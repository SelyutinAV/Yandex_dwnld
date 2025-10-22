#!/bin/bash

# Скрипт полной очистки проекта Yandex Music Downloader
# Удаляет все очереди, логи и загруженные файлы

echo "🧹 ПОЛНАЯ ОЧИСТКА ПРОЕКТА YANDEX MUSIC DOWNLOADER"
echo "=================================================="

# Останавливаем все процессы
echo "🛑 Останавливаем все процессы..."
killall python 2>/dev/null || true
killall npm 2>/dev/null || true
killall node 2>/dev/null || true
killall vite 2>/dev/null || true
sleep 2

# Очищаем базу данных
echo "🗄️ Очищаем базу данных..."
cd /home/urch/Projects/yandex_downloads/backend
if [ -f "yandex_music.db" ]; then
    /home/urch/Projects/yandex_downloads/backend/venv/bin/python -c "
import sqlite3
conn = sqlite3.connect('yandex_music.db')
cursor = conn.cursor()

# Удаляем все таблицы
tables = ['download_queue', 'playlist_sync', 'settings']
for table in tables:
    try:
        cursor.execute(f'DROP TABLE IF EXISTS {table}')
        print(f'✅ Удалена таблица: {table}')
    except Exception as e:
        print(f'❌ Ошибка удаления таблицы {table}: {e}')

conn.commit()
conn.close()
print('✅ База данных очищена')
"
else
    echo "⚠️ База данных не найдена"
fi

# Очищаем логи
echo "📝 Очищаем логи..."
cd /home/urch/Projects/yandex_downloads
if [ -d "logs" ]; then
    rm -rf logs/*
    echo "✅ Логи очищены"
else
    echo "⚠️ Папка logs не найдена"
fi

# Очищаем загруженные файлы
echo "🎵 Очищаем загруженные файлы..."
DOWNLOAD_PATH="/home/urch/Music/Yandex"
if [ -d "$DOWNLOAD_PATH" ]; then
    echo "Удаляем все файлы из: $DOWNLOAD_PATH"
    rm -rf "$DOWNLOAD_PATH"/*
    echo "✅ Загруженные файлы удалены"
else
    echo "⚠️ Папка загрузки не найдена: $DOWNLOAD_PATH"
fi

# Очищаем кэш frontend
echo "🌐 Очищаем кэш frontend..."
cd /home/urch/Projects/yandex_downloads/frontend
if [ -d "node_modules/.vite" ]; then
    rm -rf node_modules/.vite
    echo "✅ Кэш Vite очищен"
fi

if [ -d "dist" ]; then
    rm -rf dist/*
    echo "✅ Папка dist очищена"
fi

# Очищаем временные файлы
echo "🗑️ Очищаем временные файлы..."
cd /home/urch/Projects/yandex_downloads
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.log" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

# Удаляем тестовые HTML файлы
echo "🧪 Удаляем тестовые файлы..."
rm -f *.html 2>/dev/null || true
rm -f *.sh 2>/dev/null || true

echo ""
echo "✅ ПОЛНАЯ ОЧИСТКА ЗАВЕРШЕНА!"
echo "=============================="
echo ""
echo "📋 Что было очищено:"
echo "  • База данных (все таблицы)"
echo "  • Логи (все файлы)"
echo "  • Загруженные файлы"
echo "  • Кэш frontend"
echo "  • Временные файлы"
echo "  • Тестовые файлы"
echo ""
echo "🚀 Проект готов к работе!"
echo ""
echo "Для запуска используйте:"
echo "  Backend:  cd backend && python main.py"
echo "  Frontend: cd frontend && npm run dev"


