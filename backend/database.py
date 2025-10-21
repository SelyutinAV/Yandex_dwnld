"""
Модели базы данных для хранения информации о треках и загрузках
"""
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# Базовый класс для моделей
Base = declarative_base()


class DownloadedTrack(Base):
    """Модель скачанного трека"""
    __tablename__ = 'downloaded_tracks'
    
    id = Column(Integer, primary_key=True)
    track_id = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    album = Column(String)
    playlist_id = Column(String)
    file_path = Column(String, nullable=False)
    file_size = Column(Float)  # в МБ
    format = Column(String)  # FLAC, MP3, AAC
    quality = Column(String)  # bitrate/sample rate
    download_date = Column(DateTime, default=datetime.utcnow)
    last_checked = Column(DateTime, default=datetime.utcnow)
    is_available = Column(Boolean, default=True)


class PlaylistSync(Base):
    """Модель синхронизации плейлиста"""
    __tablename__ = 'playlist_syncs'
    
    id = Column(Integer, primary_key=True)
    playlist_id = Column(String, unique=True, nullable=False)
    playlist_title = Column(String, nullable=False)
    track_count = Column(Integer)
    last_sync = Column(DateTime)
    is_enabled = Column(Boolean, default=True)
    auto_sync = Column(Boolean, default=False)
    quality_preference = Column(String, default='lossless')


class DownloadQueue(Base):
    """Модель очереди загрузок"""
    __tablename__ = 'download_queue'
    
    id = Column(Integer, primary_key=True)
    track_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    album = Column(String)
    status = Column(String, default='pending')  # pending, downloading, completed, error
    progress = Column(Integer, default=0)
    quality = Column(String)
    error_message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Settings(Base):
    """Модель настроек приложения"""
    __tablename__ = 'settings'
    
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SavedToken(Base):
    """Модель сохраненных токенов"""
    __tablename__ = 'saved_tokens'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # Имя токена (например, "Мой аккаунт")
    token = Column(String, nullable=False)  # Сам токен
    token_type = Column(String, nullable=False)  # oauth или session_id
    username = Column(String)  # Имя пользователя Яндекс.Музыки (например, "alselyutin")
    is_active = Column(Boolean, default=False)  # Активный токен
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime)


# Создание базы данных
def init_database(db_url: str = None):
    """
    Инициализация базы данных
    
    Args:
        db_url: URL базы данных (если не указан, берется из env)
    """
    if not db_url:
        db_url = os.getenv('DATABASE_URL', 'sqlite:///yandex_music.db')
    
    # Используем обычный SQLite для синхронной инициализации
    if 'sqlite:///' not in db_url:
        db_url = 'sqlite:///yandex_music.db'
    
    # Убираем aiosqlite из URL если он есть
    if 'aiosqlite' in db_url:
        db_url = db_url.replace('aiosqlite', 'sqlite')
    
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal


# Функции для работы с БД
def add_downloaded_track(session, track_info: dict):
    """Добавить информацию о скачанном треке"""
    track = DownloadedTrack(**track_info)
    session.add(track)
    session.commit()
    return track


def get_downloaded_tracks(session, playlist_id: str = None):
    """Получить список скачанных треков"""
    query = session.query(DownloadedTrack)
    if playlist_id:
        query = query.filter(DownloadedTrack.playlist_id == playlist_id)
    return query.all()


def update_playlist_sync(session, playlist_id: str, sync_info: dict):
    """Обновить информацию о синхронизации плейлиста"""
    sync = session.query(PlaylistSync).filter(
        PlaylistSync.playlist_id == playlist_id
    ).first()
    
    if sync:
        for key, value in sync_info.items():
            setattr(sync, key, value)
    else:
        sync = PlaylistSync(playlist_id=playlist_id, **sync_info)
        session.add(sync)
    
    session.commit()
    return sync


def get_file_statistics(session):
    """Получить статистику файлов"""
    from sqlalchemy import func
    
    tracks = session.query(DownloadedTrack).all()
    
    stats = {
        'totalFiles': len(tracks),
        'totalSize': sum(t.file_size or 0 for t in tracks),
        'byFormat': {},
        'byQuality': {}
    }
    
    # Группировка по форматам
    for track in tracks:
        fmt = track.format or 'Unknown'
        if fmt not in stats['byFormat']:
            stats['byFormat'][fmt] = {'count': 0, 'size': 0}
        stats['byFormat'][fmt]['count'] += 1
        stats['byFormat'][fmt]['size'] += track.file_size or 0
        
        # Группировка по качеству
        quality = track.quality or 'Unknown'
        if quality not in stats['byQuality']:
            stats['byQuality'][quality] = 0
        stats['byQuality'][quality] += 1
    
    return stats


def save_setting(session, key: str, value: str):
    """Сохранить настройку"""
    setting = session.query(Settings).filter(Settings.key == key).first()
    
    if setting:
        setting.value = value
        setting.updated_at = datetime.utcnow()
    else:
        setting = Settings(key=key, value=value)
        session.add(setting)
    
    session.commit()
    return setting


def get_setting(session, key: str, default: str = None) -> str:
    """Получить настройку"""
    setting = session.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else default


def get_all_settings(session) -> dict:
    """Получить все настройки"""
    settings = session.query(Settings).all()
    return {setting.key: setting.value for setting in settings}


# Функции для работы с токенами
def save_token(session, name: str, token: str, token_type: str, username: str = None, is_active: bool = False):
    """Сохранить токен"""
    # Деактивируем все остальные токены если этот активный
    if is_active:
        session.query(SavedToken).update({SavedToken.is_active: False})
    
    # Проверяем, существует ли токен с таким именем
    existing = session.query(SavedToken).filter(SavedToken.name == name).first()
    
    if existing:
        existing.token = token
        existing.token_type = token_type
        existing.username = username
        existing.is_active = is_active
        existing.last_used = datetime.utcnow()
        saved_token = existing
    else:
        saved_token = SavedToken(
            name=name,
            token=token,
            token_type=token_type,
            username=username,
            is_active=is_active,
            last_used=datetime.utcnow()
        )
        session.add(saved_token)
    
    session.commit()
    return saved_token


def get_all_tokens(session):
    """Получить все сохраненные токены"""
    return session.query(SavedToken).order_by(SavedToken.is_active.desc(), SavedToken.last_used.desc()).all()


def get_active_token(session):
    """Получить активный токен"""
    return session.query(SavedToken).filter(SavedToken.is_active == True).first()


def delete_token(session, token_id: int):
    """Удалить токен"""
    token = session.query(SavedToken).filter(SavedToken.id == token_id).first()
    if token:
        session.delete(token)
        session.commit()
        return True
    return False


def activate_token(session, token_id: int):
    """Активировать токен"""
    # Деактивируем все токены
    session.query(SavedToken).update({SavedToken.is_active: False})
    
    # Активируем выбранный
    token = session.query(SavedToken).filter(SavedToken.id == token_id).first()
    if token:
        token.is_active = True
        token.last_used = datetime.utcnow()
        session.commit()
        return token
    return None

