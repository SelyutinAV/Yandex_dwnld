#!/bin/bash

# Скрипт для запуска Yandex Music Downloader
# Использование: ./start.sh [backend|frontend|both]

PROJECT_DIR="/home/urch/Projects/yandex_downloads"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Yandex Music Downloader - Запуск          ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

start_backend() {
    echo -e "${GREEN}🚀 Запуск Backend...${NC}"
    
    # Проверяем, не запущен ли уже backend
    check_running_servers
    
    # Останавливаем старые процессы на порту 8000
    BACKEND_PID=$(lsof -ti:8000 2>/dev/null || true)
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}🔄 Перезапуск backend...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        sleep 3
    fi
    
    cd "$BACKEND_DIR"
    
    # Проверка виртуального окружения
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}⚠️  Виртуальное окружение не найдено. Создание...${NC}"
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi
    
    # Проверка .env файла
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ Файл .env не найден!${NC}"
        echo -e "${YELLOW}Создайте .env файл на основе env.example${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Backend запускается на http://localhost:8000${NC}"
    python main.py
}

start_frontend() {
    echo -e "${GREEN}🚀 Запуск Frontend...${NC}"
    
    # Проверяем, не запущен ли уже frontend
    FRONTEND_PID=$(lsof -ti:3000 2>/dev/null || true)
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}🔄 Перезапуск frontend...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        sleep 3
    fi
    
    cd "$FRONTEND_DIR"
    
    # Проверка node_modules
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}⚠️  node_modules не найдены. Установка зависимостей...${NC}"
        npm install
    fi
    
    echo -e "${GREEN}✅ Frontend запускается на http://localhost:3000${NC}"
    npm run dev
}

start_both() {
    echo -e "${BLUE}🚀 Запуск Backend и Frontend...${NC}"
    
    # Проверяем и останавливаем запущенные серверы
    check_running_servers
    stop_servers
    
    # Запуск backend в фоне
    cd "$BACKEND_DIR"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi
    
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ Файл .env не найден в backend/!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Backend запускается на http://localhost:8000${NC}"
    python main.py &
    BACKEND_PID=$!
    
    # Ждем запуска backend
    sleep 3
    
    # Запуск frontend
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    echo -e "${GREEN}✅ Frontend запускается на http://localhost:3000${NC}"
    npm run dev
    
    # При завершении frontend, убиваем backend
    kill $BACKEND_PID 2>/dev/null
}

check_running_servers() {
    echo -e "${BLUE}🔍 Проверка запущенных серверов...${NC}"
    
    # Проверка backend (Python на порту 8000)
    BACKEND_PID=$(lsof -ti:8000 2>/dev/null || true)
    FRONTEND_PID=$(lsof -ti:3000 2>/dev/null || true)
    
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}⚠️  Backend сервер уже запущен (PID: $BACKEND_PID)${NC}"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}⚠️  Frontend сервер уже запущен (PID: $FRONTEND_PID)${NC}"
    fi
    
    return 0
}

stop_servers() {
    echo -e "${BLUE}🛑 Остановка запущенных серверов...${NC}"
    
    # Остановка backend
    BACKEND_PID=$(lsof -ti:8000 2>/dev/null || true)
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}⏹️  Останавливаем backend (PID: $BACKEND_PID)${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        sleep 2
    fi
    
    # Остановка frontend
    FRONTEND_PID=$(lsof -ti:3000 2>/dev/null || true)
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}⏹️  Останавливаем frontend (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        sleep 2
    fi
    
    echo -e "${GREEN}✅ Серверы остановлены${NC}"
}

check_requirements() {
    echo -e "${BLUE}🔍 Проверка зависимостей...${NC}"
    
    # Проверка Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python 3 не установлен${NC}"
        exit 1
    fi
    
    # Проверка Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js не установлен${NC}"
        exit 1
    fi
    
    # Проверка npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm не установлен${NC}"
        exit 1
    fi
    
    # Проверка lsof для проверки портов
    if ! command -v lsof &> /dev/null; then
        echo -e "${YELLOW}⚠️  lsof не установлен. Устанавливаем...${NC}"
        apt update && apt install -y lsof
    fi
    
    echo -e "${GREEN}✅ Все зависимости установлены${NC}"
    echo ""
}

show_help() {
    echo "Использование: ./start.sh [команда]"
    echo ""
    echo "Команды:"
    echo "  backend    - Запустить только backend сервер"
    echo "  frontend   - Запустить только frontend приложение"
    echo "  both       - Запустить оба (по умолчанию)"
    echo "  restart    - Перезапустить оба сервера"
    echo "  stop       - Остановить все запущенные серверы"
    echo "  status     - Показать статус серверов"
    echo "  help       - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  ./start.sh backend"
    echo "  ./start.sh frontend"
    echo "  ./start.sh"
    echo ""
}

# Главная логика
print_header

case "$1" in
    backend)
        check_requirements
        start_backend
        ;;
    frontend)
        check_requirements
        start_frontend
        ;;
    both|"")
        check_requirements
        start_both
        ;;
    restart)
        check_requirements
        stop_servers
        start_both
        ;;
    stop)
        stop_servers
        ;;
    status)
        check_running_servers
        ;;
    help|-h|--help)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Неизвестная команда: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

