#!/usr/bin/env python3
"""
Миграция для добавления поля username в таблицу saved_tokens
"""
import sqlite3
import os

def migrate_database():
    """Добавить поле username в таблицу saved_tokens"""
    db_path = '/home/urch/Projects/yandex_downloads/backend/yandex_music.db'
    
    if not os.path.exists(db_path):
        print("База данных не найдена, миграция не нужна")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем, существует ли уже поле username
        cursor.execute("PRAGMA table_info(saved_tokens)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'username' not in columns:
            print("Добавляем поле username в таблицу saved_tokens...")
            cursor.execute("ALTER TABLE saved_tokens ADD COLUMN username VARCHAR")
            conn.commit()
            print("✅ Поле username успешно добавлено")
        else:
            print("✅ Поле username уже существует")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")

if __name__ == "__main__":
    migrate_database()
