"""
Утилита для извлечения обложек из аудиофайлов
"""

import os
import logging
from typing import Optional, Tuple
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis
from mutagen.id3 import ID3NoHeaderError
from mutagen.id3._util import ID3NoHeaderError as ID3NoHeaderErrorUtil

logger = logging.getLogger(__name__)


def extract_cover_from_file(file_path: str) -> Optional[bytes]:
    """
    Извлечь обложку из аудиофайла

    Args:
        file_path: Путь к аудиофайлу

    Returns:
        Бинарные данные обложки или None
    """
    if not os.path.exists(file_path):
        logger.warning(f"Файл не найден: {file_path}")
        return None

    try:
        # Определяем тип файла по расширению
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == ".mp3":
            return _extract_from_mp3(file_path)
        elif file_ext == ".flac":
            return _extract_from_flac(file_path)
        elif file_ext in [".m4a", ".mp4"]:
            return _extract_from_mp4(file_path)
        elif file_ext == ".ogg":
            return _extract_from_ogg(file_path)
        else:
            logger.warning(f"Неподдерживаемый формат файла: {file_ext}")
            return None

    except Exception as e:
        logger.error(f"Ошибка извлечения обложки из {file_path}: {e}")
        return None


def _extract_from_mp3(file_path: str) -> Optional[bytes]:
    """Извлечь обложку из MP3 файла"""
    try:
        audio = MP3(file_path)

        # Ищем обложку в тегах ID3
        if hasattr(audio, "tags") and audio.tags:
            # APIC (Attached Picture) тег
            for key in audio.tags.keys():
                if key.startswith("APIC:"):
                    apic = audio.tags[key]
                    if hasattr(apic, "data"):
                        return apic.data

        return None

    except ID3NoHeaderError:
        logger.debug(f"MP3 файл без ID3 заголовков: {file_path}")
        return None
    except Exception as e:
        logger.error(f"Ошибка чтения MP3 файла {file_path}: {e}")
        return None


def _extract_from_flac(file_path: str) -> Optional[bytes]:
    """Извлечь обложку из FLAC файла"""
    try:
        audio = FLAC(file_path)

        # Ищем обложку в метаданных FLAC
        if hasattr(audio, "pictures") and audio.pictures:
            for picture in audio.pictures:
                if picture.type == 3:  # Front Cover
                    return picture.data

        return None

    except Exception as e:
        logger.error(f"Ошибка чтения FLAC файла {file_path}: {e}")
        return None


def _extract_from_mp4(file_path: str) -> Optional[bytes]:
    """Извлечь обложку из MP4/M4A файла"""
    try:
        audio = MP4(file_path)

        # Ищем обложку в тегах MP4
        if hasattr(audio, "tags") and audio.tags:
            # covr тег содержит обложки
            if "covr" in audio.tags:
                cover_data = audio.tags["covr"][0]
                if hasattr(cover_data, "data"):
                    return cover_data.data

        return None

    except Exception as e:
        logger.error(f"Ошибка чтения MP4 файла {file_path}: {e}")
        return None


def _extract_from_ogg(file_path: str) -> Optional[bytes]:
    """Извлечь обложку из OGG файла"""
    try:
        audio = OggVorbis(file_path)

        # Ищем обложку в метаданных OGG
        if hasattr(audio, "pictures") and audio.pictures:
            for picture in audio.pictures:
                if picture.type == 3:  # Front Cover
                    return picture.data

        return None

    except Exception as e:
        logger.error(f"Ошибка чтения OGG файла {file_path}: {e}")
        return None


def get_cover_info(file_path: str) -> Tuple[Optional[bytes], str]:
    """
    Получить обложку и информацию о ней

    Args:
        file_path: Путь к аудиофайлу

    Returns:
        Tuple[данные_обложки, тип_изображения]
    """
    if not os.path.exists(file_path):
        return None, "file_not_found"

    try:
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == ".mp3":
            return _get_mp3_cover_info(file_path)
        elif file_ext == ".flac":
            return _get_flac_cover_info(file_path)
        elif file_ext in [".m4a", ".mp4"]:
            return _get_mp4_cover_info(file_path)
        elif file_ext == ".ogg":
            return _get_ogg_cover_info(file_path)
        else:
            return None, "unsupported_format"

    except Exception as e:
        logger.error(f"Ошибка получения информации об обложке {file_path}: {e}")
        return None, "error"


def _get_mp3_cover_info(file_path: str) -> Tuple[Optional[bytes], str]:
    """Получить информацию об обложке MP3 файла"""
    try:
        audio = MP3(file_path)

        if hasattr(audio, "tags") and audio.tags:
            for key in audio.tags.keys():
                if key.startswith("APIC:"):
                    apic = audio.tags[key]
                    if hasattr(apic, "data"):
                        mime_type = getattr(apic, "mime", "image/jpeg")
                        return apic.data, mime_type

        return None, "no_cover"

    except ID3NoHeaderError:
        return None, "no_id3_header"
    except Exception as e:
        logger.error(f"Ошибка чтения MP3 файла {file_path}: {e}")
        return None, "error"


def _get_flac_cover_info(file_path: str) -> Tuple[Optional[bytes], str]:
    """Получить информацию об обложке FLAC файла"""
    try:
        audio = FLAC(file_path)

        if hasattr(audio, "pictures") and audio.pictures:
            for picture in audio.pictures:
                if picture.type == 3:  # Front Cover
                    mime_type = picture.mime or "image/jpeg"
                    return picture.data, mime_type

        return None, "no_cover"

    except Exception as e:
        logger.error(f"Ошибка чтения FLAC файла {file_path}: {e}")
        return None, "error"


def _get_mp4_cover_info(file_path: str) -> Tuple[Optional[bytes], str]:
    """Получить информацию об обложке MP4 файла"""
    try:
        audio = MP4(file_path)

        if hasattr(audio, "tags") and audio.tags:
            if "covr" in audio.tags:
                cover_data = audio.tags["covr"][0]
                if hasattr(cover_data, "data"):
                    # MP4 обложки обычно в формате JPEG
                    return cover_data.data, "image/jpeg"

        return None, "no_cover"

    except Exception as e:
        logger.error(f"Ошибка чтения MP4 файла {file_path}: {e}")
        return None, "error"


def _get_ogg_cover_info(file_path: str) -> Tuple[Optional[bytes], str]:
    """Получить информацию об обложке OGG файла"""
    try:
        audio = OggVorbis(file_path)

        if hasattr(audio, "pictures") and audio.pictures:
            for picture in audio.pictures:
                if picture.type == 3:  # Front Cover
                    mime_type = picture.mime or "image/jpeg"
                    return picture.data, mime_type

        return None, "no_cover"

    except Exception as e:
        logger.error(f"Ошибка чтения OGG файла {file_path}: {e}")
        return None, "error"
