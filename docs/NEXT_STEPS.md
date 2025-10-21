# Следующие шаги для завершения проекта

## ✅ Что уже готово

- ✅ Полная структура frontend (React + TypeScript)
- ✅ Все UI компоненты с красивым дизайном
- ✅ Backend структура (FastAPI)
- ✅ Модули для работы с Яндекс.Музыкой
- ✅ База данных (SQLite)
- ✅ Менеджер загрузок
- ✅ Документация

## 🔧 Что нужно сделать

### 1. Установка npm (если не установлен)

```bash
sudo apt update
sudo apt install npm
```

### 2. Установка зависимостей

```bash
# Backend
cd "/home/urch/ Projects/yandex_downloads/backend"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd "/home/urch/ Projects/yandex_downloads/frontend"
npm install
```

### 3. Получение токена Яндекс.Музыки

**Метод через DevTools (рекомендуется):**

1. Откройте Chrome/Firefox
2. Нажмите F12 (DevTools)
3. Перейдите на вкладку **Network** (Сеть)
4. Откройте https://music.yandex.ru
5. Авторизуйтесь
6. В Network найдите любой запрос к API
7. В заголовках найдите `Authorization: OAuth <токен>`
8. Скопируйте значение токена

**Альтернативный метод через Python:**

```python
from yandex_music import Client

# Войдите через браузер, затем извлеките токен из cookies
client = Client.from_credentials('ваш_логин', 'ваш_пароль')
print(client.token)
```

### 4. Создание .env файла

```bash
cd "/home/urch/ Projects/yandex_downloads/backend"
cp env.example .env
nano .env  # или используйте другой редактор
```

Заполните:
```env
YANDEX_TOKEN=y0_AgAAAAAA...ваш_токен
DOWNLOAD_PATH=/home/urch/Music/Yandex
DEFAULT_QUALITY=lossless
DATABASE_URL=sqlite+aiosqlite:///./yandex_music.db
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
```

### 5. Создание папки для музыки

```bash
mkdir -p /home/urch/Music/Yandex
```

### 6. Первый запуск

```bash
cd "/home/urch/ Projects/yandex_downloads"
./start.sh
```

Или раздельно:

**Терминал 1 (Backend):**
```bash
cd "/home/urch/ Projects/yandex_downloads/backend"
source venv/bin/activate
python main.py
```

**Терминал 2 (Frontend):**
```bash
cd "/home/urch/ Projects/yandex_downloads/frontend"
npm run dev
```

### 7. Проверка работы

1. Backend API: http://localhost:8000/docs
2. Frontend App: http://localhost:3000

## 🔨 Доработки для production

### Backend

1. **Интеграция API эндпоинтов с реальными функциями:**
   
   В `backend/main.py` замените TODO на реальную логику:
   
   ```python
   from yandex_client import YandexMusicClient
   from downloader import DownloadManager
   from database import init_database
   
   # Инициализация
   db_session = init_database()
   yandex_client = YandexMusicClient(token)
   download_manager = DownloadManager(yandex_client, download_path)
   ```

2. **Добавьте обработку ошибок:**
   ```python
   try:
       # операция
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))
   ```

3. **WebSocket для прогресса в реальном времени:**
   ```bash
   pip install websockets
   ```

4. **Фоновые задачи с Celery:**
   ```bash
   pip install celery redis
   ```

### Frontend

1. **Подключите компоненты к API:**
   
   В `frontend/src/components/PlaylistManager.tsx`:
   ```typescript
   const loadPlaylists = async () => {
     try {
       const response = await fetch('/api/playlists')
       const data = await response.json()
       setPlaylists(data)
     } catch (error) {
       console.error('Ошибка:', error)
     }
   }
   ```

2. **Добавьте state management (опционально):**
   ```bash
   npm install zustand
   # или
   npm install @reduxjs/toolkit react-redux
   ```

3. **WebSocket клиент для прогресса:**
   ```typescript
   const ws = new WebSocket('ws://localhost:8000/ws')
   ws.onmessage = (event) => {
     const data = JSON.parse(event.data)
     updateProgress(data)
   }
   ```

## 🎯 Рекомендуемый порядок доработки

### Фаза 1: Базовая работоспособность
1. ✅ Установить зависимости
2. ✅ Получить токен
3. ✅ Запустить Backend
4. ✅ Запустить Frontend
5. ⏳ Проверить подключение к Яндекс.Музыке

### Фаза 2: Интеграция
1. ⏳ Подключить API в SettingsPanel (проверка токена)
2. ⏳ Подключить API в PlaylistManager (загрузка плейлистов)
3. ⏳ Реализовать загрузку одного плейлиста
4. ⏳ Добавить отображение прогресса

### Фаза 3: Полная функциональность
1. ⏳ Очередь загрузок
2. ⏳ Анализ файлов
3. ⏳ Автосинхронизация
4. ⏳ Обработка ошибок

### Фаза 4: Улучшения
1. ⏳ WebSocket для прогресса
2. ⏳ Celery для фоновых задач
3. ⏳ Кэширование
4. ⏳ Тесты

## 📝 Чек-лист перед первым запуском

- [ ] npm установлен
- [ ] Python 3.10+ установлен
- [ ] Backend зависимости установлены (`pip install -r requirements.txt`)
- [ ] Frontend зависимости установлены (`npm install`)
- [ ] Токен Яндекс.Музыки получен
- [ ] Файл `.env` создан и заполнен
- [ ] Папка для музыки создана
- [ ] Права на запись в папку есть

## ⚡ Быстрый тест

После установки всего необходимого:

```bash
# 1. Тест Backend API
cd backend
source venv/bin/activate
python -c "from yandex_music import Client; print('OK')"

# 2. Запуск Backend
python main.py &

# 3. Проверка API
curl http://localhost:8000/api/health

# 4. В другом терминале - Frontend
cd ../frontend
npm run dev

# 5. Откройте браузер
# http://localhost:3000
```

## 🆘 Помощь

### Частые проблемы

**1. "Module yandex_music not found"**
```bash
cd backend
source venv/bin/activate
pip install yandex-music
```

**2. "npm command not found"**
```bash
sudo apt install npm
```

**3. "Permission denied при создании папки"**
```bash
sudo mkdir -p /home/urch/Music/Yandex
sudo chown -R $USER:$USER /home/urch/Music/Yandex
```

**4. "CORS error в браузере"**
- Проверьте, что Backend запущен на порту 8000
- Проверьте настройки CORS в `backend/main.py`

## 📚 Полезные ссылки

- Документация yandex-music: https://github.com/MarshalX/yandex-music-api
- FastAPI документация: https://fastapi.tiangolo.com/
- React документация: https://react.dev/
- Vite документация: https://vitejs.dev/

## 🎵 После завершения

Когда всё заработает:

1. Настройте автозапуск (systemd или PM2)
2. Настройте регулярную синхронизацию
3. Организуйте бэкапы
4. Наслаждайтесь музыкой в lossless качестве!

---

**Успехов в разработке и приятного прослушивания! 🎧**

