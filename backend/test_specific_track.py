#!/usr/bin/env python3
"""
Тестирование конкретного трека для проверки доступности FLAC
"""
import sys
import logging
from yandex_client import YandexMusicClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)

logger = logging.getLogger(__name__)

def find_and_test_track(playlist_name: str, track_title: str, artist_name: str, token: str):
    """Ищет трек в плейлисте и проверяет доступность FLAC"""
    print(f"\n{'='*80}")
    print(f"🔍 Поиск трека: {track_title} - {artist_name}")
    print(f"📋 В плейлисте: {playlist_name}")
    print(f"{'='*80}\n")
    
    # Инициализируем клиент
    client = YandexMusicClient(token)
    if not client.connect():
        print("❌ Не удалось подключиться к Яндекс.Музыке")
        return
    
    try:
        # Получаем все плейлисты
        playlists = client.get_playlists()
        target_playlist = None
        
        print(f"📋 Найдено плейлистов: {len(playlists)}")
        for pl in playlists:
            if playlist_name.lower() in pl['title'].lower():
                target_playlist = pl
                print(f"✅ Найден плейлист: {pl['title']}")
                break
        
        if not target_playlist:
            print(f"❌ Плейлист '{playlist_name}' не найден")
            print("\nДоступные плейлисты:")
            for pl in playlists[:10]:  # Показываем первые 10
                print(f"  - {pl['title']}")
            return
        
        # Получаем треки из плейлиста
        print(f"\n📥 Получаем треки из плейлиста...")
        tracks = client.get_playlist_tracks(target_playlist['id'])
        
        print(f"✅ Найдено треков в плейлисте: {len(tracks)}")
        
        # Ищем нужный трек
        target_track = None
        for track in tracks:
            if (track_title.lower() in track.get('title', '').lower() and 
                artist_name.lower() in track.get('artist', '').lower()):
                target_track = track
                print(f"\n✅ Найден трек:")
                print(f"   Название: {track.get('title')}")
                print(f"   Исполнитель: {track.get('artist')}")
                print(f"   ID: {track.get('id')}")
                break
        
        if not target_track:
            print(f"\n❌ Трек '{track_title}' - '{artist_name}' не найден в плейлисте")
            print("\nТреки в плейлисте (первые 10):")
            for track in tracks[:10]:
                print(f"  - {track.get('title')} - {track.get('artist')}")
            return
        
        # Запускаем тест форматов для найденного трека
        track_id = target_track.get('id')
        print(f"\n{'='*80}")
        print(f"🧪 Тестирование форматов для трека ID: {track_id}")
        print(f"{'='*80}\n")
        
        # Импортируем тестовый скрипт
        import importlib.util
        spec = importlib.util.spec_from_file_location("test_formats", "test_formats.py")
        test_formats = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(test_formats)
        
        # Запускаем тест
        test_formats.test_track_formats(track_id, token)
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Параметры поиска
    playlist_name = "Тестирование"
    track_title = "Madman"
    artist_name = "Depart"
    
    # Получаем токен
    token = None
    if len(sys.argv) >= 2:
        token = sys.argv[1]
    else:
        try:
            from db_manager import DatabaseManager
            db_manager = DatabaseManager()
            active_account = db_manager.get_active_account()
            if active_account:
                token = active_account.get("oauth_token") or active_account.get("session_id_token")
                print(f"✅ Токен получен из активного аккаунта")
        except Exception as e:
            print(f"⚠️  Не удалось получить токен из БД: {e}")
            token = None
    
    if not token:
        print("❌ Токен не указан и не найден в базе данных")
        print("Использование: python test_specific_track.py [token]")
        sys.exit(1)
    
    find_and_test_track(playlist_name, track_title, artist_name, token)

