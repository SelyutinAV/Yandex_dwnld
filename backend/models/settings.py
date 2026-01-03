"""Модели для настроек"""

from typing import Optional
from pydantic import BaseModel


class Settings(BaseModel):
    token: str
    downloadPath: str
    quality: str
    autoSync: bool = False
    syncInterval: int = 24
    fileTemplate: Optional[str] = "{artist} - {title}"
    folderStructure: Optional[str] = "{artist}/{album}"


class CreateFolderRequest(BaseModel):
    path: str


class ListFoldersRequest(BaseModel):
    path: str = "/"


class ScanRequest(BaseModel):
    path: str

