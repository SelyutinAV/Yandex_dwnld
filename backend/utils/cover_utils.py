"""Утилиты для работы с обложками треков"""

import os
import sqlite3
from typing import Optional

import requests
from fastapi import HTTPException
from fastapi.responses import Response

from db_manager import db_manager
from logger_config import get_logger

logger = get_logger(__name__)


def get_track_cover_from_db(track_id: str) -> Optional[bytes]:
    """Получить обложку трека из базы данных downloaded_tracks"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT cover_data FROM downloaded_tracks 
                WHERE track_id = ? AND cover_data IS NOT NULL
                LIMIT 1
            """,
                (track_id,),
            )

            row = cursor.fetchone()

            if row and row[0]:
                return row[0]
            return None
    except Exception as e:
        logger.error(f"Ошибка получения обложки из БД для трека {track_id}: {e}")
        return None


def get_queue_track_cover_url(track_id: str) -> Optional[str]:
    """Получить URL обложки трека из очереди"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT cover FROM download_queue 
                WHERE track_id = ? AND cover IS NOT NULL
                LIMIT 1
            """,
                (track_id,),
            )
            row = cursor.fetchone()
            if row and row[0]:
                return row[0]
            return None
    except Exception as e:
        logger.error(f"Ошибка получения URL обложки из очереди для трека {track_id}: {e}")
        return None


def download_cover_from_url(url: str, timeout: int = 10) -> Optional[bytes]:
    """Скачать обложку по URL"""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return response.content
        return None
    except Exception as e:
        logger.warning(f"Ошибка скачивания обложки по URL {url}: {e}")
        return None


def get_cover_placeholder() -> bytes:
    """Получить placeholder обложки"""
    svg_placeholder = """<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" fill="#f3f4f6"/>
        <text x="24" y="24" text-anchor="middle" dy=".3em" 
              font-family="Arial" font-size="12" fill="#6b7280">🎵</text>
    </svg>"""
    return svg_placeholder.encode("utf-8")


def create_cover_response(
    content: bytes, media_type: str = "image/jpeg", cache_max_age: int = 3600
) -> Response:
    """Создать Response для обложки"""
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": f"public, max-age={cache_max_age}"},
    )


def get_track_cover_response(track_id: str) -> Response:
    """Получить обложку трека из базы данных (для эндпоинта /api/tracks/{track_id}/cover)"""
    cover_data = get_track_cover_from_db(track_id)
    if cover_data:
        return create_cover_response(cover_data, cache_max_age=31536000)  # Год
    raise HTTPException(status_code=404, detail="Обложка не найдена")


def get_queue_track_cover_response(track_id: str) -> Response:
    """Получить обложку трека из очереди (для эндпоинта /api/queue/track/{track_id}/cover)"""
    cover_url = get_queue_track_cover_url(track_id)
    if cover_url:
        cover_data = download_cover_from_url(cover_url)
        if cover_data:
            return create_cover_response(cover_data, cache_max_age=3600)  # Час
    raise HTTPException(status_code=404, detail="Обложка не найдена")


def get_file_track_cover_response(track_id: str) -> Response:
    """Получить обложку трека из файлов (для эндпоинта /api/files/cover/{track_id})"""
    # Сначала пробуем получить обложку из базы данных загруженных файлов
    cover_data = get_track_cover_from_db(track_id)
    if cover_data:
        return create_cover_response(cover_data)

    # Если обложки нет в загруженных файлах, пробуем получить из очереди загрузок
    cover_url = get_queue_track_cover_url(track_id)
    if cover_url:
        cover_data = download_cover_from_url(cover_url)
        if cover_data:
            # Сохраняем обложку в базу данных загруженных файлов
            try:
                with db_manager.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "UPDATE downloaded_tracks SET cover_data = ? WHERE track_id = ?",
                        (cover_data, track_id),
                    )
                    conn.commit()
            except Exception as e:
                logger.warning(f"Не удалось сохранить обложку в БД для трека {track_id}: {e}")

            return create_cover_response(cover_data)

    # Если обложка не найдена - возвращаем placeholder
    placeholder = get_cover_placeholder()
    return create_cover_response(placeholder, media_type="image/svg+xml")

