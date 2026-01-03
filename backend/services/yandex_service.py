"""Сервис для работы с Яндекс.Музыкой"""

from config.database import (
    get_download_manager,
    get_download_queue_manager,
    get_yandex_client,
    update_yandex_client,
)

__all__ = [
    "get_yandex_client",
    "get_download_manager",
    "get_download_queue_manager",
    "update_yandex_client",
]

