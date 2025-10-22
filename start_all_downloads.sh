#!/bin/bash

echo "🔄 Перевод всех pending треков в queued для запуска загрузки"
echo "============================================================="

# Проверяем текущие статусы
echo "📊 Текущие статусы:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "🔄 Переводим pending треки в queued..."

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
echo "📊 Статусы после обновления:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "🚀 Запускаем загрузку..."
curl -s "http://localhost:8000/api/download/queue/start" -X POST | jq .

echo ""
echo "✅ Готово! Загрузка запущена."
echo "📱 Проверьте прогресс в интерфейсе: http://localhost:3000"
