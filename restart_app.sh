#!/bin/bash

# Скрипт полного перезапуска приложения Yandex Music Downloader

echo "🔄 Полный перезапуск приложения..."

# Останавливаем все процессы
echo "⏹️ Останавливаем backend..."
pkill -f "python main.py" 2>/dev/null || true

echo "⏹️ Останавливаем frontend..."
pkill -f "npm run dev" 2>/dev/null || true

# Ждем завершения процессов
sleep 2

# Запускаем backend
echo "🚀 Запускаем backend..."
cd /home/urch/Projects/yandex_downloads/backend
nohup python main.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Ждем запуска backend
sleep 3

# Запускаем frontend
echo "🚀 Запускаем frontend..."
cd /home/urch/Projects/yandex_downloads/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

# Ждем запуска frontend
sleep 5

# Проверяем статус
echo "✅ Проверяем статус серверов..."

# Проверяем backend
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ Backend запущен успешно"
else
    echo "❌ Backend не отвечает"
fi

# Проверяем frontend
if curl -s http://localhost:3000/ >/dev/null 2>&1; then
    echo "✅ Frontend запущен успешно"
else
    echo "❌ Frontend не отвечает"
fi

echo "🎉 Перезапуск завершен!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8000"
