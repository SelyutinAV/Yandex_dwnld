# Сборка Docker образа

## Быстрый старт

1. **Создайте `.env` файл** (скопируйте из `.env.example` и заполните):
   ```bash
   cp .env.example .env
   # Отредактируйте .env и укажите YANDEX_TOKEN и другие настройки
   ```

2. **Соберите и запустите**:
   ```bash
   docker-compose up -d --build
   ```

3. **Откройте приложение**:
   - http://localhost:3333 (или порт, указанный в API_PORT)

## Изменение портов

Отредактируйте `.env`:
```env
API_PORT=3333
FRONTEND_URL=http://localhost:7777
VITE_API_URL=http://localhost:3333
VITE_FRONTEND_PORT=7777
```

Затем перезапустите:
```bash
docker-compose down
docker-compose up -d
```

## Остановка

```bash
docker-compose down
```

Подробная документация в `DOCKER.md`

