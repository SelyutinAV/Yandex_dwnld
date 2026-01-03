#!/bin/bash

# Скрипт полного перезапуска приложения Yandex Music Downloader

echo "🔄 Полный перезапуск приложения..."

# Получаем пути из переменных окружения или используем значения по умолчанию
PROJECT_DIR="${PROJECT_DIR:-/home/urch/Projects/yandex_downloads}"
BACKEND_PORT="${API_PORT:-3333}"
FRONTEND_PORT="${VITE_FRONTEND_PORT:-7777}"

# Останавливаем все процессы
echo "⏹️ Останавливаем backend..."
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true

echo "⏹️ Останавливаем frontend..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Ждем завершения процессов
sleep 2

# Запускаем backend
echo "🚀 Запускаем backend..."
cd "${PROJECT_DIR}/backend"
if [ -f "venv/bin/python" ]; then
    nohup venv/bin/python main.py > /tmp/backend.log 2>&1 &
else
    nohup python main.py > /tmp/backend.log 2>&1 &
fi
BACKEND_PID=$!

# Ждем запуска backend
sleep 3

# Запускаем frontend
echo "🚀 Запускаем frontend..."
cd "${PROJECT_DIR}/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

# Ждем запуска frontend
sleep 5

# Проверяем статус
echo "✅ Проверяем статус серверов..."

# Проверяем backend
if curl -s "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    echo "✅ Backend запущен успешно на порту ${BACKEND_PORT}"
else
    echo "❌ Backend не отвечает на порту ${BACKEND_PORT}"
fi

# Проверяем frontend
if curl -s "http://localhost:${FRONTEND_PORT}/" >/dev/null 2>&1; then
    echo "✅ Frontend запущен успешно на порту ${FRONTEND_PORT}"
else
    echo "❌ Frontend не отвечает на порту ${FRONTEND_PORT}"
fi

echo "🎉 Перезапуск завершен!"
echo "📱 Frontend: http://localhost:${FRONTEND_PORT}"
echo "🔧 Backend: http://localhost:${BACKEND_PORT}"
