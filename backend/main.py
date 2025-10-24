"""
Главный модуль FastAPI приложения для загрузки музыки с Яндекс.Музыки
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import sys

# import asyncio  # Не используется
# import logging  # Не используется
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Импорт наших модулей
from yandex_client import YandexMusicClient
from downloader import DownloadManager
from db_manager import db_manager
from logger_config import setup_logging, get_logger
from download_queue_manager import DownloadQueueManager

# Загружаем переменные окружения
load_dotenv()

# Настраиваем логирование
setup_logging()
logger = get_logger(__name__)

# Глобальные переменные
yandex_client: Optional[YandexMusicClient] = None
download_manager: Optional[DownloadManager] = None
download_queue_manager = None  # Новый менеджер очереди


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
    lifespan=lifespan,
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
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
    cover: Optional[str] = None


class Track(BaseModel):
    id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration: int
    cover: Optional[str] = None


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


class DualTokenTest(BaseModel):
    oauth_token: str
    session_id_token: str


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
            # Сначала пробуем получить активный аккаунт из новой структуры
            active_account = db_manager.get_active_account()
            if active_account:
                # Используем OAuth токен как основной, если есть
                token = active_account.get("oauth_token") or active_account.get(
                    "session_id_token"
                )
                print(
                    f"✅ Используем токен из активного аккаунта: {active_account['name']}"
                )
            else:
                # Fallback на старую структуру для совместимости
                active_token = db_manager.get_active_token()
                if active_token:
                    token = active_token["token"]
                    print(
                        "⚠️  Используем токен из старой структуры (рекомендуется миграция)"
                    )
                else:
                    # Если нет активного токена, пробуем старый способ
                    token = db_manager.get_setting("yandex_token")
                    if token:
                        print("⚠️  Используем токен из настроек (устаревший способ)")
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
                    os.getenv("DOWNLOAD_PATH", "/home/urch/Music/Yandex"),
                )

                download_manager = DownloadManager(yandex_client, download_path)

                # Инициализируем новый менеджер очереди
                global download_queue_manager
                download_queue_manager = DownloadQueueManager(
                    db_manager=db_manager,
                    yandex_client=yandex_client,
                    download_path=download_path,
                )

                print("Клиент Яндекс.Музыка успешно инициализирован")
                print("✅ Менеджер очереди загрузок инициализирован")
            else:
                print("Не удалось подключиться к Яндекс.Музыке с токеном")
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


@app.get("/api/debug/queue")
async def debug_queue():
    """Отладочная информация о очереди"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем статистику
            cursor.execute("SELECT COUNT(*) FROM download_queue")
            total = cursor.fetchone()[0]

            cursor.execute(
                "SELECT status, COUNT(*) FROM download_queue GROUP BY status"
            )
            status_counts = dict(cursor.fetchall())

            # Получаем несколько примеров треков
            cursor.execute(
                """
                SELECT track_id, title, artist, status, progress 
                FROM download_queue 
                ORDER BY created_at DESC 
                LIMIT 5
            """
            )
            sample_tracks = []
            for row in cursor.fetchall():
                sample_tracks.append(
                    {
                        "track_id": row[0],
                        "title": row[1],
                        "artist": row[2],
                        "status": row[3],
                        "progress": row[4],
                    }
                )

            return {
                "total_tracks": total,
                "status_counts": status_counts,
                "sample_tracks": sample_tracks,
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/tracks/{track_id}/cover")
async def get_track_cover(track_id: str):
    """Получить обложку трека из базы данных"""
    try:
        import sqlite3
        import os
        from fastapi.responses import Response

        db_path = os.path.join(os.path.dirname(__file__), "yandex_music.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Ищем трек в downloaded_tracks
        cursor.execute(
            """
            SELECT cover_data FROM downloaded_tracks 
            WHERE track_id = ? AND cover_data IS NOT NULL
            LIMIT 1
        """,
            (track_id,),
        )

        row = cursor.fetchone()
        conn.close()

        if row and row[0]:
            # Возвращаем изображение
            return Response(
                content=row[0],
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "public, max-age=31536000"
                },  # Кешируем на год
            )
        else:
            # Возвращаем 404 если обложка не найдена
            raise HTTPException(status_code=404, detail="Обложка не найдена")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения обложки трека {track_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Ошибка получения обложки: {str(e)}"
        )


@app.get("/api/queue/track/{track_id}/cover")
async def get_queue_track_cover(track_id: str):
    """Получить обложку трека из очереди"""
    try:
        import sqlite3
        import os
        import requests
        from fastapi.responses import Response

        db_path = os.path.join(os.path.dirname(__file__), "yandex_music.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Ищем трек в download_queue
        cursor.execute(
            """
            SELECT cover FROM download_queue 
            WHERE track_id = ? AND cover IS NOT NULL
            LIMIT 1
        """,
            (track_id,),
        )

        row = cursor.fetchone()
        conn.close()

        if row and row[0]:
            # Скачиваем обложку по URL
            try:
                response = requests.get(row[0], timeout=10)
                if response.status_code == 200:
                    return Response(
                        content=response.content,
                        media_type="image/jpeg",
                        headers={
                            "Cache-Control": "public, max-age=3600"
                        },  # Кешируем на час
                    )
            except Exception as e:
                logger.warning(f"Ошибка скачивания обложки для трека {track_id}: {e}")

        # Возвращаем 404 если обложка не найдена
        raise HTTPException(status_code=404, detail="Обложка не найдена")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения обложки для трека {track_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Ошибка получения обложки: {str(e)}"
        )


@app.post("/api/auth/test")
async def test_token(request: TokenTest):
    """Тестирование токена"""
    try:
        # Создаем временный клиент для проверки
        test_client = YandexMusicClient(request.token)
        success = test_client.connect()

        if success:
            # Определяем тип токена
            token_type = "oauth" if request.token.startswith("y0_") else "session_id"

            # Сохраняем токен в базу данных
            try:
                # Сохраняем в новую таблицу токенов
                db_manager.save_token(
                    "Основной токен", request.token, token_type, is_active=True
                )
                # Также сохраняем в старую таблицу для совместимости
                db_manager.save_setting("yandex_token", request.token)
            except Exception as db_error:
                print(f"Ошибка сохранения токена в БД: {db_error}")

            # Обновляем глобальный клиент
            update_yandex_client(request.token)
            return {"status": "success", "message": "Подключение успешно"}
        else:
            print(f"Токен не прошел проверку: {request.token[:20]}...")
            raise HTTPException(
                status_code=401,
                detail="Не удалось подключиться к Яндекс.Музыке. Проверьте правильность токена.",
            )
    except Exception as e:
        print(f"Ошибка проверки токена: {e}")
        raise HTTPException(status_code=401, detail=f"Ошибка проверки токена: {str(e)}")


@app.post("/api/auth/test-dual")
async def test_dual_tokens(request: DualTokenTest):
    """Тестирование обоих токенов (OAuth и Session ID)"""
    try:
        # Проверяем OAuth токен
        oauth_client = YandexMusicClient(request.oauth_token)
        oauth_success = oauth_client.connect()

        # Проверяем Session ID токен
        session_client = YandexMusicClient(request.session_id_token)
        session_success = session_client.connect()

        if oauth_success and session_success:
            # Оба токена работают - проверяем подписку и lossless-доступ
            has_subscription = False
            has_lossless_access = False

            try:
                # Используем OAuth клиент для проверки подписки
                if oauth_client.client:
                    account = oauth_client.client.account_status()
                    subscription = account.subscription

                    print(f"Full account status: {account}")
                    print(f"Subscription object: {subscription}")

                    # Преобразуем subscription в словарь для сериализации
                    subscription_dict = {}
                    try:
                        if hasattr(subscription, "__dict__"):
                            # Фильтруем несериализуемые объекты
                            for key, value in subscription.__dict__.items():
                                try:
                                    # Пробуем сериализовать значение
                                    import json

                                    json.dumps(value)
                                    subscription_dict[key] = value
                                except Exception:
                                    # Если не сериализуется, преобразуем в строку
                                    subscription_dict[key] = str(value)
                        elif hasattr(subscription, "items"):
                            subscription_dict = dict(subscription)
                        else:
                            # Пытаемся получить атрибуты
                            for attr in dir(subscription):
                                if not attr.startswith("_"):
                                    try:
                                        value = getattr(subscription, attr)
                                        if not callable(value):
                                            try:
                                                import json

                                                json.dumps(value)
                                                subscription_dict[attr] = value
                                            except Exception:
                                                subscription_dict[attr] = str(value)
                                    except Exception:
                                        pass
                    except Exception as e:
                        print(f"Ошибка при преобразовании subscription: {e}")
                        subscription_dict = {"error": str(e)}

                    print(f"Subscription dict: {subscription_dict}")

                    # Проверяем все возможные поля подписки
                    has_subscription = (
                        subscription_dict.get("had_any_subscription", False)
                        or subscription_dict.get("can_start_trial", False)
                        or subscription_dict.get("active", False)
                        or subscription_dict.get("non_auto_renewable", False)
                        or subscription_dict.get("auto_renewable", False)
                        or subscription_dict.get("provider", False)
                        or subscription_dict.get("family", False)
                        or
                        # Проверяем также поля в других форматах
                        getattr(subscription, "had_any_subscription", False)
                        or getattr(subscription, "can_start_trial", False)
                        or getattr(subscription, "active", False)
                    )

                    # Проверяем доступность lossless-формата
                    has_lossless_access = (
                        subscription_dict.get("had_any_subscription", False)
                        or subscription_dict.get("can_start_trial", False)
                        or subscription_dict.get("active", False)
                        or subscription_dict.get("non_auto_renewable", False)
                        or subscription_dict.get("auto_renewable", False)
                        or subscription_dict.get("provider", False)
                        or subscription_dict.get("family", False)
                        or
                        # Проверяем также поля в других форматах
                        getattr(subscription, "had_any_subscription", False)
                        or getattr(subscription, "can_start_trial", False)
                        or getattr(subscription, "active", False)
                    )

                    print(
                        f"Has subscription: {has_subscription}, Has lossless: {has_lossless_access}"
                    )

            except Exception as e:
                print(f"Ошибка при проверке подписки: {e}")
                # Если не удалось проверить, предполагаем что есть подписка
                has_subscription = True
                has_lossless_access = True

            return {
                "status": "success",
                "message": "Оба токена работают корректно",
                "oauth_valid": True,
                "session_id_valid": True,
                "has_subscription": has_subscription,
                "has_lossless_access": has_lossless_access,
                "subscription_details": (
                    subscription_dict if "subscription_dict" in locals() else None
                ),
            }
        elif oauth_success:
            return {
                "status": "partial",
                "message": "OAuth токен работает, но Session ID токен недействителен",
                "oauth_valid": True,
                "session_id_valid": False,
                "has_subscription": False,
                "has_lossless_access": False,
            }
        elif session_success:
            return {
                "status": "partial",
                "message": "Session ID токен работает, но OAuth токен недействителен",
                "oauth_valid": False,
                "session_id_valid": True,
                "has_subscription": False,
                "has_lossless_access": False,
            }
        else:
            raise HTTPException(status_code=401, detail="Оба токена недействительны")

    except Exception as e:
        print(f"Ошибка проверки токенов: {e}")
        raise HTTPException(
            status_code=401, detail=f"Ошибка проверки токенов: {str(e)}"
        )


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
                "url": "https://music.yandex.ru",
            },
            {
                "number": 2,
                "title": "Откройте DevTools",
                "description": "Нажмите F12 или Ctrl+Shift+I для открытия инструментов разработчика",
                "action": "Открыть DevTools",
            },
            {
                "number": 3,
                "title": "Перейдите на вкладку Network",
                "description": "В DevTools найдите вкладку Network (Сеть)",
                "action": "Кликните на Network",
            },
            {
                "number": 4,
                "title": "Очистите список запросов",
                "description": "Нажмите кнопку очистки (🚫) для очистки списка запросов",
                "action": "Очистить список",
            },
            {
                "number": 5,
                "title": "Найдите запрос к API",
                "description": 'В списке запросов найдите любой запрос к music.yandex.ru (обычно это запросы с длинными именами, содержащими "playlist", "track", "user" или "auth")',
                "action": "Найдите запрос",
            },
            {
                "number": 6,
                "title": "Откройте заголовки",
                "description": 'Кликните на запрос и перейдите на вкладку "Headers"',
                "action": "Кликните на Headers",
            },
            {
                "number": 7,
                "title": "Скопируйте токен",
                "description": 'Найдите заголовок "Authorization" или "Cookie" и скопируйте токен',
                "action": "Скопируйте токен",
            },
        ],
        "tips": [
            "Токен может начинаться с 'y0_' (OAuth) или '3:' (Session_id) и быть длиной более 20 символов",
            "Не делитесь токеном с другими людьми",
            "При изменении пароля токен может перестать работать",
            "Убедитесь, что у вас активная подписка Яндекс.Плюс или Яндекс.Музыка",
        ],
        "example": "y0_AgAAAAAAxxx... или 3:1760904011.5.0...",
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

        # Получаем username из токена, если не указан
        username = request.username
        if not username and test_client.client:
            try:
                account = test_client.client.account_status()
                if account and account.account:
                    username = account.account.login
                    print(f"Получен username из токена: {username}")
            except Exception as e:
                print(f"Не удалось получить username из токена: {e}")

        # Определяем тип токена
        token_type = "oauth" if request.token.startswith("y0_") else "session_id"

        # Сохраняем токен
        token_id = db_manager.save_token(
            request.name, request.token, token_type, username, is_active=True
        )

        # Обновляем глобальный клиент
        update_yandex_client(request.token)

        return {
            "status": "success",
            "message": "Токен сохранен и активирован",
            "token_id": token_id,
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


@app.put("/api/tokens/{token_id}/update-username")
async def update_token_username_endpoint(token_id: int):
    """Обновить username токена из аккаунта"""
    try:
        # Получаем токен
        token_info = db_manager.get_token_by_id(token_id)
        if not token_info:
            raise HTTPException(status_code=404, detail="Токен не найден")

        # Тестируем токен и получаем username
        test_client = YandexMusicClient(token_info["token"])
        success = test_client.connect()

        if not success:
            raise HTTPException(status_code=400, detail="Токен не работает")

        username = None
        if test_client.client:
            try:
                account = test_client.client.account_status()
                if account and account.account:
                    username = account.account.login
                    print(f"Обновлен username для токена {token_id}: {username}")
            except Exception as e:
                print(f"Не удалось получить username: {e}")

        if username:
            success = db_manager.update_token_username(token_id, username)
            if not success:
                raise HTTPException(
                    status_code=500, detail="Не удалось обновить username"
                )

            return {"status": "success", "message": f"Username обновлен: {username}"}
        else:
            raise HTTPException(
                status_code=400, detail="Не удалось получить username из токена"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Новые эндпоинты для работы с едиными аккаунтами Яндекс.Музыки
class SaveAccountRequest(BaseModel):
    name: str
    oauth_token: Optional[str] = None
    session_id_token: Optional[str] = None
    username: Optional[str] = None


class ActivateAccountRequest(BaseModel):
    account_id: int


@app.get("/api/accounts/{account_id}/full-tokens")
async def get_account_full_tokens(account_id: int):
    """Получить полные токены аккаунта для отображения"""
    try:
        account = db_manager.get_account_by_id(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        return {
            "oauth_token": account.get("oauth_token"),
            "session_id_token": account.get("session_id_token"),
            "oauth_token_preview": (
                account.get("oauth_token", "")[:50] + "..."
                if account.get("oauth_token")
                and len(account.get("oauth_token", "")) > 50
                else account.get("oauth_token")
            ),
            "session_id_token_preview": (
                account.get("session_id_token", "")[:50] + "..."
                if account.get("session_id_token")
                and len(account.get("session_id_token", "")) > 50
                else account.get("session_id_token")
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/accounts/{account_id}/tokens")
async def get_account_tokens(account_id: int):
    """Получить полные токены аккаунта"""
    try:
        account = db_manager.get_account_by_id(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        return {
            "oauth_token": account.get("oauth_token"),
            "session_id_token": account.get("session_id_token"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/accounts")
async def get_accounts():
    """Получить список аккаунтов"""
    try:
        return db_manager.get_all_accounts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/accounts/save")
async def save_account_endpoint(request: SaveAccountRequest):
    """Сохранить аккаунт"""
    try:
        # Проверяем токены если они предоставлены
        if request.oauth_token:
            test_client = YandexMusicClient(request.oauth_token)
            if not test_client.connect():
                raise HTTPException(
                    status_code=400, detail="OAuth токен не прошел проверку"
                )

        if request.session_id_token:
            test_client = YandexMusicClient(request.session_id_token)
            if not test_client.connect():
                raise HTTPException(
                    status_code=400, detail="Session ID токен не прошел проверку"
                )

        # Получаем username из OAuth токена если не предоставлен
        username = request.username
        if not username and request.oauth_token:
            try:
                test_client = YandexMusicClient(request.oauth_token)
                if test_client.connect() and test_client.client:
                    account = test_client.client.account_status()
                    if account and account.account:
                        username = account.account.login
                        print(f"Получен username из OAuth токена: {username}")
            except Exception as e:
                print(f"Не удалось получить username из OAuth токена: {e}")

        # Сохраняем аккаунт
        account_id = db_manager.save_account(
            name=request.name,
            oauth_token=request.oauth_token,
            session_id_token=request.session_id_token,
            username=username,
            is_active=True,
        )

        # Обновляем глобальный клиент
        update_yandex_client()

        return {
            "status": "success",
            "message": "Аккаунт сохранен и активирован",
            "account_id": account_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/accounts/activate")
async def activate_account_endpoint(request: ActivateAccountRequest):
    """Активировать аккаунт"""
    try:
        success = db_manager.activate_account(request.account_id)
        if not success:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        # Обновляем глобальный клиент
        update_yandex_client()

        return {"status": "success", "message": "Аккаунт активирован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/accounts/deactivate")
async def deactivate_account_endpoint(request: ActivateAccountRequest):
    """Деактивировать аккаунт"""
    try:
        success = db_manager.deactivate_account(request.account_id)
        if not success:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        return {"status": "success", "message": "Аккаунт деактивирован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/accounts/{account_id}")
async def delete_account_endpoint(account_id: int):
    """Удалить аккаунт"""
    try:
        success = db_manager.delete_account(account_id)
        if not success:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        return {"status": "success", "message": "Аккаунт удален"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RenameAccountRequest(BaseModel):
    name: str


@app.put("/api/accounts/{account_id}/rename")
async def rename_account_endpoint(account_id: int, request: RenameAccountRequest):
    """Переименовать аккаунт"""
    try:
        success = db_manager.rename_account(account_id, request.name)
        if not success:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        return {"status": "success", "message": "Аккаунт переименован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/accounts/{account_id}/update-username")
async def update_account_username_endpoint(account_id: int):
    """Обновить username аккаунта из API"""
    try:
        # Получаем аккаунт
        account_info = db_manager.get_account_by_id(account_id)
        if not account_info:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        # Тестируем OAuth токен и получаем username
        username = None
        if account_info.get("oauth_token"):
            try:
                test_client = YandexMusicClient(account_info["oauth_token"])
                if test_client.connect() and test_client.client:
                    account = test_client.client.account_status()
                    if account and account.account:
                        username = account.account.login
                        print(
                            f"Обновлен username для аккаунта {account_id}: {username}"
                        )
            except Exception as e:
                print(f"Не удалось получить username: {e}")

        if username:
            success = db_manager.update_account_username(account_id, username)
            if not success:
                raise HTTPException(
                    status_code=500, detail="Не удалось обновить username"
                )

            return {"status": "success", "message": f"Username обновлен: {username}"}
        else:
            raise HTTPException(
                status_code=400, detail="Не удалось получить username из токена"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/accounts/test-dual")
async def test_dual_account_tokens(request: DualTokenTest):
    """Тестирование обоих токенов аккаунта"""
    try:
        # Проверяем OAuth токен
        oauth_client = YandexMusicClient(request.oauth_token)
        oauth_success = oauth_client.connect()

        # Проверяем Session ID токен
        session_client = YandexMusicClient(request.session_id_token)
        session_success = session_client.connect()

        if oauth_success and session_success:
            # Оба токена работают - проверяем подписку и lossless-доступ
            has_subscription = False
            has_lossless_access = False
            subscription_dict = None

            try:
                if oauth_client.client:
                    account = oauth_client.client.account_status()
                    subscription = account.subscription

                    print(f"Full account status: {account}")

                    if subscription:
                        has_subscription = True
                        subscription_dict = {
                            "can_start_trial": getattr(
                                subscription, "can_start_trial", False
                            ),
                            "had_any_subscription": getattr(
                                subscription, "had_any_subscription", False
                            ),
                            "non_auto_renewable": getattr(
                                subscription, "non_auto_renewable", False
                            ),
                            "auto_renewable": getattr(
                                subscription, "auto_renewable", False
                            ),
                        }

                        # Проверяем доступ к lossless
                        if (
                            hasattr(subscription, "auto_renewable")
                            and subscription.auto_renewable
                        ):
                            has_lossless_access = True
                        elif (
                            hasattr(subscription, "non_auto_renewable")
                            and subscription.non_auto_renewable
                        ):
                            has_lossless_access = True

                    print(f"Subscription info: {subscription_dict}")
                    print(f"Has subscription: {has_subscription}")
                    print(f"Has lossless access: {has_lossless_access}")

            except Exception as e:
                print(f"Ошибка получения информации о подписке: {e}")

            return {
                "status": "success",
                "message": "Оба токена работают корректно",
                "oauth_valid": True,
                "session_id_valid": True,
                "has_subscription": has_subscription,
                "has_lossless_access": has_lossless_access,
                "subscription_details": subscription_dict,
            }
        elif oauth_success:
            return {
                "status": "partial",
                "message": "OAuth токен работает, Session ID токен не работает",
                "oauth_valid": True,
                "session_id_valid": False,
                "has_subscription": False,
                "has_lossless_access": False,
            }
        elif session_success:
            return {
                "status": "partial",
                "message": "Session ID токен работает, OAuth токен не работает",
                "oauth_valid": False,
                "session_id_valid": True,
                "has_subscription": False,
                "has_lossless_access": False,
            }
        else:
            raise HTTPException(
                status_code=401,
                detail="Оба токена не прошли проверку. Проверьте правильность токенов.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/playlists", response_model=List[Playlist])
async def get_playlists():
    """Получить список плейлистов пользователя (быстрая загрузка без обложек)"""
    try:
        if not yandex_client:
            raise HTTPException(
                status_code=400,
                detail="Клиент не инициализирован. Проверьте токен в настройках.",
            )

        # Получаем username из активного аккаунта
        username = None
        try:
            # Сначала пробуем получить из новой структуры
            active_account = db_manager.get_active_account()
            if active_account and active_account.get("username"):
                username = active_account["username"]
                print(f"Используем username из активного аккаунта: {username}")
            else:
                # Fallback на старую структуру
                active_token = db_manager.get_active_token()
                if active_token and active_token.get("username"):
                    username = active_token["username"]
                    print(f"Используем username из старого токена: {username}")
        except Exception as e:
            print(f"Ошибка получения username: {e}")

        # Быстрая загрузка без обложек
        playlists = yandex_client.get_playlists(username)
        return playlists
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/playlists/covers")
async def load_playlist_covers(request: Request):
    """Догрузить обложки для плейлистов в фоне"""
    try:
        if not yandex_client:
            raise HTTPException(
                status_code=400,
                detail="Клиент не инициализирован. Проверьте токен в настройках.",
            )

        # Получаем данные плейлистов из запроса
        playlists_data = await request.json()

        # Догружаем обложки
        updated_playlists = yandex_client.load_playlist_covers_background(
            playlists_data
        )

        return {"success": True, "playlists": updated_playlists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/playlists/{playlist_id}/tracks", response_model=List[Track])
async def get_playlist_tracks(playlist_id: str):
    """Получить треки плейлиста"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")

        # Получаем настройки плейлистов
        playlist_settings = db_manager.get_playlist_settings()
        batch_size = playlist_settings.get("batch_size", 100)
        max_tracks = playlist_settings.get("max_tracks")

        # Получаем треки с учетом настроек
        tracks = yandex_client.get_playlist_tracks(
            playlist_id, batch_size=batch_size, max_tracks=max_tracks
        )
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
        if not yandex_client.client:
            raise HTTPException(status_code=400, detail="Клиент не подключен")

        account = yandex_client.client.account_status()

        return {
            "has_subscription": account.subscription is not None,
            "advertisement": account.advertisement,
            "account_info": {
                "login": account.account.login,
                "uid": account.account.uid,
                "full_name": account.account.full_name,
            },
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
                "codec": info.codec,
                "bitrate": info.bitrate_in_kbps,
                "gain": getattr(info, "gain", None),
                "preview": getattr(info, "preview", False),
                "direct_link_available": True,
            }

            # Пробуем получить прямую ссылку
            try:
                direct_link = info.get_direct_link()
                format_data["direct_link"] = direct_link[:100] + "..."
                format_data["has_signature"] = "ysign1=" in direct_link

                # Анализируем URL
                if "flac" in direct_link.lower():
                    has_flac = True
                    format_data["is_lossless"] = True

            except Exception as e:
                format_data["direct_link_error"] = str(e)
                format_data["direct_link_available"] = False

            formats.append(format_data)

        # Проверяем подписку
        subscription_status = None
        try:
            account = yandex_client.client.account_status()
            if account:
                subscription_status = {
                    "has_plus": account.plus is not None,
                    "login": account.account.login if account.account else None,
                }
        except Exception as e:
            print(f"⚠️  Не удалось проверить подписку: {e}")

        return {
            "track_id": track_id,
            "title": track.title,
            "artist": track.artists[0].name if track.artists else "Unknown",
            "album": track.albums[0].title if track.albums else None,
            "duration_ms": track.duration_ms,
            "available_formats": formats,
            "has_flac": has_flac,
            "formats_count": len(formats),
            "subscription": subscription_status,
            "recommendation": "lossless" if has_flac else "hq",
        }
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tracks/{track_id}/file-info")
async def get_track_file_info(track_id: str, quality: str = "lossless"):
    """Получить информацию о файле через новый API endpoint"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")

        file_info = yandex_client.get_file_info(track_id, quality)

        if file_info:
            return {"track_id": track_id, "quality": quality, "file_info": file_info}
        else:
            raise HTTPException(status_code=404, detail="Информация о файле не найдена")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download/playlist/preview")
async def preview_playlist_download(request: DownloadRequest):
    """Шаг 1: Формирование списка треков для загрузки (без скачивания)"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")

        # Получаем треки плейлиста
        tracks = yandex_client.get_playlist_tracks(request.playlist_id)

        # Фильтруем только доступные треки
        available_tracks = [t for t in tracks if t.get("available", False)]

        # Добавляем треки в очередь со статусом 'queued' (подготовлены, но не запущены)
        added_count = 0
        existing_count = 0
        already_downloaded_count = 0

        for track in available_tracks:
            try:
                with db_manager.get_connection() as conn:
                    cursor = conn.cursor()

                    # Получаем название плейлиста
                    playlist_name = track.get("playlist_name", "Unknown Playlist")

                    # Проверяем, не добавлен ли уже этот трек в очередь для этого плейлиста
                    cursor.execute(
                        "SELECT id FROM download_queue WHERE track_id = ? AND playlist_id = ?",
                        (track["id"], playlist_name),
                    )
                    if cursor.fetchone():
                        existing_count += 1
                        continue

                    # Проверяем, не скачан ли уже этот трек для этого плейлиста
                    # Сначала проверяем по track_id и playlist_id
                    cursor.execute(
                        "SELECT id FROM downloaded_tracks WHERE track_id = ? AND playlist_id = ?",
                        (track["id"], playlist_name),
                    )
                    if cursor.fetchone():
                        already_downloaded_count += 1
                        continue

                    # Дополнительная проверка по названию и исполнителю для этого плейлиста
                    cursor.execute(
                        "SELECT id FROM downloaded_tracks WHERE title = ? AND artist = ? AND playlist_id = ?",
                        (track["title"], track["artist"], playlist_name),
                    )
                    if cursor.fetchone():
                        already_downloaded_count += 1
                        continue

                    # Получаем название плейлиста
                    playlist_name = track.get("playlist_name", "Unknown Playlist")

                    # Добавляем трек в очередь со статусом 'queued'
                    cursor.execute(
                        """
                        INSERT INTO download_queue 
                        (track_id, title, artist, album, playlist_id, cover, status, progress, quality, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)
                    """,
                        (
                            track["id"],
                            track["title"],
                            track["artist"],
                            track.get("album", "Unknown Album"),
                            playlist_name,
                            track.get("cover"),
                            request.quality,
                            datetime.now().isoformat(),
                            datetime.now().isoformat(),
                        ),
                    )

                    conn.commit()
                    added_count += 1

            except Exception as e:
                logger.error(f"Ошибка добавления трека {track['title']} в очередь: {e}")

        return {
            "status": "success",
            "message": f"Список подготовлен: {added_count} новых треков, {existing_count} уже в очереди, {already_downloaded_count} уже скачаны",
            "added": added_count,
            "existing": existing_count,
            "already_downloaded": already_downloaded_count,
            "total": len(available_tracks),
        }
    except Exception as e:
        logger.error(f"Ошибка подготовки списка загрузки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download/queue/start")
async def start_download_queue():
    """Запустить загрузку подготовленных треков"""
    try:
        # Проверяем есть ли треки в очереди
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status IN ('queued', 'pending')"
            )
            queued_count = cursor.fetchone()[0]

        # Запускаем фоновую задачу для обработки очереди
        if download_manager and queued_count > 0:
            # Используем новый DownloadQueueManager вместо старого воркера
            pass

        return {
            "status": "success",
            "message": f"Запущена загрузка {queued_count} треков",
            "count": queued_count,
        }
    except Exception as e:
        logger.error(f"Ошибка запуска загрузки очереди: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download/playlist")
async def download_playlist(request: DownloadRequest):
    """Загрузить плейлист (старый метод - для совместимости)"""
    try:
        if not download_manager:
            raise HTTPException(
                status_code=400, detail="Менеджер загрузок не инициализирован"
            )

        result = await download_manager.download_playlist(
            request.playlist_id, request.quality
        )
        return {
            "status": "success",
            "message": f"Загрузка плейлиста {request.playlist_id} начата",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/queue")
async def get_download_queue():
    """Получить очередь загрузок из БД"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, track_id, title, artist, album, status, progress, 
                       quality, error_message, created_at, updated_at
                FROM download_queue
                ORDER BY created_at DESC
            """
            )

            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()

            queue = []
            for row in rows:
                item = dict(zip(columns, row))
                queue.append(item)

            return {"queue": queue}
    except Exception as e:
        logger.error(f"Ошибка получения очереди: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Получить статистику загрузок"""
    try:
        # Получаем статистику очереди
        queue_stats = db_manager.get_download_queue_stats()

        # Получаем статистику скачанных файлов
        import sqlite3
        import os

        db_path = os.path.join(os.path.dirname(__file__), "yandex_music.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM downloaded_tracks")
        downloaded_tracks = cursor.fetchone()[0]

        cursor.execute(
            "SELECT SUM(file_size) FROM downloaded_tracks WHERE file_size IS NOT NULL"
        )
        total_size = cursor.fetchone()[0] or 0

        conn.close()

        return {
            "totalTracks": downloaded_tracks,  # Всего файлов в БД
            "totalSizeMB": round(total_size, 2),
            "totalSizeGB": round(total_size / 1024, 2),
            "downloadedTracks": downloaded_tracks,
            "queueStats": queue_stats,
        }
    except Exception as e:
        return {
            "totalTracks": 0,
            "totalSizeMB": 0,
            "totalSizeGB": 0,
            "downloadedTracks": 0,
            "queueStats": {},
        }


@app.post("/api/files/check-missing")
async def check_missing_files():
    """Проверить физическое наличие файлов и очистить записи о несуществующих"""
    try:
        result = db_manager.check_and_cleanup_missing_files()

        return {
            "status": "success",
            "message": f"Проверка завершена. Проверено: {result['total_checked']}, найдено: {result['existing_files']}, отсутствует: {result['missing_files']}, удалено записей: {result['deleted_records']}",
            "details": result,
        }

    except Exception as e:
        logger.error(f"Ошибка проверки файлов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/cleanup-completed")
async def cleanup_completed_tracks():
    """Очистить завершенные треки из очереди"""
    try:
        from download_queue_manager import DownloadQueueManager

        # Получаем путь загрузки из настроек напрямую из БД
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = 'downloadPath'")
            result = cursor.fetchone()
            download_path = result[0] if result else "/home/urch/Music/Yandex"

        # Создаем экземпляр менеджера очереди
        queue_manager = DownloadQueueManager(db_manager, yandex_client, download_path)

        # Очищаем завершенные треки старше 1 часа
        deleted_count = queue_manager.cleanup_completed_tracks(older_than_hours=1)

        return {
            "status": "success",
            "message": f"Очистка завершена. Удалено завершенных треков: {deleted_count}",
            "deleted_count": deleted_count,
        }

    except Exception as e:
        logger.error(f"Ошибка очистки завершенных треков: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/playlists/{playlist_id}/stats")
async def get_playlist_stats(playlist_id: str):
    """Получить статистику плейлиста"""
    try:
        if not yandex_client:
            raise HTTPException(status_code=400, detail="Клиент не инициализирован")

        # Получаем треки плейлиста
        tracks = yandex_client.get_playlist_tracks(playlist_id)
        available_tracks = [t for t in tracks if t.get("available", False)]

        # Подсчитываем статистику
        total_tracks = len(available_tracks)
        queued_tracks = 0
        downloaded_tracks = 0

        for track in available_tracks:
            playlist_name = track.get("playlist_name", "Unknown Playlist")

            with db_manager.get_connection() as conn:
                cursor = conn.cursor()

                # Проверяем, есть ли трек в очереди
                cursor.execute(
                    "SELECT id FROM download_queue WHERE track_id = ? AND playlist_id = ?",
                    (track["id"], playlist_name),
                )
                if cursor.fetchone():
                    queued_tracks += 1
                    continue

                # Проверяем, скачан ли трек
                cursor.execute(
                    "SELECT id FROM downloaded_tracks WHERE track_id = ? AND playlist_id = ?",
                    (track["id"], playlist_name),
                )
                if cursor.fetchone():
                    downloaded_tracks += 1

        return {
            "playlist_id": playlist_id,
            "total_tracks": total_tracks,
            "queued_tracks": queued_tracks,
            "downloaded_tracks": downloaded_tracks,
            "available_tracks": total_tracks - queued_tracks - downloaded_tracks,
        }

    except Exception as e:
        logger.error(f"Ошибка получения статистики плейлиста: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/downloads/stats")
async def get_download_stats():
    """Получить детальную статистику загрузок"""
    try:
        # Получаем статистику из очереди загрузок
        queue_stats = db_manager.get_download_queue_stats()

        # Получаем и обновляем статистику загруженных файлов
        file_stats = db_manager.update_file_statistics()

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
                "totalSizeGB": (
                    round(file_stats["totalSize"] / 1024, 2)
                    if file_stats["totalSize"] > 0
                    else 0
                ),
            },
        }
    except Exception as e:
        logger.error(f"Ошибка получения статистики загрузок: {e}")
        return {
            "queue": {
                "total": 0,
                "completed": 0,
                "downloading": 0,
                "pending": 0,
                "errors": 0,
            },
            "files": {"totalFiles": 0, "totalSize": 0},
            "summary": {
                "totalInQueue": 0,
                "completedInQueue": 0,
                "downloadingInQueue": 0,
                "pendingInQueue": 0,
                "errorsInQueue": 0,
                "totalDownloaded": 0,
                "totalSizeMB": 0,
                "totalSizeGB": 0,
            },
        }


# Глобальная переменная для хранения общего количества треков в текущей сессии загрузки
_download_session_total = None


@app.get("/api/downloads/progress")
async def get_download_progress():
    """Получить информацию о прогрессе загрузки"""
    global _download_session_total

    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем статистику очереди
            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'pending'"
            )
            pending = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'queued'"
            )
            queued = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'downloading'"
            )
            downloading = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM download_queue WHERE status = 'completed'"
            )
            completed = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM download_queue WHERE status = 'error'")
            errors = cursor.fetchone()[0]

            # Текущее общее количество треков в очереди
            current_total = pending + queued + downloading + completed + errors

            # Если есть активные загрузки и мы еще не установили общее количество для сессии
            if downloading > 0 and _download_session_total is None:
                _download_session_total = current_total
                logger.info(
                    f"🎯 Установлено общее количество треков для сессии: {_download_session_total}"
                )

            # Если нет активных загрузок, сбрасываем счетчик сессии
            if downloading == 0 and _download_session_total is not None:
                logger.info("🏁 Сессия загрузки завершена, сбрасываем счетчик")
                _download_session_total = None

            # Используем сохраненное значение или текущее
            total_tracks = (
                _download_session_total
                if _download_session_total is not None
                else current_total
            )

            # Если все треки завершены и нет сохраненного значения, используем историческое
            if total_tracks == 0:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM download_queue 
                    WHERE status IN ('completed', 'error')
                """
                )
                historical_total = cursor.fetchone()[0]
                # Если нет треков в очереди вообще, то total_tracks = 0
                total_tracks = historical_total if historical_total > 0 else 0

            # Текущий обрабатываемый файл (processing или downloading)
            cursor.execute(
                """
                SELECT title, artist, status, progress 
                FROM download_queue 
                WHERE status IN ('processing', 'downloading')
                ORDER BY updated_at DESC 
                LIMIT 1
            """
            )
            current_track = cursor.fetchone()

            # Проверяем есть ли активные загрузки (только downloading и processing)
            active_downloads = downloading

            # Прогресс = завершенные + ошибки (оба статуса означают "обработано")
            processed_tracks = completed + errors

            result = {
                "is_active": active_downloads > 0,
                "overall_progress": processed_tracks,
                "overall_total": total_tracks,
                "current_track": None,
                "current_status": None,
                "current_progress": 0,
            }

            if current_track:
                title, artist, status, progress = current_track
                # Не показываем название трека в верхнем статус-баре
                result["current_status"] = status
                result["current_progress"] = progress or 0

            return result

    except Exception as e:
        logger.error(f"Ошибка получения прогресса: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/settings/download-path")
async def update_download_path(request: dict):
    """Обновить только путь загрузки"""
    try:
        download_path = request.get("downloadPath")
        if not download_path:
            raise HTTPException(status_code=400, detail="downloadPath обязателен")

        db_manager.save_setting("download_path", download_path)
        return {"message": "Путь загрузки обновлен", "downloadPath": download_path}
    except Exception as e:
        logger.error(f"Ошибка обновления пути загрузки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/system/restart")
async def restart_system():
    """Полный перезапуск системы"""
    try:
        import subprocess
        import os

        # Получаем путь к скрипту перезапуска
        script_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "restart_app.sh"
        )

        # Запускаем скрипт перезапуска в фоне
        subprocess.Popen(
            ["/bin/bash", script_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )

        return {"message": "Система перезапускается...", "status": "restarting"}
    except Exception as e:
        logger.error(f"Ошибка перезапуска системы: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/folders/scan-stop")
async def stop_folder_scanning():
    """Остановить сканирование папок"""
    try:
        # Останавливаем все процессы Python
        import subprocess

        subprocess.run(["pkill", "-f", "python main.py"], capture_output=True)
        subprocess.run(["pkill", "-f", "yandex_downloads"], capture_output=True)

        # Ждем немного, чтобы процессы завершились
        import time

        time.sleep(2)

        # Перезапускаем backend
        backend_dir = os.path.dirname(__file__)
        subprocess.Popen(
            [
                "/bin/bash",
                "-c",
                f"cd {backend_dir} && nohup python main.py > /tmp/backend.log 2>&1 &",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )

        # Перезапускаем frontend
        frontend_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "frontend"
        )
        subprocess.Popen(
            [
                "/bin/bash",
                "-c",
                f"cd {frontend_dir} && nohup npm run dev > /tmp/frontend.log 2>&1 &",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )

        return {
            "message": "Сканирование остановлено, приложение перезапускается...",
            "status": "restarting",
        }
    except Exception as e:
        logger.error(f"Ошибка остановки сканирования: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
            "downloadPath": db_manager.get_setting(
                "download_path", os.getenv("DOWNLOAD_PATH", "/home/urch/Music/Yandex")
            ),
            "quality": db_manager.get_setting(
                "quality", os.getenv("DEFAULT_QUALITY", "lossless")
            ),
            "autoSync": db_manager.get_setting("auto_sync", "false").lower() == "true",
            "syncInterval": int(db_manager.get_setting("sync_interval", "24")),
            "fileTemplate": db_manager.get_setting(
                "file_template", "{artist} - {title}"
            ),
            "folderStructure": db_manager.get_setting(
                "folder_structure", "{artist}/{album}"
            ),
            "downloads_paused": db_manager.get_setting(
                "downloads_paused", "false"
            ).lower()
            == "true",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/settings/playlist")
async def get_playlist_settings():
    """Получить настройки обработки плейлистов"""
    try:
        settings = db_manager.get_playlist_settings()
        return {
            "batchSize": settings.get("batch_size", 100),
            "maxTracks": settings.get("max_tracks"),
            "enableRateLimiting": settings.get("enable_rate_limiting", True),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/settings/playlist")
async def update_playlist_settings(request: dict):
    """Обновить настройки обработки плейлистов"""
    try:
        settings = {
            "batch_size": request.get("batchSize", 100),
            "max_tracks": request.get("maxTracks"),
            "enable_rate_limiting": request.get("enableRateLimiting", True),
        }

        success = db_manager.update_playlist_settings(settings)

        if success:
            return {"status": "success", "message": "Настройки обновлены"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось обновить настройки")
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
            "path": str(folder_path.resolve()),
        }
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Недостаточно прав для создания папки"
        )
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
            raise HTTPException(
                status_code=400, detail="Указанный путь не является директорией"
            )

        # Проверяем, не является ли это сетевой папкой
        path_str = str(folder_path)
        if any(
            network_path in path_str
            for network_path in ["/run/user/", "/mnt/", "smb-share:", "nfs:", "cifs:"]
        ):
            # Для сетевых папок ограничиваем количество элементов
            try:
                items = list(folder_path.iterdir())
                if len(items) > 1000:  # Ограничиваем до 1000 элементов
                    logger.warning(
                        f"Сетевая папка {path_str} содержит {len(items)} элементов, ограничиваем до 1000"
                    )
                    items = items[:1000]
            except (OSError, PermissionError) as e:
                logger.error(f"Ошибка доступа к сетевой папке {path_str}: {e}")
                raise HTTPException(
                    status_code=403, detail="Нет доступа к сетевой папке"
                )

        # Получаем только директории (включая символические ссылки на директории)
        folders = []
        try:
            # Используем items если это сетевая папка, иначе обычный iterdir()
            if "items" in locals():
                items_to_process = items
            else:
                items_to_process = folder_path.iterdir()

            for item in items_to_process:
                # Проверяем, что это директория (обычная или символическая ссылка на директорию)
                is_directory = item.is_dir()
                if not is_directory and item.is_symlink():
                    # Проверяем, что символическая ссылка ведет на директорию
                    try:
                        target_path = item.resolve()
                        is_directory = target_path.is_dir()
                    except (OSError, PermissionError):
                        is_directory = False

                if is_directory and not item.name.startswith("."):
                    # Проверяем наличие подпапок с обработкой ошибок доступа
                    has_children = False
                    try:
                        has_children = any(item.iterdir())
                    except PermissionError:
                        # Если нет доступа к содержимому, предполагаем что есть подпапки
                        has_children = True

                    folders.append(
                        {
                            "name": item.name,
                            "path": str(item),
                            "hasChildren": has_children,
                        }
                    )
        except PermissionError:
            # Игнорируем папки без доступа
            pass

        # Сортируем по имени
        folders.sort(key=lambda x: x["name"].lower())

        return {"path": str(folder_path), "folders": folders}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка чтения директории: {str(e)}"
        )


@app.get("/api/folders/exists")
async def check_folder_exists(path: str):
    """Проверить существование папки"""
    try:
        folder_path = Path(path)
        exists = folder_path.exists() and folder_path.is_dir()

        return {
            "exists": exists,
            "path": path,
            "resolved_path": str(folder_path.resolve()) if exists else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/decrypt-encrypted")
async def decrypt_encrypted_files():
    """Расшифровать зашифрованные файлы (.encrypted)"""
    try:
        import os
        import subprocess

        # Получаем путь загрузки из настроек
        settings = db_manager.get_settings()
        download_path = settings.get("download_path", "/home/urch/Music/Yandex")

        if not os.path.exists(download_path):
            raise HTTPException(
                status_code=404, detail="Директория загрузки не найдена"
            )

        # Запускаем утилиту расшифровки
        script_path = os.path.join(os.path.dirname(__file__), "decrypt_files.py")

        try:
            result = subprocess.run(
                [sys.executable, script_path, download_path],
                capture_output=True,
                text=True,
                timeout=300,  # 5 минут таймаут
            )

            if result.returncode == 0:
                return {
                    "status": "success",
                    "message": "Зашифрованные файлы успешно обработаны",
                    "output": result.stdout,
                }
            else:
                return {
                    "status": "error",
                    "message": "Ошибка при расшифровке файлов",
                    "error": result.stderr,
                }

        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=408, detail="Таймаут при расшифровке файлов"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка запуска утилиты: {e}")

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


@app.post("/api/files/stats/refresh")
async def refresh_files_stats():
    """Принудительно обновить статистику файлов"""
    try:
        stats = db_manager.update_file_statistics()
        return {
            "status": "success",
            "message": "Статистика файлов обновлена",
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/stats/clear")
async def clear_files_stats():
    """Очистить статистику файлов (удалить кэшированную статистику)"""
    try:
        success = db_manager.clear_file_statistics()
        if success:
            return {
                "status": "success",
                "message": "Статистика файлов очищена",
            }
        else:
            raise HTTPException(
                status_code=500, detail="Не удалось очистить статистику файлов"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/downloads/queue/clear")
async def clear_download_queue():
    """Очистить очередь загрузок"""
    try:
        if not download_queue_manager:
            raise HTTPException(
                status_code=400, detail="Менеджер очереди не инициализирован"
            )

        result = download_queue_manager.clear_queue(
            clear_completed=True, clear_pending=True
        )

        return {
            "status": "success",
            "message": result["message"],
            "cleared_count": result["cleared"],
        }
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
async def get_files_list(
    playlist_id: str = None, quality: str = None, limit: int = 100, offset: int = 0
):
    """Получить список загруженных файлов"""
    try:
        files = db_manager.get_downloaded_tracks(playlist_id, quality, limit, offset)
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
            raise HTTPException(
                status_code=400, detail="Менеджер загрузок не инициализирован"
            )

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

            audio_extensions = {".flac", ".mp3", ".aac", ".m4a", ".ogg"}
            files_scanned = 0

            # Сканируем директорию рекурсивно
            for file_path in Path(request.path).rglob("*"):
                if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                    try:
                        file_name = file_path.stem
                        file_size = file_path.stat().st_size / (1024 * 1024)  # в МБ

                        # Пытаемся извлечь информацию о треке из имени файла
                        # Простая логика: предполагаем формат "Artist - Title"
                        parts = file_name.split(" - ", 1)
                        artist = parts[0] if len(parts) > 0 else "Unknown Artist"
                        title = parts[1] if len(parts) > 1 else file_name

                        # Определяем формат и качество с помощью универсальной функции
                        from audio_quality_utils import determine_audio_quality

                        quality_info = determine_audio_quality(str(file_path))

                        format_ext = quality_info["format"]
                        quality = quality_info["quality_string"]
                        cover_data = None

                        # Извлекаем обложку если возможно
                        try:
                            if format_ext.lower() == "mp3":
                                from mutagen.mp3 import MP3

                                audio = MP3(str(file_path))
                                if audio.tags:
                                    for key in audio.tags.keys():
                                        if key.startswith("APIC:"):
                                            cover_data = audio.tags[key].data
                                            break
                            elif format_ext.lower() == "flac":
                                from mutagen.flac import FLAC

                                audio = FLAC(str(file_path))
                                if audio.pictures:
                                    cover_data = audio.pictures[0].data
                        except Exception as e:
                            # Если не удалось получить обложку, продолжаем без неё
                            pass

                        # Извлекаем название плейлиста из пути
                        playlist_name = "Scanned Files"  # По умолчанию
                        try:
                            base_path = str(request.path)
                            if str(file_path).startswith(base_path):
                                relative_path = str(file_path)[len(base_path) :].lstrip(
                                    "/"
                                )
                                path_parts = relative_path.split("/")
                                if len(path_parts) > 0:
                                    playlist_name = path_parts[0]
                        except Exception as e:
                            print(
                                f"Не удалось извлечь название плейлиста из {file_path}: {e}"
                            )

                        cursor.execute(
                            """
                            INSERT INTO downloaded_tracks 
                            (track_id, title, artist, album, playlist_id, file_path, file_size, format, quality, cover_data, download_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                            (
                                f"scanned_{hash(str(file_path))}",  # Генерируем ID на основе пути
                                title,
                                artist,
                                "Scanned Files",
                                playlist_name,  # Добавляем playlist_id
                                str(file_path),
                                round(file_size, 2),
                                format_ext,
                                quality,
                                cover_data,  # Сохраняем данные обложки
                                datetime.now().isoformat(),
                            ),
                        )

                        files_scanned += 1

                    except Exception as e:
                        print(f"Ошибка обработки файла {file_path}: {e}")

            conn.commit()
            print(f"Сканировано файлов: {files_scanned}")

        return {
            "status": "success",
            "message": f"Найдено файлов: {files_scanned}",
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files/cover/{track_id}")
async def get_track_cover(track_id: str):
    """Получить обложку трека"""
    try:
        from fastapi.responses import Response
        import requests

        # Сначала пробуем получить обложку из базы данных загруженных файлов
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT cover_data FROM downloaded_tracks WHERE track_id = ?",
                (track_id,),
            )
            row = cursor.fetchone()

            if row and row[0]:
                # Обложка есть в базе данных загруженных файлов
                return Response(
                    content=row[0],
                    media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=3600"},
                )

            # Если обложки нет в загруженных файлах, пробуем получить из очереди загрузок
            cursor.execute(
                "SELECT cover FROM download_queue WHERE track_id = ?",
                (track_id,),
            )
            queue_row = cursor.fetchone()

            if queue_row and queue_row[0]:
                # Есть URL обложки в очереди загрузок - загружаем её
                try:
                    cover_url = queue_row[0]
                    response = requests.get(cover_url, timeout=10)
                    if response.status_code == 200:
                        cover_data = response.content

                        # Сохраняем обложку в базу данных загруженных файлов
                        cursor.execute(
                            "UPDATE downloaded_tracks SET cover_data = ? WHERE track_id = ?",
                            (cover_data, track_id),
                        )
                        conn.commit()

                        return Response(
                            content=cover_data,
                            media_type="image/jpeg",
                            headers={"Cache-Control": "public, max-age=3600"},
                        )
                except Exception as e:
                    logger.warning(
                        f"Не удалось загрузить обложку по URL для трека {track_id}: {e}"
                    )

        # Если обложка не найдена - возвращаем placeholder
        svg_placeholder = """<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" fill="#f3f4f6"/>
            <text x="24" y="24" text-anchor="middle" dy=".3em" 
                  font-family="Arial" font-size="12" fill="#6b7280">🎵</text>
        </svg>"""

        return Response(
            content=svg_placeholder,
            media_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения обложки для трека {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/downloads/{track_id}/progress")
async def update_download_progress(track_id: str, request: ProgressUpdateRequest):
    """Обновить прогресс загрузки трека"""
    try:
        progress = request.progress
        if not (0 <= progress <= 100):
            raise HTTPException(
                status_code=400, detail="Прогресс должен быть от 0 до 100"
            )

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
            "deleted_count": deleted_count,
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
        logs_dir = Path(__file__).parent.parent / "logs"

        if log_type == "downloads":
            log_file = logs_dir / "downloads.log"
        elif log_type == "errors":
            log_file = logs_dir / "errors.log"
        elif log_type == "main":
            log_file = logs_dir / "yandex_music.log"
        else:  # all
            # Объединяем все логи
            all_logs = []
            for log_file in [
                logs_dir / "yandex_music.log",
                logs_dir / "downloads.log",
                logs_dir / "errors.log",
            ]:
                if log_file.exists():
                    with open(log_file, "r", encoding="utf-8") as f:
                        all_logs.extend(f.readlines())

            # Сортируем по времени (первые символы - дата)
            all_logs.sort(key=lambda x: x[:19] if len(x) > 19 else x)

            return {
                "logs": all_logs[-lines:] if lines > 0 else all_logs,
                "total_lines": len(all_logs),
                "log_type": "all",
            }

        if not log_file.exists():
            return {"logs": [], "total_lines": 0, "log_type": log_type}

        with open(log_file, "r", encoding="utf-8") as f:
            all_lines = f.readlines()

        # Берем последние N строк
        recent_lines = all_lines[-lines:] if lines > 0 else all_lines

        return {
            "logs": recent_lines,
            "total_lines": len(all_lines),
            "log_type": log_type,
        }

    except Exception as e:
        logger.error(f"Ошибка чтения логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/logs")
async def clear_logs():
    """Очистить все логи"""
    try:
        logs_dir = Path(__file__).parent.parent / "logs"

        cleared_files = []
        for log_file in logs_dir.glob("*.log*"):
            if log_file.is_file():
                log_file.unlink()
                cleared_files.append(log_file.name)

        logger.info(f"Очищены логи: {cleared_files}")

        return {
            "status": "success",
            "message": f"Очищено файлов: {len(cleared_files)}",
            "files": cleared_files,
        }

    except Exception as e:
        logger.error(f"Ошибка очистки логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs/stats")
async def get_log_stats():
    """Получить статистику логов"""
    try:
        logs_dir = Path(__file__).parent.parent / "logs"

        stats = {}
        total_size = 0

        for log_file in logs_dir.glob("*.log*"):
            if log_file.is_file():
                size = log_file.stat().st_size
                total_size += size

                # Подсчитываем строки
                try:
                    with open(log_file, "r", encoding="utf-8") as f:
                        lines_count = sum(1 for _ in f)
                except Exception:
                    lines_count = 0

                stats[log_file.name] = {
                    "size_bytes": size,
                    "size_mb": round(size / (1024 * 1024), 2),
                    "lines": lines_count,
                    "modified": log_file.stat().st_mtime,
                }

        return {
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "files": stats,
            "files_count": len(stats),
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


class RemoveTracksRequest(BaseModel):
    track_ids: List[str]


@app.post("/api/downloads/remove-selected")
async def remove_selected_tracks(request: RemoveTracksRequest):
    """Удалить выбранные треки из очереди (оптимизированная версия)"""
    try:
        # Используем батчевую обработку для больших списков
        if len(request.track_ids) > 500:
            removed_count = db_manager.bulk_remove_from_queue(request.track_ids)
        else:
            removed_count = db_manager.remove_from_queue(request.track_ids)

        return {
            "status": "success",
            "message": f"Удалено треков: {removed_count}",
            "removed_count": removed_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/downloads/clear-queued")
async def clear_queued_downloads():
    """Очистить все подготовленные (queued) загрузки"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM download_queue WHERE status = 'queued'")
            deleted_count = cursor.rowcount
            conn.commit()

        return {
            "status": "success",
            "message": f"Удалено треков из очереди: {deleted_count}",
            "deleted_count": deleted_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChangeStatusRequest(BaseModel):
    from_status: str
    to_status: str
    count: int = 10


@app.post("/api/downloads/change-status")
async def change_track_status(request: ChangeStatusRequest):
    """Изменение статуса треков для тестирования"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE download_queue 
                SET status = ? 
                WHERE status = ? 
                LIMIT ?
            """,
                (request.to_status, request.from_status, request.count),
            )
            updated_count = cursor.rowcount
            conn.commit()

        return {
            "status": "success",
            "message": f"Изменён статус {updated_count} треков с '{request.from_status}' на '{request.to_status}'",
        }
    except Exception as e:
        logger.error(f"Ошибка изменения статуса: {e}")
        return {"status": "error", "message": str(e)}


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
    cover: str = None
    quality: str = "lossless"
    playlist_id: str = None


# Новые модели для обновлённой системы очереди
class AddTracksToQueueRequest(BaseModel):
    tracks: List[Dict]  # [{id, title, artist, album}, ...]
    quality: str = "lossless"


class TrackIdRequest(BaseModel):
    track_id: str


@app.post("/api/downloads/add-to-queue")
async def add_to_queue(request: AddToQueueRequest):
    """Добавить трек в очередь загрузок"""
    try:
        # Автоматически очищаем предыдущие загрузки при добавлении новых треков
        if download_queue_manager:
            # Очищаем очередь и статистику для новой сессии
            download_queue_manager.clear_queue(clear_completed=True, clear_pending=True)
            db_manager.clear_file_statistics()

        with db_manager.get_connection() as conn:
            cursor = conn.cursor()

            # Если указан плейлист, проверяем существование в рамках этого плейлиста
            if request.playlist_id:
                cursor.execute(
                    "SELECT id FROM download_queue WHERE track_id = ? AND playlist_id = ?",
                    (request.track_id, request.playlist_id),
                )
                if cursor.fetchone():
                    return {
                        "status": "warning",
                        "message": "Трек уже в очереди для этого плейлиста",
                    }

                cursor.execute(
                    "SELECT id FROM downloaded_tracks WHERE track_id = ? AND playlist_id = ?",
                    (request.track_id, request.playlist_id),
                )
                if cursor.fetchone():
                    return {
                        "status": "warning",
                        "message": "Трек уже скачан для этого плейлиста",
                    }
            else:
                # Если плейлист не указан, проверяем глобально
                cursor.execute(
                    "SELECT id FROM download_queue WHERE track_id = ?",
                    (request.track_id,),
                )
                if cursor.fetchone():
                    return {"status": "warning", "message": "Трек уже в очереди"}

                cursor.execute(
                    "SELECT id FROM downloaded_tracks WHERE track_id = ?",
                    (request.track_id,),
                )
                if cursor.fetchone():
                    return {"status": "warning", "message": "Трек уже скачан"}

            # Добавляем трек в очередь
            cursor.execute(
                """
                INSERT INTO download_queue 
                (track_id, title, artist, album, playlist_id, cover, status, progress, quality, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
            """,
                (
                    request.track_id,
                    request.title,
                    request.artist,
                    request.album,
                    request.playlist_id,
                    request.cover,
                    request.quality,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )

            conn.commit()

        return {"status": "success", "message": "Трек добавлен в очередь"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# НОВЫЕ API ЭНДПОИНТЫ ДЛЯ ОБНОВЛЁННОЙ СИСТЕМЫ ОЧЕРЕДИ
# ============================================================================


@app.post("/api/queue/add-tracks")
async def queue_add_tracks(request: AddTracksToQueueRequest):
    """Добавить треки в очередь загрузки"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        # Автоматически очищаем предыдущие загрузки при добавлении новых треков
        result = download_queue_manager.add_tracks(
            request.tracks, request.quality, clear_previous=True
        )
        return {
            "status": "success",
            "added": result["added"],
            "skipped": result["skipped"],
            "duplicates": result["duplicates"],
            "cleared": result["cleared"],
            "message": f"Добавлено {result['added']} треков, очищено {result['cleared']} предыдущих",
        }
    except Exception as e:
        logger.error(f"Ошибка добавления треков в очередь: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/queue/list")
async def queue_list(limit: Optional[int] = None):
    """Получить список треков в очереди"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        queue = download_queue_manager.get_queue(limit)
        return {"queue": queue}
    except Exception as e:
        logger.error(f"Ошибка получения очереди: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/queue/stats")
async def queue_stats():
    """Получить статистику очереди"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        stats = download_queue_manager.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Ошибка получения статистики: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/start")
async def queue_start():
    """Запустить обработку очереди"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = await download_queue_manager.start()
        return result
    except Exception as e:
        logger.error(f"Ошибка запуска очереди: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/pause")
async def queue_pause():
    """Приостановить загрузку"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = download_queue_manager.pause()
        return result
    except Exception as e:
        logger.error(f"Ошибка паузы: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/resume")
async def queue_resume():
    """Возобновить загрузку"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = download_queue_manager.resume()
        return result
    except Exception as e:
        logger.error(f"Ошибка возобновления: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/stop")
async def queue_stop():
    """Остановить загрузку"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = download_queue_manager.stop()
        return result
    except Exception as e:
        logger.error(f"Ошибка остановки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/queue/restart")
async def queue_restart():
    """Принудительно перезапустить воркер загрузки"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = download_queue_manager.restart()
        return result
    except Exception as e:
        logger.error(f"Ошибка перезапуска: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/queue/clear-completed")
async def queue_clear_completed():
    """Удалить завершённые треки из очереди"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        deleted = download_queue_manager.clear_completed()
        return {"status": "success", "deleted": deleted}
    except Exception as e:
        logger.error(f"Ошибка очистки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/queue/track/{track_id}")
async def queue_remove_track(track_id: str):
    """Удалить трек из очереди"""
    if not download_queue_manager:
        raise HTTPException(
            status_code=400, detail="Менеджер очереди не инициализирован"
        )

    try:
        result = download_queue_manager.remove_track(track_id)
        if result:
            return {"status": "success", "message": "Трек удалён"}
        else:
            return {
                "status": "error",
                "message": "Трек не найден или не может быть удалён",
            }
    except Exception as e:
        logger.error(f"Ошибка удаления трека: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
