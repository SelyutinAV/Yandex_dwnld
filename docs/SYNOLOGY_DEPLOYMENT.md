# Развертывание на Synology NAS (Container Manager)

Это руководство поможет вам развернуть Yandex Music Downloader на Synology NAS с использованием Container Manager.

## Предварительные требования

1. **Synology NAS** с установленным DSM 7.0 или выше
2. **Container Manager** установлен и запущен
3. **Git** установлен на Synology (через Package Center → Git Server или через SSH)
4. **SSH доступ** к Synology (рекомендуется для клонирования репозитория)
5. **Токен Яндекс.Музыки** (см. [TOKEN_INSTRUCTIONS.md](./TOKEN_INSTRUCTIONS.md))

## Способ 1: Развертывание через Container Manager GUI

### Шаг 1: Клонирование проекта с GitHub

1. Подключитесь к Synology по SSH:

   ```bash
   ssh admin@192.168.1.80
   ```

2. Перейдите в папку docker и клонируйте репозиторий:

   ```bash
   cd /volume1/docker
   git clone https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads
   cd yandex-downloads
   ```

3. Если Git не установлен, установите его через Package Center:
   - Откройте **Package Center**
   - Найдите и установите **Git Server**
   - Или установите через SSH: `sudo synopkg install git`

### Шаг 2: Создание .env файла

1. Создайте файл `.env` в корне проекта:

   ```bash
   cd /volume1/docker/yandex-downloads
   cp backend/env.example .env
   ```

   Или создайте файл вручную через File Station или редактор:

2. Отредактируйте `.env` файл и укажите:

   ```env
   HOST_PORT=7777
   FRONTEND_URL=http://192.168.1.80:7777
   CORS_ORIGINS=http://192.168.1.80:7777,http://192.168.1.80
   DOWNLOAD_PATH=/volume1/music/yandex-downloads
   DEFAULT_QUALITY=lossless
   DEBUG=False
   ```

   **Примечание**: Токен `YANDEX_TOKEN` не обязателен в `.env` файле - его можно добавить через веб-интерфейс после запуска приложения (раздел "Настройки" → "Токены").

### Шаг 3: Создание проекта в Container Manager

1. Откройте **Container Manager** в DSM
2. Перейдите в раздел **Project** (Проект)
3. Нажмите **Create** (Создать)
4. Выберите **From docker-compose.yml**
5. Укажите:
   - **Project name**: `yandex-music-downloader`
   - **Path**: `/volume1/docker/yandex-downloads`
   - **Source**: выберите `docker-compose.yml` из папки проекта
6. Нажмите **Next**

### Шаг 4: Настройка переменных окружения

В разделе **Environment Variables** (Переменные окружения) убедитесь, что все переменные из `.env` файла загружены, или добавьте их вручную:

- `HOST_PORT=7777` - внешний порт для доступа к приложению (фронтенд и API)
- `FRONTEND_URL=http://192.168.1.80:7777`
- `CORS_ORIGINS=http://192.168.1.80:7777,http://192.168.1.80`
- `DOWNLOAD_PATH=/volume1/music/yandex-downloads`
- `DEFAULT_QUALITY=lossless`
- `DEBUG=False`

**Примечание**: `YANDEX_TOKEN` не обязателен - токен можно добавить через веб-интерфейс после запуска.

### Шаг 5: Настройка Volumes (томов)

В разделе **Volumes** (Томы) настройте следующие пути:

1. **База данных**:

   - Host path: `/volume1/docker/yandex-downloads/backend/data` (папка, не файл!)
   - Container path: `/app/data`

2. **Загрузки** (опционально):

   - Если хотите сохранять музыку на Synology, добавьте volume в docker-compose.yml:
   - Раскомментируйте строку: `- ${DOWNLOAD_PATH}:/app/downloads`
   - Host path: `/volume1/music/yandex-downloads` (или ваша папка)
   - Container path: `/app/downloads`
   - **Примечание**: Если не монтировать, музыка будет сохраняться внутри контейнера. Путь можно настроить позже через веб-интерфейс в разделе "Настройки".

3. **Логи**:
   - Host path: `/volume1/docker/yandex-downloads/logs`
   - Container path: `/app/logs`

### Шаг 6: Настройка портов

В разделе **Port Settings** (Настройки портов):

- **Container Port**: `8000` (внутренний порт контейнера)
- **Local Port**: `7777` (внешний порт на Synology)
- **Type**: `TCP`

### Шаг 7: Запуск проекта

1. Нажмите **Next** и проверьте все настройки
2. Нажмите **Done** для создания проекта
3. Container Manager автоматически соберет образ и запустит контейнер

### Шаг 8: Проверка работы

1. Дождитесь завершения сборки (может занять несколько минут)
2. Проверьте статус контейнера - он должен быть в состоянии **Running**
3. Откройте в браузере: `http://192.168.1.80:7777`
4. Приложение должно загрузиться

### Шаг 9: Добавление токена (если не указан в .env)

Если вы не указали токен в `.env` файле, добавьте его через веб-интерфейс:

1. Откройте приложение: `http://192.168.1.80:7777`
2. Перейдите в раздел **Настройки**
3. В разделе **Токены** добавьте ваш токен Яндекс.Музыки
4. Нажмите **Проверить** и **Сохранить**

Токен будет сохранен в базе данных и использоваться для работы приложения.

## Способ 2: Развертывание через SSH (командная строка)

Если вы предпочитаете использовать командную строку:

### Шаг 1: Подключение к Synology по SSH

1. Включите SSH в **Control Panel** → **Terminal & SNMP** → **Enable SSH service**
2. Подключитесь через SSH:
   ```bash
   ssh admin@192.168.1.80
   ```

### Шаг 2: Клонирование проекта с GitHub

```bash
# Перейдите в папку docker
cd /volume1/docker

# Клонируйте репозиторий
git clone https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads

# Перейдите в папку проекта
cd yandex-downloads
```

Если Git не установлен, установите его:

```bash
# Через Package Center (GUI) или через SSH:
sudo synopkg install git
```

### Шаг 3: Создание .env файла

```bash
# Создайте .env файл на основе примера
cp backend/env.example .env

# Отредактируйте .env файл
nano .env
```

Добавьте или измените следующие параметры:

```env
HOST_PORT=7777
FRONTEND_URL=http://192.168.1.80:7777
CORS_ORIGINS=http://192.168.1.80:7777,http://192.168.1.80
# DOWNLOAD_PATH не обязателен - можно настроить позже через веб-интерфейс
# DOWNLOAD_PATH=/volume1/music/yandex-downloads
DEFAULT_QUALITY=lossless
DEBUG=False
```

**Примечание**: `YANDEX_TOKEN` не обязателен - токен можно добавить через веб-интерфейс после запуска приложения.

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

### Шаг 4: Создание необходимых папок

**⚠️ ВАЖНО**: Эти папки должны быть созданы ДО запуска контейнера, иначе возникнет ошибка монтирования!

```bash
# Создайте папки для данных
mkdir -p /volume1/music/yandex-downloads
mkdir -p /volume1/docker/yandex-downloads/logs
mkdir -p /volume1/docker/yandex-downloads/backend/data

# Установите правильные права доступа
chmod -R 755 /volume1/music/yandex-downloads
chmod -R 755 /volume1/docker/yandex-downloads/logs
chmod -R 755 /volume1/docker/yandex-downloads/backend/data
```

### Шаг 5: Запуск через docker-compose

```bash
# Перейдите в папку проекта
cd /volume1/docker/yandex-downloads

# Запустите контейнер
docker-compose up -d --build
```

### Шаг 6: Проверка логов

```bash
# Просмотр логов
docker-compose logs -f

# Проверка статуса
docker-compose ps
```

## Настройка прав доступа

Для правильной работы приложения убедитесь, что у пользователя `http` (или пользователя, под которым запущен Docker) есть права на запись в папки:

```bash
# В SSH на Synology
sudo chown -R http:http /volume1/music/yandex-downloads
sudo chown -R http:http /volume1/docker/yandex-downloads/logs
sudo chown -R http:http /volume1/docker/yandex-downloads/backend/data
```

## Настройка портов и доступа

### Изменение порта

Если порт 7777 занят, измените его в `.env`:

```env
HOST_PORT=8080
```

И обновите `FRONTEND_URL`:

```env
FRONTEND_URL=http://192.168.1.80:8080
```

Затем перезапустите контейнер:

```bash
docker-compose down
docker-compose up -d
```

### Доступ извне (опционально)

Если вы хотите получить доступ к приложению из интернета:

1. Настройте **Port Forwarding** в роутере
2. Настройте **Firewall** в Synology (Control Panel → Security → Firewall)
3. Обновите `FRONTEND_URL` и `CORS_ORIGINS` с вашим внешним IP или доменом

## Обновление приложения

### Через SSH (рекомендуется)

```bash
cd /volume1/docker/yandex-downloads

# Остановите контейнер
docker-compose down

# Обновите код с GitHub
git pull origin main
# или
git pull origin master

# Пересоберите и запустите
docker-compose up -d --build
```

### Через Container Manager GUI

1. Остановите проект в Container Manager
2. Подключитесь по SSH и выполните:
   ```bash
   cd /volume1/docker/yandex-downloads
   git pull origin main
   ```
3. В Container Manager запустите проект заново (он автоматически пересоберет образ)

## Управление контейнером

### Просмотр логов

```bash
docker-compose logs -f yandex-music-downloader
```

### Остановка

```bash
docker-compose stop
```

### Запуск

```bash
docker-compose start
```

### Перезапуск

```bash
docker-compose restart
```

### Удаление

```bash
docker-compose down
```

Для полного удаления (включая volumes):

```bash
docker-compose down -v
```

⚠️ **Внимание**: Это удалит базу данных и все загруженные файлы!

## Troubleshooting

### Ошибка монтирования volume (Bind mount failed)

Если при запуске контейнера возникает ошибка:

```
Error response from daemon: Bind mount failed: '/volume1/docker/yandex-downloads/logs' does not exist
```

**Решение**: Создайте необходимые папки перед запуском контейнера:

```bash
mkdir -p /volume1/docker/yandex-downloads/logs
mkdir -p /volume1/docker/yandex-downloads/backend/data
mkdir -p /volume1/music/yandex-downloads

# Установите права доступа
chmod -R 755 /volume1/docker/yandex-downloads/logs
chmod -R 755 /volume1/docker/yandex-downloads/backend/data
chmod -R 755 /volume1/music/yandex-downloads
```

После создания папок перезапустите контейнер:

```bash
docker-compose up -d
```

### Ошибка при клонировании репозитория (RPC failed, SSL error)

Если при клонировании репозитория возникает ошибка:

```
error: RPC failed; curl 56 OpenSSL SSL_read: error:0A000119:SSL routines::decryption failed
fatal: early EOF
```

Это связано с настройками Git на Synology. Решение:

**Способ 1: Увеличение буфера Git (рекомендуется)**

```bash
# Настройте глобальные параметры Git
git config --global http.postBuffer 524288000
git config --global http.maxRequestBuffer 100M
git config --global core.compression 0

# Попробуйте клонировать снова
cd /volume1/docker
git clone https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads
```

**Способ 2: Клонирование с отключенной компрессией**

```bash
cd /volume1/docker
GIT_HTTP_LOW_SPEED_LIMIT=0 GIT_HTTP_LOW_SPEED_TIME=0 git clone --depth 1 https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads
```

**Способ 3: Использование shallow clone (быстрое, но без истории)**

```bash
cd /volume1/docker
git clone --depth 1 https://github.com/SelyutinAV/Yandex_dwnld.git yandex-downloads
```

**Способ 4: Обновление Git (если версия старая)**

```bash
# Проверьте версию Git
git --version

# Если версия очень старая, обновите через Package Center
# или установите более новую версию через Entware/ipkg
```

**Способ 5: Клонирование через SSH (если настроен SSH ключ)**

```bash
cd /volume1/docker
git clone git@github.com:SelyutinAV/Yandex_dwnld.git yandex-downloads
```

После успешного клонирования можно вернуть настройки Git к исходным (опционально):

```bash
git config --global --unset http.postBuffer
git config --global --unset http.maxRequestBuffer
```

### Контейнер не запускается

1. Проверьте логи:

   ```bash
   docker-compose logs yandex-music-downloader
   ```

2. Убедитесь, что `.env` файл существует и содержит правильные значения

3. Проверьте права доступа к папкам

### Ошибки CORS

Убедитесь, что `FRONTEND_URL` и `CORS_ORIGINS` в `.env` соответствуют URL, с которого вы открываете приложение.

### База данных не сохраняется

Проверьте, что volume для базы данных правильно смонтирован:

```bash
docker-compose exec yandex-music-downloader ls -la /app/data/yandex_music.db
```

База данных должна находиться в `/app/data/yandex_music.db` внутри контейнера.

### Порт занят

Измените `HOST_PORT` в `.env` на свободный порт и перезапустите контейнер.

### Проблемы с правами доступа

Убедитесь, что папки для загрузок и логов имеют правильные права:

```bash
sudo chmod -R 755 /volume1/music/yandex-downloads
sudo chmod -R 755 /volume1/docker/yandex-downloads/logs
```

## Структура папок на Synology

Рекомендуемая структура:

```
/volume1/
├── docker/
│   └── yandex-downloads/
│       ├── docker-compose.yml
│       ├── Dockerfile
│       ├── .env
│       ├── backend/
│       │   └── data/
│       │       └── yandex_music.db
│       └── logs/
└── music/
    └── yandex-downloads/
        └── (загруженная музыка)
```

## Дополнительные ресурсы

- [Docker документация](https://docs.docker.com/)
- [Synology Container Manager руководство](https://kb.synology.com/en-global/DSM/help/ContainerManager/container_manager_desc)
- [Инструкции по получению токена](./TOKEN_INSTRUCTIONS.md)
