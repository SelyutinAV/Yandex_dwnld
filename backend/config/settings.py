"""Настройки приложения"""

import os
from pathlib import Path
from typing import List


def get_cors_origins() -> List[str]:
    """Получить список разрешенных CORS origins"""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:7777")
    cors_origins = [frontend_url, "http://127.0.0.1:7777", "null"]
    
    # Добавляем дополнительные origins из переменной окружения, если указаны
    additional_origins = os.getenv("CORS_ORIGINS", "")
    if additional_origins:
        cors_origins.extend([origin.strip() for origin in additional_origins.split(",")])
    
    return cors_origins


def get_cors_settings() -> dict:
    """Получить настройки CORS middleware"""
    return {
        "allow_origins": get_cors_origins(),
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }


def get_static_dir() -> Path:
    """Получить путь к директории со статическими файлами"""
    return Path(__file__).parent.parent / "static"


def get_api_host() -> str:
    """Получить хост API из переменных окружения"""
    return os.getenv("API_HOST", "0.0.0.0")


def get_api_port() -> int:
    """Получить порт API из переменных окружения"""
    return int(os.getenv("API_PORT", "3333"))


def get_debug() -> bool:
    """Получить режим отладки из переменных окружения"""
    return os.getenv("DEBUG", "True").lower() == "true"

