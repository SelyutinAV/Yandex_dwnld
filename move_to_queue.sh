#!/bin/bash

# Инструмент для переброса треков из "ожидания" в активный процесс загрузки
# Использование: ./move_to_queue.sh [количество] [статус_откуда] [статус_куда]

COUNT=${1:-10}  # По умолчанию 10 треков
FROM_STATUS=${2:-"pending"}  # По умолчанию из pending
TO_STATUS=${3:-"queued"}  # По умолчанию в queued

echo "🔄 Переброс треков из '$FROM_STATUS' в '$TO_STATUS'"
echo "📊 Количество: $COUNT"

# Переводим треки в новый статус
cd /home/urch/Projects/yandex_downloads/backend
/home/urch/Projects/yandex_downloads/backend/venv/bin/python -c "
import sqlite3
from datetime import datetime
conn = sqlite3.connect('yandex_music.db')
cursor = conn.cursor()

# Получаем количество треков с исходным статусом
cursor.execute('SELECT COUNT(*) FROM download_queue WHERE status = ?', ('$FROM_STATUS',))
count_before = cursor.fetchone()[0]
print(f'Треков с статусом \"$FROM_STATUS\": {count_before}')

if count_before == 0:
    print('❌ Нет треков для переброса')
    conn.close()
    exit(1)

# Переводим треки в новый статус
actual_count = min($COUNT, count_before)
cursor.execute('''
    UPDATE download_queue 
    SET status = ?, updated_at = ? 
    WHERE status = ? 
    LIMIT ?
''', ('$TO_STATUS', datetime.now().isoformat(), '$FROM_STATUS', actual_count))

updated_count = cursor.rowcount
conn.commit()

print(f'✅ Переведено треков: {updated_count}')
print(f'📈 Статус изменён с \"$FROM_STATUS\" на \"$TO_STATUS\"')

conn.close()
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🚀 Запускаем загрузку..."
    
    # Запускаем загрузку
    curl -s "http://localhost:8000/api/download/queue/start" -X POST | jq .
    
    echo ""
    echo "📊 Проверяем статусы через 3 секунды..."
    sleep 3
    curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'
else
    echo "❌ Ошибка при перебросе треков"
fi
