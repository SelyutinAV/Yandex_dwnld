#!/usr/bin/env python3
"""
Миграция: добавление столбца playlist в таблицу download_queue
"""
import sqlite3
import sys

def migrate():
    try:
        conn = sqlite3.connect('yandex_music.db')
        cursor = conn.cursor()
        
        # Добавляем столбец playlist
        print("Добавляем столбец playlist...")
        cursor.execute("""
            ALTER TABLE download_queue 
            ADD COLUMN playlist TEXT
        """)
        
        conn.commit()
        print("✅ Миграция завершена успешно!")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("⚠️  Столбец playlist уже существует")
        else:
            print(f"❌ Ошибка: {e}")
            sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()





