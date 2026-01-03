"""
Утилита для обновления метаданных существующих треков в базе данных
"""

import logging
import time
from typing import List, Dict, Optional
from db_manager import db_manager

logger = logging.getLogger("metadata_updater")


class MetadataUpdater:
    """Класс для обновления метаданных существующих треков"""

    def __init__(self, yandex_client=None):
        """
        Инициализация обновлятора метаданных

        Args:
            yandex_client: Экземпляр YandexMusicClient для получения метаданных из API
        """
        self.yandex_client = yandex_client
        self.updated_count = 0
        self.failed_count = 0
        self.skipped_count = 0

    def update_track_from_api(self, track_id: str, track_data: Dict) -> bool:
        """
        Обновить метаданные трека из API Яндекс.Музыки

        Args:
            track_id: ID трека
            track_data: Данные трека из БД

        Returns:
            True если обновление успешно
        """
        if not self.yandex_client or not self.yandex_client.client:
            logger.warning(f"⚠️  Клиент Яндекс.Музыки не инициализирован для трека {track_id}")
            return False

        try:
            # Пропускаем scanned файлы (они не имеют валидного track_id)
            if track_id.startswith("scanned_"):
                return False

            # Получаем информацию о треке через API
            tracks_result = self.yandex_client.client.tracks([track_id])
            if not tracks_result or len(tracks_result) == 0:
                logger.warning(f"⚠️  Трек {track_id} не найден в API")
                return False

            track = tracks_result[0]

            # Извлекаем метаданные
            year = None
            genre = None
            label = None
            version = None
            duration = track.duration_ms // 1000 if track.duration_ms else None

            if track.albums and len(track.albums) > 0:
                album = track.albums[0]
                year = getattr(album, "year", None)
                genre = getattr(album, "genre", None)
                if hasattr(album, "labels") and album.labels and len(album.labels) > 0:
                    label = getattr(album.labels[0], "name", None)
                version = getattr(album, "version", None)

            if not version:
                version = getattr(track, "version", None)

            # ISRC
            isrc = None
            if hasattr(track, "isrc"):
                isrc = track.isrc
            elif hasattr(track, "albums") and track.albums:
                for album in track.albums:
                    if hasattr(album, "isrc"):
                        isrc = album.isrc
                        break

            # Обновляем запись в БД
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE downloaded_tracks 
                    SET year = ?, genre = ?, label = ?, isrc = ?, duration = ?, version = ?
                    WHERE track_id = ?
                """,
                    (year, genre, label, isrc, duration, version, track_id),
                )
                conn.commit()

            logger.info(f"✅ Обновлены метаданные для трека {track_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Ошибка обновления метаданных для трека {track_id}: {e}")
            return False

    def update_track_from_file(self, file_path: str) -> bool:
        """
        Обновить метаданные трека из тегов файла

        Args:
            file_path: Путь к файлу

        Returns:
            True если обновление успешно
        """
        try:
            import os
            from pathlib import Path

            if not os.path.exists(file_path):
                return False

            file_ext = Path(file_path).suffix.lower()
            year = None
            genre = None
            label = None
            duration = None
            version = None

            if file_ext == ".mp3":
                from mutagen.mp3 import MP3

                audio = MP3(file_path)
                if audio.tags:
                    # Год
                    if "TDRC" in audio.tags:
                        year_str = str(audio.tags["TDRC"][0])
                        try:
                            year = int(year_str[:4]) if year_str else None
                        except (ValueError, TypeError):
                            pass

                    # Жанр
                    if "TCON" in audio.tags:
                        genre = str(audio.tags["TCON"][0])

                    # Лейбл
                    if "TPUB" in audio.tags:
                        label = str(audio.tags["TPUB"][0])

                    # Версия
                    if "TIT3" in audio.tags:
                        version = str(audio.tags["TIT3"][0])

                if audio.info:
                    duration = int(audio.info.length)

            elif file_ext == ".flac":
                from mutagen.flac import FLAC

                audio = FLAC(file_path)

                # Год
                if "date" in audio:
                    year_str = str(audio["date"][0])
                    try:
                        year = int(year_str[:4]) if year_str else None
                    except (ValueError, TypeError):
                        pass

                # Жанр
                if "genre" in audio:
                    genre = str(audio["genre"][0])

                # Лейбл
                if "label" in audio:
                    label = str(audio["label"][0])
                elif "organization" in audio:
                    label = str(audio["organization"][0])

                # Версия
                if "version" in audio:
                    version = str(audio["version"][0])

                if audio.info:
                    duration = int(audio.info.length)

            # Обновляем запись в БД по file_path
            if year or genre or label or duration or version:
                with db_manager.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        UPDATE downloaded_tracks 
                        SET year = COALESCE(?, year), 
                            genre = COALESCE(?, genre), 
                            label = COALESCE(?, label), 
                            duration = COALESCE(?, duration), 
                            version = COALESCE(?, version)
                        WHERE file_path = ?
                    """,
                        (year, genre, label, duration, version, file_path),
                    )
                    conn.commit()

                logger.info(f"✅ Обновлены метаданные из файла: {file_path}")
                return True

            return False

        except Exception as e:
            logger.error(f"❌ Ошибка обновления метаданных из файла {file_path}: {e}")
            return False

    def update_existing_tracks_metadata(
        self, batch_size: int = 50, track_ids: Optional[List[str]] = None
    ) -> Dict:
        """
        Обновить метаданные для существующих треков

        Args:
            batch_size: Размер батча для обработки
            track_ids: Список конкретных track_id для обновления (если None - обновить все)

        Returns:
            Словарь с результатами обновления
        """
        self.updated_count = 0
        self.failed_count = 0
        self.skipped_count = 0

        try:
            # Получаем треки из БД
            if track_ids:
                # Получаем только указанные треки
                all_tracks = db_manager.get_downloaded_tracks(limit=10000)
                tracks = [t for t in all_tracks if t["track_id"] in track_ids]
            else:
                # Получаем все треки где новые поля NULL
                all_tracks = db_manager.get_downloaded_tracks(limit=10000)
                tracks = [
                    t
                    for t in all_tracks
                    if not t.get("year")
                    and not t.get("genre")
                    and not t.get("label")
                    and not t.get("isrc")
                    and not t.get("duration")
                    and not t.get("version")
                ]

            total_tracks = len(tracks)
            logger.info(f"🔄 Найдено треков для обновления: {total_tracks}")

            # Обрабатываем батчами
            for i in range(0, total_tracks, batch_size):
                batch = tracks[i : i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (total_tracks + batch_size - 1) // batch_size

                logger.info(
                    f"📦 Обрабатываем батч {batch_num}/{total_batches} ({len(batch)} треков)"
                )

                for track in batch:
                    track_id = track.get("track_id")
                    file_path = track.get("file_path")

                    # Пробуем обновить из API если есть валидный track_id
                    if track_id and not track_id.startswith("scanned_"):
                        if self.update_track_from_api(track_id, track):
                            self.updated_count += 1
                        else:
                            self.failed_count += 1
                    # Иначе пробуем обновить из файла
                    elif file_path:
                        if self.update_track_from_file(file_path):
                            self.updated_count += 1
                        else:
                            self.skipped_count += 1
                    else:
                        self.skipped_count += 1

                    # Небольшая задержка между треками для снижения нагрузки
                    time.sleep(0.1)

                # Задержка между батчами
                if i + batch_size < total_tracks:
                    time.sleep(0.5)

            logger.info(
                f"✅ Обновление завершено: обновлено {self.updated_count}, "
                f"ошибок {self.failed_count}, пропущено {self.skipped_count}"
            )

            return {
                "total": total_tracks,
                "updated": self.updated_count,
                "failed": self.failed_count,
                "skipped": self.skipped_count,
            }

        except Exception as e:
            logger.error(f"❌ Ошибка обновления метаданных: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "total": 0,
                "updated": self.updated_count,
                "failed": self.failed_count,
                "skipped": self.skipped_count,
                "error": str(e),
            }

