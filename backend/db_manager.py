"""
Простой менеджер базы данных для работы с SQLite
"""
import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional
from contextlib import contextmanager


class DatabaseManager:
    """Менеджер базы данных"""
    
    def __init__(self, db_path: str = None):
        """Инициализация менеджера БД"""
        if not db_path:
            db_path = os.path.join(os.path.dirname(__file__), 'yandex_music.db')
        self.db_path = db_path
        self._init_database()
    
    @contextmanager
    def get_connection(self):
        """Контекстный менеджер для подключения к БД"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_database(self):
        """Инициализация таблиц БД"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Таблица сохраненных токенов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS saved_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    token TEXT NOT NULL,
                    token_type TEXT NOT NULL,
                    username TEXT,
                    is_active INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_used TEXT
                )
            ''')
            
            # Таблица настроек
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Таблица загруженных треков
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS downloaded_tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    playlist_id TEXT,
                    file_path TEXT NOT NULL,
                    file_size REAL,
                    format TEXT,
                    quality TEXT,
                    download_date TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_checked TEXT DEFAULT CURRENT_TIMESTAMP,
                    is_available INTEGER DEFAULT 1
                )
            ''')
            
            # Таблица очереди загрузок
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS download_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    status TEXT DEFAULT 'pending',
                    progress INTEGER DEFAULT 0,
                    quality TEXT,
                    error_message TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Индексы для быстрого поиска
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_tokens_active ON saved_tokens(is_active)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_downloaded_tracks_date ON downloaded_tracks(download_date)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status)')
            
            conn.commit()
    
    # Методы для работы с токенами
    def get_all_tokens(self) -> List[Dict]:
        """Получить все токены"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, token, token_type, username, is_active, created_at, last_used
                FROM saved_tokens
                ORDER BY is_active DESC, last_used DESC
            """)
            
            tokens = []
            for row in cursor.fetchall():
                tokens.append({
                    "id": row[0],
                    "name": row[1],
                    "token_type": row[3],
                    "username": row[4],
                    "is_active": bool(row[5]),
                    "created_at": row[6],
                    "last_used": row[7],
                    "token_preview": row[2][:20] + "..." if len(row[2]) > 20 else row[2]
                })
            
            return tokens
    
    def get_active_token(self) -> Optional[Dict]:
        """Получить активный токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, token, token_type, username, created_at, last_used
                FROM saved_tokens
                WHERE is_active = 1
                LIMIT 1
            """)
            
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "token": row[2],
                    "token_type": row[3],
                    "username": row[4],
                    "created_at": row[5],
                    "last_used": row[6]
                }
            return None
    
    def save_token(self, name: str, token: str, token_type: str, username: str = None, is_active: bool = True) -> int:
        """Сохранить токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Деактивируем все токены если новый активный
            if is_active:
                cursor.execute("UPDATE saved_tokens SET is_active = 0")
            
            # Проверяем, существует ли токен с таким именем
            cursor.execute("SELECT id FROM saved_tokens WHERE name = ?", (name,))
            existing = cursor.fetchone()
            
            now = datetime.now().isoformat()
            
            if existing:
                # Обновляем существующий токен
                cursor.execute("""
                    UPDATE saved_tokens 
                    SET token = ?, token_type = ?, username = ?, is_active = ?, last_used = ?
                    WHERE id = ?
                """, (token, token_type, username, int(is_active), now, existing[0]))
                token_id = existing[0]
            else:
                # Создаем новый токен
                cursor.execute("""
                    INSERT INTO saved_tokens (name, token, token_type, username, is_active, created_at, last_used)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (name, token, token_type, username, int(is_active), now, now))
                token_id = cursor.lastrowid
            
            conn.commit()
            return token_id
    
    def activate_token(self, token_id: int) -> bool:
        """Активировать токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Деактивируем все токены
            cursor.execute("UPDATE saved_tokens SET is_active = 0")
            
            # Активируем выбранный
            cursor.execute("""
                UPDATE saved_tokens 
                SET is_active = 1, last_used = ?
                WHERE id = ?
            """, (datetime.now().isoformat(), token_id))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def deactivate_token(self, token_id: int) -> bool:
        """Деактивировать токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Деактивируем конкретный токен
            cursor.execute("""
                UPDATE saved_tokens 
                SET is_active = 0
                WHERE id = ?
            """, (token_id,))
            
            conn.commit()
            return cursor.rowcount > 0

    def rename_token(self, token_id: int, new_name: str) -> bool:
        """Переименовать токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("UPDATE saved_tokens SET name = ? WHERE id = ?", (new_name, token_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_token(self, token_id: int) -> bool:
        """Удалить токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM saved_tokens WHERE id = ?", (token_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # Методы для работы с настройками
    def get_setting(self, key: str, default: str = None) -> Optional[str]:
        """Получить настройку"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row[0] if row else default
    
    def save_setting(self, key: str, value: str):
        """Сохранить настройку"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
            """, (key, value, datetime.now().isoformat()))
            
            conn.commit()
    
    def get_all_settings(self) -> Dict[str, str]:
        """Получить все настройки"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings")
            return {row[0]: row[1] for row in cursor.fetchall()}
    
    # Методы для работы с файлами и загрузками
    def get_file_statistics(self) -> Dict:
        """Получить статистику файлов"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица downloaded_tracks
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """)
            if not cursor.fetchone():
                # Если таблица не существует, возвращаем пустую статистику
                return {
                    "totalFiles": 0,
                    "totalSize": 0,
                    "byFormat": {},
                    "byQuality": {}
                }
            
            # Получаем общую статистику
            cursor.execute("SELECT COUNT(*) FROM downloaded_tracks")
            total_files = cursor.fetchone()[0]
            
            cursor.execute("SELECT SUM(file_size) FROM downloaded_tracks WHERE file_size IS NOT NULL")
            total_size = cursor.fetchone()[0] or 0
            
            # Статистика по форматам
            cursor.execute("""
                SELECT format, COUNT(*) as count, SUM(file_size) as size
                FROM downloaded_tracks 
                WHERE format IS NOT NULL
                GROUP BY format
            """)
            by_format = {}
            for row in cursor.fetchall():
                by_format[row[0]] = {
                    "count": row[1],
                    "size": row[2] or 0
                }
            
            # Статистика по качеству
            cursor.execute("""
                SELECT quality, COUNT(*) as count
                FROM downloaded_tracks 
                WHERE quality IS NOT NULL
                GROUP BY quality
            """)
            by_quality = {}
            for row in cursor.fetchall():
                by_quality[row[0]] = row[1]
            
            return {
                "totalFiles": total_files,
                "totalSize": total_size,
                "byFormat": by_format,
                "byQuality": by_quality
            }
    
    def get_recent_downloaded_tracks(self, limit: int = 10) -> List[Dict]:
        """Получить недавно загруженные треки"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица downloaded_tracks
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """)
            if not cursor.fetchone():
                return []
            
            cursor.execute("""
                SELECT track_id, title, artist, album, file_path, file_size, format, quality, download_date
                FROM downloaded_tracks
                ORDER BY download_date DESC
                LIMIT ?
            """, (limit,))
            
            tracks = []
            for row in cursor.fetchall():
                tracks.append({
                    "track_id": row[0],
                    "title": row[1],
                    "artist": row[2],
                    "album": row[3],
                    "file_path": row[4],
                    "file_size": row[5],
                    "format": row[6],
                    "quality": row[7],
                    "download_date": row[8]
                })
            
            return tracks
    
    def get_downloaded_tracks(self, playlist_id: str = None, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Получить список загруженных треков"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица downloaded_tracks
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """)
            if not cursor.fetchone():
                return []
            
            query = """
                SELECT track_id, title, artist, album, playlist_id, file_path, file_size, format, quality, download_date
                FROM downloaded_tracks
            """
            params = []
            
            if playlist_id:
                query += " WHERE playlist_id = ?"
                params.append(playlist_id)
            
            query += " ORDER BY download_date DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            
            tracks = []
            for row in cursor.fetchall():
                tracks.append({
                    "track_id": row[0],
                    "title": row[1],
                    "artist": row[2],
                    "album": row[3],
                    "playlist_id": row[4],
                    "file_path": row[5],
                    "file_size": row[6],
                    "format": row[7],
                    "quality": row[8],
                    "download_date": row[9]
                })
            
            return tracks
    
    def get_download_queue(self) -> List[Dict]:
        """Получить очередь загрузок"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица download_queue
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """)
            if not cursor.fetchone():
                return []
            
            cursor.execute("""
                SELECT id, track_id, title, artist, album, status, progress, quality, error_message, created_at, updated_at
                FROM download_queue
                ORDER BY created_at DESC
            """)
            
            queue = []
            for row in cursor.fetchall():
                queue.append({
                    "id": row[0],
                    "track_id": row[1],
                    "title": row[2],
                    "artist": row[3],
                    "album": row[4],
                    "status": row[5],
                    "progress": row[6],
                    "quality": row[7],
                    "error_message": row[8],
                    "created_at": row[9],
                    "updated_at": row[10]
                })
            
            return queue
    
    def retry_download(self, track_id: str) -> bool:
        """Повторить загрузку трека"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица download_queue
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """)
            if not cursor.fetchone():
                return False
            
            cursor.execute("""
                UPDATE download_queue 
                SET status = 'pending', progress = 0, error_message = NULL, updated_at = ?
                WHERE track_id = ?
            """, (datetime.now().isoformat(), track_id))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def cancel_download(self, track_id: str) -> bool:
        """Отменить загрузку трека"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли таблица download_queue
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """)
            if not cursor.fetchone():
                return False
            
            cursor.execute("DELETE FROM download_queue WHERE track_id = ?", (track_id,))
            conn.commit()
            return cursor.rowcount > 0


# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()

