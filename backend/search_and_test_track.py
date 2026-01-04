#!/usr/bin/env python3
"""
Поиск трека по названию и исполнителю и проверка доступности FLAC
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

def search_and_test_track(track_title: str, artist_name: str, token: str):
    """Ищет трек через поиск и проверяет доступность FLAC"""
    print(f"\n{'='*80}")
    print(f"🔍 Поиск трека: {track_title} - {artist_name}")
    print(f"{'='*80}\n")
    
    # Инициализируем клиент
    client = YandexMusicClient(token)
    if not client.connect():
        print("❌ Не удалось подключиться к Яндекс.Музыке")
        return
    
    try:
        # Ищем трек через поиск
        search_query = f"{artist_name} {track_title}"
        print(f"🔍 Поиск по запросу: {search_query}")
        
        search_results = client.client.search(search_query, type_='track')
        
        if not search_results or not hasattr(search_results, 'tracks') or not search_results.tracks:
            print(f"❌ Результаты поиска не найдены")
            return
        
        tracks = search_results.tracks.results if hasattr(search_results.tracks, 'results') else []
        
        if not tracks:
            print(f"❌ Треки не найдены")
            return
        
        print(f"✅ Найдено треков: {len(tracks)}")
        
        # Ищем нужный трек
        target_track = None
        for track in tracks:
            track_title_lower = track.title.lower() if track.title else ""
            track_artist = track.artists[0].name.lower() if track.artists else ""
            
            if (track_title.lower() in track_title_lower and 
                artist_name.lower() in track_artist):
                target_track = track
                print(f"\n✅ Найден трек:")
                print(f"   Название: {track.title}")
                print(f"   Исполнитель: {track.artists[0].name if track.artists else 'Unknown'}")
                print(f"   ID: {track.id}")
                break
        
        if not target_track:
            print(f"\n❌ Точное совпадение не найдено")
            print("\nНайденные треки (первые 5):")
            for track in tracks[:5]:
                print(f"  - {track.title} - {track.artists[0].name if track.artists else 'Unknown'} (ID: {track.id})")
            
            # Пробуем найти по частичному совпадению
            for track in tracks:
                if track_title.lower() in track.title.lower() if track.title else False:
                    target_track = track
                    print(f"\n⚠️  Используем частичное совпадение:")
                    print(f"   Название: {track.title}")
                    print(f"   Исполнитель: {track.artists[0].name if track.artists else 'Unknown'}")
                    print(f"   ID: {track.id}")
                    break
        
        if not target_track:
            return
        
        # Запускаем тест форматов для найденного трека
        track_id = str(target_track.id)
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
        print("Использование: python search_and_test_track.py [token]")
        sys.exit(1)
    
    search_and_test_track(track_title, artist_name, token)

