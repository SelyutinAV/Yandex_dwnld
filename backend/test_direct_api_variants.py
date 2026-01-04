#!/usr/bin/env python3
"""
Тест различных вариантов запросов к прямому API
"""
import sys
import logging
from yandex_direct_api import YandexMusicDirectAPI

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)

download_logger = logging.getLogger('download')

def test_api_variants(track_id: str, token: str):
    """Тестирует различные варианты запросов к API"""
    client = YandexMusicDirectAPI(token, "oauth")
    
    print(f"\n{'='*80}")
    print(f"🔍 Тестирование различных вариантов запросов для трека: {track_id}")
    print(f"{'='*80}\n")
    
    # Вариант 1: quality=lossless (текущий)
    print("📋 Вариант 1: quality=lossless")
    formats = client.get_download_info(track_id, "lossless")
    if formats:
        for fmt in formats:
            print(f"   • {fmt.get('codec', 'unknown').upper()}: {fmt.get('bitrate_in_kbps', 0)} kbps")
    print()
    
    # Вариант 2: quality=hq
    print("📋 Вариант 2: quality=hq")
    formats = client.get_download_info(track_id, "hq")
    if formats:
        for fmt in formats:
            print(f"   • {fmt.get('codec', 'unknown').upper()}: {fmt.get('bitrate_in_kbps', 0)} kbps")
    print()
    
    # Вариант 3: Пробуем изменить параметры запроса
    print("📋 Вариант 3: Пробуем запросить только flac в codecs")
    import time
    import hmac
    import hashlib
    import base64
    import requests
    
    timestamp = int(time.time())
    
    # Генерируем подпись с только flac
    data_to_sign = f"{timestamp}{track_id}losslessflacencraw"
    signature = hmac.new(
        YandexMusicDirectAPI.SECRET_KEY.encode('utf-8'),
        data_to_sign.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sign = base64.b64encode(signature).decode('utf-8').rstrip('=')
    
    params = {
        'ts': timestamp,
        'trackId': track_id,
        'quality': 'lossless',
        'codecs': 'flac',
        'transports': 'encraw',
        'sign': sign
    }
    
    headers = {
        'X-Yandex-Music-Client': 'YandexMusicDesktopAppWindows/5.23.2',
    }
    client.session.headers.update(headers)
    
    response = client.session.get(
        'https://api.music.yandex.net/get-file-info',
        params=params,
        timeout=30
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Ответ API: {str(data)[:500]}")
        
        # Парсим ответ
        if isinstance(data, dict) and 'result' in data:
            result_data = data['result']
            if isinstance(result_data, dict) and 'downloadInfo' in result_data:
                info = result_data['downloadInfo']
                codec = info.get('codec', 'unknown')
                bitrate = info.get('bitrate', 0)
                print(f"   • {codec.upper()}: {bitrate} kbps")
            elif isinstance(result_data, list):
                for item in result_data:
                    codec = item.get('codec', 'unknown')
                    bitrate = item.get('bitrate', 0)
                    print(f"   • {codec.upper()}: {bitrate} kbps")
    else:
        print(f"   ❌ Ошибка: статус {response.status_code}")
    print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python test_direct_api_variants.py <track_id> [token]")
        sys.exit(1)
    
    track_id = sys.argv[1]
    
    # Пробуем получить токен
    token = None
    if len(sys.argv) >= 3:
        token = sys.argv[2]
    else:
        try:
            from db_manager import DatabaseManager
            db_manager = DatabaseManager()
            active_account = db_manager.get_active_account()
            if active_account:
                token = active_account.get("oauth_token") or active_account.get("session_id_token")
        except:
            pass
    
    if not token:
        print("❌ Токен не указан и не найден в базе данных")
        sys.exit(1)
    
    test_api_variants(track_id, token)

