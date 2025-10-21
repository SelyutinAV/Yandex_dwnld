import { AlertCircle, CheckCircle, Download, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
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
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [downloadStats, setDownloadStats] = useState({
    totalInQueue: 0,
    completedInQueue: 0,
    downloadingInQueue: 0,
    pendingInQueue: 0,
    errorsInQueue: 0,
    totalDownloaded: 0,
    totalSizeMB: 0,
    totalSizeGB: 0
  })
  const { setDownloading, setDownloadProgress, triggerRefresh } = useAppContext()

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    loadQueue()
    loadDownloadStats()

    // Обновляем очередь каждые 2 секунды для более плавного прогресса
    const interval = setInterval(() => {
      loadQueue()
      loadDownloadStats()
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const loadQueue = async () => {
    // Показываем индикатор загрузки только при первой загрузке
    if (initialLoad) {
      setLoading(true)
    }
    setDownloading(true)
    try {
      console.log('Загружаем очередь загрузок...')
      const response = await fetch('http://localhost:8000/api/downloads/queue')
      console.log('Ответ сервера:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('Данные очереди:', data)
        setTracks(data.queue || [])

        // Обновляем прогресс на основе статуса треков
        const downloadingTracks = data.queue?.filter((t: Track) => t.status === 'downloading') || []
        if (downloadingTracks.length > 0) {
          const avgProgress = downloadingTracks.reduce((sum: number, t: Track) => sum + t.progress, 0) / downloadingTracks.length
          setDownloadProgress(Math.round(avgProgress))
        } else {
          setDownloadProgress(0)
        }
      } else {
        console.error('Ошибка ответа сервера:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Ошибка загрузки очереди:', error)
    } finally {
      if (initialLoad) {
        setLoading(false)
        setInitialLoad(false)
      }
      setDownloading(false)
    }
  }

  const loadDownloadStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/stats')
      if (response.ok) {
        const data = await response.json()
        setDownloadStats(data.summary)
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error)
    }
  }

  const togglePause = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paused: !isPaused })
      })

      if (response.ok) {
        setIsPaused(!isPaused)
      } else {
        console.error('Ошибка изменения состояния паузы')
      }
    } catch (error) {
      console.error('Ошибка изменения состояния паузы:', error)
    }
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

  const toggleTrackSelection = (trackId: string) => {
    const newSelection = new Set(selectedTracks)
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId)
    } else {
      newSelection.add(trackId)
    }
    setSelectedTracks(newSelection)
  }

  const selectAllTracks = () => {
    setSelectedTracks(new Set(tracks.map(t => t.track_id)))
  }

  const clearSelection = () => {
    setSelectedTracks(new Set())
  }

  const retrySelectedTracks = async () => {
    for (const trackId of selectedTracks) {
      await retryTrack(trackId)
    }
    clearSelection()
  }

  const removeSelectedTracks = async () => {
    for (const trackId of selectedTracks) {
      await removeTrack(trackId)
    }
    clearSelection()
  }

  const clearCompleted = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/clear-completed', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        console.log(data.message)
        // Обновляем очередь
        await loadQueue()
      } else {
        console.error('Ошибка очистки завершенных загрузок')
      }
    } catch (error) {
      console.error('Ошибка очистки завершенных загрузок:', error)
    }
  }

  const addTestTrack = async () => {
    const testTracks = [
      { track_id: `test_${Date.now()}`, title: "Test Track", artist: "Test Artist", album: "Test Album", quality: "lossless" },
      { track_id: `test_${Date.now() + 1}`, title: "Another Track", artist: "Another Artist", album: "Another Album", quality: "hq" }
    ]

    for (const track of testTracks) {
      try {
        const response = await fetch('http://localhost:8000/api/downloads/add-to-queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(track)
        })

        if (response.ok) {
          console.log(`Добавлен тестовый трек: ${track.title}`)

          // Симулируем прогресс загрузки
          simulateProgress(track.track_id)
        }
      } catch (error) {
        console.error('Ошибка добавления тестового трека:', error)
      }
    }

    // Обновляем очередь и уведомляем другие компоненты
    await loadQueue()
    triggerRefresh()
  }

  const simulateProgress = async (trackId: string) => {
    // Симулируем прогресс загрузки
    for (let progress = 0; progress <= 100; progress += 10) {
      try {
        await fetch(`http://localhost:8000/api/downloads/${trackId}/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ progress })
        })

        // Небольшая задержка между обновлениями
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Ошибка обновления прогресса:', error)
      }
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
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Очередь загрузок</h2>
          <div className="mt-2 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>📥 Всего скачано: <strong className="text-success-600 dark:text-success-400">{downloadStats.totalDownloaded}</strong></span>
            <span>💾 Размер: <strong className="text-primary-600 dark:text-primary-400">{downloadStats.totalSizeGB.toFixed(1)} ГБ</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg">
              В очереди: {stats.total}
            </span>
            <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-lg">
              Завершено: {stats.completed}
            </span>
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg">
              Загружается: {stats.downloading}
            </span>
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
              В ожидании: {stats.pending}
            </span>
            {stats.errors > 0 && (
              <span className="px-3 py-1 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                Ошибки: {stats.errors}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedTracks.size > 0 && (
              <>
                <Button
                  variant="success"
                  onClick={retrySelectedTracks}
                  icon={RotateCcw}
                  size="sm"
                >
                  Повторить ({selectedTracks.size})
                </Button>
                <Button
                  variant="error"
                  onClick={removeSelectedTracks}
                  icon={Trash2}
                  size="sm"
                >
                  Удалить ({selectedTracks.size})
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearSelection}
                  size="sm"
                >
                  Отменить выбор
                </Button>
              </>
            )}
            {tracks.length > 0 && selectedTracks.size === 0 && (
              <Button
                variant="secondary"
                onClick={selectAllTracks}
                size="sm"
              >
                Выбрать все
              </Button>
            )}
            {tracks.length === 0 && (
              <Button
                variant="primary"
                onClick={addTestTrack}
                size="sm"
              >
                Добавить тестовые треки
              </Button>
            )}
            {stats.completed > 0 && (
              <Button
                variant="secondary"
                onClick={clearCompleted}
                size="sm"
                icon={Trash2}
              >
                Очистить завершенные ({stats.completed})
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={togglePause}
              icon={isPaused ? Play : Pause}
            >
              {isPaused ? 'Возобновить' : 'Приостановить'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <Card className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Download size={64} className="mb-4 animate-pulse" />
            <h3 className="text-xl font-semibold mb-2">Загрузка данных...</h3>
            <p>Получаем информацию о загрузках</p>
          </Card>
        ) : tracks.length === 0 ? (
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
                {/* Чекбокс выбора */}
                <div className="md:col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.track_id)}
                    onChange={() => toggleTrackSelection(track.track_id)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

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
                  {(track.status === 'downloading' || track.status === 'pending') && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ease-out ${track.status === 'downloading'
                          ? 'bg-gradient-to-r from-primary-500 to-secondary-500'
                          : 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                          }`}
                        style={{ width: `${track.progress}%` }}
                      ></div>
                    </div>
                  )}
                  {track.status === 'completed' && (
                    <div className="w-full bg-success-200 dark:bg-success-800 rounded-full h-3">
                      <div className="bg-success-500 h-3 rounded-full w-full"></div>
                    </div>
                  )}
                  {track.status === 'error' && (
                    <div className="w-full bg-error-200 dark:bg-error-800 rounded-full h-3">
                      <div className="bg-error-500 h-3 rounded-full w-full"></div>
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