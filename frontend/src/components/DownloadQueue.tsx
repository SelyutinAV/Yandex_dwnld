import { AlertCircle, ArrowRight, CheckCircle, Download, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { ProgressBar } from './ui/ProgressBar'

interface Track {
  id: number
  track_id: string
  title: string
  artist: string
  album?: string
  status: 'queued' | 'pending' | 'processing' | 'downloading' | 'completed' | 'error'
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
  const [progressData, setProgressData] = useState({
    is_active: false,
    overall_progress: 0,
    overall_total: 0,
    current_track: null as string | null,
    current_status: null as string | null,
    current_progress: 0
  })
  const { setDownloading, setDownloadProgress, triggerRefresh } = useAppContext()

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    loadQueue()
    loadDownloadStats()

    // Динамический интервал обновления:
    // - Каждые 3 секунды если есть активные загрузки
    // - Каждые 10 секунд если нет активных загрузок
    const interval = setInterval(() => {
      const hasActiveDownloads = tracks.some(t =>
        t.status === 'downloading' || t.status === 'processing' || t.status === 'pending'
      )

      // Обновляем только если есть активные загрузки или это первая загрузка
      if (hasActiveDownloads || tracks.length === 0) {
        loadQueue()
        loadDownloadStats()
        loadProgress()  // Добавляем обновление прогресса
      }
    }, 3000)  // Увеличен интервал до 3 секунд

    return () => clearInterval(interval)
  }, [tracks])  // Зависимость от tracks для определения активных загрузок

  const loadProgress = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/progress')
      if (response.ok) {
        const data = await response.json()
        setProgressData(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки прогресса:', error)
    }
  }

  const loadQueue = async () => {
    // Показываем индикатор загрузки только при первой загрузке
    if (initialLoad) {
      setLoading(true)
    }

    // Показываем индикатор "downloading" только если есть реально загружающиеся треки
    const hasActiveDownloads = tracks.some(t => t.status === 'downloading')

    if (hasActiveDownloads || initialLoad) {
      setDownloading(true)
    } else {
      setDownloading(false)
    }

    try {
      const response = await fetch('http://localhost:8000/api/downloads/queue')

      if (response.ok) {
        const data = await response.json()
        const newQueue = data.queue || []

        // Обновляем только если данные изменились
        if (JSON.stringify(tracks) !== JSON.stringify(newQueue)) {
          setTracks(newQueue)
        }

        // Обновляем прогресс на основе статуса треков
        const downloadingTracks = newQueue.filter((t: Track) => t.status === 'downloading') || []
        if (downloadingTracks.length > 0) {
          const avgProgress = downloadingTracks.reduce((sum: number, t: Track) => sum + t.progress, 0) / downloadingTracks.length
          setDownloadProgress(Math.round(avgProgress))
        } else {
          setDownloadProgress(0)
        }
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

  const loadPauseStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings')
      if (response.ok) {
        const data = await response.json()
        // Предполагаем что есть поле downloads_paused в настройках
        setIsPaused(data.downloads_paused === true || data.downloads_paused === 'true')
      }
    } catch (error) {
      console.error('Ошибка загрузки состояния паузы:', error)
    }
  }

  const loadDownloadStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/stats')
      if (response.ok) {
        const data = await response.json()
        setDownloadStats(data.summary)
      }

      // Также загружаем данные о прогрессе и состоянии паузы
      await loadProgress()
      await loadPauseStatus()
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
      case 'processing':
        return 'Обработка...'
      case 'error':
        return track.error_message || 'Ошибка'
      case 'queued':
        return 'Подготовлен (ожидает запуска)'
      case 'pending':
        return 'В очереди на загрузку'
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
    processing: tracks.filter(t => t.status === 'processing').length,
    pending: tracks.filter(t => t.status === 'pending').length,
    queued: tracks.filter(t => t.status === 'queued').length,
    errors: tracks.filter(t => t.status === 'error').length
  }

  const startDownloadQueue = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/download/queue/start', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        console.log(data.message)
        alert(`✅ Запущена загрузка ${data.count} треков!`)
        await loadQueue()
      } else {
        console.error('Ошибка запуска загрузки')
        alert('❌ Ошибка запуска загрузки')
      }
    } catch (error) {
      console.error('Ошибка запуска загрузки:', error)
      alert('❌ Ошибка запуска загрузки')
    }
  }

  const movePendingToQueue = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/change-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_status: 'pending',
          to_status: 'queued',
          count: 10  // Переводим по 10 треков за раз
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log(data.message)
        alert(`✅ ${data.message}`)
        await loadQueue()
        
        // Автоматически запускаем загрузку после переброса
        setTimeout(async () => {
          await startDownloadQueue()
        }, 1000)
      } else {
        console.error('Ошибка переброса треков')
        alert('❌ Ошибка переброса треков')
      }
    } catch (error) {
      console.error('Ошибка переброса треков:', error)
      alert('❌ Ошибка переброса треков')
    }
  }

  const clearQueuedTracks = async () => {
    if (!confirm(`Вы уверены, что хотите удалить ${stats.queued} подготовленных треков из очереди?`)) {
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/downloads/clear-queued', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        console.log(data.message)
        await loadQueue()
      } else {
        console.error('Ошибка очистки подготовленных треков')
      }
    } catch (error) {
      console.error('Ошибка очистки подготовленных треков:', error)
    }
  }

  return (
    <>
      <div className="w-full">
        {/* Уведомление о подготовленных треках */}
        {stats.queued > 0 && (
          <Card className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-400 dark:border-blue-600">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl animate-bounce">🎵</div>
                <div>
                  <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                    Готово к загрузке!
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300">
                    {stats.queued} {stats.queued === 1 ? 'трек' : stats.queued < 5 ? 'трека' : 'треков'} подготовлено к загрузке.
                    Нажмите кнопку ниже, чтобы начать скачивание.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={startDownloadQueue}
                  size="lg"
                  icon={Play}
                  className="text-xl font-bold shadow-xl hover:shadow-2xl transition-all px-8 py-4"
                >
                  🚀 Запустить загрузку ({stats.queued})
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearQueuedTracks}
                  size="md"
                  icon={Trash2}
                >
                  Очистить
                </Button>
              </div>
            </div>
          </Card>
        )}

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
              {stats.processing > 0 && (
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
                  Обрабатывается: {stats.processing}
                </span>
              )}
              {stats.queued > 0 && (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                  Подготовлено: {stats.queued}
                </span>
              )}
              {stats.pending > 0 && (
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
                  В ожидании: {stats.pending}
                </span>
              )}
              {stats.errors > 0 && (
                <span className="px-3 py-1 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                  Ошибки: {stats.errors}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Прогресс-бар загрузки */}
        <ProgressBar
          overallProgress={progressData.overall_progress}
          overallTotal={progressData.overall_total}
          currentProgress={progressData.current_progress}
          currentFileName={progressData.current_track}
          currentStatus={progressData.current_status}
          isActive={progressData.is_active}
        />

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
          {stats.queued > 0 && (
            <>
              <Button
                variant="primary"
                onClick={startDownloadQueue}
                size="md"
                icon={Play}
                className="text-lg font-bold shadow-lg hover:shadow-xl transition-all animate-pulse"
              >
                🚀 Запустить загрузку ({stats.queued})
              </Button>
              <Button
                variant="error"
                onClick={clearQueuedTracks}
                size="sm"
                icon={Trash2}
              >
                Очистить подготовленные ({stats.queued})
              </Button>
            </>
          )}
          {stats.pending > 0 && (
            <Button
              variant="warning"
              onClick={movePendingToQueue}
              size="md"
              icon={ArrowRight}
              className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
            >
              🔄 Перебросить из ожидания ({stats.pending})
            </Button>
          )}
          {(stats.downloading > 0 || stats.processing > 0 || stats.pending > 0) && (
            <Button
              variant={isPaused ? "success" : "warning"}
              onClick={togglePause}
              icon={isPaused ? Play : Pause}
              size="lg"
              className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
            >
              {isPaused ? '▶️ Возобновить загрузку' : '⏸️ Приостановить загрузку'}
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
                  track.status === 'processing' ? 'border-l-4 border-l-yellow-500' :
                    track.status === 'error' ? 'border-l-4 border-l-error-500' :
                      track.status === 'queued' ? 'border-l-4 border-l-blue-400' :
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
                  {track.status === 'queued' && (
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
                      <div className="bg-blue-400 h-3 rounded-full w-0"></div>
                    </div>
                  )}
                  {(track.status === 'downloading' || track.status === 'processing' || track.status === 'pending') && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ease-out ${track.status === 'downloading' ? 'bg-gradient-to-r from-primary-500 to-secondary-500' :
                          track.status === 'processing' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                        style={{ width: `${track.status === 'processing' ? 50 : track.progress}%` }}
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
    </>
  )
}

export default DownloadQueue