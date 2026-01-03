"""Модели для загрузок"""

from typing import Dict, List
from pydantic import BaseModel


class DownloadRequest(BaseModel):
    playlist_id: str
    quality: str = "lossless"


class ProgressUpdateRequest(BaseModel):
    progress: int


class AddTracksToQueueRequest(BaseModel):
    tracks: List[Dict]  # [{id, title, artist, album}, ...]
    quality: str = "lossless"


class RemoveTracksRequest(BaseModel):
    track_ids: List[str]


class ChangeStatusRequest(BaseModel):
    from_status: str
    to_status: str
    count: int = 10


class PauseRequest(BaseModel):
    paused: bool


class TrackIdRequest(BaseModel):
    track_id: str

