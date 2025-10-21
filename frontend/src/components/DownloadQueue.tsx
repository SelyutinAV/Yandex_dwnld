import { AlertCircle, CheckCircle, Download, Pause, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface Track {
  id: number
  track_id: string
  title: string
  artist: string
  album?: string
  status: 'pending' | 'downloading' | 'completed' | 'error'
  progress: number
  quality?: string
  error_message?: string
  created_at: string
  updated_at: string
}

function DownloadQueue() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [loading, setLoading] = useState(false)

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    loadQueue()

    // Обновляем очередь каждые 5 секунд
    const interval = setInterval(loadQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadQueue = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/downloads/queue')
      if (response.ok) {
        const data = await response.json()
        setTracks(data.queue || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки очереди:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
    // TODO: Реализовать паузу/возобновление загрузки на сервере
  }

  const removeTrack = async (trackId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/downloads/${trackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Обновляем локальное состояние
        setTracks(tracks.filter(t => t.track_id !== trackId))
      } else {
        console.error('Ошибка удаления трека из очереди')
      }
    } catch (error) {
      console.error('Ошибка удаления трека:', error)
    }
  }

  const retryTrack = async (trackId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/downloads/${trackId}/retry`, {
        method: 'POST'
      })

      if (response.ok) {
        // Обновляем локальное состояние
        setTracks(tracks.map(t =>
          t.track_id === trackId ? { ...t, status: 'pending' as const, error_message: undefined, progress: 0 } : t
        ))
      } else {
        console.error('Ошибка повторной загрузки трека')
      }
    } catch (error) {
      console.error('Ошибка повторной загрузки:', error)
    }
  }

  const getStatusIcon = (status: Track['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="text-success-500" />
      case 'downloading':
        return <Download size={20} className="text-primary-500 animate-pulse" />
      case 'error':
        return <AlertCircle size={20} className="text-error-500" />
      default:
        return <Download size={20} className="text-gray-400" />
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
        return track.error_message || 'Ошибка'
      default:
        return 'В очереди'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const stats = {
    total: tracks.length,
    completed: tracks.filter(t => t.status === 'completed').length,
    downloading: tracks.filter(t => t.status === 'downloading').length,
    pending: tracks.filter(t => t.status === 'pending').length,
    errors: tracks.filter(t => t.status === 'error').length
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Очередь загрузок</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg">
              Всего: {stats.total}
            </span>
            <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-lg">
              Завершено: {stats.completed}
            </span>
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg">
              Загружается: {stats.downloading}
            </span>
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
              В очереди: {stats.pending}
            </span>
            {stats.errors > 0 && (
              <span className="px-3 py-1 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                Ошибки: {stats.errors}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={togglePause}
            icon={isPaused ? Play : Pause}
          >
            {isPaused ? 'Возобновить' : 'Приостановить'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {tracks.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Download size={64} className="mb-4" />
            <h3 className="text-xl font-semibold mb-2">Очередь пуста</h3>
            <p>Выберите плейлисты для синхронизации</p>
          </Card>
        ) : (
          tracks.map(track => (
            <Card
              key={track.id}
              className={`p-4 transition-all duration-200 ${track.status === 'completed' ? 'border-l-4 border-l-success-500' :
                track.status === 'downloading' ? 'border-l-4 border-l-primary-500' :
                  track.status === 'error' ? 'border-l-4 border-l-error-500' :
                    'border-l-4 border-l-gray-300 dark:border-l-gray-600'
                }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Статус */}
                <div className="md:col-span-1 flex justify-center">
                  {getStatusIcon(track.status)}
                </div>

                {/* Информация о треке */}
                <div className="md:col-span-4 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {track.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {track.artist}
                  </div>
                  {track.album && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {track.album}
                    </div>
                  )}
                </div>

                {/* Детали качества */}
                <div className="md:col-span-2 text-right">
                  <div className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {track.quality || '—'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDate(track.created_at)}
                  </div>
                </div>

                {/* Прогресс */}
                <div className="md:col-span-4 min-w-0">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {getStatusText(track)}
                  </div>
                  {track.status === 'downloading' && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${track.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Действия */}
                <div className="md:col-span-1 flex justify-end gap-2">
                  {track.status === 'error' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => retryTrack(track.track_id)}
                      icon={Play}
                      className="p-2"
                    >
                      Повторить
                    </Button>
                  )}
                  <Button
                    variant="error"
                    size="sm"
                    onClick={() => removeTrack(track.track_id)}
                    icon={X}
                    className="p-2"
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default DownloadQueue