"""
Простой менеджер базы данных для работы с SQLite
"""

import json
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
            # Создаем папку data, если её нет
            data_dir = os.path.join(os.path.dirname(__file__), "data")
            os.makedirs(data_dir, exist_ok=True)
            db_path = os.path.join(data_dir, "yandex_music.db")
        self.db_path = db_path
        self._init_database()

    @contextmanager
    def get_connection(self):
        """Контекстный менеджер для подключения к БД"""
        # timeout=5.0 позволяет ждать до 5 секунд, пока база разблокируется
        # check_same_thread=False позволяет использовать одно подключение из разных потоков
        conn = sqlite3.connect(self.db_path, timeout=5.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_database(self):
        """Инициализация таблиц БД"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Новая единая таблица аккаунтов Яндекс.Музыки
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS yandex_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    username TEXT,
                    oauth_token TEXT,
                    session_id_token TEXT,
                    is_active INTEGER DEFAULT 0,
                    has_subscription INTEGER DEFAULT 0,
                    has_lossless_access INTEGER DEFAULT 0,
                    subscription_details TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_used TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Старая таблица сохраненных токенов (для совместимости)
            cursor.execute(
                """
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
            """
            )

            # Таблица настроек
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Таблица загруженных треков
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS downloaded_tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    playlist_id TEXT,
                    file_path TEXT NOT NULL,
                    file_size REAL,
                    format TEXT,
                    quality TEXT,
                    cover_data BLOB,
                    download_date TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_checked TEXT DEFAULT CURRENT_TIMESTAMP,
                    is_available INTEGER DEFAULT 1
                )
            """
            )

            # Таблица очереди загрузок
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS download_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    playlist_id TEXT,
                    cover TEXT,
                    status TEXT DEFAULT 'pending',
                    progress INTEGER DEFAULT 0,
                    quality TEXT,
                    error_message TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Миграция: добавляем поле cover_data если его нет
            try:
                cursor.execute(
                    "ALTER TABLE downloaded_tracks ADD COLUMN cover_data BLOB"
                )
            except sqlite3.OperationalError:
                # Поле уже существует
                pass

            # Миграция: добавляем поле cover в download_queue если его нет
            try:
                cursor.execute("ALTER TABLE download_queue ADD COLUMN cover TEXT")
            except sqlite3.OperationalError:
                # Поле уже существует
                pass

            # Миграция: добавляем новые поля метаданных в downloaded_tracks
            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN year INTEGER")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN genre TEXT")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN label TEXT")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN isrc TEXT")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN duration INTEGER")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE downloaded_tracks ADD COLUMN version TEXT")
            except sqlite3.OperationalError:
                pass

            # Индексы для быстрого поиска
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_yandex_accounts_active ON yandex_accounts(is_active)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_tokens_active ON saved_tokens(is_active)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_downloaded_tracks_date ON downloaded_tracks(download_date)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_download_queue_playlist_id ON download_queue(playlist_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_download_queue_track_id ON download_queue(track_id)"
            )

            # Индексы для новых полей метаданных
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_downloaded_tracks_year ON downloaded_tracks(year)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_downloaded_tracks_genre ON downloaded_tracks(genre)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_downloaded_tracks_label ON downloaded_tracks(label)"
            )

            conn.commit()

    # Методы для работы с токенами
    def get_all_tokens(self) -> List[Dict]:
        """Получить все токены"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, token, token_type, username, is_active, created_at, last_used
                FROM saved_tokens
                ORDER BY is_active DESC, last_used DESC
            """
            )

            tokens = []
            for row in cursor.fetchall():
                tokens.append(
                    {
                        "id": row[0],
                        "name": row[1],
                        "token_type": row[3],
                        "username": row[4],
                        "is_active": bool(row[5]),
                        "created_at": row[6],
                        "last_used": row[7],
                        "token_preview": (
                            row[2][:20] + "..." if len(row[2]) > 20 else row[2]
                        ),
                    }
                )

            return tokens

    def get_active_token(self) -> Optional[Dict]:
        """Получить активный токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, token, token_type, username, created_at, last_used
                FROM saved_tokens
                WHERE is_active = 1
                LIMIT 1
            """
            )

            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "token": row[2],
                    "token_type": row[3],
                    "username": row[4],
                    "created_at": row[5],
                    "last_used": row[6],
                }
            return None

    def save_token(
        self,
        name: str,
        token: str,
        token_type: str,
        username: str = None,
        is_active: bool = True,
    ) -> int:
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
                cursor.execute(
                    """
                    UPDATE saved_tokens 
                    SET token = ?, token_type = ?, username = ?, is_active = ?, last_used = ?
                    WHERE id = ?
                """,
                    (token, token_type, username, int(is_active), now, existing[0]),
                )
                token_id = existing[0]
            else:
                # Создаем новый токен
                cursor.execute(
                    """
                    INSERT INTO saved_tokens (name, token, token_type, username, is_active, created_at, last_used)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                    (name, token, token_type, username, int(is_active), now, now),
                )
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
            cursor.execute(
                """
                UPDATE saved_tokens 
                SET is_active = 1, last_used = ?
                WHERE id = ?
            """,
                (datetime.now().isoformat(), token_id),
            )

            conn.commit()
            return cursor.rowcount > 0

    def deactivate_token(self, token_id: int) -> bool:
        """Деактивировать токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Деактивируем конкретный токен
            cursor.execute(
                """
                UPDATE saved_tokens 
                SET is_active = 0
                WHERE id = ?
            """,
                (token_id,),
            )

            conn.commit()
            return cursor.rowcount > 0

    def rename_token(self, token_id: int, new_name: str) -> bool:
        """Переименовать токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "UPDATE saved_tokens SET name = ? WHERE id = ?", (new_name, token_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_token_username(self, token_id: int, username: str) -> bool:
        """Обновить username токена"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE saved_tokens SET username = ? WHERE id = ?",
                (username, token_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_token_by_id(self, token_id: int) -> Optional[Dict]:
        """Получить токен по ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, token, token_type, username, is_active, created_at
                FROM saved_tokens WHERE id = ?
            """,
                (token_id,),
            )

            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "token": row[2],
                    "token_type": row[3],
                    "username": row[4],
                    "is_active": bool(row[5]),
                    "created_at": row[6],
                }
            return None

    def delete_token(self, token_id: int) -> bool:
        """Удалить токен"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM saved_tokens WHERE id = ?", (token_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Методы для работы с едиными аккаунтами Яндекс.Музыки
    def get_all_accounts(self) -> List[Dict]:
        """Получить все аккаунты"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, username, oauth_token, session_id_token, is_active, 
                       has_subscription, has_lossless_access, subscription_details,
                       created_at, last_used, updated_at
                FROM yandex_accounts
                ORDER BY is_active DESC, last_used DESC
            """
            )

            accounts = []
            for row in cursor.fetchall():
                accounts.append(
                    {
                        "id": row[0],
                        "name": row[1],
                        "username": row[2],
                        "oauth_token_preview": (
                            row[3][:50] + "..."
                            if row[3] and len(row[3]) > 50
                            else row[3]
                        ),
                        "session_id_token_preview": (
                            row[4][:50] + "..."
                            if row[4] and len(row[4]) > 50
                            else row[4]
                        ),
                        "is_active": bool(row[5]),
                        "has_subscription": bool(row[6]),
                        "has_lossless_access": bool(row[7]),
                        "subscription_details": row[8],
                        "created_at": row[9],
                        "last_used": row[10],
                        "updated_at": row[11],
                    }
                )

            return accounts

    def get_active_account(self) -> Optional[Dict]:
        """Получить активный аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, username, oauth_token, session_id_token, 
                       has_subscription, has_lossless_access, subscription_details,
                       created_at, last_used, updated_at
                FROM yandex_accounts
                WHERE is_active = 1
                LIMIT 1
            """
            )

            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "username": row[2],
                    "oauth_token": row[3],
                    "session_id_token": row[4],
                    "has_subscription": bool(row[5]),
                    "has_lossless_access": bool(row[6]),
                    "subscription_details": row[7],
                    "created_at": row[8],
                    "last_used": row[9],
                    "updated_at": row[10],
                }
            return None

    def save_account(
        self,
        name: str,
        oauth_token: str = None,
        session_id_token: str = None,
        username: str = None,
        is_active: bool = True,
        has_subscription: bool = False,
        has_lossless_access: bool = False,
        subscription_details: str = None,
    ) -> int:
        """Сохранить аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Деактивируем все аккаунты если новый активный
            if is_active:
                cursor.execute("UPDATE yandex_accounts SET is_active = 0")

            # Проверяем, существует ли аккаунт с таким именем
            cursor.execute("SELECT id FROM yandex_accounts WHERE name = ?", (name,))
            existing = cursor.fetchone()

            now = datetime.now().isoformat()

            if existing:
                # Обновляем существующий аккаунт
                cursor.execute(
                    """
                    UPDATE yandex_accounts 
                    SET oauth_token = ?, session_id_token = ?, username = ?, 
                        is_active = ?, has_subscription = ?, has_lossless_access = ?,
                        subscription_details = ?, last_used = ?, updated_at = ?
                    WHERE id = ?
                """,
                    (
                        oauth_token,
                        session_id_token,
                        username,
                        int(is_active),
                        int(has_subscription),
                        int(has_lossless_access),
                        subscription_details,
                        now,
                        now,
                        existing[0],
                    ),
                )
                account_id = existing[0]
            else:
                # Создаем новый аккаунт
                cursor.execute(
                    """
                    INSERT INTO yandex_accounts 
                    (name, oauth_token, session_id_token, username, is_active, 
                     has_subscription, has_lossless_access, subscription_details, 
                     created_at, last_used, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        name,
                        oauth_token,
                        session_id_token,
                        username,
                        int(is_active),
                        int(has_subscription),
                        int(has_lossless_access),
                        subscription_details,
                        now,
                        now,
                        now,
                    ),
                )
                account_id = cursor.lastrowid

            conn.commit()
            return account_id

    def activate_account(self, account_id: int) -> bool:
        """Активировать аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Деактивируем все аккаунты
            cursor.execute("UPDATE yandex_accounts SET is_active = 0")

            # Активируем выбранный
            cursor.execute(
                """
                UPDATE yandex_accounts 
                SET is_active = 1, last_used = ?, updated_at = ?
                WHERE id = ?
            """,
                (datetime.now().isoformat(), datetime.now().isoformat(), account_id),
            )

            conn.commit()
            return cursor.rowcount > 0

    def deactivate_account(self, account_id: int) -> bool:
        """Деактивировать аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Деактивируем конкретный аккаунт
            cursor.execute(
                """
                UPDATE yandex_accounts 
                SET is_active = 0, updated_at = ?
                WHERE id = ?
            """,
                (datetime.now().isoformat(), account_id),
            )

            conn.commit()
            return cursor.rowcount > 0

    def rename_account(self, account_id: int, new_name: str) -> bool:
        """Переименовать аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "UPDATE yandex_accounts SET name = ?, updated_at = ? WHERE id = ?",
                (new_name, datetime.now().isoformat(), account_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_account_username(self, account_id: int, username: str) -> bool:
        """Обновить username аккаунта"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE yandex_accounts SET username = ?, updated_at = ? WHERE id = ?",
                (username, datetime.now().isoformat(), account_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_account_subscription_info(
        self,
        account_id: int,
        has_subscription: bool,
        has_lossless_access: bool,
        subscription_details: str = None,
    ) -> bool:
        """Обновить информацию о подписке аккаунта"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE yandex_accounts 
                SET has_subscription = ?, has_lossless_access = ?, 
                    subscription_details = ?, updated_at = ?
                WHERE id = ?
            """,
                (
                    int(has_subscription),
                    int(has_lossless_access),
                    subscription_details,
                    datetime.now().isoformat(),
                    account_id,
                ),
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_account_by_id(self, account_id: int) -> Optional[Dict]:
        """Получить аккаунт по ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, username, oauth_token, session_id_token, is_active,
                       has_subscription, has_lossless_access, subscription_details,
                       created_at, last_used, updated_at
                FROM yandex_accounts WHERE id = ?
            """,
                (account_id,),
            )

            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "username": row[2],
                    "oauth_token": row[3],
                    "session_id_token": row[4],
                    "is_active": bool(row[5]),
                    "has_subscription": bool(row[6]),
                    "has_lossless_access": bool(row[7]),
                    "subscription_details": row[8],
                    "created_at": row[9],
                    "last_used": row[10],
                    "updated_at": row[11],
                }
            return None

    def delete_account(self, account_id: int) -> bool:
        """Удалить аккаунт"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM yandex_accounts WHERE id = ?", (account_id,))
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

            cursor.execute(
                """
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
            """,
                (key, value, datetime.now().isoformat()),
            )

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
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """
            )
            if not cursor.fetchone():
                # Если таблица не существует, возвращаем пустую статистику
                return {
                    "totalFiles": 0,
                    "totalSize": 0,
                    "byFormat": {},
                    "byQuality": {},
                }

            # Получаем общую статистику
            cursor.execute("SELECT COUNT(*) FROM downloaded_tracks")
            total_files = cursor.fetchone()[0]

            cursor.execute(
                "SELECT SUM(file_size) FROM downloaded_tracks WHERE file_size IS NOT NULL"
            )
            total_size = cursor.fetchone()[0] or 0

            # Статистика по форматам
            cursor.execute(
                """
                SELECT format, COUNT(*) as count, SUM(file_size) as size
                FROM downloaded_tracks 
                WHERE format IS NOT NULL
                GROUP BY format
            """
            )
            by_format = {}
            for row in cursor.fetchall():
                by_format[row[0]] = {"count": row[1], "size": row[2] or 0}

            # Статистика по качеству
            cursor.execute(
                """
                SELECT quality, COUNT(*) as count
                FROM downloaded_tracks 
                WHERE quality IS NOT NULL
                GROUP BY quality
            """
            )
            by_quality = {}
            for row in cursor.fetchall():
                by_quality[row[0]] = row[1]

            return {
                "totalFiles": total_files,
                "totalSize": total_size,
                "byFormat": by_format,
                "byQuality": by_quality,
            }

    def update_file_statistics(self) -> Dict:
        """Обновить и вернуть статистику файлов"""
        # Получаем свежую статистику
        stats = self.get_file_statistics()

        # Сохраняем обновленную статистику в настройки для кэширования
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES ('file_statistics', ?, ?)
            """,
                (json.dumps(stats), datetime.now().isoformat()),
            )

            conn.commit()

        return stats

    def clear_download_queue(self) -> int:
        """Очистить очередь загрузок (удалить все треки из очереди)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем количество записей перед удалением
            cursor.execute("SELECT COUNT(*) FROM download_queue")
            count = cursor.fetchone()[0]

            # Удаляем все записи из очереди
            cursor.execute("DELETE FROM download_queue")
            conn.commit()

            return count

    def clear_download_queue_by_status(self, status: str) -> int:
        """Очистить очередь загрузок по статусу"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем количество записей перед удалением
            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = ?", (status,)
            )
            count = cursor.fetchone()[0]

            # Удаляем записи с указанным статусом
            cursor.execute("DELETE FROM download_queue WHERE status = ?", (status,))
            conn.commit()

            return count

    def clear_file_statistics(self) -> bool:
        """Очистить статистику файлов (удалить кэшированную статистику)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM settings WHERE key = 'file_statistics'")
                conn.commit()
                return True
        except Exception as e:
            print(f"Ошибка очистки статистики файлов: {e}")
            return False

    def get_recent_downloaded_tracks(self, limit: int = 10) -> List[Dict]:
        """Получить недавно загруженные треки"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица downloaded_tracks
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """
            )
            if not cursor.fetchone():
                return []

            cursor.execute(
                """
                SELECT track_id, title, artist, album, file_path, file_size, format, quality, 
                       CASE WHEN cover_data IS NOT NULL THEN 1 ELSE 0 END as has_cover, 
                       download_date, year, genre, label, isrc, duration, version
                FROM downloaded_tracks
                ORDER BY download_date DESC
                LIMIT ?
            """,
                (limit,),
            )

            tracks = []
            for row in cursor.fetchall():
                tracks.append(
                    {
                        "track_id": row[0],
                        "title": row[1],
                        "artist": row[2],
                        "album": row[3],
                        "file_path": row[4],
                        "file_size": row[5],
                        "format": row[6],
                        "quality": row[7],
                        "has_cover": bool(row[8]),
                        "download_date": row[9],
                        "year": row[10],
                        "genre": row[11],
                        "label": row[12],
                        "isrc": row[13],
                        "duration": row[14],
                        "version": row[15],
                    }
                )

            return tracks

    def check_and_cleanup_missing_files(self) -> Dict:
        """
        Проверяет физическое наличие файлов и удаляет записи о несуществующих файлах
        Проверяет все таблицы с file_path: downloaded_tracks и download_queue

        Returns:
            Словарь с результатами проверки
        """
        import os

        with self.get_connection() as conn:
            cursor = conn.cursor()

            all_files = []
            missing_files = []
            existing_files = []

            # Проверяем только downloaded_tracks (основная таблица с файлами)
            cursor.execute(
                """
                SELECT id, track_id, title, artist, file_path, playlist_id, 'downloaded_tracks' as table_name
                FROM downloaded_tracks
                WHERE file_path IS NOT NULL AND file_path != ''
            """
            )

            downloaded_tracks = cursor.fetchall()

            # Используем только записи из downloaded_tracks
            all_files = downloaded_tracks
            total_files = len(all_files)

            for file_record in all_files:
                file_id, track_id, title, artist, file_path, playlist_id, table_name = (
                    file_record
                )

                if file_path and os.path.exists(file_path):
                    existing_files.append(
                        {
                            "id": file_id,
                            "track_id": track_id,
                            "title": title,
                            "artist": artist,
                            "file_path": file_path,
                            "playlist_id": playlist_id,
                            "table_name": table_name,
                        }
                    )
                else:
                    missing_files.append(
                        {
                            "id": file_id,
                            "track_id": track_id,
                            "title": title,
                            "artist": artist,
                            "file_path": file_path,
                            "playlist_id": playlist_id,
                            "table_name": table_name,
                        }
                    )

            # Удаляем записи о несуществующих файлах
            deleted_count = 0
            if missing_files:
                for missing_file in missing_files:
                    # Удаляем из downloaded_tracks
                    cursor.execute(
                        "DELETE FROM downloaded_tracks WHERE id = ?",
                        (missing_file["id"],),
                    )

                    # Также удаляем из download_queue если есть
                    cursor.execute(
                        "DELETE FROM download_queue WHERE track_id = ? AND playlist_id = ?",
                        (missing_file["track_id"], missing_file["playlist_id"]),
                    )

                    deleted_count += 1

                conn.commit()

            return {
                "total_checked": total_files,
                "existing_files": len(existing_files),
                "missing_files": len(missing_files),
                "deleted_records": deleted_count,
                "missing_file_details": missing_files,
                "checked_tables": ["downloaded_tracks"],
            }

    def get_downloaded_tracks(
        self,
        playlist_id: str = None,
        quality: str = None,
        year: int = None,
        genre: str = None,
        label: str = None,
        search: str = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict]:
        """Получить список загруженных треков"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица downloaded_tracks
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='downloaded_tracks'
            """
            )
            if not cursor.fetchone():
                return []

            query = """
                SELECT track_id, title, artist, album, playlist_id, file_path, file_size, format, quality, 
                       CASE WHEN cover_data IS NOT NULL THEN 1 ELSE 0 END as has_cover, 
                       download_date, year, genre, label, isrc, duration, version
                FROM downloaded_tracks
            """
            params = []
            conditions = []

            if playlist_id:
                conditions.append("playlist_id = ?")
                params.append(playlist_id)

            if quality:
                conditions.append("quality = ?")
                params.append(quality)

            if year:
                conditions.append("year = ?")
                params.append(year)

            if genre:
                conditions.append("genre = ?")
                params.append(genre)

            if label:
                conditions.append("label = ?")
                params.append(label)

            if search:
                conditions.append("(title LIKE ? OR artist LIKE ? OR album LIKE ?)")
                search_pattern = f"%{search}%"
                params.extend([search_pattern, search_pattern, search_pattern])

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY download_date DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)

            tracks = []
            for row in cursor.fetchall():
                tracks.append(
                    {
                        "track_id": row[0],
                        "title": row[1],
                        "artist": row[2],
                        "album": row[3],
                        "playlist_id": row[4],
                        "file_path": row[5],
                        "file_size": row[6],
                        "format": row[7],
                        "quality": row[8],
                        "has_cover": bool(row[9]),
                        "download_date": row[10],
                        "year": row[11],
                        "genre": row[12],
                        "label": row[13],
                        "isrc": row[14],
                        "duration": row[15],
                        "version": row[16],
                    }
                )

            return tracks

    def get_download_queue(self) -> List[Dict]:
        """Получить очередь загрузок"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return []

            cursor.execute(
                """
                SELECT id, track_id, title, artist, album, playlist_id, cover, status, progress, quality, error_message, created_at, updated_at
                FROM download_queue
                ORDER BY created_at DESC
            """
            )

            queue = []
            for row in cursor.fetchall():
                queue.append(
                    {
                        "id": row[0],
                        "track_id": row[1],
                        "title": row[2],
                        "artist": row[3],
                        "album": row[4],
                        "playlist_id": row[5],
                        "cover": row[6],
                        "status": row[7],
                        "progress": row[8],
                        "quality": row[9],
                        "error_message": row[10],
                        "created_at": row[11],
                        "updated_at": row[12],
                    }
                )

            return queue

    def retry_download(self, track_id: str) -> bool:
        """Повторить загрузку трека"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return False

            cursor.execute(
                """
                UPDATE download_queue 
                SET status = 'pending', progress = 0, error_message = NULL, updated_at = ?
                WHERE track_id = ?
            """,
                (datetime.now().isoformat(), track_id),
            )

            conn.commit()
            return cursor.rowcount > 0

    def cancel_download(self, track_id: str) -> bool:
        """Отменить загрузку трека"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return False

            cursor.execute("DELETE FROM download_queue WHERE track_id = ?", (track_id,))
            conn.commit()
            return cursor.rowcount > 0

    def update_download_progress(self, track_id: str, progress: int) -> bool:
        """Обновить прогресс загрузки трека"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return False

            # Обновляем только прогресс, не меняем статус автоматически
            cursor.execute(
                """
                UPDATE download_queue 
                SET progress = ?, updated_at = ?
                WHERE track_id = ?
            """,
                (progress, datetime.now().isoformat(), track_id),
            )

            conn.commit()
            return cursor.rowcount > 0

    def get_download_queue_stats(self) -> Dict:
        """Получить статистику очереди загрузок"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return {
                    "total": 0,
                    "completed": 0,
                    "downloading": 0,
                    "pending": 0,
                    "queued": 0,
                    "error": 0,
                    "errors": 0,
                }

            # Получаем общее количество
            cursor.execute("SELECT COUNT(*) FROM download_queue")
            total = cursor.fetchone()[0]

            # Получаем статистику по статусам
            cursor.execute(
                """
                SELECT status, COUNT(*) as count
                FROM download_queue
                GROUP BY status
            """
            )

            stats = {
                "total": total,
                "completed": 0,
                "downloading": 0,
                "processing": 0,
                "pending": 0,
                "queued": 0,
                "error": 0,
                "errors": 0,
            }

            for row in cursor.fetchall():
                status = row[0]
                count = row[1]
                if status in stats:
                    stats[status] = count
                # Для совместимости добавляем errors как alias для error
                if status == "error":
                    stats["errors"] = count

            return stats

    def remove_from_queue(self, track_ids: List[str]) -> int:
        """Удалить треки из очереди (оптимизированная версия)"""
        if not track_ids:
            return 0

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Создаем плейсхолдеры для IN запроса
            placeholders = ",".join(["?" for _ in track_ids])

            # Выполняем одно массовое удаление вместо цикла
            cursor.execute(
                f"DELETE FROM download_queue WHERE track_id IN ({placeholders})",
                track_ids,
            )

            removed_count = cursor.rowcount
            conn.commit()
            return removed_count

    def bulk_remove_from_queue(
        self, track_ids: List[str], batch_size: int = 1000
    ) -> int:
        """Массовое удаление треков из очереди с батчевой обработкой"""
        if not track_ids:
            return 0

        total_removed = 0

        # Обрабатываем батчами для избежания слишком больших SQL запросов
        for i in range(0, len(track_ids), batch_size):
            batch = track_ids[i : i + batch_size]
            total_removed += self.remove_from_queue(batch)

        return total_removed

    def change_queue_status(self, track_ids: List[str], new_status: str) -> int:
        """Изменить статус треков в очереди (оптимизированная версия)"""
        if not track_ids:
            return 0

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Создаем плейсхолдеры для IN запроса
            placeholders = ",".join(["?" for _ in track_ids])

            # Выполняем одно массовое обновление вместо цикла
            cursor.execute(
                f"""
                UPDATE download_queue 
                SET status = ?, updated_at = ?
                WHERE track_id IN ({placeholders})
                """,
                [new_status, datetime.now().isoformat()] + track_ids,
            )

            updated_count = cursor.rowcount
            conn.commit()
            return updated_count

    def clear_completed_downloads(self) -> int:
        """Очистить завершенные загрузки из очереди"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Проверяем, существует ли таблица download_queue
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='download_queue'
            """
            )
            if not cursor.fetchone():
                return 0

            # Удаляем завершенные загрузки
            cursor.execute("DELETE FROM download_queue WHERE status = 'completed'")
            deleted_count = cursor.rowcount
            conn.commit()

            return deleted_count

    def get_playlist_settings(self) -> Dict:
        """
        Получить настройки обработки плейлистов

        Returns:
            Словарь с настройками
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем настройки
            settings = {
                "batch_size": 100,  # По умолчанию
                "max_tracks": None,  # None = все треки
                "enable_rate_limiting": True,
            }

            cursor.execute(
                "SELECT key, value FROM settings WHERE key LIKE 'playlist_%'"
            )
            for row in cursor.fetchall():
                key = row[0].replace("playlist_", "")
                value = row[1]

                # Преобразуем значения
                if key in ["batch_size", "max_tracks"]:
                    settings[key] = int(value) if value and value != "null" else None
                elif key == "enable_rate_limiting":
                    settings[key] = value.lower() == "true"

            return settings

    def update_playlist_settings(self, settings: Dict) -> bool:
        """
        Обновить настройки обработки плейлистов

        Args:
            settings: Словарь с настройками

        Returns:
            True если успешно
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            for key, value in settings.items():
                db_key = f"playlist_{key}"

                # Преобразуем значения
                if value is None:
                    db_value = "null"
                elif isinstance(value, bool):
                    db_value = "true" if value else "false"
                else:
                    db_value = str(value)

                cursor.execute(
                    """
                    INSERT INTO settings (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = excluded.updated_at
                """,
                    (db_key, db_value),
                )

            conn.commit()
            return True


# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()
