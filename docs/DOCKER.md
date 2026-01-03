# Docker конфигурация для Yandex Music Downloader

## Быстрый старт

### 1. Создайте файл `.env` в корне проекта

Скопируйте `.env.example` и заполните необходимые переменные:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите:
- `YANDEX_TOKEN` - ваш токен Яндекс.Музыки
- `DOWNLOAD_PATH` - путь для сохранения музыки (локальный путь)
- `API_PORT` - порт для API (по умолчанию 3333)
- `FRONTEND_URL` - URL фронтенда (для CORS, по умолчанию http://localhost:7777)

### 2. Соберите и запустите контейнер

```bash
docker-compose up -d --build
```

### 3. Откройте приложение

- **Фронтенд**: http://localhost:3333 (обслуживается через бэкенд)
- **API**: http://localhost:3333/api

## Настройка портов

Порты по умолчанию:
- **Бэкенд**: 3333
- **Фронтенд**: 7777

Чтобы изменить порты, отредактируйте `.env`:

```env
API_PORT=3333
FRONTEND_URL=http://localhost:7777
VITE_API_URL=http://localhost:3333
VITE_FRONTEND_PORT=7777
```

Затем пересоберите и перезапустите:

```bash
docker-compose down
docker-compose up -d --build
```

## Переменные окружения

### Обязательные
- `YANDEX_TOKEN` - токен Яндекс.Музыки

### Опциональные
- `API_PORT` - порт API (по умолчанию 3333)
- `API_HOST` - хост API (по умолчанию 0.0.0.0)
- `FRONTEND_URL` - URL фронтенда для CORS
- `CORS_ORIGINS` - дополнительные origins через запятую
- `DOWNLOAD_PATH` - путь для загрузки музыки (по умолчанию ./downloads)
- `DEFAULT_QUALITY` - качество по умолчанию (lossless, hq, nq)
- `DEBUG` - режим отладки (True/False)

## Volumes

Контейнер монтирует следующие директории:
- `./backend/yandex_music.db` - база данных
- `${DOWNLOAD_PATH}` - директория для загрузки музыки
- `./logs` - логи приложения

## Остановка

```bash
docker-compose down
```

## Просмотр логов

```bash
docker-compose logs -f
```

## Пересборка после изменений

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Развертывание на удаленном сервере

1. Скопируйте проект на сервер
2. Создайте `.env` файл с правильными настройками
3. Убедитесь, что `FRONTEND_URL` указывает на публичный URL сервера
4. Запустите `docker-compose up -d --build`

## Troubleshooting

### Порт занят
Измените `API_PORT` в `.env` и перезапустите контейнер.

### CORS ошибки
Убедитесь, что `FRONTEND_URL` в `.env` соответствует URL, с которого открывается приложение.

### База данных не сохраняется
Проверьте, что volume для `yandex_music.db` правильно смонтирован.

