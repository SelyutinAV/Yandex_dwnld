#!/bin/bash

# Скрипт запуска проекта Yandex Music Downloader
# Запускает backend и frontend

echo "🚀 ЗАПУСК YANDEX MUSIC DOWNLOADER"
echo "=================================="

# Проверяем что мы в правильной директории
if [ ! -f "backend/main.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой папки проекта"
    exit 1
fi

echo "📂 Текущая директория: $(pwd)"
echo ""

# Запускаем backend
echo "🔧 Запускаем backend..."
cd backend
echo "📁 Директория backend: $(pwd)"

# Проверяем виртуальное окружение
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено!"
    echo "Создайте его командой: python -m venv venv"
    exit 1
fi

# Активируем виртуальное окружение и запускаем
echo "🐍 Активируем виртуальное окружение..."
source venv/bin/activate

echo "🚀 Запускаем backend сервер..."
python main.py &
BACKEND_PID=$!

echo "✅ Backend запущен (PID: $BACKEND_PID)"
echo ""

# Ждем немного чтобы backend запустился
sleep 3

# Запускаем frontend
echo "🌐 Запускаем frontend..."
cd ../frontend
echo "📁 Директория frontend: $(pwd)"

# Проверяем node_modules
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules не найдено!"
    echo "Установите зависимости командой: npm install"
    exit 1
fi

echo "🚀 Запускаем frontend сервер..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Frontend запущен (PID: $FRONTEND_PID)"
echo ""

# Ждем немного чтобы frontend запустился
sleep 5

echo "🎉 ПРОЕКТ ЗАПУЩЕН!"
echo "=================="
echo ""
echo "📊 Статус сервисов:"
echo "  • Backend:  http://localhost:8000 (PID: $BACKEND_PID)"
echo "  • Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "🌐 Откройте браузер и перейдите на:"
echo "  http://localhost:3000"
echo ""
echo "🛑 Для остановки нажмите Ctrl+C"
echo ""

# Ждем завершения
wait


