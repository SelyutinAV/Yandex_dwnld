"""
Менеджер очереди загрузок с поддержкой FLAC
Поштучная обработка треков с возможностью паузы/возобновления
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional, Dict, List, Callable
from pathlib import Path

from db_manager import DatabaseManager, db_manager
from yandex_client import YandexMusicClient

logger = logging.getLogger("download_queue")
download_logger = logging.getLogger("download")


class DownloadQueueManager:
    """Менеджер очереди загрузок с поштучной обработкой"""

    def __init__(
        self,
        db_manager: DatabaseManager,
        yandex_client: YandexMusicClient,
        download_path: str,
    ):
        self.db = db_manager
        self.client = yandex_client
        self.download_path = download_path
        self.is_running = False
        self.is_paused = False
        self.current_track_id: Optional[str] = None
        self.worker_task: Optional[asyncio.Task] = None

    def clear_queue(
        self, clear_completed: bool = True, clear_pending: bool = True
    ) -> Dict:
        """
        Очистить очередь загрузок

        Args:
            clear_completed: Очистить завершенные загрузки
            clear_pending: Очистить ожидающие загрузки

        Returns:
            {cleared: int, message: str}
        """
        cleared_count = 0

        if clear_completed:
            cleared_count += self.db.clear_download_queue_by_status("completed")

        if clear_pending:
            cleared_count += self.db.clear_download_queue_by_status("pending")
            cleared_count += self.db.clear_download_queue_by_status("queued")
            cleared_count += self.db.clear_download_queue_by_status("downloading")
            cleared_count += self.db.clear_download_queue_by_status("error")

        logger.info(f"✅ Очищено из очереди: {cleared_count} треков")

        return {
            "cleared": cleared_count,
            "message": f"Очищено {cleared_count} треков из очереди",
        }

    def add_tracks(
        self,
        tracks: List[Dict],
        quality: str = "lossless",
        clear_previous: bool = False,
    ) -> Dict:
        """
        Добавить треки в очередь загрузки

        Args:
            tracks: List[{id, title, artist, album}]
            quality: lossless, hq, nq
            clear_previous: Очистить предыдущие загрузки перед добавлением новых

        Returns:
            {added: int, skipped: int, duplicates: [], cleared: int}
        """
        cleared_count = 0

        # Очищаем предыдущие загрузки если нужно
        if clear_previous:
            clear_result = self.clear_queue(clear_completed=True, clear_pending=True)
            cleared_count = clear_result["cleared"]

            # Очищаем статистику файлов для новой сессии
            try:
                self.db.clear_file_statistics()
                logger.info(f"🗑️  Статистика файлов очищена для новой сессии")
            except Exception as e:
                logger.warning(f"⚠️  Не удалось очистить статистику файлов: {e}")
        added = 0
        skipped = 0
        duplicates = []

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            for track in tracks:
                # Проверяем, нет ли уже в очереди
                cursor.execute(
                    "SELECT id FROM download_queue WHERE track_id = ? AND status != 'error'",
                    (track["id"],),
                )

                if cursor.fetchone():
                    duplicates.append(track["title"])
                    skipped += 1
                    continue

                # Добавляем в очередь
                cursor.execute(
                    """
                    INSERT INTO download_queue 
                    (track_id, title, artist, album, playlist, quality, status, progress, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
                """,
                    (
                        track["id"],
                        track.get("title", "Unknown"),
                        track.get("artist", "Unknown"),
                        track.get("album", ""),
                        track.get("playlist", ""),
                        quality,
                        datetime.now().isoformat(),
                        datetime.now().isoformat(),
                    ),
                )
                added += 1

            conn.commit()

        logger.info(f"✅ Добавлено в очередь: {added} треков (пропущено: {skipped})")

        return {
            "added": added,
            "skipped": skipped,
            "duplicates": duplicates,
            "cleared": cleared_count,
        }

    def get_queue(self, limit: Optional[int] = None) -> List[Dict]:
        """Получить список треков в очереди"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, track_id, title, artist, album, playlist_id, cover, status, progress, 
                       quality, error_message, created_at, updated_at
                FROM download_queue
                ORDER BY 
                    CASE status
                        WHEN 'downloading' THEN 1
                        WHEN 'pending' THEN 2
                        WHEN 'paused' THEN 3
                        WHEN 'error' THEN 4
                        WHEN 'completed' THEN 5
                    END,
                    created_at ASC
            """

            if limit:
                query += f" LIMIT {limit}"

            cursor.execute(query)
            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()

            return [dict(zip(columns, row)) for row in rows]

    def get_stats(self) -> Dict:
        """Получить статистику очереди"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'pending'"
            )
            pending = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'queued'"
            )
            queued = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'downloading'"
            )
            downloading = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'completed'"
            )
            completed = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'error'")
            errors = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM download_queue")
            queue_total = cursor.fetchone()[0]

            # Получаем общее количество файлов в БД
            cursor.execute("SELECT COUNT(*) FROM downloaded_tracks")
            total_files_in_db = cursor.fetchone()[0]

            # Получаем общий размер файлов в БД
            cursor.execute(
                "SELECT SUM(file_size) FROM downloaded_tracks WHERE file_size IS NOT NULL"
            )
            total_size_mb = cursor.fetchone()[0] or 0
            total_size_gb = round(total_size_mb / 1024, 2) if total_size_mb > 0 else 0

            return {
                # Общая статистика (вся база данных)
                "general_stats": {
                    "total_files": total_files_in_db,
                    "total_size_mb": round(total_size_mb, 2),
                    "total_size_gb": total_size_gb,
                },
                # Статистика текущей сессии (очередь загрузок)
                "session_stats": {
                    "pending": pending,
                    "queued": queued,
                    "downloading": downloading,
                    "completed": completed,
                    "errors": errors,
                    "total_in_queue": queue_total,
                },
                # Состояние системы
                "system_state": {
                    "is_running": self.is_running,
                    "is_paused": self.is_paused,
                    "current_track_id": self.current_track_id,
                },
            }

    def clear_completed(self) -> int:
        """Удалить завершённые треки из очереди"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM download_queue WHERE status = 'completed'")
            deleted = cursor.rowcount
            conn.commit()

        logger.info(f"🗑️  Удалено завершённых треков: {deleted}")
        return deleted

    def remove_track(self, track_id: str) -> bool:
        """Удалить трек из очереди"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Нельзя удалить трек который сейчас скачивается
            if self.current_track_id == track_id:
                logger.warning(
                    f"⚠️  Нельзя удалить трек {track_id} - он сейчас скачивается"
                )
                return False

            cursor.execute("DELETE FROM download_queue WHERE track_id = ?", (track_id,))
            deleted = cursor.rowcount > 0
            conn.commit()

        return deleted

    async def start(self):
        """Запустить обработку очереди"""
        if self.is_running:
            logger.info("⚠️  Воркер уже запущен")
            return {"status": "already_running"}

        # Переводим треки из pending в queued (если есть)
        # И возвращаем зависшие треки из downloading в queued
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Переводим pending в queued
            cursor.execute(
                """
                UPDATE download_queue 
                SET status = 'queued', updated_at = ?
                WHERE status = 'pending'
            """,
                (datetime.now().isoformat(),),
            )

            # Возвращаем зависшие треки из downloading в queued
            cursor.execute(
                """
                UPDATE download_queue 
                SET status = 'queued', progress = 0, updated_at = ?
                WHERE status = 'downloading'
            """,
                (datetime.now().isoformat(),),
            )

            # Получаем количество возвращенных треков
            reset_count = cursor.rowcount

            conn.commit()

            if reset_count > 0:
                logger.info(
                    f"🔄 Возвращено {reset_count} зависших треков из downloading в queued"
                )

        # Проверяем есть ли треки для загрузки (queued + downloading) ПОСЛЕ обновления статусов
        stats = self.get_stats()
        session_stats = stats.get("session_stats", {})
        queued_count = session_stats.get("queued", 0)
        downloading_count = session_stats.get("downloading", 0)

        if queued_count == 0 and downloading_count == 0:
            return {"status": "empty", "message": "Нет треков для загрузки"}

        # Запускаем воркер
        self.is_running = True
        self.is_paused = False
        self.worker_task = asyncio.create_task(self._worker())

        logger.info(f"🚀 Запущена загрузка {session_stats.get('queued', 0)} треков")

        return {"status": "started", "queued": session_stats.get("queued", 0)}

    def pause(self):
        """Приостановить загрузку"""
        if not self.is_running:
            return {"status": "not_running"}

        self.is_paused = True
        logger.info("⏸️  Загрузка приостановлена")

        return {"status": "paused"}

    def resume(self):
        """Возобновить загрузку"""
        if not self.is_running:
            return {"status": "not_running"}

        if not self.is_paused:
            return {"status": "not_paused"}

        self.is_paused = False
        logger.info("▶️  Загрузка возобновлена")

        return {"status": "resumed"}

    def stop(self):
        """Остановить загрузку"""
        if not self.is_running:
            return {"status": "not_running"}

        self.is_running = False
        self.is_paused = False

        if self.worker_task:
            self.worker_task.cancel()

        logger.info("🛑 Загрузка остановлена")

        return {"status": "stopped"}

    def restart(self):
        """Принудительно перезапустить воркер загрузки"""
        logger.info("🔄 Принудительный перезапуск воркера загрузки")

        # Останавливаем текущий воркер
        if self.is_running:
            self.is_running = False
            if self.worker_task:
                self.worker_task.cancel()

        # Сбрасываем состояние паузы
        self.is_paused = False

        # Запускаем новый воркер асинхронно
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Если цикл уже запущен, создаем задачу
                task = loop.create_task(self.start())
                return {"status": "restarting", "message": "Воркер перезапускается"}
            else:
                # Если цикл не запущен, запускаем его
                return loop.run_until_complete(self.start())
        except RuntimeError:
            # Если нет цикла событий, создаем новый
            return asyncio.run(self.start())

    async def _worker(self):
        """Фоновый воркер для поштучной обработки очереди"""
        logger.info("👷 Воркер загрузки запущен")

        try:
            while self.is_running:
                # Проверяем паузу
                if self.is_paused:
                    await asyncio.sleep(1)
                    continue

                # Получаем следующий трек
                next_track = self._get_next_track()

                if not next_track:
                    # Нет треков для загрузки
                    logger.info("✅ Все треки обработаны")
                    self.is_running = False
                    break

                # Скачиваем трек
                await self._download_track(next_track)

                # Небольшая пауза между треками
                await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            logger.info("⏹️  Воркер отменён")
        except Exception as e:
            logger.error(f"❌ Ошибка в воркере: {e}")
            import traceback

            logger.error(traceback.format_exc())
        finally:
            self.is_running = False
            self.current_track_id = None
            logger.info("👷 Воркер загрузки завершён")

    def _get_next_track(self) -> Optional[Dict]:
        """Получить следующий трек для загрузки"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, track_id, title, artist, album, playlist_id, cover, quality
                FROM download_queue
                WHERE status = 'queued'
                ORDER BY created_at ASC
                LIMIT 1
            """
            )

            row = cursor.fetchone()

            if not row:
                return None

            return {
                "db_id": row[0],
                "track_id": row[1],
                "title": row[2],
                "artist": row[3],
                "album": row[4],
                "playlist": row[5],  # playlist_id из БД
                "cover": row[6],
                "quality": row[7],
            }

    def _update_track_status(
        self,
        track_id: str,
        status: str,
        progress: int = 0,
        error: str = None,
    ):
        """Обновить статус трека в БД"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            update_fields = ["status = ?", "progress = ?", "updated_at = ?"]
            values = [status, progress, datetime.now().isoformat()]

            if error:
                update_fields.append("error_message = ?")
                values.append(error)

            values.append(track_id)

            cursor.execute(
                f"""
                UPDATE download_queue
                SET {', '.join(update_fields)}
                WHERE track_id = ?
            """,
                values,
            )

            conn.commit()

    def _remove_track_from_queue(self, track_id: str):
        """Удалить трек из очереди после успешной загрузки"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM download_queue WHERE track_id = ?", (track_id,))
            conn.commit()
            logger.info(f"🗑️  Трек {track_id} удален из очереди")

    def cleanup_completed_tracks(self, older_than_hours: int = 24):
        """
        Удаляет завершенные треки из очереди, которые старше указанного времени

        Args:
            older_than_hours: Удалять треки старше указанного количества часов
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Удаляем завершенные треки старше указанного времени
            cursor.execute(
                """
                DELETE FROM download_queue 
                WHERE status = 'completed' 
                AND datetime(created_at) < datetime('now', '-{} hours')
            """.format(
                    older_than_hours
                )
            )

            deleted_count = cursor.rowcount
            conn.commit()

            if deleted_count > 0:
                logger.info(f"🗑️  Удалено {deleted_count} завершенных треков из очереди")

            return deleted_count

    async def _download_track(self, track: Dict):
        """Скачать один трек"""
        track_id = track["track_id"]
        self.current_track_id = track_id

        logger.info(f"📥 Начинаем загрузку: {track['title']} - {track['artist']}")

        try:
            # Обновляем статус на 'downloading'
            self._update_track_status(track_id, "downloading", 0)

            # Формируем путь для сохранения
            artist = self._sanitize_filename(track["artist"])
            album = (
                self._sanitize_filename(track["album"])
                if track["album"]
                else "Unknown Album"
            )
            title = self._sanitize_filename(track["title"])

            # Строим путь к файлу на основе настроек
            quality = track.get(
                "quality", "lossless"
            )  # Используем значение по умолчанию
            output_path, track_dir = self._build_file_path(track, quality)

            # Создаём директорию если её нет
            track_dir.mkdir(parents=True, exist_ok=True)

            # Колбэк для обновления прогресса
            def progress_callback(downloaded: int, total: int):
                if total > 0:
                    progress = int((downloaded / total) * 100)
                    self._update_track_status(track_id, "downloading", progress)

            # Скачиваем трек используя существующий клиент
            result = await asyncio.to_thread(
                self.client.download_track,
                track_id=track_id,
                output_path=str(output_path),
                quality=quality,
                progress_callback=progress_callback,
            )

            if result:
                # Успешно скачан
                self._update_track_status(track_id, "completed", 100)

                # Сохраняем информацию о загруженном треке в downloaded_tracks
                logger.info(
                    f"🔄 Вызываем _save_downloaded_track_info для {track['title']}"
                )
                self._save_downloaded_track_info(track, str(output_path), quality)

                # НЕ удаляем трек из очереди сразу - оставляем для отображения в плашке "Завершено"
                # Трек будет удален автоматически через некоторое время или при следующей проверке файлов

                logger.info(f"✅ Успешно: {track['title']}")
            else:
                # Ошибка загрузки
                logger.error(f"❌ result = {result}, файл не скачан: {track['title']}")
                self._update_track_status(
                    track_id, "error", 0, error="Не удалось скачать файл"
                )
                logger.error(f"❌ Ошибка: {track['title']}")

        except Exception as e:
            logger.error(f"❌ Ошибка загрузки {track['title']}: {e}")
            self._update_track_status(track_id, "error", 0, error=str(e))

        finally:
            self.current_track_id = None

    def _save_downloaded_track_info(self, track: dict, file_path: str, quality: str):
        """
        Сохраняет информацию о загруженном треке в downloaded_tracks

        Args:
            track: Информация о треке
            file_path: Путь к загруженному файлу
            quality: Качество загрузки
        """
        try:
            import os
            import requests
            from datetime import datetime
            from audio_quality_utils import (
                standardize_yandex_quality,
                determine_audio_quality,
            )

            logger.info(
                f"💾 Сохраняем информацию о треке: {track['title']} - {track['artist']}"
            )

            # Получаем размер файла
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # в МБ
            else:
                logger.warning(f"⚠️  Файл не найден: {file_path}")
                file_size = 0

            # Определяем качество файла
            if os.path.exists(file_path):
                quality_info = determine_audio_quality(file_path)
            else:
                quality_info = standardize_yandex_quality(quality)

            # Если не удалось определить качество из файла, используем стандартизированное
            if quality_info["quality_level"] == "Unknown Quality":
                quality_info = standardize_yandex_quality(quality)

            # Получаем обложку из очереди и скачиваем её
            cover_data = None
            if track.get("cover"):
                try:
                    response = requests.get(track["cover"], timeout=10)
                    if response.status_code == 200:
                        cover_data = response.content
                        logger.info(f"✅ Обложка скачана для {track['title']}")
                except Exception as e:
                    logger.warning(
                        f"⚠️ Не удалось скачать обложку для {track['title']}: {e}"
                    )

            # Сохраняем в базу данных
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO downloaded_tracks 
                    (track_id, title, artist, album, playlist_id, file_path, file_size, format, quality, cover_data, download_date,
                     year, genre, label, isrc, duration, version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        track["track_id"],
                        track["title"],
                        track["artist"],
                        track.get("album", ""),
                        track.get("playlist", "") or "Unknown Playlist",
                        file_path,
                        round(file_size, 2),
                        quality_info["format"],
                        quality_info["quality_string"],
                        cover_data,
                        datetime.now().isoformat(),
                        track.get("year"),
                        track.get("genre"),
                        track.get("label"),
                        track.get("isrc"),
                        track.get("duration"),
                        track.get("version"),
                    ),
                )
                conn.commit()

                logger.info(
                    f"✅ Информация о треке сохранена в базу данных: {track['title']}"
                )

            # Обновляем статистику файлов
            try:
                db_manager.update_file_statistics()
                logger.info(f"✅ Статистика файлов обновлена для {track['title']}")
            except Exception as e:
                logger.warning(f"⚠️ Не удалось обновить статистику файлов: {e}")

        except Exception as e:
            logger.error(f"Ошибка сохранения информации о загруженном треке: {e}")

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Очистить имя файла от недопустимых символов"""
        # Проверяем, что name не None
        if name is None:
            return "Unknown"

        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            name = name.replace(char, "_")
        return name.strip()

    def _build_file_path(self, track: dict, quality: str) -> tuple[Path, Path]:
        """
        Строит путь к файлу на основе настроек пользователя

        Args:
            track: Информация о треке
            quality: Качество загрузки

        Returns:
            tuple: (полный_путь_к_файлу, директория_для_создания)
        """
        from pathlib import Path

        # Получаем настройки из базы данных
        settings = db_manager.get_all_settings()
        file_template = settings.get("file_template", "{artist} - {title}")
        folder_structure = settings.get("folder_structure", "{artist}/{album}")

        # Подготавливаем данные для подстановки
        artist = self._sanitize_filename(track["artist"])
        title = self._sanitize_filename(track["title"])
        album = (
            self._sanitize_filename(track["album"])
            if track["album"]
            else "Unknown Album"
        )
        year = track.get("year", "")
        track_num = track.get("track_number", "")
        playlist = self._sanitize_filename(track.get("playlist", ""))

        # Преобразуем track_number в число для форматирования
        try:
            track_num_int = int(track_num) if track_num else 0
        except (ValueError, TypeError):
            track_num_int = 0

        # Определяем расширение
        extension = ".flac" if quality == "lossless" else ".mp3"

        # Формируем имя файла
        filename = (
            file_template.format(
                artist=artist,
                title=title,
                album=album,
                year=year,
                track=track_num_int,  # Используем число для форматирования
                playlist=playlist,
            )
            + extension
        )

        # Формируем структуру папок
        folder_path = folder_structure.format(
            artist=artist, album=album, year=year, playlist=playlist
        )

        # Убираем ведущий слеш если есть
        folder_path = folder_path.lstrip("/")

        # Создаём полный путь
        track_dir = Path(self.download_path) / folder_path
        output_path = track_dir / filename

        return output_path, track_dir
