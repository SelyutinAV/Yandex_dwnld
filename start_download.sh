#!/bin/bash

echo "🚀 Запуск загрузки очереди через API..."

# Проверяем что бэкенд работает
if ! curl -s "http://localhost:8000/api/health" > /dev/null; then
    echo "❌ Бэкенд не отвечает на http://localhost:8000"
    echo "Запустите бэкенд: cd backend && python main.py"
    exit 1
fi

# Получаем статистику до запуска
echo "📊 Статистика ДО запуска:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "🚀 Запускаем загрузку..."

# Запускаем загрузку
response=$(curl -s -X POST "http://localhost:8000/api/download/queue/start")
echo "Ответ API: $response"

echo ""
echo "⏳ Ожидаем 3 секунды и проверяем статус..."

sleep 3

echo "📊 Статистика ПОСЛЕ запуска:"
curl -s "http://localhost:8000/api/debug/queue" | jq '.status_counts'

echo ""
echo "✅ Готово! Проверьте интерфейс на http://localhost:3000"
