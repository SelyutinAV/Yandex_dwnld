#!/usr/bin/env python3
"""
Скрипт для перемещения базы данных в папку data
"""

import os
import shutil
from pathlib import Path


def move_database():
    """Перемещает базу данных в папку data"""
    backend_dir = Path(__file__).parent
    old_db_path = backend_dir / "yandex_music.db"
    data_dir = backend_dir / "data"
    new_db_path = data_dir / "yandex_music.db"

    # Проверяем, существует ли старая БД
    if not old_db_path.exists():
        print("✅ База данных уже находится в папке data или не существует")
        return

    # Создаем папку data, если её нет
    data_dir.mkdir(exist_ok=True)

    # Проверяем, нет ли уже БД в новой папке
    if new_db_path.exists():
        old_size = old_db_path.stat().st_size
        new_size = new_db_path.stat().st_size
        print(
            f"⚠️  База данных уже существует в папке data "
            f"(старая: {old_size / 1024 / 1024:.2f}MB, "
            f"новая: {new_size / 1024 / 1024:.2f}MB)"
        )
        # Если старая БД больше, заменяем новую
        if old_size > new_size:
            print(
                f"📦 Старая БД больше новой, заменяем новую на старую..."
            )
            new_db_path.unlink()
        else:
            print("✅ Новая БД больше или равна старой, оставляем новую")
            old_db_path.unlink()
            return

    # Перемещаем БД
    try:
        shutil.move(str(old_db_path), str(new_db_path))
        print(f"✅ База данных успешно перемещена в {new_db_path}")
    except Exception as e:
        print(f"❌ Ошибка при перемещении БД: {e}")
        raise


if __name__ == "__main__":
    move_database()

