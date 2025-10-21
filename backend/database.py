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


# Создание базы данных
def init_database(db_url: str = None):
    """
    Инициализация базы данных
    
    Args:
        db_url: URL базы данных (если не указан, берется из env)
    """
    if not db_url:
        db_url = os.getenv('DATABASE_URL', 'sqlite:///yandex_music.db')
    
    # Исправляем URL для синхронного SQLite
    if 'sqlite+aiosqlite' in db_url:
        db_url = db_url.replace('sqlite+aiosqlite', 'sqlite')
    
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

