#!/bin/bash

echo "📊 Мониторинг загрузки"
echo "======================"

while true; do
    echo ""
    echo "⏰ $(date '+%H:%M:%S') - Статус загрузки:"
    
    # Получаем прогресс
    progress=$(curl -s "http://localhost:8000/api/downloads/progress" | jq -r '
        "📥 Общий: " + (.overall_progress | tostring) + "/" + (.overall_total | tostring) + 
        " (" + (((.overall_progress / .overall_total) * 100) | floor | tostring) + "%)" +
        "\n🔄 Активен: " + (if .is_active then "Да" else "Нет" end) +
        "\n🎵 Текущий: " + (if .current_track then .current_track + " (" + (.current_progress | tostring) + "%)" else "Нет активных загрузок" end)
    ')
    echo "$progress"
    
    # Получаем статусы
    stats=$(curl -s "http://localhost:8000/api/debug/queue" | jq -r '
        "📊 Статусы: completed=" + (.status_counts.completed | tostring) + 
        ", downloading=" + ((.status_counts.downloading // 0) | tostring) + 
        ", pending=" + ((.status_counts.pending // 0) | tostring) + 
        ", queued=" + ((.status_counts.queued // 0) | tostring) + 
        ", error=" + ((.status_counts.error // 0) | tostring)
    ')
    echo "$stats"
    
    # Проверяем нужно ли перезапустить загрузку
    pending_count=$(curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts.pending // 0')
    downloading_count=$(curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts.downloading // 0')
    queued_count=$(curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts.queued // 0')
    
    if [ "$pending_count" -gt 0 ] && [ "$downloading_count" -eq 0 ] && [ "$queued_count" -eq 0 ]; then
        echo "⚠️  Обнаружена остановка загрузки! Перезапускаем..."
        cd /home/urch/Projects/yandex_downloads && ./auto_start_downloads.sh > /dev/null
    fi
    
    sleep 10
done
