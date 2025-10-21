"""
Главный модуль FastAPI приложения для загрузки музыки с Яндекс.Музыки
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

app = FastAPI(
    title="Yandex Music Downloader API",
    description="API для скачивания музыки из Яндекс.Музыки",
    version="1.0.0"
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


@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {"message": "Yandex Music Downloader API"}


@app.get("/api/health")
async def health_check():
    """Проверка состояния сервера"""
    return {"status": "ok"}


@app.post("/api/auth/test")
async def test_connection(token: str):
    """Проверка подключения к Яндекс.Музыке"""
    try:
        # TODO: Реализовать проверку токена через yandex-music API
        if not token:
            raise HTTPException(status_code=400, detail="Токен не указан")
        
        # Здесь будет проверка токена
        return {"status": "success", "message": "Подключение успешно"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/api/playlists", response_model=List[Playlist])
async def get_playlists():
    """Получить список плейлистов пользователя"""
    # TODO: Реализовать получение плейлистов через yandex-music API
    return []


@app.get("/api/playlists/{playlist_id}/tracks", response_model=List[Track])
async def get_playlist_tracks(playlist_id: str):
    """Получить треки из плейлиста"""
    # TODO: Реализовать получение треков
    return []


@app.post("/api/download")
async def start_download(task: DownloadTask):
    """Начать загрузку плейлиста"""
    # TODO: Реализовать фоновую задачу загрузки
    return {"status": "started", "playlistId": task.playlistId}


@app.get("/api/downloads")
async def get_downloads():
    """Получить статус всех загрузок"""
    # TODO: Реализовать получение статуса
    return []


@app.get("/api/files/stats")
async def get_file_stats():
    """Получить статистику загруженных файлов"""
    # TODO: Реализовать анализ файлов
    return {
        "totalFiles": 0,
        "totalSize": 0,
        "byFormat": {},
        "byQuality": {}
    }


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

