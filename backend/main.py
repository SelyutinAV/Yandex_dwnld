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
from database import init_database, get_file_statistics

# Загружаем переменные окружения
load_dotenv()

# Глобальные переменные
yandex_client: Optional[YandexMusicClient] = None
download_manager: Optional[DownloadManager] = None
db_session = None

# Инициализация БД в синхронном контексте
try:
    db_session = init_database()
except Exception as e:
    print(f"Ошибка инициализации БД: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    await init_app()
    yield
    # Shutdown (если нужно)

app = FastAPI(
    title="Yandex Music Downloader API",
    description="API для скачивания музыки из Яндекс.Музыки",
    version="1.0.0",
    lifespan=lifespan
)

# CORS настройки для работы с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модели данных
class Playlist(BaseModel):
    id: str
    title: str
    trackCount: int
    cover: Optional[str] = None
    isSynced: bool = False
    lastSync: Optional[str] = None

class Track(BaseModel):
    id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration: int
    available: bool = True

class DownloadTask(BaseModel):
    playlistId: str
    quality: str = "lossless"

class Settings(BaseModel):
    token: str
    downloadPath: str
    quality: str
    autoSync: bool = False
    syncInterval: int = 24

class TokenTest(BaseModel):
    token: str

# Инициализация приложения
async def init_app():
    """Инициализация приложения"""
    global yandex_client, download_manager, db_session
    
    # БД уже инициализирована в синхронном контексте
    
    # Получение токена из переменных окружения
    token = os.getenv("YANDEX_TOKEN")
    download_path = os.getenv("DOWNLOAD_PATH", "/home/urch/Music/Yandex")
    
    if token and token != "your_yandex_music_token_here":
        yandex_client = YandexMusicClient(token)
        download_manager = DownloadManager(yandex_client, download_path)



@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {"message": "Yandex Music Downloader API"}


@app.get("/api/health")
async def health_check():
    """Проверка состояния сервера"""
    return {"status": "ok"}


@app.post("/api/auth/test")
async def test_connection(request: TokenTest):
    """Проверка подключения к Яндекс.Музыке"""
    try:
        if not request.token:
            raise HTTPException(status_code=400, detail="Токен не указан")
        
        # Создаем временный клиент для проверки
        test_client = YandexMusicClient(request.token)
        success = test_client.connect()
        
        if success:
            return {"status": "success", "message": "Подключение успешно"}
        else:
            raise HTTPException(status_code=401, detail="Не удалось подключиться к Яндекс.Музыке")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/api/playlists", response_model=List[Playlist])
async def get_playlists():
    """Получить список плейлистов пользователя"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован. Проверьте токен в настройках.")
        
        playlists = yandex_client.get_playlists()
        return [Playlist(**playlist) for playlist in playlists]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/playlists/{playlist_id}/tracks", response_model=List[Track])
async def get_playlist_tracks(playlist_id: str):
    """Получить треки из плейлиста"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован. Проверьте токен в настройках.")
        
        tracks = yandex_client.get_playlist_tracks(playlist_id)
        return [Track(**track) for track in tracks]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download")
async def start_download(task: DownloadTask):
    """Начать загрузку плейлиста"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        # Запускаем загрузку в фоне
        asyncio.create_task(
            download_manager.download_playlist(
                task.playlistId, 
                task.quality
            )
        )
        
        return {"status": "started", "playlistId": task.playlistId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/downloads")
async def get_downloads():
    """Получить статус всех загрузок"""
    # TODO: Реализовать получение статуса
    return []


@app.get("/api/files/stats")
async def get_file_stats():
    """Получить статистику загруженных файлов"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        stats = download_manager.analyze_directory()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/settings")
async def save_settings(settings: Settings):
    """Сохранить настройки"""
    # TODO: Сохранить настройки в БД или файл
    return {"status": "saved"}


@app.get("/api/settings")
async def get_settings():
    """Получить текущие настройки"""
    # TODO: Загрузить настройки
    return {
        "downloadPath": os.getenv("DOWNLOAD_PATH", "/home/user/Music/Yandex"),
        "quality": os.getenv("DEFAULT_QUALITY", "lossless"),
        "autoSync": False,
        "syncInterval": 24
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("DEBUG", "False").lower() == "true"
    )

