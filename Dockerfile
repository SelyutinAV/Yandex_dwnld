# Многоэтапная сборка
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и устанавливаем зависимости
COPY frontend/package*.json ./
RUN npm ci

# Копируем все остальные файлы (включая конфигурацию и исходники)
# Исключаем node_modules если он есть, но копируем все остальное
COPY frontend/. ./

# Собираем фронтенд
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Копирование и установка Python зависимостей
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Копирование бэкенда
COPY backend/ ./

# Копирование собранного фронтенда
COPY --from=frontend-builder /app/frontend/dist ./static

# Создание директорий
RUN mkdir -p /app/downloads /app/logs

# Переменные окружения по умолчанию
ENV API_HOST=0.0.0.0
ENV API_PORT=8000
ENV FRONTEND_URL=http://localhost:8000
ENV DEBUG=False

EXPOSE 8000

CMD ["python", "main.py"]

