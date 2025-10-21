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
            token: Токен авторизации Яндекс.Музыки (OAuth или Session_id)
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
            # Пробуем разные способы инициализации в зависимости от типа токена
            if self.token.startswith('y0_'):
                # OAuth токен
                self.client = Client(self.token).init()
            elif self.token.startswith('3:'):
                # Session_id токен - пробуем использовать как OAuth
                try:
                    self.client = Client(self.token).init()
                except:
                    # Если не получилось, пробуем другой способ
                    self.client = Client().init()
                    # Устанавливаем session_id вручную
                    self.client._session_id = self.token
            else:
                # Пробуем как OAuth токен
                self.client = Client(self.token).init()
            
            # Проверяем, что клиент действительно подключился
            if self.client:
                # Пробуем получить информацию о пользователе для проверки
                try:
                    account = self.client.account_status()
                    if account:
                        print(f"Успешно подключились к аккаунту: {account.account.login}")
                        return True
                except Exception as account_error:
                    print(f"Ошибка проверки аккаунта: {account_error}")
                    # Попробуем другой способ проверки
                    try:
                        # Попробуем получить информацию о пользователе
                        user_info = self.client.me()
                        if user_info:
                            print(f"Успешно подключились к пользователю: {user_info.login}")
                            return True
                    except Exception as user_error:
                        print(f"Ошибка получения информации о пользователе: {user_error}")
                        pass
            
            return False
        except Exception as e:
            print(f"Ошибка подключения: {e}")
            return False
    
    def get_playlists(self, username: str = None) -> List[dict]:
        """
        Получить плейлисты пользователя
        
        Args:
            username: Имя пользователя для получения плейлистов (если не указано, будет определено автоматически)
        
        Returns:
            Список плейлистов
        """
        if not self.client:
            if not self.connect():
                print("Не удалось подключиться к Яндекс.Музыке")
                return []
            
        try:
            # Получаем все плейлисты пользователя
            if not self.client:
                raise Exception("Клиент не инициализирован")
            
            # Проверяем авторизацию
            try:
                account = self.client.account_status()
                if not account:
                    print("❌ Не удалось получить информацию об аккаунте")
                    return []
                
                print(f"✅ Аккаунт получен: {account.account.login if account.account.login else 'Без логина'}")
                
                # Если нет UID, но есть логин, попробуем получить плейлисты с логином
                if not account.account.uid and account.account.login:
                    print(f"⚠️  UID не найден, но есть логин: {account.account.login}")
                    print("   Пробуем получить плейлисты с логином...")
                elif not account.account.uid and not account.account.login:
                    print("⚠️  UID и логин не найдены, пробуем с переданным логином...")
                    if username:
                        print(f"   Используем переданный логин: {username}")
                    else:
                        print("   Логин не передан, попробуем без параметров")
                    
            except Exception as auth_error:
                print(f"❌ Ошибка проверки авторизации: {auth_error}")
                return []
            
            # Получаем плейлисты пользователя
            try:
                # Сначала пробуем с UID
                if account.account.uid:
                    playlists = self.client.users_playlists_list(account.account.uid)
                else:
                    raise Exception("UID не найден")
            except Exception as playlist_error:
                print(f"❌ Ошибка получения плейлистов с UID: {playlist_error}")
                # Попробуем с логином пользователя
                try:
                    if account.account.login:
                        playlists = self.client.users_playlists_list(account.account.login)
                    else:
                        raise Exception("Логин не найден")
                except Exception as login_error:
                    print(f"❌ Ошибка получения плейлистов с логином: {login_error}")
                    # Попробуем с переданным логином
                    try:
                        if username:
                            print(f"🔄 Пробуем с переданным логином: {username}")
                            playlists = self.client.users_playlists_list(username)
                        else:
                            raise Exception("Логин не передан")
                    except Exception as username_error:
                        print(f"❌ Ошибка получения плейлистов с переданным логином: {username_error}")
                        # Попробуем без параметров
                        try:
                            playlists = self.client.users_playlists_list()
                        except Exception as fallback_error:
                            print(f"❌ Ошибка получения плейлистов (fallback): {fallback_error}")
                            return []
            
            result = []
            
            print(f"✅ Найдено {len(playlists)} плейлистов")
            
            for playlist in playlists:
                try:
                    playlist_data = {
                        'id': str(playlist.kind),
                        'title': playlist.title or 'Без названия',
                        'track_count': playlist.track_count or 0,
                        'cover': self._get_cover_url(playlist),
                        'isSynced': False,
                        'lastSync': None,
                        'description': getattr(playlist, 'description', None),
                        'owner': getattr(playlist.owner, 'login', 'Unknown') if hasattr(playlist, 'owner') and playlist.owner else 'Unknown',
                        'created': getattr(playlist, 'created', None),
                        'modified': getattr(playlist, 'modified', None)
                    }
                    result.append(playlist_data)
                except Exception as playlist_error:
                    print(f"Ошибка обработки плейлиста {getattr(playlist, 'title', 'Unknown')}: {playlist_error}")
                    continue
            
            # Добавляем плейлист "Мне нравится"
            try:
                print("🔄 Получаем плейлист 'Мне нравится'...")
                
                # Пробуем разные способы получения лайков
                liked_tracks = None
                
                # Способ 1: Без параметров (для текущего пользователя)
                try:
                    liked_tracks = self.client.users_likes_tracks()
                    print("✅ Получены лайки без параметров")
                except Exception as e1:
                    print(f"❌ Способ 1 не сработал: {e1}")
                    
                    # Способ 2: С UID из аккаунта
                    if account.account.uid:
                        try:
                            liked_tracks = self.client.users_likes_tracks(account.account.uid)
                            print(f"✅ Получены лайки с UID: {account.account.uid}")
                        except Exception as e2:
                            print(f"❌ Способ 2 не сработал: {e2}")
                    
                    # Способ 3: С логином пользователя
                    if not liked_tracks and username:
                        try:
                            liked_tracks = self.client.users_likes_tracks(username)
                            print(f"✅ Получены лайки с логином: {username}")
                        except Exception as e3:
                            print(f"❌ Способ 3 не сработал: {e3}")
                
                if liked_tracks and len(liked_tracks) > 0:
                    likes_playlist = {
                        'id': 'likes',
                        'title': 'Мне нравится',
                        'track_count': len(liked_tracks),
                        'cover': None,
                        'isSynced': False,
                        'lastSync': None,
                        'description': 'Треки, которые вам нравятся',
                        'owner': account.account.login if account.account.login else username or 'Unknown',
                        'created': None,
                        'modified': None
                    }
                    result.insert(0, likes_playlist)  # Добавляем в начало списка
                    print(f"✅ Плейлист 'Мне нравится' добавлен: {len(liked_tracks)} треков")
                else:
                    print("⚠️  Плейлист 'Мне нравится' пуст или недоступен")
            except Exception as likes_error:
                print(f"❌ Общая ошибка получения плейлиста 'Мне нравится': {likes_error}")
            
            print(f"✅ Успешно обработано {len(result)} плейлистов")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка получения плейлистов: {e}")
            import traceback
            traceback.print_exc()
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
            if not self.connect():
                print("Не удалось подключиться к Яндекс.Музыке")
                return []
            
        try:
            if not self.client:
                raise Exception("Клиент не инициализирован")
            
            playlist = self.client.users_playlists(playlist_id)
            if not playlist:
                raise Exception(f"Плейлист с ID {playlist_id} не найден")
            
            tracks = playlist.fetch_tracks()
            if not tracks:
                tracks = []
            
            print(f"Получено {len(tracks)} треков из плейлиста {playlist_id}")
            
            result = []
            for track_short in tracks:
                try:
                    if not track_short.track:
                        print("Пропускаем трек без данных")
                        continue
                        
                    track = track_short.track
                    
                    # Безопасное получение данных трека
                    artists = []
                    if track.artists:
                        artists = [artist.name for artist in track.artists if hasattr(artist, 'name')]
                    
                    album_title = None
                    if track.albums and len(track.albums) > 0:
                        album = track.albums[0]
                        album_title = getattr(album, 'title', None)
                    
                    track_data = {
                        'id': str(track.id) if track.id else None,
                        'title': track.title or 'Без названия',
                        'artist': ', '.join(artists) if artists else 'Неизвестный исполнитель',
                        'album': album_title,
                        'duration': track.duration_ms // 1000 if track.duration_ms else 0,
                        'available': getattr(track, 'available', True)
                    }
                    
                    result.append(track_data)
                    
                except Exception as track_error:
                    print(f"Ошибка обработки трека: {track_error}")
                    continue
            
            print(f"Успешно обработано {len(result)} треков")
            return result
            
        except Exception as e:
            print(f"Ошибка получения треков для плейлиста {playlist_id}: {e}")
            import traceback
            traceback.print_exc()
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
            if not self.connect():
                print("Не удалось подключиться к Яндекс.Музыке")
                return None
            
        try:
            if not self.client:
                raise Exception("Клиент не инициализирован")
            
            tracks_result = self.client.tracks([track_id])
            if not tracks_result or len(tracks_result) == 0:
                raise Exception(f"Трек с ID {track_id} не найден")
            
            track = tracks_result[0]
            
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

