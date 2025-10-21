"""
Клиент для работы с API Яндекс.Музыки
"""
from typing import List, Optional
from yandex_music import Client, Playlist, Track
import os


class YandexMusicClient:
    """Обертка для работы с Яндекс.Музыкой"""
    
    def __init__(self, token: str):
        """
        Инициализация клиента
        
        Args:
            token: Токен авторизации Яндекс.Музыки
        """
        self.token = token
        self.client: Optional[Client] = None
        
    def connect(self) -> bool:
        """
        Подключение к Яндекс.Музыке
        
        Returns:
            True если подключение успешно
        """
        try:
            self.client = Client(self.token).init()
            return True
        except Exception as e:
            print(f"Ошибка подключения: {e}")
            return False
    
    def get_playlists(self) -> List[dict]:
        """
        Получить плейлисты пользователя
        
        Returns:
            Список плейлистов
        """
        if not self.client:
            self.connect()
            
        try:
            playlists = self.client.users_playlists_list()
            result = []
            
            for playlist in playlists:
                result.append({
                    'id': str(playlist.kind),
                    'title': playlist.title,
                    'trackCount': playlist.track_count,
                    'cover': self._get_cover_url(playlist),
                    'isSynced': False,
                    'lastSync': None
                })
            
            return result
        except Exception as e:
            print(f"Ошибка получения плейлистов: {e}")
            return []
    
    def get_playlist_tracks(self, playlist_id: str) -> List[dict]:
        """
        Получить треки из плейлиста
        
        Args:
            playlist_id: ID плейлиста
            
        Returns:
            Список треков
        """
        if not self.client:
            self.connect()
            
        try:
            playlist = self.client.users_playlists(playlist_id)
            tracks = playlist.fetch_tracks()
            
            result = []
            for track_short in tracks:
                track = track_short.track
                result.append({
                    'id': str(track.id),
                    'title': track.title,
                    'artist': ', '.join([artist.name for artist in track.artists]),
                    'album': track.albums[0].title if track.albums else None,
                    'duration': track.duration_ms // 1000,
                    'available': track.available
                })
            
            return result
        except Exception as e:
            print(f"Ошибка получения треков: {e}")
            return []
    
    def download_track(
        self, 
        track_id: str, 
        output_path: str,
        quality: str = 'lossless'
    ) -> Optional[str]:
        """
        Скачать трек
        
        Args:
            track_id: ID трека
            output_path: Путь для сохранения
            quality: Качество (lossless, hq, nq)
            
        Returns:
            Путь к скачанному файлу или None в случае ошибки
        """
        if not self.client:
            self.connect()
            
        try:
            track = self.client.tracks([track_id])[0]
            
            # Получаем информацию о файле для скачивания
            download_info = track.get_download_info(get_direct_links=True)
            
            # Выбираем качество
            codec_priority = {
                'lossless': ['flac', 'aac', 'mp3'],
                'hq': ['aac', 'mp3'],
                'nq': ['mp3']
            }
            
            selected_info = None
            for codec in codec_priority.get(quality, ['mp3']):
                for info in download_info:
                    if info.codec == codec:
                        selected_info = info
                        break
                if selected_info:
                    break
            
            if not selected_info:
                selected_info = download_info[0]
            
            # Формируем имя файла
            artist = track.artists[0].name if track.artists else 'Unknown'
            title = track.title
            extension = selected_info.codec
            
            filename = f"{artist} - {title}.{extension}"
            # Удаляем недопустимые символы
            filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.'))
            
            filepath = os.path.join(output_path, filename)
            
            # Скачиваем файл
            selected_info.download(filepath)
            
            # TODO: Добавить метаданные с помощью mutagen
            
            return filepath
            
        except Exception as e:
            print(f"Ошибка скачивания трека {track_id}: {e}")
            return None
    
    def _get_cover_url(self, playlist: Playlist) -> Optional[str]:
        """
        Получить URL обложки плейлиста
        
        Args:
            playlist: Объект плейлиста
            
        Returns:
            URL обложки или None
        """
        try:
            if playlist.cover and playlist.cover.uri:
                return f"https://{playlist.cover.uri.replace('%%', '400x400')}"
        except:
            pass
        return None

