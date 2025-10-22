#!/bin/bash

echo "🔄 Автоматический запуск загрузки"
echo "================================="

# Проверяем текущие статусы
echo "📊 Текущие статусы:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

# Проверяем есть ли pending треки
pending_count=$(curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts.pending // 0')

if [ "$pending_count" -gt 0 ]; then
    echo ""
    echo "🔄 Найдено $pending_count треков в статусе pending"
    echo "📝 Переводим их в queued..."
    
    # Переводим все pending треки в queued
    cd /home/urch/Projects/yandex_downloads/backend && /home/urch/Projects/yandex_downloads/backend/venv/bin/python -c "
import sqlite3
from datetime import datetime
conn = sqlite3.connect('yandex_music.db')
cursor = conn.cursor()
cursor.execute(\"UPDATE download_queue SET status = 'queued', updated_at = ? WHERE status = 'pending'\", (datetime.now().isoformat(),))
conn.commit()
print(f'Обновлено строк: {cursor.rowcount}')
conn.close()
"
    
    echo ""
    echo "🚀 Запускаем загрузку..."
    curl -s "http://localhost:8000/api/download/queue/start" -X POST | jq .
    
    echo ""
    echo "✅ Загрузка запущена!"
else
    echo ""
    echo "ℹ️  Нет треков в статусе pending для загрузки"
fi

echo ""
echo "📊 Финальные статусы:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "📱 Проверьте прогресс в интерфейсе: http://localhost:3000"
