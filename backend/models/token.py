"""Модели для токенов и аккаунтов"""

from typing import Optional
from pydantic import BaseModel


class TokenTest(BaseModel):
    token: str


class DualTokenTest(BaseModel):
    oauth_token: str
    session_id_token: str


class SaveTokenRequest(BaseModel):
    name: str
    token: str
    username: Optional[str] = None


class ActivateTokenRequest(BaseModel):
    token_id: int


class RenameTokenRequest(BaseModel):
    name: str


class SaveAccountRequest(BaseModel):
    name: str
    oauth_token: Optional[str] = None
    session_id_token: Optional[str] = None
    username: Optional[str] = None


class ActivateAccountRequest(BaseModel):
    account_id: int


class RenameAccountRequest(BaseModel):
    name: str

