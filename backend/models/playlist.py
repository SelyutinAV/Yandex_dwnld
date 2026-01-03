"""Модели для плейлистов"""

from typing import Optional
from pydantic import BaseModel


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

