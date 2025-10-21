"""
Модуль для управления загрузками треков
"""
import asyncio
import os
from typing import Optional, Callable
from pathlib import Path
from mutagen.flac import FLAC
from mutagen.mp3 import MP3
from mutagen.aac import AAC
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC


class DownloadManager:
    """Менеджер загрузок треков"""
    
    def __init__(self, yandex_client, download_path: str):
        """
        Инициализация менеджера загрузок
        
        Args:
            yandex_client: Клиент Яндекс.Музыки
            download_path: Путь для сохранения файлов
        """
        self.client = yandex_client
        self.download_path = Path(download_path)
        self.download_path.mkdir(parents=True, exist_ok=True)
        self.active_downloads = {}
        
    async def download_playlist(
        self,
        playlist_id: str,
        quality: str = 'lossless',
        progress_callback: Optional[Callable] = None
    ):
        """
        Скачать весь плейлист
        
        Args:
            playlist_id: ID плейлиста
            quality: Качество аудио
            progress_callback: Функция для отслеживания прогресса
        """
        # Получаем треки плейлиста
        tracks = self.client.get_playlist_tracks(playlist_id)
        total_tracks = len(tracks)
        
        results = {
            'total': total_tracks,
            'completed': 0,
            'failed': 0,
            'skipped': 0,
            'tracks': []
        }
        
        for index, track in enumerate(tracks, 1):
            if not track['available']:
                results['skipped'] += 1
                continue
            
            try:
                # Формируем путь для сохранения
                artist_folder = self._sanitize_filename(track['artist'])
                album_folder = self._sanitize_filename(
                    track['album'] or 'Unknown Album'
                )
                
                save_path = self.download_path / artist_folder / album_folder
                save_path.mkdir(parents=True, exist_ok=True)
                
                # Скачиваем трек
                file_path = self.client.download_track(
                    track['id'],
                    str(save_path),
                    quality
                )
                
                if file_path:
                    # Добавляем метаданные
                    self._add_metadata(file_path, track)
                    
                    results['completed'] += 1
                    results['tracks'].append({
                        'track_id': track['id'],
                        'title': track['title'],
                        'artist': track['artist'],
                        'file_path': file_path,
                        'status': 'completed'
                    })
                else:
                    results['failed'] += 1
                    
            except Exception as e:
                print(f"Ошибка загрузки {track['title']}: {e}")
                results['failed'] += 1
            
            # Вызываем callback для обновления прогресса
            if progress_callback:
                if asyncio.iscoroutinefunction(progress_callback):
                    await progress_callback(index, total_tracks, track)
                else:
                    progress_callback(index, total_tracks, track)
        
        return results
    
    async def download_track_async(
        self,
        track_id: str,
        track_info: dict,
        quality: str = 'lossless'
    ) -> Optional[str]:
        """
        Асинхронная загрузка одного трека
        
        Args:
            track_id: ID трека
            track_info: Информация о треке
            quality: Качество
            
        Returns:
            Путь к файлу или None
        """
        try:
            artist_folder = self._sanitize_filename(track_info['artist'])
            album_folder = self._sanitize_filename(
                track_info.get('album', 'Unknown Album')
            )
            
            save_path = self.download_path / artist_folder / album_folder
            save_path.mkdir(parents=True, exist_ok=True)
            
            file_path = self.client.download_track(
                track_id,
                str(save_path),
                quality
            )
            
            if file_path:
                self._add_metadata(file_path, track_info)
            
            return file_path
            
        except Exception as e:
            print(f"Ошибка загрузки трека {track_id}: {e}")
            return None
    
    def _sanitize_filename(self, name: str) -> str:
        """
        Очистка имени файла от недопустимых символов
        
        Args:
            name: Исходное имя
            
        Returns:
            Очищенное имя
        """
        # Удаляем или заменяем недопустимые символы
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            name = name.replace(char, '_')
        
        # Ограничиваем длину
        return name[:200]
    
    def _add_metadata(self, file_path: str, track_info: dict):
        """
        Добавление метаданных к аудиофайлу
        
        Args:
            file_path: Путь к файлу
            track_info: Информация о треке
        """
        try:
            extension = os.path.splitext(file_path)[1].lower()
            
            if extension == '.flac':
                audio = FLAC(file_path)
                audio['title'] = track_info['title']
                audio['artist'] = track_info['artist']
                if track_info.get('album'):
                    audio['album'] = track_info['album']
                audio.save()
                
            elif extension == '.mp3':
                audio = MP3(file_path)
                if audio.tags is None:
                    audio.add_tags()
                
                audio.tags.add(TIT2(encoding=3, text=track_info['title']))
                audio.tags.add(TPE1(encoding=3, text=track_info['artist']))
                if track_info.get('album'):
                    audio.tags.add(TALB(encoding=3, text=track_info['album']))
                audio.save()
                
        except Exception as e:
            print(f"Ошибка добавления метаданных: {e}")
    
    def get_file_info(self, file_path: str) -> dict:
        """
        Получить информацию о файле
        
        Args:
            file_path: Путь к файлу
            
        Returns:
            Словарь с информацией о файле
        """
        try:
            extension = os.path.splitext(file_path)[1].lower()[1:]
            file_size = os.path.getsize(file_path) / (1024 * 1024)  # в МБ
            
            info = {
                'format': extension.upper(),
                'size': round(file_size, 2),
                'bitrate': None,
                'sampleRate': None
            }
            
            if extension == 'flac':
                audio = FLAC(file_path)
                info['bitrate'] = f"{audio.info.bits_per_sample}-bit"
                info['sampleRate'] = f"{audio.info.sample_rate / 1000}kHz"
                
            elif extension == 'mp3':
                audio = MP3(file_path)
                info['bitrate'] = f"{audio.info.bitrate // 1000}kbps"
                info['sampleRate'] = f"{audio.info.sample_rate / 1000}kHz"
            
            return info
            
        except Exception as e:
            print(f"Ошибка получения информации о файле: {e}")
            return {}
    
    def analyze_directory(self, path: Optional[str] = None) -> dict:
        """
        Анализ директории с музыкой
        
        Args:
            path: Путь к директории (если None, используется download_path)
            
        Returns:
            Статистика по файлам
        """
        if path is None:
            path = self.download_path
        else:
            path = Path(path)
        
        stats = {
            'totalFiles': 0,
            'totalSize': 0,
            'byFormat': {},
            'byQuality': {},
            'recentFiles': []
        }
        
        # Поддерживаемые форматы
        audio_extensions = {'.flac', '.mp3', '.aac', '.m4a', '.ogg'}
        
        # Сканируем директорию
        files_with_mtime = []
        for file_path in path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                files_with_mtime.append((file_path, file_path.stat().st_mtime))
        
        # Сортируем по времени модификации
        files_with_mtime.sort(key=lambda x: x[1], reverse=True)
        
        for file_path, _ in files_with_mtime:
            try:
                file_info = self.get_file_info(str(file_path))
                
                stats['totalFiles'] += 1
                stats['totalSize'] += file_info.get('size', 0)
                
                # По форматам
                fmt = file_info['format']
                if fmt not in stats['byFormat']:
                    stats['byFormat'][fmt] = {'count': 0, 'size': 0}
                stats['byFormat'][fmt]['count'] += 1
                stats['byFormat'][fmt]['size'] += file_info.get('size', 0)
                
                # По качеству
                if file_info.get('bitrate') and file_info.get('sampleRate'):
                    quality = f"{file_info['bitrate']}/{file_info['sampleRate']}"
                    stats['byQuality'][quality] = stats['byQuality'].get(quality, 0) + 1
                
                # Последние файлы (первые 10)
                if len(stats['recentFiles']) < 10:
                    stats['recentFiles'].append({
                        'path': str(file_path),
                        'format': fmt,
                        'size': file_info.get('size', 0),
                        'bitrate': file_info.get('bitrate', ''),
                        'sampleRate': file_info.get('sampleRate', '')
                    })
                    
            except Exception as e:
                print(f"Ошибка анализа файла {file_path}: {e}")
        
        return stats

