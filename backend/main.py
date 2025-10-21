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
import logging
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Импорт наших модулей
from yandex_client import YandexMusicClient
from downloader import DownloadManager
from db_manager import db_manager
from logger_config import setup_logging, get_logger

# Загружаем переменные окружения
load_dotenv()

# Настраиваем логирование
setup_logging()
logger = get_logger(__name__)

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
    
    logger.info("Инициализация приложения...")
    
    # Инициализация клиента Яндекс.Музыка
    update_yandex_client()
    
    logger.info("✅ Приложение инициализировано")

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
    fileTemplate: Optional[str] = "{artist} - {title}"
    folderStructure: Optional[str] = "{artist}/{album}"

class TokenTest(BaseModel):
    token: str

class SaveTokenRequest(BaseModel):
    name: str
    token: str
    username: Optional[str] = None

class ActivateTokenRequest(BaseModel):
    token_id: int

class ProgressUpdateRequest(BaseModel):
    progress: int

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
        token_id = db_manager.save_token(request.name, request.token, token_type, request.username, is_active=True)
        
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

@app.post("/api/tokens/deactivate")
async def deactivate_token_endpoint(request: ActivateTokenRequest):
    """Деактивировать токен"""
    try:
        success = db_manager.deactivate_token(request.token_id)
        if not success:
            raise HTTPException(status_code=404, detail="Токен не найден")
        
        # Обновляем клиент
        update_yandex_client()
        
        return {"status": "success", "message": "Токен деактивирован"}
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

class CreateFolderRequest(BaseModel):
    path: str

class ListFoldersRequest(BaseModel):
    path: str = "/"

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
        
        # Получаем username из активного токена
        username = None
        try:
            active_token = db_manager.get_active_token()
            if active_token and active_token.get('username'):
                username = active_token['username']
                print(f"Используем username из токена: {username}")
        except Exception as e:
            print(f"Ошибка получения username из токена: {e}")
        
        playlists = yandex_client.get_playlists(username)
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

@app.get("/api/account/subscription")
async def get_subscription_info():
    """Получить информацию о подписке"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")
        
        # Получаем информацию об аккаунте
        from yandex_music import Client
        client = Client().init()
        client._session_id = yandex_client.token
        
        account = client.account_status()
        
        return {
            'has_subscription': account.subscription is not None,
            'advertisement': account.advertisement,
            'account_info': {
                'login': account.account.login,
                'uid': account.account.uid,
                'full_name': account.account.full_name
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tracks/{track_id}/formats")
async def get_track_formats(track_id: str):
    """Получить доступные форматы трека"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")
        
        # Получаем информацию о треке
        tracks_result = yandex_client.client.tracks([track_id])
        if not tracks_result or len(tracks_result) == 0:
            raise HTTPException(status_code=404, detail="Трек не найден")
        
        track = tracks_result[0]
        print(f"🔍 Получение форматов для трека: {track.title}")
        
        download_info = track.get_download_info(get_direct_links=True)
        
        formats = []
        has_flac = False
        
        for info in download_info:
            format_data = {
                'codec': info.codec,
                'bitrate': info.bitrate_in_kbps,
                'gain': getattr(info, 'gain', None),
                'preview': getattr(info, 'preview', False),
                'direct_link_available': True
            }
            
            # Пробуем получить прямую ссылку
            try:
                direct_link = info.get_direct_link()
                format_data['direct_link'] = direct_link[:100] + '...'
                format_data['has_signature'] = 'ysign1=' in direct_link
                
                # Анализируем URL
                if 'flac' in direct_link.lower():
                    has_flac = True
                    format_data['is_lossless'] = True
                
            except Exception as e:
                format_data['direct_link_error'] = str(e)
                format_data['direct_link_available'] = False
            
            formats.append(format_data)
        
        # Проверяем подписку
        subscription_status = None
        try:
            account = yandex_client.client.account_status()
            if account:
                subscription_status = {
                    'has_plus': account.plus is not None,
                    'login': account.account.login if account.account else None
                }
        except Exception as e:
            print(f"⚠️  Не удалось проверить подписку: {e}")
        
        return {
            'track_id': track_id,
            'title': track.title,
            'artist': track.artists[0].name if track.artists else 'Unknown',
            'album': track.albums[0].title if track.albums else None,
            'duration_ms': track.duration_ms,
            'available_formats': formats,
            'has_flac': has_flac,
            'formats_count': len(formats),
            'subscription': subscription_status,
            'recommendation': 'lossless' if has_flac else 'hq'
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tracks/{track_id}/file-info")
async def get_track_file_info(track_id: str, quality: str = 'lossless'):
    """Получить информацию о файле через новый API endpoint"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")
        
        file_info = yandex_client.get_file_info(track_id, quality)
        
        if file_info:
            return {
                'track_id': track_id,
                'quality': quality,
                'file_info': file_info
            }
        else:
            raise HTTPException(status_code=404, detail="Информация о файле не найдена")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download/playlist")
async def download_playlist(request: DownloadRequest):
    """Загрузить плейлист"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        result = await download_manager.download_playlist(request.playlist_id, request.quality)
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

@app.get("/api/downloads/stats")
async def get_download_stats():
    """Получить детальную статистику загрузок"""
    try:
        # Получаем статистику из очереди загрузок
        queue_stats = db_manager.get_download_queue_stats()
        
        # Получаем статистику загруженных файлов
        file_stats = db_manager.get_file_statistics()
        
        return {
            "queue": queue_stats,
            "files": file_stats,
            "summary": {
                "totalInQueue": queue_stats["total"],
                "completedInQueue": queue_stats["completed"],
                "downloadingInQueue": queue_stats["downloading"],
                "pendingInQueue": queue_stats["pending"],
                "errorsInQueue": queue_stats["errors"],
                "totalDownloaded": file_stats["totalFiles"],
                "totalSizeMB": file_stats["totalSize"],
                "totalSizeGB": round(file_stats["totalSize"] / 1024, 2) if file_stats["totalSize"] > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Ошибка получения статистики загрузок: {e}")
        return {
            "queue": {"total": 0, "completed": 0, "downloading": 0, "pending": 0, "errors": 0},
            "files": {"totalFiles": 0, "totalSize": 0},
            "summary": {
                "totalInQueue": 0,
                "completedInQueue": 0,
                "downloadingInQueue": 0,
                "pendingInQueue": 0,
                "errorsInQueue": 0,
                "totalDownloaded": 0,
                "totalSizeMB": 0,
                "totalSizeGB": 0
            }
        }

@app.post("/api/settings")
async def save_settings(settings: Settings):
    """Сохранить настройки"""
    try:
        # Сохраняем настройки в базу данных
        db_manager.save_setting("download_path", settings.downloadPath)
        db_manager.save_setting("quality", settings.quality)
        db_manager.save_setting("auto_sync", str(settings.autoSync))
        db_manager.save_setting("sync_interval", str(settings.syncInterval))
        
        # Сохраняем дополнительные настройки
        if settings.fileTemplate:
            db_manager.save_setting("file_template", settings.fileTemplate)
        if settings.folderStructure:
            db_manager.save_setting("folder_structure", settings.folderStructure)
        
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
            "syncInterval": int(db_manager.get_setting("sync_interval", "24")),
            "fileTemplate": db_manager.get_setting("file_template", "{artist} - {title}"),
            "folderStructure": db_manager.get_setting("folder_structure", "{artist}/{album}")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/folders/create")
async def create_folder(request: CreateFolderRequest):
    """Создать папку"""
    try:
        folder_path = Path(request.path)
        
        # Проверка безопасности - не разрешаем создавать папки вне домашней директории
        # Раскомментируйте при необходимости
        # home_dir = Path.home()
        # if not str(folder_path.resolve()).startswith(str(home_dir)):
        #     raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Создаем папку и все родительские папки
        folder_path.mkdir(parents=True, exist_ok=True)
        
        return {
            "status": "success",
            "message": f"Папка '{request.path}' успешно создана",
            "path": str(folder_path.resolve())
        }
    except PermissionError:
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания папки")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка создания папки: {str(e)}")

@app.post("/api/folders/list")
async def list_folders(request: ListFoldersRequest):
    """Получить список папок в указанной директории"""
    try:
        folder_path = Path(request.path)
        
        if not folder_path.exists():
            raise HTTPException(status_code=404, detail="Путь не существует")
        
        if not folder_path.is_dir():
            raise HTTPException(status_code=400, detail="Указанный путь не является директорией")
        
        # Получаем только директории
        folders = []
        try:
            for item in folder_path.iterdir():
                if item.is_dir() and not item.name.startswith('.'):
                    folders.append({
                        "name": item.name,
                        "path": str(item),
                        "hasChildren": any(item.iterdir()) if item.is_dir() else False
                    })
        except PermissionError:
            # Игнорируем папки без доступа
            pass
        
        # Сортируем по имени
        folders.sort(key=lambda x: x["name"].lower())
        
        return {
            "path": str(folder_path),
            "folders": folders
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения директории: {str(e)}")

@app.get("/api/folders/exists")
async def check_folder_exists(path: str):
    """Проверить существование папки"""
    try:
        folder_path = Path(path)
        exists = folder_path.exists() and folder_path.is_dir()
        
        return {
            "exists": exists,
            "path": path,
            "resolved_path": str(folder_path.resolve()) if exists else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/stats")
async def get_files_stats():
    """Получить статистику файлов из базы данных"""
    try:
        stats = db_manager.get_file_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/recent")
async def get_recent_files(limit: int = 10):
    """Получить список недавно загруженных файлов"""
    try:
        recent_files = db_manager.get_recent_downloaded_tracks(limit)
        return {"files": recent_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/list")
async def get_files_list(playlist_id: str = None, limit: int = 100, offset: int = 0):
    """Получить список загруженных файлов"""
    try:
        files = db_manager.get_downloaded_tracks(playlist_id, limit, offset)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files/clear-stats")
async def clear_file_stats():
    """Очистить статистику файлов"""
    try:
        # Очищаем таблицу загруженных треков
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM downloaded_tracks")
            conn.commit()
        
        return {"status": "success", "message": "Статистика файлов очищена"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ScanRequest(BaseModel):
    path: str

@app.post("/api/files/scan")
async def scan_filesystem(request: ScanRequest):
    """Сканировать файловую систему для поиска аудиофайлов"""
    try:
        if not download_manager:
            raise HTTPException(status_code=400, detail="Менеджер загрузок не инициализирован")
        
        # Используем метод analyze_directory из DownloadManager
        stats = download_manager.analyze_directory(request.path)
        
        # Сохраняем найденные файлы в базу данных
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Очищаем старые записи
            cursor.execute("DELETE FROM downloaded_tracks")
            
            # Сканируем все файлы заново для полной статистики
            import os
            from pathlib import Path
            
            audio_extensions = {'.flac', '.mp3', '.aac', '.m4a', '.ogg'}
            files_scanned = 0
            
            # Сканируем директорию рекурсивно
            for file_path in Path(request.path).rglob('*'):
                if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                    try:
                        file_name = file_path.stem
                        file_size = file_path.stat().st_size / (1024 * 1024)  # в МБ
                        
                        # Пытаемся извлечь информацию о треке из имени файла
                        # Простая логика: предполагаем формат "Artist - Title"
                        parts = file_name.split(' - ', 1)
                        artist = parts[0] if len(parts) > 0 else 'Unknown Artist'
                        title = parts[1] if len(parts) > 1 else file_name
                        
                        # Определяем формат и качество
                        format_ext = file_path.suffix.lower()[1:].upper()
                        
                        # Пытаемся получить реальные метаданные файла
                        quality = f"{format_ext} Audio"
                        cover_data = None
                        try:
                            if format_ext.lower() == 'mp3':
                                from mutagen.mp3 import MP3
                                audio = MP3(str(file_path))
                                if audio.info:
                                    bitrate = f"{audio.info.bitrate // 1000}kbps"
                                    sample_rate = f"{audio.info.sample_rate / 1000}kHz"
                                    quality = f"{bitrate}/{sample_rate}"
                                
                                # Извлекаем обложку
                                if audio.tags:
                                    for key in audio.tags.keys():
                                        if key.startswith('APIC:'):
                                            cover_data = audio.tags[key].data
                                            break
                            elif format_ext.lower() == 'flac':
                                from mutagen.flac import FLAC
                                audio = FLAC(str(file_path))
                                if audio.info:
                                    bit_depth = f"{audio.info.bits_per_sample}-bit"
                                    sample_rate = f"{audio.info.sample_rate / 1000}kHz"
                                    quality = f"{bit_depth}/{sample_rate}"
                                
                                # Извлекаем обложку из FLAC
                                if audio.pictures:
                                    cover_data = audio.pictures[0].data
                        except Exception as e:
                            # Если не удалось получить метаданные, используем базовое качество
                            pass
                        
                        cursor.execute("""
                            INSERT INTO downloaded_tracks 
                            (track_id, title, artist, album, file_path, file_size, format, quality, cover_data, download_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            f"scanned_{hash(str(file_path))}",  # Генерируем ID на основе пути
                            title,
                            artist,
                            'Scanned Files',
                            str(file_path),
                            round(file_size, 2),
                            format_ext,
                            quality,
                            cover_data,  # Сохраняем данные обложки
                            datetime.now().isoformat()
                        ))
                        
                        files_scanned += 1
                        
                    except Exception as e:
                        print(f"Ошибка обработки файла {file_path}: {e}")
            
            conn.commit()
            print(f"Сканировано файлов: {files_scanned}")
        
        return {
            "status": "success", 
            "message": f"Найдено файлов: {files_scanned}",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/cover/{track_id}")
async def get_track_cover(track_id: str):
    """Получить обложку трека"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT cover_data FROM downloaded_tracks WHERE track_id = ?", (track_id,))
            row = cursor.fetchone()
            
            if row and row[0]:
                from fastapi.responses import Response
                return Response(
                    content=row[0],
                    media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            else:
                # Возвращаем placeholder изображение если обложка не найдена
                from fastapi.responses import Response
                import base64
                
                # Простое SVG изображение как placeholder
                svg_placeholder = f'''<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
                    <rect width="48" height="48" fill="#f3f4f6"/>
                    <text x="24" y="24" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="#6b7280">🎵</text>
                </svg>'''
                
                return Response(
                    content=svg_placeholder,
                    media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600"}
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/downloads/{track_id}/progress")
async def update_download_progress(track_id: str, request: ProgressUpdateRequest):
    """Обновить прогресс загрузки трека"""
    try:
        progress = request.progress
        if not (0 <= progress <= 100):
            raise HTTPException(status_code=400, detail="Прогресс должен быть от 0 до 100")
        
        success = db_manager.update_download_progress(track_id, progress)
        if not success:
            raise HTTPException(status_code=404, detail="Трек не найден в очереди")
        
        return {"status": "success", "message": "Прогресс обновлен"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/downloads/clear-completed")
async def clear_completed_downloads():
    """Очистить завершенные загрузки из очереди"""
    try:
        deleted_count = db_manager.clear_completed_downloads()
        return {
            "status": "success", 
            "message": f"Удалено завершенных загрузок: {deleted_count}",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/downloads/queue")
async def get_download_queue():
    """Получить очередь загрузок из базы данных"""
    try:
        queue = db_manager.get_download_queue()
        return {"queue": queue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/downloads/{track_id}/retry")
async def retry_download(track_id: str):
    """Повторить загрузку трека"""
    try:
        success = db_manager.retry_download(track_id)
        if not success:
            raise HTTPException(status_code=404, detail="Трек не найден в очереди")
        return {"status": "success", "message": "Загрузка поставлена в очередь"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
async def get_logs(log_type: str = "all", lines: int = 100):
    """Получить логи"""
    try:
        logs_dir = Path(__file__).parent.parent / 'logs'
        
        if log_type == "downloads":
            log_file = logs_dir / 'downloads.log'
        elif log_type == "errors":
            log_file = logs_dir / 'errors.log'
        elif log_type == "main":
            log_file = logs_dir / 'yandex_music.log'
        else:  # all
            # Объединяем все логи
            all_logs = []
            for log_file in [logs_dir / 'yandex_music.log', logs_dir / 'downloads.log', logs_dir / 'errors.log']:
                if log_file.exists():
                    with open(log_file, 'r', encoding='utf-8') as f:
                        all_logs.extend(f.readlines())
            
            # Сортируем по времени (первые символы - дата)
            all_logs.sort(key=lambda x: x[:19] if len(x) > 19 else x)
            
            return {
                "logs": all_logs[-lines:] if lines > 0 else all_logs,
                "total_lines": len(all_logs),
                "log_type": "all"
            }
        
        if not log_file.exists():
            return {"logs": [], "total_lines": 0, "log_type": log_type}
        
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
        
        # Берем последние N строк
        recent_lines = all_lines[-lines:] if lines > 0 else all_lines
        
        return {
            "logs": recent_lines,
            "total_lines": len(all_lines),
            "log_type": log_type
        }
        
    except Exception as e:
        logger.error(f"Ошибка чтения логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/logs")
async def clear_logs():
    """Очистить все логи"""
    try:
        logs_dir = Path(__file__).parent.parent / 'logs'
        
        cleared_files = []
        for log_file in logs_dir.glob('*.log*'):
            if log_file.is_file():
                log_file.unlink()
                cleared_files.append(log_file.name)
        
        logger.info(f"Очищены логи: {cleared_files}")
        
        return {
            "status": "success",
            "message": f"Очищено файлов: {len(cleared_files)}",
            "files": cleared_files
        }
        
    except Exception as e:
        logger.error(f"Ошибка очистки логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/stats")
async def get_log_stats():
    """Получить статистику логов"""
    try:
        logs_dir = Path(__file__).parent.parent / 'logs'
        
        stats = {}
        total_size = 0
        
        for log_file in logs_dir.glob('*.log*'):
            if log_file.is_file():
                size = log_file.stat().st_size
                total_size += size
                
                # Подсчитываем строки
                try:
                    with open(log_file, 'r', encoding='utf-8') as f:
                        lines_count = sum(1 for _ in f)
                except:
                    lines_count = 0
                
                stats[log_file.name] = {
                    "size_bytes": size,
                    "size_mb": round(size / (1024 * 1024), 2),
                    "lines": lines_count,
                    "modified": log_file.stat().st_mtime
                }
        
        return {
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "files": stats,
            "files_count": len(stats)
        }
        
    except Exception as e:
        logger.error(f"Ошибка получения статистики логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/downloads/{track_id}")
async def cancel_download(track_id: str):
    """Отменить загрузку трека"""
    try:
        success = db_manager.cancel_download(track_id)
        if not success:
            raise HTTPException(status_code=404, detail="Трек не найден в очереди")
        return {"status": "success", "message": "Загрузка отменена"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PauseRequest(BaseModel):
    paused: bool

@app.post("/api/downloads/pause")
async def pause_downloads(request: PauseRequest):
    """Приостановить/возобновить все загрузки"""
    try:
        # Сохраняем состояние паузы в настройках
        db_manager.save_setting("downloads_paused", str(request.paused))
        
        if request.paused:
            # Если пауза, останавливаем все активные загрузки
            if download_manager:
                # TODO: Реализовать остановку активных загрузок в DownloadManager
                pass
            return {"status": "success", "message": "Загрузки приостановлены"}
        else:
            # Если возобновление, запускаем обработку очереди
            if download_manager:
                # TODO: Реализовать возобновление загрузок в DownloadManager
                pass
            return {"status": "success", "message": "Загрузки возобновлены"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AddToQueueRequest(BaseModel):
    track_id: str
    title: str
    artist: str
    album: str = None
    quality: str = "lossless"

@app.post("/api/downloads/add-to-queue")
async def add_to_queue(request: AddToQueueRequest):
    """Добавить трек в очередь загрузок"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем, не добавлен ли уже этот трек
            cursor.execute("SELECT id FROM download_queue WHERE track_id = ?", (request.track_id,))
            if cursor.fetchone():
                return {"status": "warning", "message": "Трек уже в очереди"}
            
            # Добавляем трек в очередь
            cursor.execute("""
                INSERT INTO download_queue 
                (track_id, title, artist, album, status, progress, quality, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
            """, (
                request.track_id,
                request.title,
                request.artist,
                request.album,
                request.quality,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            conn.commit()
            
        return {"status": "success", "message": "Трек добавлен в очередь"}
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