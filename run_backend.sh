#!/bin/bash

# Скрипт запуска только backend
echo "🐍 Запуск Backend..."
cd backend
source venv/bin/activate
python main.py
