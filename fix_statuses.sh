#!/bin/bash

echo "🔧 Исправление статусов всех файлов в очереди загрузок..."

# Проверяем что бэкенд работает
if ! curl -s "http://localhost:8000/api/health" > /dev/null; then
    echo "❌ Бэкенд не отвечает на http://localhost:8000"
    echo "Запустите бэкенд: cd backend && python main.py"
    exit 1
fi

echo "📊 Статистика ДО исправления:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "🔄 Исправляем статусы..."

# Меняем все pending на queued
echo "1. Меняем 'pending' → 'queued'..."
pending_result=$(curl -s -X POST "http://localhost:8000/api/downloads/change-status" \
  -H "Content-Type: application/json" \
  -d '{"from_status": "pending", "to_status": "queued", "count": 10000}')
echo "   $pending_result"

# Меняем все error на queued
echo "2. Меняем 'error' → 'queued'..."
error_result=$(curl -s -X POST "http://localhost:8000/api/downloads/change-status" \
  -H "Content-Type: application/json" \
  -d '{"from_status": "error", "to_status": "queued", "count": 1000}')
echo "   $error_result"

echo ""
echo "📊 Статистика ПОСЛЕ исправления:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "✅ Готово! Теперь все файлы имеют правильные статусы:"
echo "   • completed: завершённые загрузки"
echo "   • downloading: активно загружающиеся"
echo "   • queued: готовые к загрузке (новый пошаговый процесс)"
echo ""
echo "🚀 Для запуска загрузки используйте:"
echo "   ./start_download.sh"
echo "   или"
echo "   curl -X POST http://localhost:8000/api/download/queue/start"
