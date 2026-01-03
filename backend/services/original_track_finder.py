"""
Сервис для поиска оригинальных треков в открытых каталогах
"""

import requests
import time
from typing import Optional, Dict, List
import logging

logger = logging.getLogger("original_finder")


class OriginalTrackFinder:
    """Поиск оригинальных треков в открытых каталогах"""

    def __init__(self):
        self.musicbrainz_base_url = "https://musicbrainz.org/ws/2"
        self.user_agent = "YandexMusicDownloader/1.0 (https://github.com/your-repo)"
        self.last_request_time = 0
        self.min_request_interval = 1.0  # Минимум 1 секунда между запросами (лимит MusicBrainz)

    def _rate_limit(self):
        """Соблюдение лимита запросов к MusicBrainz"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_request_interval:
            time.sleep(self.min_request_interval - time_since_last)
        self.last_request_time = time.time()

    def search_musicbrainz(
        self, artist: str, title: str, album: str = None, year: int = None
    ) -> Optional[Dict]:
        """
        Поиск трека в MusicBrainz API

        Args:
            artist: Имя исполнителя
            title: Название трека
            album: Название альбома (опционально)
            year: Год релиза (опционально)

        Returns:
            Словарь с информацией о найденном треке или None
        """
        try:
            self._rate_limit()

            # Формируем запрос для MusicBrainz
            query_parts = []
            
            # Экранируем кавычки в запросе
            artist_escaped = artist.replace('"', '\\"')
            title_escaped = title.replace('"', '\\"')
            
            query_parts.append(f'artist:"{artist_escaped}"')
            query_parts.append(f'recording:"{title_escaped}"')
            
            if album:
                album_escaped = album.replace('"', '\\"')
                query_parts.append(f'release:"{album_escaped}"')
            
            if year:
                query_parts.append(f'date:{year}')

            query = " AND ".join(query_parts)

            params = {
                "query": query,
                "fmt": "json",
                "limit": 5,
            }

            headers = {
                "User-Agent": self.user_agent,
                "Accept": "application/json",
            }

            logger.info(f"🔍 Поиск в MusicBrainz: {artist} - {title}")

            response = requests.get(
                f"{self.musicbrainz_base_url}/recording",
                params=params,
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("recordings") and len(data["recordings"]) > 0:
                    # Возвращаем первый результат
                    recording = data["recordings"][0]
                    
                    # Извлекаем информацию о релизах
                    releases = []
                    if "releases" in recording:
                        for release in recording["releases"][:5]:  # Берем первые 5 релизов
                            release_info = {
                                "title": release.get("title", ""),
                                "date": release.get("date", ""),
                                "country": release.get("country", ""),
                            }
                            # Пытаемся получить лейбл из release-group
                            if "release-group" in release:
                                rg = release["release-group"]
                                if "label-info" in rg:
                                    labels = [li.get("label", {}).get("name", "") for li in rg.get("label-info", [])]
                                    if labels:
                                        release_info["label"] = labels[0]
                            releases.append(release_info)
                    
                    # Извлекаем ISRC коды
                    isrcs = []
                    if "isrcs" in recording:
                        isrcs = recording["isrcs"]
                    
                    # Извлекаем имя исполнителя
                    artist_name = artist
                    if "artist-credit" in recording and len(recording["artist-credit"]) > 0:
                        artist_name = recording["artist-credit"][0].get("name", artist)

                    result = {
                        "mbid": recording.get("id"),
                        "title": recording.get("title", title),
                        "artist": artist_name,
                        "releases": releases,
                        "isrcs": isrcs,
                        "source": "musicbrainz",
                    }
                    
                    logger.info(f"✅ Найден в MusicBrainz: {result['title']} - {result['artist']}")
                    return result
                else:
                    logger.info(f"⚠️  Не найдено в MusicBrainz: {artist} - {title}")
            else:
                logger.warning(
                    f"⚠️  Ошибка запроса к MusicBrainz: статус {response.status_code}"
                )

            return None
        except requests.RequestException as e:
            logger.error(f"❌ Ошибка сети при запросе к MusicBrainz: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при поиске в MusicBrainz: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    def find_alternative(
        self,
        track_id: str,
        title: str,
        artist: str,
        album: str = None,
        year: int = None,
        isrc: str = None,
    ) -> Dict:
        """
        Найти альтернативную версию трека

        Args:
            track_id: ID трека в локальной БД
            title: Название трека
            artist: Имя исполнителя
            album: Название альбома (опционально)
            year: Год релиза (опционально)
            isrc: ISRC код трека (опционально)

        Returns:
            Словарь с результатом поиска
        """
        # Если есть ISRC, можно использовать его для более точного поиска
        # Но MusicBrainz API не поддерживает прямой поиск по ISRC через recording endpoint
        # Можно использовать lookup, но это требует MBID
        
        # Ищем в MusicBrainz
        result = self.search_musicbrainz(artist, title, album, year)

        if result:
            return {
                "track_id": track_id,
                "found": True,
                "source": result["source"],
                "mbid": result.get("mbid"),
                "title": result.get("title"),
                "artist": result.get("artist"),
                "releases": result.get("releases", []),
                "isrcs": result.get("isrcs", []),
            }

        return {
            "track_id": track_id,
            "found": False,
            "message": "Аналог не найден в открытых каталогах",
        }

