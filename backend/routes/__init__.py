"""API роуты"""

# Импортируем все роутеры для удобного доступа
from routes import (
    accounts,
    auth,
    downloads,
    files,
    logs,
    playlists,
    settings,
    system,
    tokens,
)

__all__ = [
    "auth",
    "tokens",
    "accounts",
    "playlists",
    "downloads",
    "files",
    "settings",
    "logs",
    "system",
]
