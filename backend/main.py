"""
Главный модуль FastAPI приложения для загрузки музыки с Яндекс.Музыки
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import asyncio
from dotenv import load_dotenv

# Импорт наших модулей
from yandex_client import YandexMusicClient
from downloader import DownloadManager
from db_manager import db_manager

# Загружаем переменные окружения
load_dotenv()

# Глобальные переменные
yandex_client: Optional[YandexMusicClient] = None
download_manager: Optional[DownloadManager] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    await init_app()
    yield
    # Shutdown
    print("Приложение завершает работу")

async def init_app():
    """Инициализация приложения"""
    global yandex_client, download_manager
    
    # Инициализация клиента Яндекс.Музыка
    update_yandex_client()

# Создание FastAPI приложения
app = FastAPI(
    title="Yandex Music Downloader API",
    description="API для загрузки музыки с Яндекс.Музыки",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модели данных
class Playlist(BaseModel):
    id: str
    title: str
    track_count: int
    owner: str

class Track(BaseModel):
    id: str
    title: str
    artist: str
    album: str
    duration: int

class DownloadRequest(BaseModel):
    playlist_id: str
    quality: str = "lossless"

class Settings(BaseModel):
    token: str
    downloadPath: str
    quality: str
    autoSync: bool = False
    syncInterval: int = 24

class TokenTest(BaseModel):
    token: str

class SaveTokenRequest(BaseModel):
    name: str
    token: str

class ActivateTokenRequest(BaseModel):
    token_id: int

# Функция для обновления клиента
def update_yandex_client(token: Optional[str] = None):
    """Обновление клиента Яндекс.Музыка"""
    global yandex_client, download_manager
    
    # Получаем токен из базы данных если не передан
    if not token:
        try:
            # Получаем активный токен
            active_token = db_manager.get_active_token()
            if active_token:
                token = active_token["token"]
            else:
                # Если нет активного токена, пробуем старый способ
                token = db_manager.get_setting("yandex_token")
        except Exception as e:
            print(f"Ошибка получения токена из БД: {e}")
            token = None
    
    # Если токен не найден в БД, пробуем из переменных окружения
    if not token:
        token = os.getenv("YANDEX_TOKEN", "")
    
    if token and token != "your_yandex_music_token_here":
        try:
            yandex_client = YandexMusicClient(token)
            if yandex_client.connect():
                # Получаем путь для загрузки из настроек
                download_path = db_manager.get_setting(
                    "download_path", 
                    os.getenv("DOWNLOAD_PATH", "/home/urch/Music/Yandex")
                )
                
                download_manager = DownloadManager(yandex_client, download_path)
                print(f"Клиент Яндекс.Музыка успешно инициализирован")
            else:
                print(f"Не удалось подключиться к Яндекс.Музыке с токеном")
                yandex_client = None
        except Exception as e:
            print(f"Ошибка инициализации клиента Яндекс.Музыки: {e}")
            yandex_client = None
    else:
        print("Токен Яндекс.Музыки не найден")

# Эндпоинты
@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {"message": "Yandex Music Downloader API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    """Проверка состояния API"""
    return {"status": "ok"}

@app.post("/api/auth/test")
async def test_token(request: TokenTest):
    """Тестирование токена"""
    try:
        # Создаем временный клиент для проверки
        test_client = YandexMusicClient(request.token)
        success = test_client.connect()
        
        if success:
            # Определяем тип токена
            token_type = "oauth" if request.token.startswith('y0_') else "session_id"
            
            # Сохраняем токен в базу данных
            try:
                # Сохраняем в новую таблицу токенов
                db_manager.save_token("Основной токен", request.token, token_type, is_active=True)
                # Также сохраняем в старую таблицу для совместимости
                db_manager.save_setting("yandex_token", request.token)
            except Exception as db_error:
                print(f"Ошибка сохранения токена в БД: {db_error}")
            
            # Обновляем глобальный клиент
            update_yandex_client(request.token)
            return {"status": "success", "message": "Подключение успешно"}
        else:
            print(f"Токен не прошел проверку: {request.token[:20]}...")
            raise HTTPException(status_code=401, detail="Не удалось подключиться к Яндекс.Музыке. Проверьте правильность токена.")
    except Exception as e:
        print(f"Ошибка проверки токена: {e}")
        raise HTTPException(status_code=401, detail=f"Ошибка проверки токена: {str(e)}")

@app.get("/api/auth/guide")
async def get_token_guide():
    """Получить инструкцию по получению токена"""
    return {
        "steps": [
            {
                "number": 1,
                "title": "Откройте Яндекс.Музыку",
                "description": "Перейдите на сайт Яндекс.Музыки и авторизуйтесь в своем аккаунте",
                "action": "Перейти на music.yandex.ru",
                "url": "https://music.yandex.ru"
            },
            {
                "number": 2,
                "title": "Откройте DevTools",
                "description": "Нажмите F12 или Ctrl+Shift+I для открытия инструментов разработчика",
                "action": "Открыть DevTools"
            },
            {
                "number": 3,
                "title": "Перейдите на вкладку Network",
                "description": "В DevTools найдите вкладку Network (Сеть)",
                "action": "Кликните на Network"
            },
            {
                "number": 4,
                "title": "Очистите список запросов",
                "description": "Нажмите кнопку очистки (🚫) для очистки списка запросов",
                "action": "Очистить список"
            },
            {
                "number": 5,
                "title": "Найдите запрос к API",
                "description": "В списке запросов найдите любой запрос к music.yandex.ru (обычно это запросы с длинными именами, содержащими \"playlist\", \"track\", \"user\" или \"auth\")",
                "action": "Найдите запрос"
            },
            {
                "number": 6,
                "title": "Откройте заголовки",
                "description": "Кликните на запрос и перейдите на вкладку \"Headers\"",
                "action": "Кликните на Headers"
            },
            {
                "number": 7,
                "title": "Скопируйте токен",
                "description": "Найдите заголовок \"Authorization\" или \"Cookie\" и скопируйте токен",
                "action": "Скопируйте токен"
            }
        ],
        "tips": [
            "Токен может начинаться с 'y0_' (OAuth) или '3:' (Session_id) и быть длиной более 20 символов",
            "Не делитесь токеном с другими людьми",
            "При изменении пароля токен может перестать работать",
            "Убедитесь, что у вас активная подписка Яндекс.Плюс или Яндекс.Музыка"
        ],
        "example": "y0_AgAAAAAAxxx... или 3:1760904011.5.0..."
    }

@app.get("/api/tokens")
async def get_tokens():
    """Получить список сохраненных токенов"""
    try:
        return db_manager.get_all_tokens()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tokens/save")
async def save_token_endpoint(request: SaveTokenRequest):
    """Сохранить токен"""
    try:
        # Проверяем токен
        test_client = YandexMusicClient(request.token)
        success = test_client.connect()
        
        if not success:
            raise HTTPException(status_code=400, detail="Токен не работает")
        
        # Определяем тип токена
        token_type = "oauth" if request.token.startswith('y0_') else "session_id"
        
        # Сохраняем токен
        token_id = db_manager.save_token(request.name, request.token, token_type, is_active=True)
        
        # Обновляем глобальный клиент
        update_yandex_client(request.token)
        
        return {
            "status": "success",
            "message": "Токен сохранен и активирован",
            "token_id": token_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tokens/activate")
async def activate_token_endpoint(request: ActivateTokenRequest):
    """Активировать токен"""
    try:
        success = db_manager.activate_token(request.token_id)
        if not success:
            raise HTTPException(status_code=404, detail="Токен не найден")
        
        # Обновляем клиент с новым токеном
        update_yandex_client()
        
        return {"status": "success", "message": "Токен активирован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tokens/{token_id}")
async def delete_token_endpoint(token_id: int):
    """Удалить токен"""
    try:
        success = db_manager.delete_token(token_id)
        if not success:
            raise HTTPException(status_code=404, detail="Токен не найден")
        
        return {"status": "success", "message": "Токен удален"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenameTokenRequest(BaseModel):
    name: str

@app.put("/api/tokens/{token_id}/rename")
async def rename_token_endpoint(token_id: int, request: RenameTokenRequest):
    """Переименовать токен"""
    try:
        success = db_manager.rename_token(token_id, request.name)
        if not success:
            raise HTTPException(status_code=404, detail="Токен не найден")
        
        return {"status": "success", "message": "Токен переименован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists", response_model=List[Playlist])
async def get_playlists():
    """Получить список плейлистов пользователя"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован. Проверьте токен в настройках.")
        
        playlists = yandex_client.get_playlists()
        return playlists
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists/{playlist_id}/tracks", response_model=List[Track])
async def get_playlist_tracks(playlist_id: str):
    """Получить треки плейлиста"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")
        
        tracks = yandex_client.get_playlist_tracks(playlist_id)
        return tracks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download/playlist")
async def download_playlist(request: DownloadRequest):
    """Загрузить плейлист"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        result = download_manager.download_playlist(request.playlist_id, request.quality)
        return {"status": "success", "message": f"Загрузка плейлиста {request.playlist_id} начата"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/queue")
async def get_download_queue():
    """Получить очередь загрузок"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        queue = download_manager.get_queue()
        return {"queue": queue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    """Получить статистику загрузок"""
    try:
        import sqlite3
        import os
        
        db_path = os.path.join(os.path.dirname(__file__), 'yandex_music.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем статистику из БД
        cursor.execute("SELECT COUNT(*) FROM downloaded_tracks")
        total_tracks = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(file_size) FROM downloaded_tracks WHERE file_size IS NOT NULL")
        total_size = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            "totalTracks": total_tracks,
            "totalSizeMB": round(total_size, 2),
            "totalSizeGB": round(total_size / 1024, 2)
        }
    except Exception as e:
        return {"totalTracks": 0, "totalSizeMB": 0, "totalSizeGB": 0}

@app.post("/api/settings")
async def save_settings(settings: Settings):
    """Сохранить настройки"""
    try:
        # Сохраняем настройки в базу данных
        db_manager.save_setting("download_path", settings.downloadPath)
        db_manager.save_setting("quality", settings.quality)
        db_manager.save_setting("auto_sync", str(settings.autoSync))
        db_manager.save_setting("sync_interval", str(settings.syncInterval))
        
        # Если изменился токен, обновляем клиент
        current_token = db_manager.get_setting("yandex_token", "")
        if settings.token and settings.token != current_token:
            db_manager.save_setting("yandex_token", settings.token)
            update_yandex_client(settings.token)
        
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings")
async def get_settings():
    """Получить текущие настройки"""
    try:
        # Получаем активный токен
        active_token = db_manager.get_active_token()
        current_token = active_token["token"] if active_token else ""
        
        # Если нет активного токена, пробуем старый способ
        if not current_token:
            current_token = db_manager.get_setting("yandex_token", "")
        
        return {
            "token": current_token,
            "downloadPath": db_manager.get_setting("download_path", os.getenv("DOWNLOAD_PATH", "/home/urch/Music/Yandex")),
            "quality": db_manager.get_setting("quality", os.getenv("DEFAULT_QUALITY", "lossless")),
            "autoSync": db_manager.get_setting("auto_sync", "false").lower() == "true",
            "syncInterval": int(db_manager.get_setting("sync_interval", "24"))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )