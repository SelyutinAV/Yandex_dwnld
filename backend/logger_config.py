"""
Конфигурация логирования
"""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Путь к директории логов
LOGS_DIR = Path(__file__).parent.parent / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

# Файлы логов
APP_LOG_FILE = LOGS_DIR / 'yandex_music.log'
ERROR_LOG_FILE = LOGS_DIR / 'errors.log'
DOWNLOAD_LOG_FILE = LOGS_DIR / 'downloads.log'


def setup_logging():
    """
    Настройка логирования с записью в файл и консоль
    """
    
    # Создаем форматтер
    detailed_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Корневой логгер
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Очищаем существующие обработчики
    root_logger.handlers.clear()
    
    # 1. Консольный вывод (цветной, краткий)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # 2. Основной файл логов (все логи)
    file_handler = RotatingFileHandler(
        APP_LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10 МБ
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler)
    
    # 3. Файл только ошибок
    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=5 * 1024 * 1024,  # 5 МБ
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(error_handler)
    
    # Создаем специальный логгер для загрузок
    download_logger = logging.getLogger('download')
    download_logger.setLevel(logging.INFO)
    
    download_handler = RotatingFileHandler(
        DOWNLOAD_LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10 МБ
        backupCount=5,
        encoding='utf-8'
    )
    download_handler.setFormatter(detailed_formatter)
    download_logger.addHandler(download_handler)
    
    # Отключаем лишние логи от uvicorn (оставляем только важные)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.error').setLevel(logging.INFO)
    
    logging.info("=" * 80)
    logging.info("🚀 YANDEX MUSIC DOWNLOADER - Backend Started")
    logging.info("=" * 80)
    logging.info(f"📁 Логи сохраняются в: {LOGS_DIR}")
    logging.info(f"   • Основные логи: {APP_LOG_FILE.name}")
    logging.info(f"   • Ошибки: {ERROR_LOG_FILE.name}")
    logging.info(f"   • Загрузки: {DOWNLOAD_LOG_FILE.name}")
    logging.info("=" * 80)


def get_logger(name: str) -> logging.Logger:
    """
    Получить логгер с указанным именем
    
    Args:
        name: Имя логгера
        
    Returns:
        Настроенный логгер
    """
    return logging.getLogger(name)


# Специальные логгеры
download_logger = logging.getLogger('download')
api_logger = logging.getLogger('api')
yandex_logger = logging.getLogger('yandex')

