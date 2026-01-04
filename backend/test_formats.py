#!/usr/bin/env python3
"""
Тестовый скрипт для проверки доступности FLAC форматов
"""
import sys
import json
import logging
from yandex_client import YandexMusicClient
from yandex_direct_api import YandexMusicDirectAPI

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)

logger = logging.getLogger(__name__)
download_logger = logging.getLogger('download')

def test_track_formats(track_id: str, token: str):
    """Тестирует доступные форматы для трека"""
    print(f"\n{'='*80}")
    print(f"🔍 Тестирование трека ID: {track_id}")
    print(f"{'='*80}\n")
    
    # Инициализируем клиенты
    client = YandexMusicClient(token)
    if not client.connect():
        print("❌ Не удалось подключиться к Яндекс.Музыке")
        return
    
    # Получаем информацию о треке
    try:
        tracks_result = client.client.tracks([track_id])
        if not tracks_result or len(tracks_result) == 0:
            print(f"❌ Трек с ID {track_id} не найден")
            return
        
        track = tracks_result[0]
        artist_name = track.artists[0].name if track.artists else "Unknown"
        print(f"✅ Найден трек: {track.title} - {artist_name}\n")
    except Exception as e:
        print(f"❌ Ошибка получения трека: {e}")
        return
    
    # ТЕСТ 1: Стандартный API (yandex-music библиотека)
    print(f"{'─'*80}")
    print("📋 ТЕСТ 1: Стандартный API (yandex-music библиотека)")
    print(f"{'─'*80}")
    try:
        download_info = track.get_download_info(get_direct_links=True)
        print(f"✅ Получено форматов: {len(download_info)}\n")
        
        flac_found = False
        for i, info in enumerate(download_info):
            codec = info.codec
            bitrate = info.bitrate_in_kbps
            preview = getattr(info, 'preview', False)
            gain = getattr(info, 'gain', None)
            
            print(f"  Формат {i+1}:")
            print(f"    • Кодек: {codec.upper()}")
            print(f"    • Битрейт: {bitrate} kbps")
            print(f"    • Preview: {preview}")
            if gain:
                print(f"    • Gain: {gain}")
            
            # Пробуем получить прямую ссылку
            try:
                direct_link = info.get_direct_link()
                print(f"    • Прямая ссылка: {direct_link[:80]}...")
                
                # Проверяем наличие flac в ссылке
                if 'flac' in direct_link.lower():
                    print(f"    ✅ FLAC обнаружен в ссылке!")
                    flac_found = True
            except Exception as e:
                print(f"    • Ошибка получения прямой ссылки: {e}")
            
            # Выводим все атрибуты объекта
            print(f"    • Все атрибуты: {dir(info)}")
            
            # Пробуем получить сырые данные
            try:
                raw_data = info.__dict__
                print(f"    • Сырые данные: {json.dumps({k: str(v)[:50] for k, v in raw_data.items()}, indent=6, ensure_ascii=False)}")
            except:
                pass
            
            print()
        
        if not flac_found:
            print("⚠️  FLAC не найден в стандартном API\n")
        else:
            print("✅ FLAC найден в стандартном API!\n")
            
    except Exception as e:
        print(f"❌ Ошибка стандартного API: {e}")
        import traceback
        traceback.print_exc()
        print()
    
    # ТЕСТ 2: Прямой API
    print(f"{'─'*80}")
    print("📋 ТЕСТ 2: Прямой API (yandex_direct_api)")
    print(f"{'─'*80}")
    try:
        if not client.direct_api_client:
            print("⚠️  Прямой API клиент не инициализирован")
        else:
            formats = client.direct_api_client.get_download_info(track_id, "lossless")
            
            if formats:
                print(f"✅ Получено форматов: {len(formats)}\n")
                
                flac_found = False
                for i, fmt in enumerate(formats):
                    print(f"  Формат {i+1}:")
                    print(f"    • Кодек: {fmt.get('codec', 'N/A').upper()}")
                    print(f"    • Битрейт: {fmt.get('bitrate_in_kbps', 0)} kbps")
                    print(f"    • Transport: {fmt.get('transport', 'N/A')}")
                    print(f"    • Direct: {fmt.get('direct', False)}")
                    print(f"    • Прямая ссылка: {fmt.get('direct_link', 'N/A')}")
                    print(f"    • Download URL: {fmt.get('download_info_url', 'N/A')[:80]}...")
                    print(f"    • Ключ: {fmt.get('key', 'N/A')[:20]}..." if fmt.get('key') else "    • Ключ: нет")
                    
                    # Проверяем все ключи в формате
                    print(f"    • Все ключи: {list(fmt.keys())}")
                    print(f"    • Полные данные: {json.dumps(fmt, indent=6, ensure_ascii=False)}")
                    
                    if fmt.get('codec', '').lower() in ['flac', 'flac-mp4']:
                        print(f"    ✅ FLAC обнаружен!")
                        flac_found = True
                    print()
                
                if not flac_found:
                    print("⚠️  FLAC не найден в прямом API\n")
                else:
                    print("✅ FLAC найден в прямом API!\n")
            else:
                print("❌ Прямой API не вернул форматы\n")
                
    except Exception as e:
        print(f"❌ Ошибка прямого API: {e}")
        import traceback
        traceback.print_exc()
        print()
    
    # ТЕСТ 3: Проверка подписки
    print(f"{'─'*80}")
    print("📋 ТЕСТ 3: Проверка подписки")
    print(f"{'─'*80}")
    try:
        account = client.client.account_status()
        if account:
            print(f"✅ Аккаунт: {account.account.login if account.account else 'N/A'}")
            print(f"   • Plus: {account.plus}")
            print(f"   • Срок действия Plus: {account.plus_expires if hasattr(account, 'plus_expires') else 'N/A'}")
            print()
        else:
            print("⚠️  Не удалось получить информацию об аккаунте\n")
    except Exception as e:
        print(f"❌ Ошибка проверки подписки: {e}\n")

if __name__ == "__main__":
    import os
    import sys
    
    # Пробуем получить токен из базы данных, если не указан
    token = None
    if len(sys.argv) >= 3:
        track_id = sys.argv[1]
        token = sys.argv[2]
    elif len(sys.argv) >= 2:
        track_id = sys.argv[1]
        # Пробуем получить токен из базы данных
        try:
            from db_manager import DatabaseManager
            db_manager = DatabaseManager()
            
            # Сначала пробуем активный аккаунт
            active_account = db_manager.get_active_account()
            if active_account:
                token = active_account.get("oauth_token") or active_account.get("session_id_token")
                print(f"✅ Токен получен из активного аккаунта: {active_account['name']}")
            else:
                # Fallback на старую структуру
                active_token = db_manager.get_active_token()
                if active_token:
                    token = active_token["token"]
                    print(f"✅ Токен получен из базы данных (старая структура)")
                else:
                    # Пробуем из настроек
                    token = db_manager.get_setting("yandex_token")
                    if token:
                        print(f"✅ Токен получен из настроек")
        except Exception as e:
            print(f"⚠️  Не удалось получить токен из БД: {e}")
            token = None
        
        # Если не получили из БД, пробуем переменную окружения
        if not token:
            token = os.getenv("YANDEX_TOKEN")
            if token:
                print(f"✅ Токен получен из переменной окружения")
        
        if not token:
            print("❌ Токен не указан и не найден в базе данных")
            print("\nИспользование: python test_formats.py <track_id> [token]")
            print("\nПримеры track_id из логов:")
            print("  - 39882979 (Kaltes Klares Wasser - Malaria!)")
            print("  - 9531339 (L'appel - Dernière Volonté)")
            print("  - 12345678 (Smek - Ÿuma, mom)")
            sys.exit(1)
    else:
        print("Использование: python test_formats.py <track_id> [token]")
        print("\nПримеры track_id из логов:")
        print("  - 39882979 (Kaltes Klares Wasser - Malaria!)")
        print("  - 9531339 (L'appel - Dernière Volonté)")
        print("  - 12345678 (Smek - Ÿuma, mom)")
        print("\nЕсли токен не указан, будет использован токен из базы данных")
        sys.exit(1)
    
    test_track_formats(track_id, token)

