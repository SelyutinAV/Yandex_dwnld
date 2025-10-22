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

from db_manager import DatabaseManager
from yandex_client import YandexMusicClient

logger = logging.getLogger('download_queue')
download_logger = logging.getLogger('download')


class DownloadQueueManager:
    """Менеджер очереди загрузок с поштучной обработкой"""
    
    def __init__(self, db_manager: DatabaseManager, yandex_client: YandexMusicClient, download_path: str):
        self.db = db_manager
        self.client = yandex_client
        self.download_path = download_path
        self.is_running = False
        self.is_paused = False
        self.current_track_id: Optional[str] = None
        self.worker_task: Optional[asyncio.Task] = None
        
    def add_tracks(self, tracks: List[Dict], quality: str = 'lossless') -> Dict:
        """
        Добавить треки в очередь загрузки
        
        Args:
            tracks: List[{id, title, artist, album}]
            quality: lossless, hq, nq
            
        Returns:
            {added: int, skipped: int, duplicates: []}
        """
        added = 0
        skipped = 0
        duplicates = []
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            for track in tracks:
                # Проверяем, нет ли уже в очереди
                cursor.execute(
                    "SELECT id FROM download_queue WHERE track_id = ? AND status != 'error'",
                    (track['id'],)
                )
                
                if cursor.fetchone():
                    duplicates.append(track['title'])
                    skipped += 1
                    continue
                
                # Добавляем в очередь
                cursor.execute("""
                    INSERT INTO download_queue 
                    (track_id, title, artist, album, quality, status, progress, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
                """, (
                    track['id'],
                    track.get('title', 'Unknown'),
                    track.get('artist', 'Unknown'),
                    track.get('album', ''),
                    quality,
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
                added += 1
            
            conn.commit()
        
        logger.info(f"✅ Добавлено в очередь: {added} треков (пропущено: {skipped})")
        
        return {
            'added': added,
            'skipped': skipped,
            'duplicates': duplicates
        }
    
    def get_queue(self, limit: Optional[int] = None) -> List[Dict]:
        """Получить список треков в очереди"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT id, track_id, title, artist, album, status, progress, 
                       quality, file_path, error_message, created_at, updated_at
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
            
            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'pending'")
            pending = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'downloading'")
            downloading = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'completed'")
            completed = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'error'")
            errors = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM download_queue")
            total = cursor.fetchone()[0]
            
            return {
                'pending': pending,
                'downloading': downloading,
                'completed': completed,
                'errors': errors,
                'total': total,
                'is_running': self.is_running,
                'is_paused': self.is_paused,
                'current_track_id': self.current_track_id
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
                logger.warning(f"⚠️  Нельзя удалить трек {track_id} - он сейчас скачивается")
                return False
            
            cursor.execute("DELETE FROM download_queue WHERE track_id = ?", (track_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
        
        return deleted
    
    async def start(self):
        """Запустить обработку очереди"""
        if self.is_running:
            logger.info("⚠️  Воркер уже запущен")
            return {'status': 'already_running'}
        
        # Проверяем есть ли треки для загрузки
        stats = self.get_stats()
        if stats['pending'] == 0:
            return {'status': 'empty', 'message': 'Нет треков для загрузки'}
        
        # Запускаем воркер
        self.is_running = True
        self.is_paused = False
        self.worker_task = asyncio.create_task(self._worker())
        
        logger.info(f"🚀 Запущена загрузка {stats['pending']} треков")
        
        return {
            'status': 'started',
            'pending': stats['pending']
        }
    
    def pause(self):
        """Приостановить загрузку"""
        if not self.is_running:
            return {'status': 'not_running'}
        
        self.is_paused = True
        logger.info("⏸️  Загрузка приостановлена")
        
        return {'status': 'paused'}
    
    def resume(self):
        """Возобновить загрузку"""
        if not self.is_running:
            return {'status': 'not_running'}
        
        if not self.is_paused:
            return {'status': 'not_paused'}
        
        self.is_paused = False
        logger.info("▶️  Загрузка возобновлена")
        
        return {'status': 'resumed'}
    
    def stop(self):
        """Остановить загрузку"""
        if not self.is_running:
            return {'status': 'not_running'}
        
        self.is_running = False
        self.is_paused = False
        
        if self.worker_task:
            self.worker_task.cancel()
        
        logger.info("🛑 Загрузка остановлена")
        
        return {'status': 'stopped'}
    
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
            cursor.execute("""
                SELECT id, track_id, title, artist, album, quality
                FROM download_queue
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 1
            """)
            
            row = cursor.fetchone()
            
            if not row:
                return None
            
            return {
                'db_id': row[0],
                'track_id': row[1],
                'title': row[2],
                'artist': row[3],
                'album': row[4],
                'quality': row[5]
            }
    
    def _update_track_status(self, track_id: str, status: str, progress: int = 0, 
                            file_path: str = None, error: str = None):
        """Обновить статус трека в БД"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            update_fields = ['status = ?', 'progress = ?', 'updated_at = ?']
            values = [status, progress, datetime.now().isoformat()]
            
            if file_path:
                update_fields.append('file_path = ?')
                values.append(file_path)
            
            if error:
                update_fields.append('error_message = ?')
                values.append(error)
            
            values.append(track_id)
            
            cursor.execute(f"""
                UPDATE download_queue
                SET {', '.join(update_fields)}
                WHERE track_id = ?
            """, values)
            
            conn.commit()
    
    async def _download_track(self, track: Dict):
        """Скачать один трек"""
        track_id = track['track_id']
        self.current_track_id = track_id
        
        logger.info(f"📥 Начинаем загрузку: {track['title']} - {track['artist']}")
        
        try:
            # Обновляем статус на 'downloading'
            self._update_track_status(track_id, 'downloading', 0)
            
            # Формируем путь для сохранения
            artist = self._sanitize_filename(track['artist'])
            album = self._sanitize_filename(track['album']) if track['album'] else 'Unknown Album'
            title = self._sanitize_filename(track['title'])
            
            # Определяем расширение по качеству
            extension = '.flac' if track['quality'] == 'lossless' else '.mp3'
            filename = f"{artist} - {title}{extension}"
            
            # Создаём путь к файлу
            track_dir = Path(self.download_path) / artist / album
            track_dir.mkdir(parents=True, exist_ok=True)
            
            output_path = track_dir / filename
            
            # Колбэк для обновления прогресса
            def progress_callback(downloaded: int, total: int):
                if total > 0:
                    progress = int((downloaded / total) * 100)
                    self._update_track_status(track_id, 'downloading', progress)
            
            # Скачиваем трек используя существующий клиент
            result = await asyncio.to_thread(
                self.client.download_track,
                track_id=track_id,
                output_path=str(output_path),
                quality=track['quality'],
                progress_callback=progress_callback
            )
            
            if result:
                # Успешно скачан
                self._update_track_status(track_id, 'completed', 100, str(output_path))
                logger.info(f"✅ Успешно: {track['title']}")
            else:
                # Ошибка загрузки
                self._update_track_status(track_id, 'error', 0, error='Не удалось скачать файл')
                logger.error(f"❌ Ошибка: {track['title']}")
                
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки {track['title']}: {e}")
            self._update_track_status(track_id, 'error', 0, error=str(e))
        
        finally:
            self.current_track_id = None
    
    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Очистить имя файла от недопустимых символов"""
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            name = name.replace(char, '_')
        return name.strip()

