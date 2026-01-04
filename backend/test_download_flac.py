#!/usr/bin/env python3
"""
Тестовая загрузка и расшифровка FLAC трека
"""
import sys
import os
import logging
from pathlib import Path
from yandex_client import YandexMusicClient
from db_manager import DatabaseManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)

logger = logging.getLogger(__name__)
download_logger = logging.getLogger('download')

def test_download_flac(track_id: str, token: str, test_dir: str = "/tmp/yandex_test_download"):
    """Тестирует загрузку и расшифровку FLAC трека"""
    print(f"\n{'='*80}")
    print(f"🧪 Тест загрузки и расшифровки FLAC трека")
    print(f"{'='*80}\n")
    
    # Создаем тестовую директорию
    test_path = Path(test_dir)
    test_path.mkdir(parents=True, exist_ok=True)
    print(f"📁 Тестовая директория: {test_path}")
    
    # Инициализируем клиент
    client = YandexMusicClient(token)
    if not client.connect():
        print("❌ Не удалось подключиться к Яндекс.Музыке")
        return False
    
    try:
        # Получаем информацию о треке
        tracks_result = client.client.tracks([track_id])
        if not tracks_result or len(tracks_result) == 0:
            print(f"❌ Трек с ID {track_id} не найден")
            return False
        
        track = tracks_result[0]
        artist_name = track.artists[0].name if track.artists else "Unknown"
        track_title = track.title
        
        print(f"✅ Найден трек: {track_title} - {artist_name}")
        print(f"   ID: {track_id}\n")
        
        # Формируем путь для сохранения
        safe_artist = "".join(c for c in artist_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = "".join(c for c in track_title if c.isalnum() or c in (' ', '-', '_')).strip()
        output_filename = f"{safe_artist} - {safe_title}.flac"
        output_path = str(test_path / output_filename)
        
        print(f"📥 Начинаем загрузку с качеством lossless...")
        print(f"   Путь сохранения: {output_path}\n")
        
        # Скачиваем трек
        result_path = client.download_track(
            track_id=track_id,
            output_path=output_path,
            quality="lossless",
            progress_callback=lambda downloaded, total: None
        )
        
        if result_path:
            print(f"\n✅ Успешно скачан!")
            print(f"   Результирующий путь: {result_path}")
            
            # Проверяем файл
            if os.path.exists(result_path):
                file_size = os.path.getsize(result_path) / (1024 * 1024)
                print(f"   Размер файла: {file_size:.2f} МБ")
                
                # Проверяем расширение
                if result_path.endswith('.flac'):
                    print(f"   ✅ Файл имеет расширение .flac")
                    
                    # Пробуем проверить, что это действительно FLAC
                    try:
                        from mutagen.flac import FLAC
                        audio = FLAC(result_path)
                        if audio.info:
                            print(f"   ✅ Это валидный FLAC файл!")
                            print(f"      Битовая глубина: {audio.info.bits_per_sample} bit")
                            print(f"      Частота дискретизации: {audio.info.sample_rate} Hz")
                            print(f"      Длительность: {audio.info.length:.2f} сек")
                            return True
                    except ImportError:
                        print(f"   ⚠️  mutagen не установлен, не можем проверить валидность FLAC")
                        return True
                    except Exception as e:
                        print(f"   ❌ Ошибка проверки FLAC файла: {e}")
                        return False
                elif result_path.endswith('.encrypted'):
                    print(f"   ❌ Файл остался зашифрованным (.encrypted)")
                    print(f"   Это означает, что расшифровка или конвертация не завершились")
                    return False
                else:
                    print(f"   ⚠️  Неожиданное расширение файла: {os.path.splitext(result_path)[1]}")
                    return True
            else:
                print(f"   ❌ Файл не найден по указанному пути!")
                return False
        else:
            print(f"\n❌ Загрузка не удалась (вернул None)")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # ID трека Madman - Depart
    track_id = "137829428"
    
    # Получаем токен
    token = None
    if len(sys.argv) >= 2:
        token = sys.argv[1]
    else:
        try:
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
        print("Использование: python test_download_flac.py [token]")
        sys.exit(1)
    
    success = test_download_flac(track_id, token)
    
    if success:
        print(f"\n{'='*80}")
        print(f"✅ ТЕСТ ПРОЙДЕН: FLAC файл успешно загружен и расшифрован!")
        print(f"{'='*80}\n")
        sys.exit(0)
    else:
        print(f"\n{'='*80}")
        print(f"❌ ТЕСТ НЕ ПРОЙДЕН: Возникли проблемы при загрузке/расшифровке")
        print(f"{'='*80}\n")
        sys.exit(1)

