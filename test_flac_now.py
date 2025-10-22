#!/usr/bin/env python3
"""Быстрый тест FLAC загрузки"""
import sys
import os
sys.path.insert(0, '/home/urch/Projects/yandex_downloads/backend')

from yandex_client import YandexMusicClient

# OAuth токен из базы
OAUTH_TOKEN = "AgAAAAAA1SRjAAG8XvFvavCHikT-gBsYg8mZvfU"
TEST_TRACK_ID = "68160955"
OUTPUT_DIR = "/tmp/yandex_flac_test"
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, f"test_{TEST_TRACK_ID}.flac")

print("=" * 80)
print("🧪 ТЕСТ FLAC ЗАГРУЗКИ")
print("=" * 80)

try:
    # Удаляем старый файл если есть
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)
    
    print("\n1️⃣  Инициализация...")
    client = YandexMusicClient(OAUTH_TOKEN)
    if not client.connect():
        print("❌ Не удалось подключиться")
        sys.exit(1)
    print("✅ Подключено")
    
    print("\n2️⃣  Скачивание FLAC...")
    print(f"   Track ID: {TEST_TRACK_ID}")
    print(f"   Output: {OUTPUT_FILE}")
    
    result = client.download_track(
        track_id=TEST_TRACK_ID,
        output_path=OUTPUT_FILE,
        quality='lossless'
    )
    
    if result and os.path.exists(result):
        size = os.path.getsize(result) / (1024 * 1024)
        print(f"\n✅ УСПЕХ!")
        print(f"   Файл: {result}")
        print(f"   Размер: {size:.2f} МБ")
        
        # Проверяем заголовок
        with open(result, 'rb') as f:
            header = f.read(4)
            if header == b'fLaC':
                print("   Формат: FLAC ✓")
            else:
                print(f"   Заголовок: {header}")
    else:
        print("\n❌ ОШИБКА: Файл не скачан")
        sys.exit(1)
        
except Exception as e:
    print(f"\n❌ ОШИБКА: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)

