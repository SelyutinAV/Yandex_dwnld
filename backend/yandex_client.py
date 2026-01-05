"""
Клиент для работы с API Яндекс.Музыки
"""

import logging
import os
from typing import Callable, List, Optional

from yandex_music import Client, Playlist, Track

# Логгер для Яндекс клиента
logger = logging.getLogger("yandex")
download_logger = logging.getLogger("download")

# Импортируем прямой API для FLAC
try:
    from yandex_direct_api import YandexMusicDirectAPI

    DIRECT_API_AVAILABLE = True
except ImportError:
    DIRECT_API_AVAILABLE = False
    logger.warning(
        "⚠️  Модуль yandex_direct_api недоступен, FLAC через прямой API не будет работать"
    )


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
        self.uid: Optional[int] = None
        self.direct_api_client: Optional["YandexMusicDirectAPI"] = None

        # Инициализируем прямой API клиент для Session_id или OAuth
        if DIRECT_API_AVAILABLE:
            try:
                # Определяем тип токена
                if token.startswith("3:") or token.startswith("2:"):
                    self.direct_api_client = YandexMusicDirectAPI(token, "session_id")
                    logger.info("✅ Прямой API клиент инициализирован для Session_id")
                elif token.startswith("y0_") or token.startswith("AgAAAA"):
                    self.direct_api_client = YandexMusicDirectAPI(token, "oauth")
                    logger.info("✅ Прямой API клиент инициализирован для OAuth")
            except Exception as e:
                logger.warning(f"⚠️  Не удалось инициализировать прямой API: {e}")

    def connect(self) -> bool:
        """
        Подключение к Яндекс.Музыке

        Returns:
            True если подключение успешно
        """
        try:
            # Пробуем разные способы инициализации в зависимости от типа токена
            if self.token.startswith("y0_"):
                # OAuth токен
                self.client = Client(self.token).init()
            elif self.token.startswith("3:"):
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
                        print(
                            f"Успешно подключились к аккаунту: {account.account.login}"
                        )
                        # Сохраняем UID для дальнейшего использования
                        self.uid = account.account.uid
                        return True
                except Exception as account_error:
                    print(f"Ошибка проверки аккаунта: {account_error}")
                    # Попробуем другой способ проверки
                    try:
                        # Попробуем получить информацию о пользователе
                        user_info = self.client.me()
                        if user_info:
                            print(
                                f"Успешно подключились к пользователю: {user_info.login}"
                            )
                            # Сохраняем UID для дальнейшего использования
                            self.uid = user_info.uid
                            return True
                    except Exception as user_error:
                        print(
                            f"Ошибка получения информации о пользователе: {user_error}"
                        )
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
                logger.error("Не удалось подключиться к Яндекс.Музыке")
                raise Exception(
                    "Не удалось подключиться к Яндекс.Музыке. Проверьте токен."
                )

        try:
            # Получаем все плейлисты пользователя
            if not self.client:
                logger.error("Клиент не инициализирован")
                raise Exception("Клиент не инициализирован")

            # Проверяем авторизацию
            account = None
            try:
                account = self.client.account_status()
                if not account:
                    logger.error("Не удалось получить информацию об аккаунте")
                    raise Exception(
                        "Не удалось получить информацию об аккаунте. Проверьте токен."
                    )

                logger.info(
                    f"Аккаунт получен: {account.account.login if account.account.login else 'Без логина'}"
                )

                # Если нет UID, но есть логин, попробуем получить плейлисты с логином
                if not account.account.uid and account.account.login:
                    logger.warning(
                        f"UID не найден, но есть логин: {account.account.login}"
                    )
                    logger.info("Пробуем получить плейлисты с логином...")
                elif not account.account.uid and not account.account.login:
                    logger.warning(
                        "UID и логин не найдены, пробуем с переданным логином..."
                    )
                    if username:
                        logger.info(f"Используем переданный логин: {username}")
                    else:
                        logger.info("Логин не передан, попробуем без параметров")

            except Exception as auth_error:
                logger.error(
                    f"Ошибка проверки авторизации: {auth_error}", exc_info=True
                )
                raise Exception(f"Ошибка авторизации: {str(auth_error)}")

            # Получаем плейлисты пользователя
            playlists = None
            try:
                # Сначала пробуем с UID
                uid_to_use = account.account.uid or self.uid
                if uid_to_use:
                    logger.info(f"Используем UID: {uid_to_use}")
                    playlists = self.client.users_playlists_list(uid_to_use)
                else:
                    raise Exception("UID не найден")
            except Exception as playlist_error:
                logger.warning(f"Ошибка получения плейлистов с UID: {playlist_error}")
                # Попробуем с логином пользователя
                try:
                    login_to_use = account.account.login or username
                    if login_to_use:
                        logger.info(f"Пробуем с логином: {login_to_use}")
                        playlists = self.client.users_playlists_list(login_to_use)
                    else:
                        raise Exception("Логин не найден")
                except Exception as login_error:
                    logger.warning(
                        f"Ошибка получения плейлистов с логином: {login_error}"
                    )
                    # Попробуем без параметров
                    try:
                        logger.info("Пробуем без параметров...")
                        playlists = self.client.users_playlists_list()
                    except Exception as fallback_error:
                        logger.error(
                            f"Ошибка получения плейлистов (fallback): {fallback_error}",
                            exc_info=True,
                        )
                        raise Exception(
                            f"Не удалось получить плейлисты: {str(fallback_error)}"
                        )

            result = []

            print(f"✅ Найдено {len(playlists)} плейлистов")

            for playlist in playlists:
                try:
                    # Быстрая загрузка без обложек
                    playlist_data = {
                        "id": str(playlist.kind),
                        "title": playlist.title or "Без названия",
                        "track_count": playlist.track_count or 0,
                        "cover": None,  # Обложки загрузим позже
                        "isSynced": False,
                        "lastSync": None,
                        "description": getattr(playlist, "description", None),
                        "owner": (
                            getattr(playlist.owner, "login", "Unknown")
                            if hasattr(playlist, "owner") and playlist.owner
                            else "Unknown"
                        ),
                        "created": getattr(playlist, "created", None),
                        "modified": getattr(playlist, "modified", None),
                    }
                    result.append(playlist_data)
                except Exception as playlist_error:
                    print(
                        f"Ошибка обработки плейлиста {getattr(playlist, 'title', 'Unknown')}: {playlist_error}"
                    )
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
                            liked_tracks = self.client.users_likes_tracks(
                                account.account.uid
                            )
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
                        "id": "likes",
                        "title": "Мне нравится",
                        "track_count": len(liked_tracks),
                        "cover": None,
                        "isSynced": False,
                        "lastSync": None,
                        "description": "Треки, которые вам нравятся",
                        "owner": (
                            account.account.login
                            if account.account.login
                            else username or "Unknown"
                        ),
                        "created": None,
                        "modified": None,
                    }
                    result.insert(0, likes_playlist)  # Добавляем в начало списка
                    print(
                        f"✅ Плейлист 'Мне нравится' добавлен: {len(liked_tracks)} треков"
                    )
                else:
                    print("⚠️  Плейлист 'Мне нравится' пуст или недоступен")
            except Exception as likes_error:
                print(
                    f"❌ Общая ошибка получения плейлиста 'Мне нравится': {likes_error}"
                )

            logger.info(
                f"Успешно обработано {len(result)} плейлистов (быстрая загрузка без обложек)"
            )
            return result

        except Exception as e:
            error_msg = str(e) if str(e) else f"Неизвестная ошибка: {type(e).__name__}"
            logger.error(
                f"Общая ошибка получения плейлистов: {error_msg}", exc_info=True
            )
            raise Exception(f"Ошибка получения плейлистов: {error_msg}")

    def get_playlist_tracks(
        self, playlist_id: str, batch_size: int = 100, max_tracks: Optional[int] = None
    ) -> List[dict]:
        """
        Получить треки из плейлиста с поддержкой пакетной обработки

        Args:
            playlist_id: ID плейлиста
            batch_size: Размер батча для обработки (по умолчанию 100)
            max_tracks: Максимальное количество треков для обработки (None = все)

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

            print(f"Получаем плейлист {playlist_id}")
            download_logger.info(
                f"🔄 get_playlist_tracks вызван с playlist_id = {playlist_id}"
            )

            # Специальная обработка для плейлиста "Мне нравится"
            if playlist_id == "likes":
                return self._get_liked_tracks_optimized(batch_size, max_tracks)

            # Для обычных плейлистов
            try:
                from db_manager import DatabaseManager

                db_manager = DatabaseManager()
                token_info = db_manager.get_active_token()
                username = token_info.get("username") if token_info else None

                if username:
                    print(f"Используем username: {username}")
                    playlist = self.client.users_playlists(playlist_id, username)
                else:
                    playlist = self.client.users_playlists(playlist_id)
            except Exception as e:
                print(f"Ошибка получения плейлиста с username: {e}")
                playlist = self.client.users_playlists(playlist_id)

            if not playlist:
                raise Exception(f"Плейлист с ID {playlist_id} не найден")

            print(f"Плейлист найден: {playlist.title}")
            tracks = playlist.fetch_tracks()
            if not tracks:
                tracks = []

            # Ограничиваем количество треков если указано
            if max_tracks and len(tracks) > max_tracks:
                download_logger.info(
                    f"⚠️  Ограничиваем обработку до {max_tracks} треков из {len(tracks)}"
                )
                tracks = tracks[:max_tracks]

            print(f"Получено {len(tracks)} треков из плейлиста {playlist_id}")

            return self._process_tracks_batch(tracks, batch_size, playlist.title)

        except Exception as e:
            print(f"Ошибка получения треков для плейлиста {playlist_id}: {e}")
            import traceback

            traceback.print_exc()
            return []

    def _get_liked_tracks_optimized(
        self, batch_size: int = 100, max_tracks: Optional[int] = None
    ) -> List[dict]:
        """
        Оптимизированное получение лайкнутых треков с пакетной обработкой

        Args:
            batch_size: Размер батча для обработки
            max_tracks: Максимальное количество треков для обработки (None = все)

        Returns:
            Список треков
        """
        download_logger.info("🔄 Получаем плейлист 'Мне нравится' (оптимизированно)...")

        try:
            # Получаем список лайкнутых треков
            liked_tracks = self.client.users_likes_tracks()

            if not liked_tracks or len(liked_tracks) == 0:
                download_logger.warning(
                    "⚠️  Плейлист 'Мне нравится' пуст или недоступен"
                )
                return []

            total_tracks = len(liked_tracks)
            download_logger.info(f"✅ Получено {total_tracks} лайков")

            # Ограничиваем количество треков если указано
            if max_tracks and total_tracks > max_tracks:
                download_logger.info(
                    f"⚠️  Ограничиваем обработку до {max_tracks} треков из {total_tracks}"
                )
                liked_tracks = liked_tracks[:max_tracks]
                total_tracks = max_tracks

            # Получаем ID всех треков
            track_ids = [
                track_short.id for track_short in liked_tracks if track_short.id
            ]
            download_logger.info(f"📋 Получено {len(track_ids)} ID треков")

            # Обрабатываем батчами для оптимизации
            result = []
            for i in range(0, len(track_ids), batch_size):
                batch_ids = track_ids[i : i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(track_ids) + batch_size - 1) // batch_size

                download_logger.info(
                    f"📦 Обрабатываем батч {batch_num}/{total_batches} ({len(batch_ids)} треков)"
                )

                try:
                    # Используем метод tracks() для получения полной информации о батче треков
                    tracks = self.client.tracks(batch_ids)

                    for track in tracks:
                        try:
                            if not track:
                                continue

                            # Безопасное получение данных трека
                            artists = []
                            if track.artists:
                                artists = [
                                    artist.name
                                    for artist in track.artists
                                    if hasattr(artist, "name")
                                ]

                            album_title = None
                            year = None
                            genre = None
                            label = None
                            version = None

                            if track.albums and len(track.albums) > 0:
                                album = track.albums[0]
                                album_title = getattr(album, "title", None)
                                year = getattr(album, "year", None)
                                genre = getattr(album, "genre", None)
                                # Получаем первый лейбл если есть
                                if (
                                    hasattr(album, "labels")
                                    and album.labels
                                    and len(album.labels) > 0
                                ):
                                    label = getattr(album.labels[0], "name", None)
                                version = getattr(album, "version", None)

                            # Получаем версию трека если не найдена в альбоме
                            if not version:
                                version = getattr(track, "version", None)

                            # Попытка получить ISRC
                            isrc = None
                            if hasattr(track, "isrc"):
                                isrc = track.isrc
                            elif hasattr(track, "albums") and track.albums:
                                for album in track.albums:
                                    if hasattr(album, "isrc"):
                                        isrc = album.isrc
                                        break

                            track_data = {
                                "id": str(track.id) if track.id else None,
                                "title": track.title or "Без названия",
                                "artist": (
                                    ", ".join(artists)
                                    if artists
                                    else "Неизвестный исполнитель"
                                ),
                                "album": album_title,
                                "duration": (
                                    track.duration_ms // 1000
                                    if track.duration_ms
                                    else 0
                                ),
                                "year": year,
                                "genre": genre,
                                "label": label,
                                "version": version,
                                "isrc": isrc,
                                "available": getattr(track, "available", True),
                                "playlist_name": "Мне нравится",
                            }

                            result.append(track_data)

                        except Exception as track_error:
                            download_logger.warning(
                                f"Ошибка обработки трека в батче: {track_error}"
                            )
                            continue

                    download_logger.info(
                        f"✅ Батч {batch_num}/{total_batches} обработан: {len(tracks)} треков"
                    )

                    # Небольшая задержка между батчами для снижения нагрузки на API
                    import time

                    time.sleep(0.5)

                except Exception as batch_error:
                    download_logger.error(
                        f"❌ Ошибка обработки батча {batch_num}: {batch_error}"
                    )
                    continue

            download_logger.info(
                f"✅ Успешно обработано {len(result)} треков из 'Мне нравится'"
            )
            return result

        except Exception as e:
            download_logger.error(f"❌ Ошибка получения лайков: {e}")
            import traceback

            traceback.print_exc()
            return []

    def _process_tracks_batch(
        self, tracks, batch_size: int = 100, playlist_name: str = None
    ) -> List[dict]:
        """
        Обработка списка треков батчами

        Args:
            tracks: Список треков для обработки
            batch_size: Размер батча

        Returns:
            Список обработанных треков
        """
        result = []
        total_tracks = len(tracks)

        for i in range(0, total_tracks, batch_size):
            batch = tracks[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_tracks + batch_size - 1) // batch_size

            download_logger.info(
                f"📦 Обрабатываем батч {batch_num}/{total_batches} ({len(batch)} треков)"
            )

            for track_short in batch:
                try:
                    if not track_short.track:
                        continue

                    track = track_short.track

                    # Безопасное получение данных трека
                    artists = []
                    if track.artists:
                        artists = [
                            artist.name
                            for artist in track.artists
                            if hasattr(artist, "name")
                        ]

                    album_title = None
                    year = None
                    genre = None
                    label = None
                    version = None

                    if track.albums and len(track.albums) > 0:
                        album = track.albums[0]
                        album_title = getattr(album, "title", None)
                        year = getattr(album, "year", None)
                        genre = getattr(album, "genre", None)
                        # Получаем первый лейбл если есть
                        if (
                            hasattr(album, "labels")
                            and album.labels
                            and len(album.labels) > 0
                        ):
                            label = getattr(album.labels[0], "name", None)
                        version = getattr(album, "version", None)

                    # Получаем версию трека если не найдена в альбоме
                    if not version:
                        version = getattr(track, "version", None)

                    # Попытка получить ISRC (может быть в разных местах)
                    isrc = None
                    if hasattr(track, "isrc"):
                        isrc = track.isrc
                    elif hasattr(track, "albums") and track.albums:
                        # Иногда ISRC может быть в альбоме
                        for album in track.albums:
                            if hasattr(album, "isrc"):
                                isrc = album.isrc
                                break

                    # Получаем обложку трека
                    cover_url = self._get_track_cover_url(track)

                    track_data = {
                        "id": str(track.id) if track.id else None,
                        "title": track.title or "Без названия",
                        "artist": (
                            ", ".join(artists) if artists else "Неизвестный исполнитель"
                        ),
                        "album": album_title,
                        "duration": (
                            track.duration_ms // 1000 if track.duration_ms else 0
                        ),
                        "year": year,
                        "genre": genre,
                        "label": label,
                        "version": version,
                        "isrc": isrc,
                        "cover": cover_url,
                        "available": getattr(track, "available", True),
                        "playlist_name": playlist_name or "Unknown Playlist",
                    }

                    result.append(track_data)

                except Exception as track_error:
                    download_logger.warning(f"Ошибка обработки трека: {track_error}")
                    continue

            download_logger.info(f"✅ Батч {batch_num}/{total_batches} обработан")

        download_logger.info(f"✅ Всего обработано {len(result)} треков")
        return result

    def download_track(
        self,
        track_id: str,
        output_path: str,
        quality: str = "lossless",
        progress_callback: Optional[Callable] = None,
    ) -> Optional[str]:
        """
        Скачать трек

        Args:
            track_id: ID трека
            output_path: Путь для сохранения
            quality: Качество (lossless, hq, nq)
            progress_callback: Функция для отслеживания прогресса (bytes_downloaded, total_bytes)

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

            download_logger.info(f"🎵 Загружаем трек с ID: {track_id}")
            tracks_result = self.client.tracks([track_id])
            if not tracks_result or len(tracks_result) == 0:
                raise Exception(f"Трек с ID {track_id} не найден")

            track = tracks_result[0]
            artist_name = track.artists[0].name if track.artists else "Unknown"
            download_logger.info(f"✅ Найден трек: {track.title} - {artist_name}")

            # ПОПЫТКА ИСПОЛЬЗОВАТЬ ПРЯМОЙ API ДЛЯ LOSSLESS
            if quality == "lossless" and self.direct_api_client:
                download_logger.info(f"🔄 Попытка скачать FLAC через прямой API...")
                try:
                    # Используем прямой API для получения форматов
                    formats = self.direct_api_client.get_download_info(
                        track_id, "lossless"
                    )

                    if formats:
                        # Ищем FLAC или FLAC-MP4 - проверяем все возможные варианты
                        flac_format = None

                        # Сначала проверяем по кодеку
                        for fmt in formats:
                            codec = fmt.get("codec", "").lower()
                            if codec in ["flac", "flac-mp4", "flac_mp4"]:
                                flac_format = fmt
                                download_logger.info(
                                    f"✅ FLAC найден в прямом API по кодеку: {codec}"
                                )
                                break

                        # Если не нашли по кодеку, проверяем прямые ссылки и download_info_url
                        if not flac_format:
                            for fmt in formats:
                                # Проверяем прямую ссылку
                                direct_link = fmt.get("direct_link", "")
                                if direct_link and "flac" in direct_link.lower():
                                    flac_format = fmt
                                    download_logger.info(
                                        f"✅ FLAC найден в прямой ссылке прямого API"
                                    )
                                    break

                                # Проверяем download_info_url
                                download_url = fmt.get("download_info_url", "")
                                if download_url and "flac" in download_url.lower():
                                    flac_format = fmt
                                    download_logger.info(
                                        f"✅ FLAC найден в download_info_url прямого API"
                                    )
                                    break

                        # Если FLAC не найден, пробуем найти aac-mp4 как альтернативу
                        # aac-mp4 с 256 kbps качественнее MP3 320 kbps
                        if not flac_format:
                            download_logger.info(
                                f"🔄 FLAC не найден, ищем aac-mp4 как альтернативу..."
                            )
                            for fmt in formats:
                                codec = fmt.get("codec", "").lower()
                                bitrate = fmt.get("bitrate_in_kbps", 0)
                                # Принимаем aac-mp4 если битрейт >= 256 kbps
                                if (
                                    codec in ["aac-mp4", "aac", "he-aac-mp4"]
                                    and bitrate >= 256
                                ):
                                    flac_format = fmt
                                    download_logger.info(
                                        f"✅ Найден {codec.upper()} {bitrate} kbps как альтернатива FLAC!"
                                    )
                                    break

                        # Логируем все форматы для диагностики, если ничего не нашли
                        if not flac_format:
                            download_logger.warning(
                                f"⚠️  FLAC и качественный aac-mp4 не найдены. Доступные форматы:"
                            )
                            for fmt in formats:
                                codec = fmt.get("codec", "unknown")
                                bitrate = fmt.get("bitrate_in_kbps", 0)
                                transport = fmt.get("transport", "unknown")
                                direct_link = fmt.get("direct_link", "")
                                download_url = fmt.get("download_info_url", "")
                                download_logger.warning(
                                    f"   • {codec.upper()}: {bitrate} kbps, "
                                    f"transport={transport}, "
                                    f"direct_link={'есть' if direct_link else 'нет'}, "
                                    f"download_url={'есть' if download_url else 'нет'}"
                                )

                        if flac_format:
                            codec_name = flac_format.get("codec", "").lower()
                            is_flac = codec_name in ["flac", "flac-mp4", "flac_mp4"]
                            is_aac = codec_name in ["aac-mp4", "aac", "he-aac-mp4"]

                            if is_flac:
                                download_logger.info(
                                    f"✅ FLAC доступен через прямой API!"
                                )
                            elif is_aac:
                                download_logger.info(
                                    f"✅ AAC-MP4 (качественная альтернатива) доступен через прямой API!"
                                )
                            else:
                                download_logger.info(
                                    f"✅ Формат {codec_name.upper()} доступен через прямой API!"
                                )

                            download_logger.info(f"   Кодек: {flac_format['codec']}")
                            download_logger.info(
                                f"   Битрейт: {flac_format['bitrate_in_kbps']} kbps"
                            )

                            # Проверяем есть ли прямая ссылка
                            direct_link = flac_format.get("direct_link")

                            if not direct_link:
                                # Если нет прямой ссылки, получаем её
                                download_logger.info(f"🔗 Получаем прямую ссылку...")
                                direct_link = (
                                    self.direct_api_client.get_direct_download_link(
                                        flac_format["download_info_url"]
                                    )
                                )
                            else:
                                download_logger.info(
                                    f"✅ Прямая ссылка уже в ответе API!"
                                )

                            if direct_link:
                                # Скачиваем через прямой API
                                download_logger.info(f"💾 Сохраняем в: {output_path}")
                                download_logger.info(f"📥 Начинаем скачивание...")

                                import tempfile

                                import requests

                                # Проверяем нужна ли расшифровка
                                needs_decrypt = flac_format.get("transport") == "encraw"
                                encryption_key = flac_format.get("key", "")

                                import os

                                # Если нужна расшифровка, скачиваем во временный файл
                                if needs_decrypt and encryption_key:
                                    download_logger.info(
                                        f"🔐 Файл зашифрован, потребуется расшифровка"
                                    )
                                    temp_encrypted = output_path + ".encrypted"
                                    temp_decrypted = output_path + ".decrypted.mp4"

                                    # Удаляем существующие временные файлы, если они есть
                                    if os.path.exists(temp_encrypted):
                                        os.remove(temp_encrypted)
                                        download_logger.info(
                                            f"🗑️  Удален старый зашифрованный файл"
                                        )
                                    if os.path.exists(temp_decrypted):
                                        os.remove(temp_decrypted)
                                        download_logger.info(
                                            f"🗑️  Удален старый расшифрованный файл"
                                        )
                                else:
                                    temp_encrypted = output_path
                                    temp_decrypted = None

                                response = self.direct_api_client.session.get(
                                    direct_link, stream=True, timeout=120
                                )

                                if response.status_code == 200:
                                    total_size = int(
                                        response.headers.get("content-length", 0)
                                    )
                                    downloaded = 0

                                    try:
                                        with open(temp_encrypted, "wb") as f:
                                            # Увеличенный chunk_size для лучшей производительности (64 KB вместо 8 KB)
                                            for chunk in response.iter_content(
                                                chunk_size=65536
                                            ):
                                                if chunk:
                                                    f.write(chunk)
                                                    downloaded += len(chunk)

                                                    if (
                                                        progress_callback
                                                        and total_size > 0
                                                    ):
                                                        progress_callback(
                                                            downloaded, total_size
                                                        )

                                        download_logger.info(f"✅ Файл успешно скачан!")
                                        download_logger.info(
                                            f"   Размер: {downloaded / (1024 * 1024):.2f} МБ"
                                        )
                                        download_logger.info(
                                            f"   Временный файл: {temp_encrypted}"
                                        )
                                    except Exception as download_error:
                                        download_logger.error(
                                            f"❌ Ошибка записи файла: {download_error}"
                                        )
                                        # Удаляем частично скачанный файл
                                        import os

                                        if os.path.exists(temp_encrypted):
                                            try:
                                                os.remove(temp_encrypted)
                                                download_logger.info(
                                                    f"🗑️  Удален частично скачанный файл"
                                                )
                                            except:
                                                pass
                                        return None

                                    # Определяем кодек для выбора правильного расширения
                                    codec_name = flac_format.get("codec", "").lower()

                                    # Если файл не зашифрован, нужно проверить расширение
                                    if not needs_decrypt or not encryption_key:
                                        # Для незашифрованных файлов
                                        if codec_name in [
                                            "aac-mp4",
                                            "aac",
                                            "he-aac-mp4",
                                        ]:
                                            # Меняем расширение на .m4a
                                            import os

                                            output_path_m4a = (
                                                os.path.splitext(output_path)[0]
                                                + ".m4a"
                                            )
                                            if temp_encrypted != output_path:
                                                os.rename(
                                                    temp_encrypted, output_path_m4a
                                                )
                                            else:
                                                os.rename(output_path, output_path_m4a)
                                            download_logger.info(
                                                f"✅ AAC-MP4 файл готов!"
                                            )
                                            download_logger.info(
                                                f"   Путь: {output_path_m4a}"
                                            )
                                            return output_path_m4a
                                        else:
                                            # Для FLAC и других форматов
                                            return output_path

                                    # Если нужна расшифровка и конвертация
                                    if needs_decrypt and encryption_key:
                                        try:
                                            # Проверяем, что зашифрованный файл существует и доступен
                                            import os

                                            if not os.path.exists(temp_encrypted):
                                                download_logger.error(
                                                    f"❌ Зашифрованный файл не найден: {temp_encrypted}"
                                                )
                                                return None

                                            # Проверяем права доступа
                                            try:
                                                if not os.access(
                                                    temp_encrypted, os.R_OK
                                                ):
                                                    download_logger.error(
                                                        f"❌ Нет прав на чтение зашифрованного файла: {temp_encrypted}"
                                                    )
                                                    return None
                                            except Exception as access_error:
                                                download_logger.warning(
                                                    f"⚠️  Не удалось проверить права доступа: {access_error}"
                                                )

                                            # Расшифровываем
                                            download_logger.info(
                                                f"🔓 Начинаем расшифровку: {temp_encrypted} → {temp_decrypted}"
                                            )
                                            if not self.direct_api_client.decrypt_track(
                                                temp_encrypted,
                                                temp_decrypted,
                                                encryption_key,
                                            ):
                                                download_logger.error(
                                                    "❌ Не удалось расшифровать файл"
                                                )
                                                # Удаляем зашифрованный файл при ошибке
                                                if os.path.exists(temp_encrypted):
                                                    try:
                                                        os.remove(temp_encrypted)
                                                        download_logger.info(
                                                            "🗑️  Удален зашифрованный файл после ошибки расшифровки"
                                                        )
                                                    except Exception as cleanup_error:
                                                        download_logger.warning(
                                                            f"⚠️  Не удалось удалить зашифрованный файл: {cleanup_error}"
                                                        )
                                                return None

                                            # Удаляем зашифрованный файл после успешной расшифровки
                                            import os

                                            if os.path.exists(temp_encrypted):
                                                try:
                                                    os.remove(temp_encrypted)
                                                    download_logger.info(
                                                        "🗑️  Удален зашифрованный файл после расшифровки"
                                                    )
                                                except (
                                                    PermissionError,
                                                    OSError,
                                                ) as cleanup_error:
                                                    download_logger.warning(
                                                        f"⚠️  Не удалось удалить зашифрованный файл: {cleanup_error}"
                                                    )
                                                    # На NAS это может быть нормально, продолжаем работу

                                            # Определяем кодек и выбираем расширение файла
                                            codec_name = flac_format.get(
                                                "codec", ""
                                            ).lower()

                                            # Для FLAC конвертируем в FLAC
                                            if codec_name in [
                                                "flac",
                                                "flac-mp4",
                                                "flac_mp4",
                                            ]:
                                                # Проверяем, что расшифрованный файл существует
                                                import os

                                                if not os.path.exists(temp_decrypted):
                                                    download_logger.error(
                                                        f"❌ Расшифрованный файл не найден: {temp_decrypted}"
                                                    )
                                                    return None

                                                # Проверяем права доступа к расшифрованному файлу
                                                try:
                                                    if not os.access(
                                                        temp_decrypted, os.R_OK
                                                    ):
                                                        download_logger.error(
                                                            f"❌ Нет прав на чтение расшифрованного файла: {temp_decrypted}"
                                                        )
                                                        return None

                                                    # Проверяем размер файла
                                                    file_size = os.path.getsize(
                                                        temp_decrypted
                                                    )
                                                    if file_size == 0:
                                                        download_logger.error(
                                                            f"❌ Расшифрованный файл пуст: {temp_decrypted}"
                                                        )
                                                        return None

                                                    download_logger.info(
                                                        f"   Размер расшифрованного файла: {file_size / (1024*1024):.2f} МБ"
                                                    )
                                                except (
                                                    PermissionError,
                                                    OSError,
                                                ) as check_error:
                                                    download_logger.error(
                                                        f"❌ Ошибка проверки расшифрованного файла: {check_error}"
                                                    )
                                                    return None

                                                # Конвертируем MP4 с FLAC в чистый FLAC
                                                download_logger.info(
                                                    f"🔄 Конвертируем {temp_decrypted} → {output_path}"
                                                )
                                                if not self.direct_api_client.mux_to_flac(
                                                    temp_decrypted, output_path
                                                ):
                                                    download_logger.error(
                                                        "❌ Не удалось конвертировать в FLAC"
                                                    )
                                                    # Удаляем расшифрованный файл при ошибке
                                                    if os.path.exists(temp_decrypted):
                                                        try:
                                                            os.remove(temp_decrypted)
                                                            download_logger.info(
                                                                "🗑️  Удален расшифрованный файл после ошибки конвертации"
                                                            )
                                                        except (
                                                            Exception
                                                        ) as cleanup_error:
                                                            download_logger.warning(
                                                                f"⚠️  Не удалось удалить расшифрованный файл: {cleanup_error}"
                                                            )
                                                    return None

                                                # Удаляем временный MP4 после успешной конвертации
                                                import os

                                                if os.path.exists(temp_decrypted):
                                                    try:
                                                        os.remove(temp_decrypted)
                                                        download_logger.info(
                                                            "🗑️  Удален расшифрованный файл после конвертации"
                                                        )
                                                    except (
                                                        PermissionError,
                                                        OSError,
                                                    ) as cleanup_error:
                                                        download_logger.warning(
                                                            f"⚠️  Не удалось удалить расшифрованный файл: {cleanup_error}"
                                                        )
                                                        # На NAS это может быть нормально, продолжаем работу

                                                download_logger.info(
                                                    f"✅ FLAC файл готов!"
                                                )
                                                download_logger.info(
                                                    f"   Путь: {output_path}"
                                                )
                                            # Для AAC-MP4 сохраняем как M4A
                                            elif codec_name in [
                                                "aac-mp4",
                                                "aac",
                                                "he-aac-mp4",
                                            ]:
                                                # Меняем расширение на .m4a
                                                import os

                                                output_path_m4a = (
                                                    os.path.splitext(output_path)[0]
                                                    + ".m4a"
                                                )

                                                # Перемещаем расшифрованный MP4 в M4A
                                                os.rename(
                                                    temp_decrypted, output_path_m4a
                                                )
                                                download_logger.info(
                                                    f"✅ AAC-MP4 файл готов!"
                                                )
                                                download_logger.info(
                                                    f"   Путь: {output_path_m4a}"
                                                )
                                                return output_path_m4a
                                            else:
                                                # Для других форматов просто перемещаем
                                                import os

                                                os.rename(temp_decrypted, output_path)
                                                download_logger.info(f"✅ Файл готов!")
                                                download_logger.info(
                                                    f"   Путь: {output_path}"
                                                )
                                                return output_path

                                        except Exception as e:
                                            download_logger.error(
                                                f"❌ Ошибка обработки зашифрованного файла: {e}"
                                            )
                                            import traceback

                                            download_logger.error(
                                                traceback.format_exc()
                                            )

                                            # Очищаем все временные файлы при ошибке
                                            import os

                                            # Удаляем расшифрованный файл
                                            if temp_decrypted and os.path.exists(
                                                temp_decrypted
                                            ):
                                                try:
                                                    os.remove(temp_decrypted)
                                                    download_logger.info(
                                                        f"🗑️  Удален расшифрованный файл после ошибки"
                                                    )
                                                except Exception as cleanup_error:
                                                    download_logger.warning(
                                                        f"⚠️  Не удалось удалить расшифрованный файл: {cleanup_error}"
                                                    )

                                            # Удаляем зашифрованный файл
                                            if (
                                                temp_encrypted != output_path
                                                and os.path.exists(temp_encrypted)
                                            ):
                                                try:
                                                    os.remove(temp_encrypted)
                                                    download_logger.info(
                                                        f"🗑️  Удален зашифрованный файл после ошибки"
                                                    )
                                                except Exception as cleanup_error:
                                                    download_logger.warning(
                                                        f"⚠️  Не удалось удалить зашифрованный файл: {cleanup_error}"
                                                    )
                                                    # Если не удалось удалить, предупреждаем пользователя
                                                    download_logger.warning(
                                                        f"⚠️  Зашифрованный файл оставлен для ручной обработки: {temp_encrypted}"
                                                    )

                                            return None

                                    return output_path
                                else:
                                    download_logger.warning(
                                        f"⚠️  Ошибка скачивания: статус {response.status_code}"
                                    )
                                    # Удаляем временный файл, если он был создан
                                    import os

                                    if (
                                        temp_encrypted != output_path
                                        and os.path.exists(temp_encrypted)
                                    ):
                                        try:
                                            os.remove(temp_encrypted)
                                            download_logger.info(
                                                f"🗑️  Удален временный файл после ошибки скачивания"
                                            )
                                        except:
                                            pass
                        else:
                            download_logger.warning(
                                f"⚠️  FLAC не найден в ответе прямого API"
                            )
                    else:
                        download_logger.warning(f"⚠️  Прямой API не вернул форматы")

                except Exception as e:
                    download_logger.warning(
                        f"⚠️  Ошибка при использовании прямого API: {e}"
                    )
                    download_logger.info(f"   Переключаемся на стандартный API...")

            # Получаем информацию о файле для скачивания (стандартный способ)
            download_logger.info(
                f"📥 Запрашиваем доступные форматы через стандартный API..."
            )
            download_info = track.get_download_info(get_direct_links=True)

            # Детальная информация о доступных форматах
            download_logger.info(f"📋 Доступно форматов: {len(download_info)}")
            for info in download_info:
                codec_str = getattr(info, "codec", "unknown")
                bitrate_str = getattr(info, "bitrate_in_kbps", 0)

                # Пробуем получить прямую ссылку для проверки
                direct_link_str = ""
                try:
                    direct_link = info.get_direct_link()
                    if direct_link and "flac" in direct_link.lower():
                        direct_link_str = " [FLAC в ссылке!]"
                except:
                    pass

                download_logger.info(
                    f"   • {codec_str.upper()}: {bitrate_str} kbps{direct_link_str}"
                )

                # Дополнительная диагностика для каждого формата
                download_logger.debug(f"      Полный объект: {type(info)}")
                download_logger.debug(
                    f"      Атрибуты: {[attr for attr in dir(info) if not attr.startswith('_')]}"
                )

            # УЛУЧШЕННАЯ ЛОГИКА ВЫБОРА КАЧЕСТВА
            selected_info = None

            if quality == "lossless":
                # Для lossless СТРОГО ищем FLAC
                download_logger.info(f"🎯 Поиск FLAC формата для lossless качества...")

                # Варианты кодека FLAC
                flac_codecs = ["flac", "flac-mp4", "flac_mp4"]

                for info in download_info:
                    codec = getattr(info, "codec", "").lower()

                    # Проверяем по кодеку
                    if codec in flac_codecs:
                        selected_info = info
                        download_logger.info(
                            f"✅ FLAC найден по кодеку! Кодек: {codec}, Битрейт: {getattr(info, 'bitrate_in_kbps', 0)} kbps"
                        )
                        break

                    # Также проверяем прямую ссылку на наличие FLAC
                    try:
                        direct_link = info.get_direct_link()
                        if direct_link and "flac" in direct_link.lower():
                            selected_info = info
                            download_logger.info(
                                f"✅ FLAC найден в прямой ссылке! Кодек: {codec}, Битрейт: {getattr(info, 'bitrate_in_kbps', 0)} kbps"
                            )
                            download_logger.info(f"   Ссылка: {direct_link[:100]}...")
                            break
                    except Exception as e:
                        download_logger.debug(
                            f"   Не удалось получить прямую ссылку для {codec}: {e}"
                        )

                # Если не нашли по кодеку или ссылке, пробуем другие методы
                if not selected_info:
                    # Проверяем все атрибуты объекта на наличие flac
                    for info in download_info:
                        codec = getattr(info, "codec", "").lower()
                        download_logger.debug(f"   Проверяем формат: {codec}")

                        # Проверяем все строковые атрибуты на наличие flac
                        for attr_name in dir(info):
                            if attr_name.startswith("_"):
                                continue
                            try:
                                attr_value = getattr(info, attr_name, None)
                                if (
                                    isinstance(attr_value, str)
                                    and "flac" in attr_value.lower()
                                ):
                                    download_logger.info(
                                        f"   🔍 Обнаружен 'flac' в атрибуте {attr_name}: {attr_value[:100]}"
                                    )
                                    if not selected_info:
                                        selected_info = info
                                        download_logger.info(
                                            f"✅ FLAC найден через атрибут {attr_name}! Кодек: {codec}"
                                        )
                                        break
                            except:
                                pass
                        if selected_info:
                            break

                # Если FLAC не найден, ищем aac-mp4/aac как альтернативу
                # aac-mp4 с 256+ kbps качественнее MP3 320 kbps
                if not selected_info:
                    download_logger.warning("⚠️  FLAC недоступен!")
                    download_logger.info("🔄 Ищем aac-mp4/aac как альтернативу FLAC...")

                    # Ищем AAC/AAC-MP4 с битрейтом >= 256 kbps
                    aac_formats = []
                    for info in download_info:
                        codec = getattr(info, "codec", "").lower()
                        bitrate = getattr(info, "bitrate_in_kbps", 0)
                        if codec in ["aac", "aac-mp4", "he-aac-mp4"] and bitrate >= 256:
                            aac_formats.append((info, bitrate))
                            download_logger.info(
                                f"   ✓ Найден {codec.upper()}: {bitrate} kbps"
                            )

                    if aac_formats:
                        # Выбираем AAC с максимальным битрейтом
                        aac_formats.sort(key=lambda x: x[1], reverse=True)
                        selected_info = aac_formats[0][0]
                        download_logger.info(
                            f"✅ Выбран {selected_info.codec.upper()} ({selected_info.bitrate_in_kbps} kbps) "
                            f"как альтернатива FLAC"
                        )
                    else:
                        # Проверяем подписку
                        try:
                            account = self.client.account_status()
                            if account and not account.plus:
                                download_logger.warning(
                                    "❌ FLAC доступен только с подпиской Яндекс.Плюс!"
                                )
                                download_logger.info(
                                    "   Будет выбран лучший доступный формат."
                                )
                        except:
                            pass

                        # Если AAC нет, выбираем формат с максимальным битрейтом
                        sorted_formats = sorted(
                            download_info,
                            key=lambda x: x.bitrate_in_kbps or 0,
                            reverse=True,
                        )
                        selected_info = sorted_formats[0]
                        download_logger.info(
                            f"➡️  Выбран лучший доступный: {selected_info.codec.upper()} ({selected_info.bitrate_in_kbps} kbps)"
                        )

            elif quality == "hq":
                # Для HQ ищем AAC с максимальным битрейтом или MP3 320
                download_logger.info(f"🎯 Поиск HQ формата...")
                aac_formats = [info for info in download_info if info.codec == "aac"]
                if aac_formats:
                    selected_info = max(
                        aac_formats, key=lambda x: x.bitrate_in_kbps or 0
                    )
                    download_logger.info(
                        f"✅ AAC найден: {selected_info.bitrate_in_kbps} kbps"
                    )
                else:
                    # Ищем MP3 с максимальным битрейтом
                    mp3_formats = [
                        info for info in download_info if info.codec == "mp3"
                    ]
                    if mp3_formats:
                        selected_info = max(
                            mp3_formats, key=lambda x: x.bitrate_in_kbps or 0
                        )
                        download_logger.info(
                            f"✅ MP3 найден: {selected_info.bitrate_in_kbps} kbps"
                        )

            else:  # 'nq' или другое
                # Для NQ ищем MP3 со средним битрейтом
                download_logger.info(f"🎯 Поиск NQ формата...")
                mp3_formats = [info for info in download_info if info.codec == "mp3"]
                if mp3_formats:
                    # Берем MP3 с минимальным битрейтом (для nq)
                    selected_info = min(
                        mp3_formats, key=lambda x: x.bitrate_in_kbps or 0
                    )
                    download_logger.info(
                        f"✅ MP3 найден: {selected_info.bitrate_in_kbps} kbps"
                    )

            # Если ничего не выбрали, берем первый доступный
            if not selected_info and download_info:
                selected_info = download_info[0]
                download_logger.warning(
                    f"⚠️  Используем первый доступный формат: {selected_info.codec.upper()}"
                )

            if not selected_info:
                raise Exception("Нет доступных форматов для скачивания")

            download_logger.info(
                f"🎯 ВЫБРАН: {selected_info.codec.upper()} ({selected_info.bitrate_in_kbps} kbps)"
            )

            # Получаем прямую ссылку для логирования
            try:
                direct_link = selected_info.get_direct_link()
                download_logger.debug(
                    f"🔗 Прямая ссылка получена: {direct_link[:80]}..."
                )
                if "ysign1=" in direct_link:
                    download_logger.debug("🔑 Подпись присутствует в URL")
            except Exception as e:
                download_logger.warning(
                    f"⚠️  Не удалось получить прямую ссылку для логирования: {e}"
                )

            # Формируем имя файла с правильным расширением
            artist = track.artists[0].name if track.artists else "Unknown"
            title = track.title

            # Определяем расширение файла в зависимости от кодека
            if selected_info.codec in ["flac", "flac-mp4"]:
                extension = "flac"
            elif selected_info.codec in ["aac", "he-aac"]:
                extension = "aac"
            else:
                extension = "mp3"

            filename = f"{artist} - {title}.{extension}"

            # Удаляем недопустимые символы ИЗ filename
            filename = "".join(
                c for c in filename if c.isalnum() or c in (" ", "-", "_", ".")
            )

            # ВАЖНО: если output_path был для FLAC, но выбран MP3/AAC - обновляем путь
            import os

            download_logger.debug(
                f"🔍 Проверка fallback: quality={quality}, extension={extension}"
            )
            if quality == "lossless" and extension != "flac":
                download_logger.info(
                    f"🔄 FLAC недоступен, будет загружен {extension.upper()}"
                )
                download_logger.debug(f"   📂 Исходный output_path: {output_path}")
                download_logger.debug(f"   📄 Новое имя файла: {filename}")
                # Заменяем расширение в output_path
                output_dir = os.path.dirname(output_path)
                output_path = os.path.join(output_dir, filename)
                download_logger.debug(f"   📂 Новый output_path: {output_path}")
            else:
                download_logger.debug(
                    f"   ⏭️  Fallback не нужен (extension={extension})"
                )

            # Используем обновленный output_path (который уже содержит правильный путь)
            filepath = output_path

            # Убеждаемся что директория существует
            file_dir = os.path.dirname(filepath)
            if not os.path.exists(file_dir):
                os.makedirs(file_dir, exist_ok=True)
                download_logger.debug(f"📁 Создана директория: {file_dir}")

            download_logger.info(f"💾 Сохраняем в: {filepath}")

            # Скачиваем файл с отслеживанием прогресса
            download_logger.info("📥 Начинаем скачивание...")

            if progress_callback:
                # Скачиваем с отслеживанием прогресса
                self._download_with_progress(selected_info, filepath, progress_callback)
            else:
                # Обычное скачивание без прогресса
                selected_info.download(filepath)

            # Проверяем, что файл действительно создался
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath) / (1024 * 1024)  # в МБ
                download_logger.info(f"✅ Файл успешно скачан!")
                download_logger.info(f"   Размер: {file_size:.2f} МБ")
                download_logger.info(f"   Путь: {filepath}")
            else:
                download_logger.error("❌ ОШИБКА: Файл не был создан!")
                download_logger.error(
                    "❌ Функция download_track возвращает None - файл не создан"
                )
                return None

            download_logger.info(f"✅ Функция download_track возвращает: {filepath}")
            return filepath

        except Exception as e:
            download_logger.error(
                f"❌ Ошибка скачивания трека {track_id}: {e}", exc_info=True
            )
            download_logger.info(
                f"❌ Функция download_track возвращает None из-за ошибки"
            )
            return None

    def get_playlist_name(self, playlist_id: str) -> Optional[str]:
        """
        Получить название плейлиста по ID

        Args:
            playlist_id: ID плейлиста

        Returns:
            Название плейлиста или None
        """
        if not self.client:
            if not self.connect():
                print("Не удалось подключиться к Яндекс.Музыке")
                return None

        try:
            if not self.client:
                raise Exception("Клиент не инициализирован")

            # Для плейлиста "Мне нравится" возвращаем специальное название
            if playlist_id == "likes":
                return "Мне нравится"

            # Пробуем получить плейлист с username из базы данных
            try:
                from db_manager import DatabaseManager

                db_manager = DatabaseManager()
                token_info = db_manager.get_active_token()
                username = token_info.get("username") if token_info else None

                if username:
                    playlist = self.client.users_playlists(playlist_id, username)
                else:
                    playlist = self.client.users_playlists(playlist_id)
            except Exception as e:
                print(f"Ошибка получения плейлиста с username: {e}")
                playlist = self.client.users_playlists(playlist_id)

            if playlist and playlist.title:
                return playlist.title
            else:
                return f"Playlist_{playlist_id}"

        except Exception as e:
            print(f"Ошибка получения названия плейлиста {playlist_id}: {e}")
            return f"Playlist_{playlist_id}"

    def _download_with_progress(
        self, download_info, filepath: str, progress_callback: Callable
    ):
        """
        Скачать файл с отслеживанием прогресса

        Args:
            download_info: Информация о загрузке от yandex-music
            filepath: Путь для сохранения файла
            progress_callback: Функция для отслеживания прогресса
        """
        import time

        import requests

        # Максимальное количество попыток
        max_retries = 3
        retry_delay = 2  # секунды

        try:
            # Получаем прямую ссылку
            direct_link = download_info.get_direct_link()

            # Получаем размер файла с timeout
            try:
                response = requests.head(direct_link, allow_redirects=True, timeout=30)
                total_size = int(response.headers.get("content-length", 0))
            except Exception as e:
                download_logger.warning(f"Не удалось получить размер файла: {e}")
                total_size = 0

            download_logger.info(f"📊 Размер файла: {total_size / (1024*1024):.2f} МБ")

            # Скачиваем с прогрессом и повторными попытками
            for attempt in range(max_retries):
                try:
                    # Увеличиваем timeout для больших файлов: connect timeout 30s, read timeout 300s (5 минут)
                    response = requests.get(direct_link, stream=True, timeout=(30, 300))
                    response.raise_for_status()

                    downloaded = 0
                    last_callback_time = time.time()
                    callback_interval = (
                        0.1  # Вызывать callback не чаще раза в 0.1 секунды
                    )

                    with open(filepath, "wb") as f:
                        # Увеличенный chunk_size для лучшей производительности (64 KB вместо 8 KB)
                        for chunk in response.iter_content(chunk_size=65536):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)

                                # Вызываем callback с прогрессом (не чаще раза в 0.1 секунды)
                                if progress_callback:
                                    current_time = time.time()
                                    if (
                                        current_time - last_callback_time
                                        >= callback_interval
                                    ):
                                        progress_callback(downloaded, total_size)
                                        last_callback_time = current_time

                    # Финальный callback для 100%
                    if progress_callback:
                        progress_callback(downloaded, total_size)

                    # Если дошли сюда, значит успешно скачали
                    return

                except (
                    requests.exceptions.ChunkedEncodingError,
                    requests.exceptions.ConnectionError,
                    requests.exceptions.ProtocolError,
                    OSError,
                ) as e:
                    current_delay = retry_delay * (
                        2**attempt
                    )  # Экспоненциальная задержка
                    if attempt < max_retries - 1:
                        download_logger.warning(
                            f"Ошибка соединения при попытке {attempt + 1}/{max_retries}: {e}. Повтор через {current_delay}с..."
                        )
                        time.sleep(current_delay)
                    else:
                        # Последняя попытка не удалась
                        download_logger.error(
                            f"Ошибка скачивания с прогрессом после {max_retries} попыток: {e}"
                        )
                        raise

        except Exception as e:
            download_logger.error(f"Ошибка скачивания с прогрессом: {e}")
            raise

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

    def _get_track_cover_url(self, track) -> Optional[str]:
        """
        Получить URL обложки трека

        Args:
            track: Объект трека

        Returns:
            URL обложки или None
        """
        try:
            # Сначала пробуем получить обложку из альбома
            if track.albums and len(track.albums) > 0:
                album = track.albums[0]
                if hasattr(album, "cover_uri") and album.cover_uri:
                    return f"https://{album.cover_uri.replace('%%', '400x400')}"
                elif hasattr(album, "cover") and album.cover and album.cover.uri:
                    return f"https://{album.cover.uri.replace('%%', '400x400')}"

            # Если нет обложки альбома, пробуем получить из трека напрямую
            if hasattr(track, "cover_uri") and track.cover_uri:
                return f"https://{track.cover_uri.replace('%%', '400x400')}"
            elif hasattr(track, "cover") and track.cover and track.cover.uri:
                return f"https://{track.cover.uri.replace('%%', '400x400')}"

        except Exception as e:
            print(f"Ошибка получения обложки трека: {e}")
            pass
        return None

    def _get_first_track_cover(self, playlist) -> Optional[str]:
        """
        Получить обложку первого трека плейлиста

        Args:
            playlist: Объект плейлиста

        Returns:
            URL обложки первого трека или None
        """
        try:
            # Получаем первые несколько треков плейлиста
            tracks = playlist.fetch_tracks()
            if not tracks or len(tracks) == 0:
                return None

            # Пробуем найти трек с обложкой среди первых треков
            for i, track_short in enumerate(tracks[:5]):  # Проверяем первые 5 треков
                if track_short.track:
                    cover_url = self._get_track_cover_url(track_short.track)
                    if cover_url:
                        print(
                            f"Найдена обложка для плейлиста {playlist.title} из трека {i+1}"
                        )
                        return cover_url

            return None

        except Exception as e:
            print(
                f"Ошибка получения обложки первого трека для плейлиста {getattr(playlist, 'title', 'Unknown')}: {e}"
            )
            return None

    def load_playlist_covers_background(self, playlists: List[dict]) -> List[dict]:
        """
        Догрузить обложки для плейлистов в фоне

        Args:
            playlists: Список плейлистов без обложек

        Returns:
            Список плейлистов с обложками
        """
        print("🔄 Начинаем догрузку обложек плейлистов...")

        if not self.client:
            if not self.connect():
                print("❌ Не удалось подключиться к Яндекс.Музыке для догрузки обложек")
                return playlists

        try:
            # Получаем все плейлисты для поиска обложек
            all_playlists = self.client.users_playlists_list()
            playlist_map = {str(p.kind): p for p in all_playlists}

            updated_playlists = []

            for playlist_data in playlists:
                try:
                    playlist_id = playlist_data["id"]

                    # Пропускаем плейлист "Мне нравится"
                    if playlist_id == "likes":
                        updated_playlists.append(playlist_data)
                        continue

                    # Ищем соответствующий плейлист
                    if playlist_id in playlist_map:
                        playlist_obj = playlist_map[playlist_id]

                        # Получаем обложку плейлиста или обложку первого трека
                        cover_url = self._get_cover_url(playlist_obj)
                        if not cover_url:
                            cover_url = self._get_first_track_cover(playlist_obj)

                        # Обновляем данные плейлиста
                        playlist_data["cover"] = cover_url

                        if cover_url:
                            print(
                                f"✅ Обложка загружена для плейлиста: {playlist_data['title']}"
                            )
                        else:
                            print(
                                f"⚠️  Обложка не найдена для плейлиста: {playlist_data['title']}"
                            )

                    updated_playlists.append(playlist_data)

                except Exception as e:
                    print(
                        f"❌ Ошибка догрузки обложки для плейлиста {playlist_data.get('title', 'Unknown')}: {e}"
                    )
                    updated_playlists.append(playlist_data)
                    continue

            print(
                f"✅ Догрузка обложек завершена для {len(updated_playlists)} плейлистов"
            )
            return updated_playlists

        except Exception as e:
            print(f"❌ Ошибка догрузки обложек: {e}")
            return playlists
