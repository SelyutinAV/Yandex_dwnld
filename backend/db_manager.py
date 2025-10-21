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
            
            # Индексы для быстрого поиска
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_tokens_active ON saved_tokens(is_active)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)')
            
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


# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()

