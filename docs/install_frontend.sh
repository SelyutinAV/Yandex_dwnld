#!/bin/bash

# Скрипт для установки frontend зависимостей
echo "🚀 Установка frontend зависимостей..."

cd frontend

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не найден! Сначала выполните:"
    echo "sudo apt update"
    echo "sudo apt install -y nodejs npm"
    exit 1
fi

echo "✅ npm найден: $(npm --version)"
echo "✅ Node.js: $(node --version)"

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Frontend зависимости установлены!"
    echo ""
    echo "Теперь можете запустить:"
    echo "npm run dev"
else
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi
