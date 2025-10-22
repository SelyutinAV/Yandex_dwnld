#!/usr/bin/env python3
"""
Миграция: Добавить поле file_path в таблицу download_queue
"""
import sqlite3
import sys

DB_PATH = 'yandex_music.db'

def migrate():
    """Добавить поле file_path если его нет"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем существует ли поле
        cursor.execute("PRAGMA table_info(download_queue)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'file_path' in columns:
            print("✅ Поле file_path уже существует")
            return True
        
        # Добавляем поле
        print("➕ Добавляем поле file_path...")
        cursor.execute("""
            ALTER TABLE download_queue
            ADD COLUMN file_path TEXT
        """)
        
        conn.commit()
        conn.close()
        
        print("✅ Миграция успешно выполнена!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)

