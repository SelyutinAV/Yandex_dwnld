import { CheckCircle, Download, Music, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import './PlaylistManager.css'

interface Playlist {
  id: string
  title: string
  trackCount: number
  cover?: string
  isSynced: boolean
  lastSync?: string
}

function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())

  // Функция для загрузки плейлистов с API
  const loadPlaylists = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/playlists')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setPlaylists(data)
    } catch (error) {
      console.error('Ошибка загрузки плейлистов:', error)
      // Показываем пример данных в случае ошибки
      setPlaylists([
        {
          id: '1',
          title: 'Любимые треки (демо)',
          trackCount: 156,
          isSynced: true,
          lastSync: '2025-10-20T10:30:00'
        },
        {
          id: '2',
          title: 'Audiophile Collection (демо)',
          trackCount: 89,
          isSynced: false
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlaylists()
  }, [])

  const togglePlaylistSelection = (id: string) => {
    const newSelection = new Set(selectedPlaylists)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedPlaylists(newSelection)
  }

  const syncSelectedPlaylists = async () => {
    if (selectedPlaylists.size === 0) return

    try {
      for (const playlistId of selectedPlaylists) {
        const response = await fetch('http://localhost:8000/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playlistId: playlistId,
            quality: 'lossless'
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        console.log(`Синхронизация плейлиста ${playlistId}:`, result)
      }

      // Обновляем список плейлистов после синхронизации
      await loadPlaylists()
    } catch (error) {
      console.error('Ошибка синхронизации плейлистов:', error)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Никогда'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="playlist-manager">
      <div className="manager-header">
        <h2>Мои плейлисты</h2>
        <div className="header-actions">
          <button onClick={loadPlaylists} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            Обновить
          </button>
          <button
            onClick={syncSelectedPlaylists}
            disabled={selectedPlaylists.size === 0}
            className="primary"
          >
            <Download size={18} />
            Синхронизировать ({selectedPlaylists.size})
          </button>
        </div>
      </div>

      {loading && playlists.length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={48} className="spin" />
          <p>Загрузка плейлистов...</p>
        </div>
      ) : (
        <div className="playlist-grid">
          {playlists.map(playlist => (
            <div
              key={playlist.id}
              className={`playlist-card ${selectedPlaylists.has(playlist.id) ? 'selected' : ''}`}
              onClick={() => togglePlaylistSelection(playlist.id)}
            >
              <div className="playlist-cover">
                {playlist.cover ? (
                  <img src={playlist.cover} alt={playlist.title} />
                ) : (
                  <div className="cover-placeholder">
                    <Music size={48} />
                  </div>
                )}
                {playlist.isSynced && (
                  <div className="sync-badge">
                    <CheckCircle size={16} />
                  </div>
                )}
              </div>
              <div className="playlist-info">
                <h3>{playlist.title}</h3>
                <p className="track-count">{playlist.trackCount} треков</p>
                <p className="last-sync">
                  Последняя синхронизация: {formatDate(playlist.lastSync)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <div className="empty-state">
          <Music size={64} />
          <h3>Плейлисты не найдены</h3>
          <p>Подключитесь к Яндекс.Музыке в настройках</p>
        </div>
      )}
    </div>
  )
}

export default PlaylistManager

