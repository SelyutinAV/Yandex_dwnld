import { useState, useEffect } from 'react'
import { Pause, Play, X, Download, CheckCircle, AlertCircle } from 'lucide-react'
import './DownloadQueue.css'

interface Track {
  id: string
  title: string
  artist: string
  album?: string
  status: 'pending' | 'downloading' | 'completed' | 'error'
  progress: number
  quality?: string
  fileSize?: number
  error?: string
}

function DownloadQueue() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPaused, setIsPaused] = useState(false)

  // Пример данных для демонстрации
  useEffect(() => {
    setTracks([
      {
        id: '1',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        status: 'completed',
        progress: 100,
        quality: 'FLAC 24-bit/96kHz',
        fileSize: 87.3
      },
      {
        id: '2',
        title: 'Hotel California',
        artist: 'Eagles',
        album: 'Hotel California',
        status: 'downloading',
        progress: 67,
        quality: 'FLAC 24-bit/96kHz',
        fileSize: 92.1
      },
      {
        id: '3',
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        album: 'Led Zeppelin IV',
        status: 'pending',
        progress: 0,
        quality: 'FLAC 24-bit/96kHz'
      },
      {
        id: '4',
        title: 'Comfortably Numb',
        artist: 'Pink Floyd',
        album: 'The Wall',
        status: 'error',
        progress: 0,
        error: 'Ошибка сети'
      }
    ])
  }, [])

  const togglePause = () => {
    setIsPaused(!isPaused)
    // TODO: Реализовать паузу/возобновление загрузки
  }

  const removeTrack = (id: string) => {
    setTracks(tracks.filter(t => t.id !== id))
    // TODO: Отменить загрузку на сервере
  }

  const retryTrack = (id: string) => {
    setTracks(tracks.map(t => 
      t.id === id ? { ...t, status: 'pending' as const, error: undefined } : t
    ))
    // TODO: Повторить загрузку
  }

  const getStatusIcon = (status: Track['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="status-icon completed" />
      case 'downloading':
        return <Download size={20} className="status-icon downloading" />
      case 'error':
        return <AlertCircle size={20} className="status-icon error" />
      default:
        return <Download size={20} className="status-icon pending" />
    }
  }

  const formatFileSize = (mb?: number) => {
    if (!mb) return '—'
    return `${mb.toFixed(1)} МБ`
  }

  const getStatusText = (track: Track) => {
    switch (track.status) {
      case 'completed':
        return 'Завершено'
      case 'downloading':
        return `Загрузка... ${track.progress}%`
      case 'error':
        return track.error || 'Ошибка'
      default:
        return 'В очереди'
    }
  }

  const stats = {
    total: tracks.length,
    completed: tracks.filter(t => t.status === 'completed').length,
    downloading: tracks.filter(t => t.status === 'downloading').length,
    errors: tracks.filter(t => t.status === 'error').length
  }

  return (
    <div className="download-queue">
      <div className="queue-header">
        <h2>Очередь загрузок</h2>
        <div className="queue-stats">
          <span>Всего: {stats.total}</span>
          <span className="stat-completed">Завершено: {stats.completed}</span>
          <span className="stat-downloading">Загружается: {stats.downloading}</span>
          {stats.errors > 0 && <span className="stat-errors">Ошибки: {stats.errors}</span>}
        </div>
        <button onClick={togglePause} className="control-button">
          {isPaused ? <Play size={18} /> : <Pause size={18} />}
          {isPaused ? 'Возобновить' : 'Приостановить'}
        </button>
      </div>

      <div className="tracks-list">
        {tracks.length === 0 ? (
          <div className="empty-queue">
            <Download size={64} />
            <h3>Очередь пуста</h3>
            <p>Выберите плейлисты для синхронизации</p>
          </div>
        ) : (
          tracks.map(track => (
            <div key={track.id} className={`track-item ${track.status}`}>
              <div className="track-status">
                {getStatusIcon(track.status)}
              </div>
              
              <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist}</div>
                {track.album && <div className="track-album">{track.album}</div>}
              </div>

              <div className="track-details">
                <div className="track-quality">{track.quality || '—'}</div>
                <div className="track-size">{formatFileSize(track.fileSize)}</div>
              </div>

              <div className="track-progress-container">
                <div className="track-status-text">{getStatusText(track)}</div>
                {track.status === 'downloading' && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${track.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>

              <div className="track-actions">
                {track.status === 'error' && (
                  <button 
                    onClick={() => retryTrack(track.id)}
                    className="retry-button"
                    title="Повторить"
                  >
                    <Play size={16} />
                  </button>
                )}
                <button 
                  onClick={() => removeTrack(track.id)}
                  className="remove-button"
                  title="Удалить из очереди"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default DownloadQueue

