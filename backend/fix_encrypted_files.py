#!/usr/bin/env python3
"""
Утилита для исправления зашифрованных файлов
Удаляет файлы с расширением .encrypted, которые остались после неудачной загрузки
"""

import os
import sys
from pathlib import Path

def find_encrypted_files(directory: str) -> list:
    """Найти все файлы с расширением .encrypted"""
    encrypted_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.encrypted'):
                encrypted_files.append(os.path.join(root, file))
    return encrypted_files

def clean_encrypted_files(directory: str, dry_run: bool = True) -> int:
    """Очистить зашифрованные файлы"""
    encrypted_files = find_encrypted_files(directory)
    
    if not encrypted_files:
        print("✅ Зашифрованных файлов не найдено")
        return 0
    
    print(f"🔍 Найдено {len(encrypted_files)} зашифрованных файлов:")
    for file_path in encrypted_files:
        file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
        print(f"  • {file_path} ({file_size:.2f} MB)")
    
    if dry_run:
        print("\n⚠️  Режим предварительного просмотра (--dry-run)")
        print("Для удаления файлов запустите без --dry-run")
        return len(encrypted_files)
    
    print(f"\n🗑️  Удаляем {len(encrypted_files)} зашифрованных файлов...")
    removed_count = 0
    
    for file_path in encrypted_files:
        try:
            os.remove(file_path)
            print(f"✅ Удален: {file_path}")
            removed_count += 1
        except Exception as e:
            print(f"❌ Ошибка удаления {file_path}: {e}")
    
    print(f"\n🎉 Удалено {removed_count} из {len(encrypted_files)} файлов")
    return removed_count

def main():
    if len(sys.argv) < 2:
        print("Использование: python fix_encrypted_files.py <директория> [--dry-run]")
        print("Пример: python fix_encrypted_files.py /home/urch/Music/Yandex --dry-run")
        sys.exit(1)
    
    directory = sys.argv[1]
    dry_run = '--dry-run' in sys.argv
    
    if not os.path.exists(directory):
        print(f"❌ Директория не существует: {directory}")
        sys.exit(1)
    
    print(f"🔍 Поиск зашифрованных файлов в: {directory}")
    removed_count = clean_encrypted_files(directory, dry_run)
    
    if removed_count > 0 and not dry_run:
        print(f"\n✅ Очистка завершена! Удалено {removed_count} файлов")
    elif removed_count > 0 and dry_run:
        print(f"\n⚠️  Найдено {removed_count} файлов для удаления")
        print("Запустите без --dry-run для удаления")

if __name__ == "__main__":
    main()
