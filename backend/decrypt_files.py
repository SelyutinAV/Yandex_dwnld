#!/usr/bin/env python3
"""
Утилита для расшифровки зашифрованных файлов
Пытается расшифровать файлы .encrypted используя ключи из базы данных
"""

import os
import sys
import sqlite3
from pathlib import Path
import hashlib

# Импортируем необходимые модули
try:
    from Crypto.Cipher import AES
    from Crypto.Util import Counter

    CRYPTO_AVAILABLE = True
except ImportError:
    print("❌ pycryptodome не установлен. Установите: pip install pycryptodome")
    CRYPTO_AVAILABLE = False
    sys.exit(1)


def get_database_connection():
    """Получить соединение с базой данных"""
    db_path = os.path.join(os.path.dirname(__file__), "yandex_music.db")
    return sqlite3.connect(db_path)


def find_encrypted_files(directory: str) -> list:
    """Найти все файлы с расширением .encrypted"""
    encrypted_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".encrypted"):
                file_path = os.path.join(root, file)
                # Пытаемся найти соответствующий трек в базе данных
                track_info = get_track_info_from_db(file_path)
                if track_info:
                    encrypted_files.append(
                        {"path": file_path, "track_info": track_info}
                    )
    return encrypted_files


def get_track_info_from_db(file_path: str) -> dict:
    """Получить информацию о треке из базы данных по пути к файлу"""
    try:
        conn = get_database_connection()
        cursor = conn.cursor()

        # Извлекаем имя файла без расширения .encrypted
        base_name = os.path.basename(file_path).replace(".encrypted", "")

        # Ищем трек по имени файла
        cursor.execute(
            """
            SELECT track_id, title, artist, album, file_path, encryption_key
            FROM downloaded_tracks 
            WHERE file_path LIKE ? OR file_path LIKE ?
        """,
            (f"%{base_name}%", f"%{base_name.replace('.flac', '')}%"),
        )

        result = cursor.fetchone()
        conn.close()

        if result:
            return {
                "track_id": result[0],
                "title": result[1],
                "artist": result[2],
                "album": result[3],
                "file_path": result[4],
                "encryption_key": result[5],
            }
        return None

    except Exception as e:
        print(f"Ошибка поиска в базе данных: {e}")
        return None


def decrypt_file(encrypted_path: str, output_path: str, key: str) -> bool:
    """Расшифровать файл"""
    if not CRYPTO_AVAILABLE:
        return False

    try:
        print(f"🔓 Расшифровываем: {os.path.basename(encrypted_path)}")

        # Читаем зашифрованный файл
        with open(encrypted_path, "rb") as f:
            encrypted_data = bytearray(f.read())

        # Конвертируем hex-ключ в bytes
        key_bytes = bytes.fromhex(key)

        if len(key_bytes) != 16:
            print(f"❌ Неверный размер ключа: {len(key_bytes)} байт")
            return False

        # Создаём counter из 128 нулевых бит
        ctr = Counter.new(128, initial_value=0)

        # Создаём AES-128-CTR cipher
        cipher = AES.new(key_bytes, AES.MODE_CTR, counter=ctr)

        # Расшифровываем
        decrypted_data = cipher.decrypt(bytes(encrypted_data))

        # Сохраняем расшифрованный файл
        with open(output_path, "wb") as f:
            f.write(decrypted_data)

        print(f"✅ Файл расшифрован: {os.path.basename(output_path)}")
        return True

    except Exception as e:
        print(f"❌ Ошибка расшифровки {encrypted_path}: {e}")
        return False


def convert_to_flac(input_path: str, output_path: str) -> bool:
    """Конвертировать расшифрованный файл в FLAC"""
    try:
        import subprocess

        print(f"🔧 Конвертируем в FLAC: {os.path.basename(input_path)}")

        # ffmpeg -i input.mp4 -c:a copy output.flac
        result = subprocess.run(
            ["ffmpeg", "-i", input_path, "-c:a", "copy", output_path, "-y"],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode == 0:
            print(f"✅ Конвертация завершена: {os.path.basename(output_path)}")
            return True
        else:
            print(f"❌ ffmpeg ошибка: {result.stderr}")
            return False

    except FileNotFoundError:
        print("❌ ffmpeg не найден. Установите ffmpeg для конвертации")
        return False
    except Exception as e:
        print(f"❌ Ошибка конвертации: {e}")
        return False


def decrypt_encrypted_files(directory: str, dry_run: bool = True) -> int:
    """Расшифровать зашифрованные файлы"""
    encrypted_files = find_encrypted_files(directory)

    if not encrypted_files:
        print("✅ Зашифрованных файлов не найдено")
        return 0

    print(f"🔍 Найдено {len(encrypted_files)} зашифрованных файлов:")
    for file_info in encrypted_files:
        file_size = os.path.getsize(file_info["path"]) / (1024 * 1024)  # MB
        track_info = file_info["track_info"]
        print(f"  • {os.path.basename(file_info['path'])} ({file_size:.2f} MB)")
        print(f"    Трек: {track_info['artist']} - {track_info['title']}")
        print(f"    Ключ: {'Есть' if track_info['encryption_key'] else 'Нет'}")

    if dry_run:
        print("\n⚠️  Режим предварительного просмотра (--dry-run)")
        print("Для расшифровки файлов запустите без --dry-run")
        return len(encrypted_files)

    print(f"\n🔓 Расшифровываем {len(encrypted_files)} файлов...")
    success_count = 0

    for file_info in encrypted_files:
        encrypted_path = file_info["path"]
        track_info = file_info["track_info"]

        if not track_info["encryption_key"]:
            print(f"❌ Нет ключа для {os.path.basename(encrypted_path)}")
            continue

        # Создаем пути для временных файлов
        temp_decrypted = encrypted_path.replace(".encrypted", ".decrypted.mp4")
        final_flac = encrypted_path.replace(".encrypted", ".flac")

        try:
            # Расшифровываем
            if not decrypt_file(
                encrypted_path, temp_decrypted, track_info["encryption_key"]
            ):
                continue

            # Конвертируем в FLAC
            if not convert_to_flac(temp_decrypted, final_flac):
                # Удаляем временный расшифрованный файл
                if os.path.exists(temp_decrypted):
                    os.remove(temp_decrypted)
                continue

            # Удаляем временные файлы
            if os.path.exists(temp_decrypted):
                os.remove(temp_decrypted)
            if os.path.exists(encrypted_path):
                os.remove(encrypted_path)

            print(f"✅ Успешно обработан: {os.path.basename(final_flac)}")
            success_count += 1

        except Exception as e:
            print(f"❌ Ошибка обработки {os.path.basename(encrypted_path)}: {e}")
            # Очищаем временные файлы
            if os.path.exists(temp_decrypted):
                os.remove(temp_decrypted)

    print(f"\n🎉 Успешно обработано {success_count} из {len(encrypted_files)} файлов")
    return success_count


def main():
    if len(sys.argv) < 2:
        print("Использование: python decrypt_files.py <директория> [--dry-run]")
        print("Пример: python decrypt_files.py /home/urch/Music/Yandex --dry-run")
        sys.exit(1)

    directory = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    if not os.path.exists(directory):
        print(f"❌ Директория не существует: {directory}")
        sys.exit(1)

    print(f"🔍 Поиск зашифрованных файлов в: {directory}")
    success_count = decrypt_encrypted_files(directory, dry_run)

    if success_count > 0 and not dry_run:
        print(f"\n✅ Расшифровка завершена! Обработано {success_count} файлов")
    elif success_count > 0 and dry_run:
        print(f"\n⚠️  Найдено {success_count} файлов для расшифровки")
        print("Запустите без --dry-run для расшифровки")


if __name__ == "__main__":
    main()
