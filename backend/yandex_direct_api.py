"""
Прямые API запросы к Яндекс.Музыке для получения FLAC
Использует HMAC подпись и правильные headers, как делает веб-клиент
"""
import hmac
import hashlib
import base64
import time
import requests
import subprocess
import os
from typing import Optional, Dict, List, Any
import logging

logger = logging.getLogger('yandex_direct_api')
download_logger = logging.getLogger('download')

# Проверяем наличие pycryptodome
try:
    from Crypto.Cipher import AES
    from Crypto.Util import Counter
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("⚠️  pycryptodome не установлен. Расшифровка FLAC будет недоступна.")


class YandexMusicDirectAPI:
    """Прямой API клиент для Яндекс.Музыки с поддержкой FLAC"""
    
    # Secret key для HMAC подписи (из исследования десктопного клиента)
    SECRET_KEY = 'kzqU4XhfCaY6B6JTHODeq5'
    
    # API endpoints
    API_BASE = 'https://api.music.yandex.net'
    GET_FILE_INFO_ENDPOINT = f'{API_BASE}/get-file-info'
    
    def __init__(self, token: str, token_type: str = 'session_id'):
        """
        Инициализация клиента
        
        Args:
            token: Токен авторизации (Session_id или OAuth)
            token_type: Тип токена ('session_id' или 'oauth')
        """
        self.token = token
        self.token_type = token_type
        self.session = requests.Session()
        
        # Базовые headers как в браузере
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'ru',
            'Origin': 'https://music.yandex.ru',
            'Referer': 'https://music.yandex.ru/',
        })
        
        # Настройка аутентификации в зависимости от типа токена
        if token_type == 'oauth' or token.startswith('y0_') or token.startswith('AgAAAA'):
            # OAuth токен - добавляем в header Authorization
            self.session.headers['Authorization'] = f'OAuth {token}'
            logger.info("✅ YandexMusicDirectAPI инициализирован с OAuth токеном")
        else:
            # Session_id токен - добавляем в cookies
            self.session.cookies.set('Session_id', token, domain='.yandex.ru')
            logger.info("✅ YandexMusicDirectAPI инициализирован с Session_id токеном")
    
    def _generate_hmac_sign(self, timestamp: int, track_id: str, quality: str) -> str:
        """
        Генерирует HMAC-SHA256 подпись для запроса (согласно Rust реализации)
        
        Args:
            timestamp: Unix timestamp
            track_id: ID трека
            quality: Качество (lossless, hq, nq)
            
        Returns:
            Base64 encoded подпись
        """
        # Формируем строку для подписи ТОЧНО как в Rust коде:
        # Format: "{timestamp}{trackId}{quality}flacaache-aacmp3flac-mp4aac-mp4he-aac-mp4encraw"
        # Обратите внимание: кодеки БЕЗ запятых и дефисов, transport = encraw
        data_to_sign = f"{timestamp}{track_id}{quality}flacaache-aacmp3flac-mp4aac-mp4he-aac-mp4encraw"
        
        # Создаём HMAC-SHA256
        signature = hmac.new(
            self.SECRET_KEY.encode('utf-8'),
            data_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        # Кодируем в base64 и убираем последний символ '='
        sign = base64.b64encode(signature).decode('utf-8').rstrip('=')
        
        download_logger.debug(f"🔐 HMAC signature: {data_to_sign} -> {sign[:20]}...")
        
        return sign
    
    def get_download_info(self, track_id: str, quality: str = 'lossless') -> Optional[List[Dict[str, Any]]]:
        """
        Получает информацию о доступных форматах для скачивания
        
        Args:
            track_id: ID трека
            quality: Качество (lossless, hq, nq)
            
        Returns:
            Список доступных форматов или None при ошибке
        """
        try:
            # Текущий timestamp
            timestamp = int(time.time())
            
            # Генерируем подпись с качеством (как в Rust коде)
            sign = self._generate_hmac_sign(timestamp, track_id, quality)
            
            # Параметры запроса ТОЧНО как в Rust коде
            # Обратите внимание: codecs БЕЗ запятых, transport = encraw
            params = {
                'ts': timestamp,
                'trackId': track_id,
                'quality': quality,
                'codecs': 'flac,aac,he-aac,mp3,flac-mp4,aac-mp4,he-aac-mp4',
                'transports': 'encraw',  # ИЗМЕНЕНО: было 'raw', теперь 'encraw'
                'sign': sign
            }
            
            # Специальные headers для API
            # Для OAuth используем headers десктопного клиента (версия 5.23.2 как в Rust)
            if self.token_type == 'oauth' or self.token.startswith('y0_') or self.token.startswith('AgAAAA'):
                headers = {
                    'X-Yandex-Music-Client': 'YandexMusicDesktopAppWindows/5.23.2',
                }
            else:
                headers = {
                    'x-requested-with': 'XMLHttpRequest',
                    'x-retpath-y': 'https://music.yandex.ru/',
                    'x-yandex-music-client': 'YandexMusicWebNext/1.0.0',
                    'x-yandex-music-without-invocation-info': '1',
                }
            
            download_logger.info(f"🌐 Запрос к API: track_id={track_id}, quality={quality}")
            download_logger.debug(f"   URL: {self.GET_FILE_INFO_ENDPOINT}")
            download_logger.debug(f"   Params: {params}")
            
            # Выполняем запрос
            response = self.session.get(
                self.GET_FILE_INFO_ENDPOINT,
                params=params,
                headers=headers,
                timeout=30
            )
            
            # Проверяем статус
            if response.status_code != 200:
                download_logger.error(f"❌ API вернул статус {response.status_code}")
                download_logger.error(f"   Response: {response.text[:500]}")
                return None
            
            # Парсим JSON
            data = response.json()
            
            download_logger.info(f"📦 Полный ответ API (первые 2000 символов): {str(data)[:2000]}")
            download_logger.debug(f"📦 Полный ответ API: {data}")
            
            # Согласно Rust коду, API возвращает объект с полем result
            # result содержит объект с полем downloadInfo
            if not data:
                download_logger.error(f"❌ Пустой ответ API")
                return None
            
            # Проверяем разные форматы ответа
            result = None
            if isinstance(data, list):
                # Прямой список форматов
                result = data
                download_logger.info(f"✅ API вернул список из {len(result)} элементов")
            elif 'result' in data:
                result_data = data['result']
                download_logger.debug(f"   Тип result: {type(result_data)}")
                download_logger.debug(f"   Ключи result (если dict): {list(result_data.keys()) if isinstance(result_data, dict) else 'N/A'}")
                
                if isinstance(result_data, dict) and 'downloadInfo' in result_data:
                    # Формат: {result: {downloadInfo: {...}}}
                    result = [result_data['downloadInfo']]
                    download_logger.info(f"✅ API вернул downloadInfo в формате dict")
                elif isinstance(result_data, dict) and 'downloadInfoUrl' in result_data:
                    # Альтернативный формат с downloadInfoUrl
                    result = [result_data]
                    download_logger.info(f"✅ API вернул формат с downloadInfoUrl")
                elif isinstance(result_data, list):
                    # Формат: {result: [...]}
                    result = result_data
                    download_logger.info(f"✅ API вернул {len(result)} форматов в списке")
                elif isinstance(result_data, dict):
                    # Может быть что result_data это уже один формат
                    result = [result_data]
                    download_logger.info(f"✅ API вернул один формат в result dict")
                else:
                    download_logger.error(f"❌ Неизвестный формат result: {type(result_data)}")
                    download_logger.error(f"   Содержимое: {result_data}")
                    return None
            elif isinstance(data, dict) and 'downloadInfo' in data:
                # Прямой формат с downloadInfo на верхнем уровне
                result = [data['downloadInfo']]
                download_logger.info(f"✅ API вернул downloadInfo на верхнем уровне")
            elif isinstance(data, dict):
                # Может быть что data это уже один формат
                result = [data]
                download_logger.info(f"✅ API вернул один формат на верхнем уровне")
            else:
                download_logger.error(f"❌ Некорректный формат ответа API: {type(data)}")
                download_logger.error(f"   Содержимое: {str(data)[:500]}")
                return None
            
            # Преобразуем в удобный формат
            formats = []
            for idx, item in enumerate(result):
                if not isinstance(item, dict):
                    download_logger.warning(f"⚠️  Пропускаем элемент {idx} неправильного типа: {type(item)}")
                    download_logger.debug(f"   Содержимое: {item}")
                    continue
                
                download_logger.debug(f"   Обрабатываем формат {idx+1}: {list(item.keys())}")
                
                # Получаем URL - может быть либо прямая ссылка (url), либо downloadInfoUrl, либо downloadInfoUrl
                download_url = item.get('url') or item.get('downloadInfoUrl') or item.get('download_info_url') or ''
                
                # Получаем кодек - проверяем разные варианты названий полей
                codec = (item.get('codec') or item.get('codecName') or '').lower()
                
                # Получаем битрейт - проверяем разные варианты
                bitrate = (item.get('bitrateInKbps') or 
                          item.get('bitrate_in_kbps') or 
                          item.get('bitrate') or 
                          item.get('bitrateInKbps') or 0)
                
                format_info = {
                    'codec': codec,
                    'bitrate_in_kbps': bitrate if isinstance(bitrate, int) else int(bitrate) if bitrate else 0,
                    'download_info_url': download_url,
                    'direct_link': download_url if download_url and download_url.startswith('https://strm') else None,
                    'direct': item.get('direct', download_url.startswith('https://strm') if download_url else False),
                    'key': item.get('key', ''),  # Ключ для расшифровки (если transport=encraw)
                    'transport': item.get('transport', ''),  # encraw = зашифровано
                }
                
                # Дополнительная диагностика - проверяем наличие flac в любых полях
                flac_indicator = False
                for key, value in item.items():
                    if isinstance(value, str) and 'flac' in value.lower():
                        flac_indicator = True
                        download_logger.debug(f"      🔍 Обнаружен 'flac' в поле '{key}': {value[:100]}")
                
                if flac_indicator and codec not in ['flac', 'flac-mp4']:
                    download_logger.warning(
                        f"   ⚠️  FLAC индикатор найден, но кодек указан как: {codec.upper()}"
                    )
                    # Попробуем определить кодек по содержимому URL
                    if download_url and 'flac' in download_url.lower():
                        format_info['codec'] = 'flac'
                        download_logger.info(f"      ✅ Исправлен кодек на 'flac' на основе URL")
                
                formats.append(format_info)
                
                log_msg = (
                    f"   • {format_info['codec'].upper()}: "
                    f"{format_info['bitrate_in_kbps']} kbps "
                    f"transport={format_info['transport']} "
                    f"{'(direct)' if format_info['direct'] else ''}"
                )
                if flac_indicator or 'flac' in codec:
                    log_msg += " [FLAC!]"
                download_logger.info(log_msg)
            
            return formats if formats else None
            
        except requests.RequestException as e:
            download_logger.error(f"❌ Ошибка сети при запросе к API: {e}")
            return None
        except Exception as e:
            download_logger.error(f"❌ Неожиданная ошибка при запросе к API: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            return None
    
    def get_direct_download_link(self, download_info_url: str) -> Optional[str]:
        """
        Получает прямую ссылку для скачивания из downloadInfoUrl
        
        Args:
            download_info_url: URL для получения информации о скачивании
            
        Returns:
            Прямая ссылка на файл или None при ошибке
        """
        try:
            download_logger.info(f"🔗 Получаем прямую ссылку...")
            
            # Запрашиваем информацию о скачивании
            response = self.session.get(download_info_url, timeout=30)
            
            if response.status_code != 200:
                download_logger.error(f"❌ Ошибка получения ссылки: статус {response.status_code}")
                return None
            
            # XML ответ содержит прямую ссылку
            xml_content = response.text
            
            # Простой парсинг XML (ищем host, path, ts, s)
            import xml.etree.ElementTree as ET
            
            root = ET.fromstring(xml_content)
            
            host = root.find('host')
            path = root.find('path')
            ts = root.find('ts')
            s = root.find('s')
            
            if not all([host, path, ts, s]):
                download_logger.error(f"❌ Некорректный XML ответ")
                return None
            
            # Формируем прямую ссылку
            # Формат: https://{host}/get-mp3/{s}/{ts}{path}
            direct_link = f"https://{host.text}/get-mp3/{s.text}/{ts.text}{path.text}"
            
            download_logger.info(f"✅ Прямая ссылка получена")
            download_logger.debug(f"   Link: {direct_link[:100]}...")
            
            return direct_link
            
        except Exception as e:
            download_logger.error(f"❌ Ошибка получения прямой ссылки: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            return None
    
    def download_track(self, track_id: str, output_path: str, quality: str = 'lossless') -> bool:
        """
        Скачивает трек в указанный файл
        
        Args:
            track_id: ID трека
            output_path: Путь для сохранения файла
            quality: Качество (lossless, hq, nq)
            
        Returns:
            True если скачивание успешно
        """
        try:
            # Получаем информацию о форматах
            formats = self.get_download_info(track_id, quality)
            
            if not formats:
                download_logger.error("❌ Не удалось получить информацию о форматах")
                return False
            
            # Выбираем формат
            selected_format = None
            
            if quality == 'lossless':
                # Ищем FLAC
                for fmt in formats:
                    if fmt['codec'] == 'flac':
                        selected_format = fmt
                        download_logger.info(f"✅ FLAC найден! {fmt['bitrate_in_kbps']} kbps")
                        break
            
            if not selected_format:
                # Берём формат с максимальным битрейтом
                selected_format = max(formats, key=lambda x: x['bitrate_in_kbps'])
                download_logger.warning(
                    f"⚠️  FLAC недоступен, выбран {selected_format['codec'].upper()} "
                    f"({selected_format['bitrate_in_kbps']} kbps)"
                )
            
            # Получаем прямую ссылку
            download_url = self.get_direct_download_link(selected_format['download_info_url'])
            
            if not download_url:
                download_logger.error("❌ Не удалось получить ссылку на скачивание")
                return False
            
            # Скачиваем файл
            download_logger.info(f"📥 Начинаем скачивание...")
            
            response = self.session.get(download_url, stream=True, timeout=60)
            
            if response.status_code != 200:
                download_logger.error(f"❌ Ошибка скачивания: статус {response.status_code}")
                return False
            
            # Сохраняем файл
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
            
            download_logger.info(f"✅ Файл успешно скачан!")
            download_logger.info(f"   Размер: {downloaded / (1024 * 1024):.2f} МБ")
            download_logger.info(f"   Путь: {output_path}")
            
            return True
            
        except Exception as e:
            download_logger.error(f"❌ Ошибка скачивания трека: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            return False
    
    def decrypt_track(self, encrypted_path: str, decrypted_path: str, key: str) -> bool:
        """
        Расшифровывает зашифрованный FLAC файл (transport=encraw)
        Улучшено для работы с удаленными NAS (Synology и др.)
        
        Args:
            encrypted_path: Путь к зашифрованному файлу
            decrypted_path: Путь для сохранения расшифрованного файла
            key: Hex-ключ для расшифровки
            
        Returns:
            True если успешно
        """
        if not CRYPTO_AVAILABLE:
            download_logger.error("❌ pycryptodome не установлен. Установите: pip install pycryptodome")
            return False
        
        import tempfile
        import shutil
        
        # Для удаленных NAS используем временный файл в /tmp, затем перемещаем
        use_temp_file = False
        temp_decrypted = None
        
        try:
            # Проверяем, является ли путь сетевым (NAS)
            is_network_path = any(
                encrypted_path.startswith(prefix) 
                for prefix in ['/mnt/', '/run/user/', 'smb://', 'nfs://', 'cifs://']
            ) or ':' in decrypted_path.split('/')[0] if '/' in decrypted_path else False
            
            if is_network_path:
                download_logger.info(f"🌐 Обнаружен сетевой путь, используем временный файл для расшифровки")
                use_temp_file = True
                # Создаем временный файл в /tmp
                temp_dir = tempfile.gettempdir()
                temp_decrypted = os.path.join(
                    temp_dir, 
                    f"decrypt_{os.path.basename(decrypted_path)}"
                )
            
            download_logger.info(f"🔓 Расшифровываем FLAC файл...")
            download_logger.info(f"   Входной файл: {encrypted_path}")
            download_logger.info(f"   Выходной файл: {decrypted_path if not use_temp_file else temp_decrypted}")
            
            # Проверяем права доступа к входному файлу
            if not os.path.exists(encrypted_path):
                download_logger.error(f"❌ Зашифрованный файл не найден: {encrypted_path}")
                return False
            
            try:
                # Проверяем права на чтение
                os.access(encrypted_path, os.R_OK)
            except PermissionError as e:
                download_logger.error(f"❌ Нет прав на чтение файла {encrypted_path}: {e}")
                return False
            
            # Читаем зашифрованный файл с обработкой ошибок
            try:
                with open(encrypted_path, 'rb') as f:
                    encrypted_data = bytearray(f.read())
            except PermissionError as e:
                download_logger.error(f"❌ Ошибка доступа при чтении файла: {e}")
                return False
            except OSError as e:
                download_logger.error(f"❌ Ошибка файловой системы при чтении: {e}")
                return False
            
            download_logger.info(f"   Размер зашифрованного файла: {len(encrypted_data) / (1024*1024):.2f} МБ")
            
            # Конвертируем hex-ключ в bytes
            try:
                key_bytes = bytes.fromhex(key)
            except ValueError as e:
                download_logger.error(f"❌ Неверный формат ключа: {e}")
                return False
            
            if len(key_bytes) != 16:
                download_logger.error(f"❌ Ключ должен быть 16 байт, получено: {len(key_bytes)}")
                return False
            
            # В AES CTR mode нужен counter, а не nonce
            from Crypto.Util import Counter
            
            # Создаём counter из 128 нулевых бит
            ctr = Counter.new(128, initial_value=0)
            
            # Создаём AES-128-CTR cipher
            cipher = AES.new(key_bytes, AES.MODE_CTR, counter=ctr)
            
            # Расшифровываем
            decrypted_data = cipher.decrypt(bytes(encrypted_data))
            
            # Сохраняем расшифрованный файл
            output_file = temp_decrypted if use_temp_file else decrypted_path
            
            # Создаем директорию для выходного файла, если её нет
            output_dir = os.path.dirname(output_file)
            if output_dir and not os.path.exists(output_dir):
                try:
                    os.makedirs(output_dir, exist_ok=True)
                except (PermissionError, OSError) as e:
                    download_logger.error(f"❌ Не удалось создать директорию {output_dir}: {e}")
                    return False
            
            # Записываем файл с retry логикой для сетевых файловых систем
            max_write_retries = 3
            for attempt in range(max_write_retries):
                try:
                    # Используем атомарную запись: сначала пишем во временный файл, затем переименовываем
                    temp_output = output_file + '.tmp'
                    
                    with open(temp_output, 'wb') as f:
                        f.write(decrypted_data)
                    
                    # Атомарное переименование (работает на большинстве файловых систем)
                    os.rename(temp_output, output_file)
                    
                    download_logger.info(f"✅ Файл успешно расшифрован!")
                    break
                    
                except PermissionError as e:
                    if attempt < max_write_retries - 1:
                        download_logger.warning(
                            f"⚠️  Ошибка прав доступа при записи (попытка {attempt + 1}/{max_write_retries}): {e}"
                        )
                        import time
                        time.sleep(1)  # Небольшая задержка перед повтором
                    else:
                        download_logger.error(f"❌ Не удалось записать файл после {max_write_retries} попыток: {e}")
                        return False
                except OSError as e:
                    if attempt < max_write_retries - 1:
                        download_logger.warning(
                            f"⚠️  Ошибка файловой системы при записи (попытка {attempt + 1}/{max_write_retries}): {e}"
                        )
                        import time
                        time.sleep(1)
                    else:
                        download_logger.error(f"❌ Ошибка файловой системы после {max_write_retries} попыток: {e}")
                        return False
            
            # Если использовали временный файл, перемещаем на NAS
            if use_temp_file and os.path.exists(temp_decrypted):
                try:
                    # Создаем директорию на NAS, если её нет
                    nas_dir = os.path.dirname(decrypted_path)
                    if nas_dir and not os.path.exists(nas_dir):
                        os.makedirs(nas_dir, exist_ok=True)
                    
                    # Перемещаем файл на NAS
                    shutil.move(temp_decrypted, decrypted_path)
                    download_logger.info(f"✅ Файл перемещен на NAS: {decrypted_path}")
                except (PermissionError, OSError, shutil.Error) as e:
                    download_logger.error(f"❌ Не удалось переместить файл на NAS: {e}")
                    # Оставляем файл во временной директории для ручной обработки
                    download_logger.warning(f"⚠️  Расшифрованный файл оставлен в: {temp_decrypted}")
                    return False
            
            return True
            
        except Exception as e:
            download_logger.error(f"❌ Ошибка расшифровки: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            
            # Очищаем временные файлы при ошибке
            if temp_decrypted and os.path.exists(temp_decrypted):
                try:
                    os.remove(temp_decrypted)
                except:
                    pass
            
            return False
    
    def mux_to_flac(self, input_path: str, output_path: str) -> bool:
        """
        Конвертирует MP4 контейнер в FLAC используя ffmpeg
        Улучшено для работы с удаленными NAS (Synology и др.)
        
        Args:
            input_path: Путь к входному файлу (MP4 с FLAC кодеком)
            output_path: Путь для сохранения FLAC файла
            
        Returns:
            True если успешно
        """
        import tempfile
        import shutil
        
        # Для удаленных NAS используем временный файл в /tmp, затем перемещаем
        use_temp_file = False
        temp_output = None
        
        try:
            # Проверяем, является ли путь сетевым (NAS)
            is_network_path = any(
                output_path.startswith(prefix) 
                for prefix in ['/mnt/', '/run/user/', 'smb://', 'nfs://', 'cifs://']
            ) or ':' in output_path.split('/')[0] if '/' in output_path else False
            
            if is_network_path:
                download_logger.info(f"🌐 Обнаружен сетевой путь, используем временный файл для конвертации")
                use_temp_file = True
                # Создаем временный файл в /tmp
                temp_dir = tempfile.gettempdir()
                temp_output = os.path.join(
                    temp_dir, 
                    f"mux_{os.path.basename(output_path)}"
                )
            
            download_logger.info(f"🔧 Конвертируем в FLAC...")
            download_logger.info(f"   Входной файл: {input_path}")
            download_logger.info(f"   Выходной файл: {output_path if not use_temp_file else temp_output}")
            
            # Проверяем входной файл
            if not os.path.exists(input_path):
                download_logger.error(f"❌ Входной файл не найден: {input_path}")
                return False
            
            try:
                os.access(input_path, os.R_OK)
            except PermissionError as e:
                download_logger.error(f"❌ Нет прав на чтение файла {input_path}: {e}")
                return False
            
            # Определяем выходной файл
            output_file = temp_output if use_temp_file else output_path
            
            # Создаем директорию для выходного файла, если её нет
            output_dir = os.path.dirname(output_file)
            if output_dir and not os.path.exists(output_dir):
                try:
                    os.makedirs(output_dir, exist_ok=True)
                except (PermissionError, OSError) as e:
                    download_logger.error(f"❌ Не удалось создать директорию {output_dir}: {e}")
                    return False
            
            # Увеличиваем timeout для сетевых файловых систем
            timeout = 120 if is_network_path else 60
            
            # ffmpeg -i input.mp4 -c:a copy output.flac
            # Используем -loglevel error для уменьшения вывода
            result = subprocess.run(
                ['ffmpeg', '-i', input_path, '-c:a', 'copy', output_file, '-y', '-loglevel', 'error'],
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            if result.returncode == 0:
                download_logger.info(f"✅ Конвертация завершена!")
                
                # Если использовали временный файл, перемещаем на NAS
                if use_temp_file and os.path.exists(temp_output):
                    try:
                        # Проверяем размер файла
                        file_size = os.path.getsize(temp_output)
                        if file_size == 0:
                            download_logger.error(f"❌ Результирующий файл пуст!")
                            os.remove(temp_output)
                            return False
                        
                        # Создаем директорию на NAS, если её нет
                        nas_dir = os.path.dirname(output_path)
                        if nas_dir and not os.path.exists(nas_dir):
                            os.makedirs(nas_dir, exist_ok=True)
                        
                        # Перемещаем файл на NAS с retry
                        max_move_retries = 3
                        for attempt in range(max_move_retries):
                            try:
                                shutil.move(temp_output, output_path)
                                download_logger.info(f"✅ Файл перемещен на NAS: {output_path}")
                                break
                            except (PermissionError, OSError, shutil.Error) as e:
                                if attempt < max_move_retries - 1:
                                    download_logger.warning(
                                        f"⚠️  Ошибка перемещения файла (попытка {attempt + 1}/{max_move_retries}): {e}"
                                    )
                                    import time
                                    time.sleep(2)
                                else:
                                    download_logger.error(f"❌ Не удалось переместить файл на NAS: {e}")
                                    download_logger.warning(f"⚠️  Файл оставлен в: {temp_output}")
                                    return False
                    except Exception as e:
                        download_logger.error(f"❌ Ошибка при перемещении файла: {e}")
                        if os.path.exists(temp_output):
                            download_logger.warning(f"⚠️  Файл оставлен в: {temp_output}")
                        return False
                
                return True
            else:
                download_logger.error(f"❌ ffmpeg вернул ошибку: {result.stderr}")
                # Удаляем временный файл при ошибке
                if use_temp_file and temp_output and os.path.exists(temp_output):
                    try:
                        os.remove(temp_output)
                    except:
                        pass
                return False
                
        except FileNotFoundError:
            download_logger.error("❌ ffmpeg не найден. Установите: sudo apt install ffmpeg")
            return False
        except subprocess.TimeoutExpired:
            download_logger.error(f"❌ Timeout при конвертации (превышен лимит {timeout} секунд)")
            # Удаляем временный файл при timeout
            if use_temp_file and temp_output and os.path.exists(temp_output):
                try:
                    os.remove(temp_output)
                except:
                    pass
            return False
        except PermissionError as e:
            download_logger.error(f"❌ Ошибка прав доступа при конвертации: {e}")
            return False
        except OSError as e:
            download_logger.error(f"❌ Ошибка файловой системы при конвертации: {e}")
            return False
        except Exception as e:
            download_logger.error(f"❌ Ошибка конвертации: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            return False

