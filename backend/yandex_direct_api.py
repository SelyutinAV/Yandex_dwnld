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
            
            download_logger.debug(f"📦 Полный ответ API: {data}")
            
            # Согласно Rust коду, API возвращает объект с полем result
            # result содержит объект с полем downloadInfo
            if not data:
                download_logger.error(f"❌ Пустой ответ API")
                return None
            
            # Проверяем разные форматы ответа
            if isinstance(data, list):
                # Прямой список форматов
                result = data
                download_logger.info(f"✅ API вернул список из {len(result)} элементов")
            elif 'result' in data:
                result_data = data['result']
                if isinstance(result_data, dict) and 'downloadInfo' in result_data:
                    # Формат: {result: {downloadInfo: {...}}}
                    result = [result_data['downloadInfo']]
                    download_logger.info(f"✅ API вернул downloadInfo")
                elif isinstance(result_data, list):
                    # Формат: {result: [...]}
                    result = result_data
                    download_logger.info(f"✅ API вернул {len(result)} форматов")
                else:
                    download_logger.error(f"❌ Неизвестный формат result: {type(result_data)}")
                    return None
            else:
                download_logger.error(f"❌ Некорректный ответ API: {data}")
                return None
            
            # Преобразуем в удобный формат
            formats = []
            for item in result:
                if not isinstance(item, dict):
                    download_logger.warning(f"⚠️  Пропускаем элемент неправильного типа: {type(item)}")
                    continue
                    
                # Получаем URL - может быть либо прямая ссылка (url), либо downloadInfoUrl
                download_url = item.get('url', item.get('downloadInfoUrl', ''))
                
                format_info = {
                    'codec': item.get('codec', '').lower(),
                    'bitrate_in_kbps': item.get('bitrateInKbps', item.get('bitrate', 0)),
                    'download_info_url': download_url,
                    'direct_link': download_url if download_url.startswith('https://strm') else None,
                    'direct': item.get('direct', download_url.startswith('https://strm')),
                    'key': item.get('key', ''),  # Ключ для расшифровки (если transport=encraw)
                    'transport': item.get('transport', ''),  # encraw = зашифровано
                }
                
                formats.append(format_info)
                
                download_logger.info(
                    f"   • {format_info['codec'].upper()}: "
                    f"{format_info['bitrate_in_kbps']} kbps "
                    f"{'(direct)' if format_info['direct'] else ''}"
                )
            
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
        
        try:
            download_logger.info(f"🔓 Расшифровываем FLAC файл...")
            
            # Читаем зашифрованный файл
            with open(encrypted_path, 'rb') as f:
                encrypted_data = bytearray(f.read())
            
            # Конвертируем hex-ключ в bytes
            key_bytes = bytes.fromhex(key)
            
            if len(key_bytes) != 16:
                raise ValueError(f"Ключ должен быть 16 байт, получено: {len(key_bytes)}")
            
            # В AES CTR mode нужен counter, а не nonce
            # Counter состоит из 16 байт (128 бит), все нули как в Rust коде
            from Crypto.Util import Counter
            
            # Создаём counter из 128 нулевых бит
            ctr = Counter.new(128, initial_value=0)
            
            # Создаём AES-128-CTR cipher
            cipher = AES.new(key_bytes, AES.MODE_CTR, counter=ctr)
            
            # Расшифровываем
            decrypted_data = cipher.decrypt(bytes(encrypted_data))
            
            # Сохраняем расшифрованный файл
            with open(decrypted_path, 'wb') as f:
                f.write(decrypted_data)
            
            download_logger.info(f"✅ Файл успешно расшифрован!")
            return True
            
        except Exception as e:
            download_logger.error(f"❌ Ошибка расшифровки: {e}")
            import traceback
            download_logger.error(traceback.format_exc())
            return False
    
    def mux_to_flac(self, input_path: str, output_path: str) -> bool:
        """
        Конвертирует MP4 контейнер в FLAC используя ffmpeg
        
        Args:
            input_path: Путь к входному файлу (MP4 с FLAC кодеком)
            output_path: Путь для сохранения FLAC файла
            
        Returns:
            True если успешно
        """
        try:
            download_logger.info(f"🔧 Конвертируем в FLAC...")
            
            # ffmpeg -i input.mp4 -c:a copy output.flac
            result = subprocess.run(
                ['ffmpeg', '-i', input_path, '-c:a', 'copy', output_path, '-y'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                download_logger.info(f"✅ Конвертация завершена!")
                return True
            else:
                download_logger.error(f"❌ ffmpeg вернул ошибку: {result.stderr}")
                return False
                
        except FileNotFoundError:
            download_logger.error("❌ ffmpeg не найден. Установите: sudo apt install ffmpeg")
            return False
        except subprocess.TimeoutExpired:
            download_logger.error("❌ Timeout при конвертации")
            return False
        except Exception as e:
            download_logger.error(f"❌ Ошибка конвертации: {e}")
            return False

