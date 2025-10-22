#!/bin/bash

echo "🎵 Тестирование обновления прогресса загрузки"
echo "=============================================="

echo ""
echo "📊 Текущий прогресс:"
curl -s "http://localhost:8000/api/downloads/progress" | jq .

echo ""
echo "📈 Статистика очереди:"
curl -s "http://localhost:8000/api/debug/queue" | jq .

echo ""
echo "🌐 Откройте в браузере для визуального тестирования:"
echo "file:///home/urch/Projects/yandex_downloads/test_progress_update.html"
echo ""
echo "📱 Или основной интерфейс:"
echo "http://localhost:3000"
echo ""
echo "🔄 Тест обновления каждые 5 секунд (Ctrl+C для остановки):"

while true; do
    echo ""
    echo "⏰ $(date '+%H:%M:%S') - Проверка прогресса:"
    curl -s "http://localhost:8000/api/downloads/progress" | jq -r '
        "📥 Общий: " + (.overall_progress | tostring) + "/" + (.overall_total | tostring) + 
        " (" + (((.overall_progress / .overall_total) * 100) | floor | tostring) + "%)" +
        "\n🎵 Текущий: " + (if .current_track then .current_track + " (" + (.current_progress | tostring) + "%)" else "Нет активных загрузок" end) +
        "\n🔄 Активен: " + (if .is_active then "Да" else "Нет" end)
    '
    sleep 5
done
