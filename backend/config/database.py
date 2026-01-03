"""Инициализация базы данных и приложения"""

import os
from typing import Optional

from db_manager import db_manager
from dotenv import load_dotenv
from download_queue_manager import DownloadQueueManager
from downloader import DownloadManager
from logger_config import get_logger, setup_logging
from yandex_client import YandexMusicClient

# Загружаем переменные окружения
load_dotenv()

# Настраиваем логирование
setup_logging()
logger = get_logger(__name__)

# Глобальные переменные
yandex_client: Optional[YandexMusicClient] = None
download_manager: Optional[DownloadManager] = None
download_queue_manager: Optional[DownloadQueueManager] = None


def update_yandex_client(token: Optional[str] = None):
    """Обновление клиента Яндекс.Музыка"""
    global yandex_client, download_manager, download_queue_manager

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


async def init_app():
    """Инициализация приложения"""
    logger.info("Инициализация приложения...")
    update_yandex_client()
    logger.info("✅ Приложение инициализировано")


def get_yandex_client() -> Optional[YandexMusicClient]:
    """Получить клиент Яндекс.Музыки"""
    return yandex_client


def get_download_manager() -> Optional[DownloadManager]:
    """Получить менеджер загрузок"""
    return download_manager


def get_download_queue_manager() -> Optional[DownloadQueueManager]:
    """Получить менеджер очереди загрузок"""
    return download_queue_manager

