# Docker конфигурация для Yandex Music Downloader

## Развертывание на Synology NAS

Для развертывания на Synology NAS с Container Manager см. подробную инструкцию:

- [Быстрый старт на Synology](../SYNOLOGY_QUICK_START.md)
- [Полная инструкция по развертыванию на Synology](./SYNOLOGY_DEPLOYMENT.md)

## Быстрый старт

### 1. Создайте файл `.env` в корне проекта

Скопируйте `.env.example` и заполните необходимые переменные:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите:

- `YANDEX_TOKEN` - ваш токен Яндекс.Музыки
- `DOWNLOAD_PATH` - путь для сохранения музыки (локальный путь)
- `API_PORT` - порт для API (по умолчанию 8000)
- `FRONTEND_URL` - URL фронтенда (для CORS, по умолчанию http://localhost:8000)

### 2. Соберите и запустите контейнер

```bash
docker-compose up -d --build
```

### 3. Откройте приложение

- **Фронтенд и API**: http://localhost:8000 (обслуживается через бэкенд)
- **API**: http://localhost:8000/api

## Настройка портов

Порты по умолчанию:

- **Бэкенд и Фронтенд**: 8000

Чтобы изменить порты, отредактируйте `.env`:

```env
API_PORT=8000
FRONTEND_URL=http://localhost:8000
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

- `API_PORT` - порт API (по умолчанию 8000)
- `API_HOST` - хост API (по умолчанию 0.0.0.0)
- `FRONTEND_URL` - URL фронтенда для CORS
- `CORS_ORIGINS` - дополнительные origins через запятую
- `DOWNLOAD_PATH` - путь для загрузки музыки (по умолчанию ./downloads)
- `DEFAULT_QUALITY` - качество по умолчанию (lossless, hq, nq)
- `DEBUG` - режим отладки (True/False)

## Volumes

Контейнер монтирует следующие директории:

- `./backend/data/yandex_music.db` - база данных
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
