# Быстрый старт на Synology NAS

## Шаг 1: Клонирование проекта с GitHub

Подключитесь к Synology по SSH и выполните:

```bash
# Перейдите в папку docker
cd /volume1/docker

# Клонируйте репозиторий
git clone https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads

# Перейдите в папку проекта
cd yandex-downloads
```

**Примечания**:

- Если Git не установлен, установите его через Package Center (Git Server) или через SSH: `sudo synopkg install git`
- Если при клонировании возникает ошибка `RPC failed` или `SSL error`, см. раздел "Ошибка при клонировании репозитория" в [полной инструкции](./docs/SYNOLOGY_DEPLOYMENT.md#ошибка-при-клонировании-репозитория-rpc-failed-ssl-error)

## Шаг 2: Создание .env файла

Создайте файл `.env` в корне проекта на основе примера:

```bash
cd /volume1/docker/yandex-downloads
cp backend/env.example .env
nano .env  # или используйте любой другой редактор
```

Или создайте файл вручную через File Station. Содержимое `.env`:

```env
HOST_PORT=7777
FRONTEND_URL=http://192.168.1.80:7777
CORS_ORIGINS=http://192.168.1.80:7777,http://192.168.1.80
# DOWNLOAD_PATH не обязателен - можно настроить позже через веб-интерфейс
# DOWNLOAD_PATH=/volume1/music/yandex-downloads
DEFAULT_QUALITY=lossless
DEBUG=False
```

**Примечание**: Токен `YANDEX_TOKEN` не обязателен в `.env` - его можно добавить через веб-интерфейс после запуска приложения (раздел "Настройки" → "Токены").

## Шаг 3: Создание папок

**⚠️ ВАЖНО**: Эти папки должны быть созданы ДО запуска контейнера, иначе возникнет ошибка монтирования!

Создайте необходимые папки через File Station или SSH:

```bash
# Обязательные папки
mkdir -p /volume1/docker/yandex-downloads/logs
mkdir -p /volume1/docker/yandex-downloads/backend/data

# Установите права доступа
chmod -R 755 /volume1/docker/yandex-downloads/logs
chmod -R 755 /volume1/docker/yandex-downloads/backend/data

# Папка для загрузок (опционально - можно настроить позже через веб-интерфейс)
# mkdir -p /volume1/music/yandex-downloads
# chmod -R 755 /volume1/music/yandex-downloads
```

## Шаг 4: Запуск через Container Manager

### Вариант A: Через GUI

1. Откройте **Container Manager**
2. Перейдите в **Project** → **Create**
3. Выберите **From docker-compose.yml**
4. Укажите:
   - **Project name**: `yandex-music-downloader`
   - **Path**: `/volume1/docker/yandex-downloads`
5. Нажмите **Next** → **Done**

### Вариант B: Через SSH

```bash
cd /volume1/docker/yandex-downloads
docker-compose up -d --build
```

## Шаг 5: Открытие приложения

Откройте в браузере:

```
http://192.168.1.80:7777
```

## Полная инструкция

Подробная инструкция с troubleshooting находится в файле:
[docs/SYNOLOGY_DEPLOYMENT.md](./docs/SYNOLOGY_DEPLOYMENT.md)
