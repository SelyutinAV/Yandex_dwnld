#!/bin/bash
# Скрипт для запуска frontend

echo "🚀 Запуск Frontend..."

# Останавливаем процессы на порту 3000
echo "🛑 Остановка процессов на порту 3000..."
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
sleep 2

cd "$(dirname "$0")/frontend"

# Проверяем node_modules
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules не найдены. Установка зависимостей..."
    npm install
fi

echo "✅ Зависимости проверены"
echo "🚀 Запуск Vite сервера на http://localhost:3000"

npm run dev
