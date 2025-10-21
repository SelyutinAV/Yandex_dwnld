#!/bin/bash

# Скрипт специально для запуска через Cursor Full Stack App
echo "🚀 Запуск Yandex Music Downloader через Cursor..."

# Переходим в директорию проекта
cd "$(dirname "$0")"

# Останавливаем все запущенные процессы
echo "🛑 Остановка запущенных серверов..."
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "node.*vite" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
sleep 2

# Освобождаем порты
lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
sleep 1

echo "✅ Порты освобождены"

# Запускаем backend в фоне
echo "🐍 Запуск Backend..."
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
    export PYTHONPATH="$PWD:$PYTHONPATH"
    echo "✅ Виртуальное окружение активировано"
    python main.py &
    BACKEND_PID=$!
    echo "✅ Backend запущен (PID: $BACKEND_PID)"
else
    echo "❌ Виртуальное окружение не найдено!"
    exit 1
fi

# Возвращаемся в корень и запускаем frontend
cd ../frontend
echo "⚛️ Запуск Frontend..."

if [ ! -d "node_modules" ]; then
    echo "⚠️  Установка зависимостей frontend..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend запущен (PID: $FRONTEND_PID)"

# Ждем запуска серверов
echo "⏳ Ожидание запуска серверов..."
sleep 5

# Проверяем статус
echo "🔍 Проверка статуса серверов..."
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Backend: http://localhost:8000 - работает"
else
    echo "❌ Backend не отвечает"
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend: http://localhost:3000 - работает"
else
    echo "❌ Frontend не отвечает"
fi

echo ""
echo "🎉 Приложение запущено!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 Документация API: http://localhost:8000/docs"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Ждем завершения
wait
