import { AlertCircle, CheckCircle, Download, Music, Pause, Play, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
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
  cover?: string
  status: 'pending' | 'queued' | 'processing' | 'downloading' | 'completed' | 'error'
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null) // Новое состояние для фильтра
  const [downloadStats, setDownloadStats] = useState({
    totalInQueue: 0,
    completedInQueue: 0,
    downloadingInQueue: 0,
    pendingInQueue: 0,
    queuedInQueue: 0,
    errorsInQueue: 0,
    totalDownloaded: 0,
    totalSizeMB: 0,
    totalSizeGB: 0,
    totalInSession: 0  // Общее количество треков в очереди
  })
  const [progressData, setProgressData] = useState({
    is_active: false,
    overall_progress: 0,
    overall_total: 0,
    current_track: null as string | null,
    current_status: null as string | null,
    current_progress: 0
  })
  const { triggerRefresh } = useAppContext()

  // Функция для фильтрации треков по статусу
  const getFilteredTracks = () => {
    let filteredTracks = tracks;

    if (statusFilter) {
      if (statusFilter === 'pending') {
        // Для фильтра "pending" показываем треки со статусами 'pending' и 'queued'
        filteredTracks = tracks.filter(track => track.status === 'pending' || track.status === 'queued')
      } else {
        filteredTracks = tracks.filter(track => track.status === statusFilter)
      }
    }

    // Сортируем треки: загружающиеся вверху, остальные по дате создания
    return filteredTracks.sort((a, b) => {
      // Приоритет для загружающихся треков
      if (a.status === 'downloading' && b.status !== 'downloading') return -1;
      if (b.status === 'downloading' && a.status !== 'downloading') return 1;

      // Если оба загружаются или оба не загружаются, сортируем по дате
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    loadQueue()
    loadDownloadStats()

    // Динамический интервал обновления:
    // - Каждые 3 секунды если есть активные загрузки
    // - Каждые 10 секунд если нет активных загрузок
    const interval = setInterval(() => {
      const hasActiveDownloads = tracks.some(t =>
        t.status === 'downloading' || t.status === 'processing' || t.status === 'pending' || t.status === 'queued'
      )

      // ТОЧКА КОНТРОЛЯ: Логируем решение об обновлении
      console.log('⏰ Интервал обновления:', {
        hasActiveDownloads,
        tracksLength: tracks.length,
        willUpdate: hasActiveDownloads || tracks.length === 0,
        timestamp: new Date().toISOString()
      })

      // Обновляем только если есть активные загрузки или это первая загрузка
      if (hasActiveDownloads || tracks.length === 0) {
        loadQueue()
        loadDownloadStats()
        loadProgress()  // Добавляем обновление прогресса
      } else {
        // Если нет активных загрузок, обновляем только статистику (для отображения обновленных данных)
        loadDownloadStats()
      }
      
      // ВСЕГДА обновляем статистику для отображения актуальных данных
      loadDownloadStats()
    }, 3000)  // Увеличен интервал до 3 секунд

    return () => clearInterval(interval)
  }, [tracks])  // Зависимость от tracks для определения активных загрузок

  const loadProgress = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/progress')
      if (response.ok) {
        const data = await response.json()

        // ТОЧКА КОНТРОЛЯ: Логируем изменения прогресса
        const oldProgress = progressData.overall_progress
        const oldTotal = progressData.overall_total
        const oldActive = progressData.is_active

        if (oldProgress !== data.overall_progress || oldTotal !== data.overall_total || oldActive !== data.is_active) {
          console.log('🔄 ProgressBar обновление:', {
            old: { progress: oldProgress, total: oldTotal, active: oldActive },
            new: { progress: data.overall_progress, total: data.overall_total, active: data.is_active },
            timestamp: new Date().toISOString()
          })
        }

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

    try {
      // Используем новый API эндпоинт
      const response = await fetch('http://localhost:8000/api/queue/list')

      if (response.ok) {
        const data = await response.json()
        const newQueue = data.queue || []

        // Обновляем только если данные изменились
        if (JSON.stringify(tracks) !== JSON.stringify(newQueue)) {
          setTracks(newQueue)
          // Принудительно обновляем статистику при изменении очереди
          loadDownloadStats()
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки очереди:', error)
    } finally {
      if (initialLoad) {
        setLoading(false)
        setInitialLoad(false)
      }
    }
  }


  const loadDownloadStats = async () => {
    try {
      // Используем новый API для статистики очереди
      const response = await fetch('http://localhost:8000/api/queue/stats')
      if (response.ok) {
        const data = await response.json()
        
        // Получаем общую статистику
        const generalStats = data.general_stats || {}
        
        // Получаем статистику текущей сессии
        const sessionStats = data.session_stats || {}
        
        // Преобразуем данные в формат, ожидаемый компонентом
        setDownloadStats({
          // Общая статистика
          totalInQueue: generalStats.total_files || 0,
          totalDownloaded: generalStats.total_files || 0,
          totalSizeMB: generalStats.total_size_mb || 0,
          totalSizeGB: generalStats.total_size_gb || 0,
          
          // Статистика текущей сессии
          completedInQueue: sessionStats.completed || 0,
          downloadingInQueue: sessionStats.downloading || 0,
          pendingInQueue: sessionStats.pending || 0,
          queuedInQueue: sessionStats.queued || 0,
          errorsInQueue: sessionStats.errors || 0,
          totalInSession: sessionStats.total_in_queue || 0  // Общее количество треков в очереди
        })

        // Обновляем состояние паузы
        const systemState = data.system_state || {}
        setIsPaused(systemState.is_paused === true)

        // НЕ сбрасываем progressData здесь - это вызывает прыжки!
        // setProgressData будет обновлен в loadProgress()
      }

      // Также загружаем данные о прогрессе
      await loadProgress()
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error)
    }
  }

  const togglePause = async () => {
    try {
      // Используем новые эндпоинты паузы/возобновления
      const endpoint = isPaused ? '/api/queue/resume' : '/api/queue/pause'
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST'
      })

      if (response.ok) {
        setIsPaused(!isPaused)
        await loadQueue()
      } else {
        console.error('Ошибка изменения состояния паузы')
      }
    } catch (error) {
      console.error('Ошибка изменения состояния паузы:', error)
    }
  }

  const restartWorker = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/queue/restart', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Воркер перезапущен:', result)

        // Обновляем состояние
        setIsPaused(false)
        await loadQueue()
        await loadProgress()
      } else {
        console.error('Ошибка перезапуска воркера')
      }
    } catch (error) {
      console.error('Ошибка перезапуска воркера:', error)
    }
  }

  const removeTrack = async (trackId: string) => {
    try {
      // Используем новый эндпоинт удаления
      const response = await fetch(`http://localhost:8000/api/queue/track/${trackId}`, {
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
      // Используем новый эндпоинт
      const response = await fetch('http://localhost:8000/api/queue/clear-completed', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`Удалено ${data.deleted} треков`)
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

  const getStatusText = (track: Track) => {
    switch (track.status) {
      case 'completed':
        return 'Завершено'
      case 'downloading':
        return `Загрузка... ${Math.min(Math.max(track.progress || 0, 0), 100)}%`
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


  const startDownloadQueue = async () => {
    try {
      // Используем новый эндпоинт
      const response = await fetch('http://localhost:8000/api/queue/start', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === 'started') {
          console.log(`✅ Запущена загрузка ${data.queued} треков`)
        } else if (data.status === 'empty') {
          console.log('⚠️ Нет треков для загрузки')
        }
        await loadQueue()
      } else {
        console.error('Ошибка запуска загрузки')
      }
    } catch (error) {
      console.error('Ошибка запуска загрузки:', error)
    }
  }


  return (
    <>
      <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Очередь загрузок</h2>
          </div>

          {/* Плашка статуса */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border-l-4 border-purple-500">
            <div className="text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400 font-semibold mb-1">
              Статус
            </div>
            <div className="text-lg font-bold text-purple-900 dark:text-purple-200">
              {progressData.is_active ? (isPaused ? '⏸️ Пауза' : '▶️ Работает') : '⏹️ Остановлен'}
            </div>
          </div>
        </div>

        {/* Индикатор активного фильтра */}
        {statusFilter && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  🔍 Фильтр активен:
                </span>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-sm font-semibold">
                  {statusFilter === 'pending' ? 'Ожидает' :
                    statusFilter === 'downloading' ? 'Скачивается' :
                      statusFilter === 'completed' ? 'Завершено' :
                        statusFilter === 'error' ? 'Ошибки' : statusFilter}
                </span>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  ({getFilteredTracks().length} из {tracks.length})
                </span>
              </div>
              <button
                onClick={() => setStatusFilter(null)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
              >
                ✕ Сбросить фильтр
              </button>
            </div>
          </div>
        )}

        {/* Общая статистика */}
        <Card className="mb-6 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            📈 Общая статистика
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Всего файлов */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border-l-4 border-green-500">
              <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-400 font-semibold mb-1">
                Всего файлов
              </div>
              <div className="text-3xl font-bold text-green-900 dark:text-green-200">
                {downloadStats.totalInQueue}
              </div>
            </div>

            {/* Общий размер */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold mb-1">
                Общий размер
              </div>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-200">
                {downloadStats.totalSizeGB.toFixed(1)} ГБ
              </div>
            </div>

            {/* Размер в МБ */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400 font-semibold mb-1">
                Размер (МБ)
              </div>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-200">
                {downloadStats.totalSizeMB.toFixed(0)}
              </div>
            </div>
          </div>
        </Card>

        {/* Статистика текущей сессии */}
        <Card className="mb-6 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            📋 Текущая сессия
          </h3>
          <div className="grid grid-cols-6 gap-3">
            {/* Ожидает */}
            <div
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-3 border-l-4 border-yellow-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === 'pending' ? 'ring-2 ring-yellow-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'pending' ? null : 'pending')}
            >
              <div className="text-xs uppercase tracking-wide text-yellow-700 dark:text-yellow-400 font-semibold mb-1">
                Ожидает
              </div>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
                {downloadStats.pendingInQueue}
              </div>
            </div>

            {/* В очереди */}
            <div
              className={`bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-3 border-l-4 border-orange-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === 'queued' ? 'ring-2 ring-orange-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'queued' ? null : 'queued')}
            >
              <div className="text-xs uppercase tracking-wide text-orange-700 dark:text-orange-400 font-semibold mb-1">
                В очереди
              </div>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                {downloadStats.queuedInQueue}
              </div>
            </div>

            {/* Скачивается */}
            <div
              className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3 border-l-4 border-blue-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === 'downloading' ? 'ring-2 ring-blue-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'downloading' ? null : 'downloading')}
            >
              <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold mb-1">
                Скачивается
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {downloadStats.downloadingInQueue}
              </div>
            </div>

            {/* Завершено */}
            <div
              className={`bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3 border-l-4 border-green-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === 'completed' ? 'ring-2 ring-green-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'completed' ? null : 'completed')}
            >
              <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-400 font-semibold mb-1">
                Завершено
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                {downloadStats.completedInQueue}
              </div>
            </div>

            {/* Ошибки */}
            <div
              className={`bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-3 border-l-4 border-red-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === 'error' ? 'ring-2 ring-red-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'error' ? null : 'error')}
            >
              <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400 font-semibold mb-1">
                Ошибки
              </div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-200">
                {downloadStats.errorsInQueue}
              </div>
            </div>

            {/* Всего */}
            <div
              className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 rounded-lg p-3 border-l-4 border-gray-500 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${statusFilter === null ? 'ring-2 ring-gray-400 shadow-lg' : ''}`}
              onClick={() => setStatusFilter(null)}
            >
              <div className="text-xs uppercase tracking-wide text-gray-700 dark:text-gray-400 font-semibold mb-1">
                Всего
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                {downloadStats.totalInSession}
              </div>
            </div>
          </div>
        </Card>

        {/* Прогресс-бар загрузки */}
        <ProgressBar
          overallProgress={progressData.overall_progress}
          overallTotal={progressData.overall_total}
          currentProgress={progressData.current_progress}
          currentFileName={undefined} // Убираем название трека из верхнего статус-бара
          currentStatus={progressData.current_status || undefined}
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
          {/* Показываем кнопку запуска только если нет активных загрузок */}
          {(downloadStats.pendingInQueue > 0 || downloadStats.queuedInQueue > 0) && downloadStats.downloadingInQueue === 0 && !progressData.is_active && (
            <Button
              variant="primary"
              onClick={startDownloadQueue}
              size="md"
              icon={Play}
              className="text-lg font-bold shadow-lg hover:shadow-xl transition-all animate-pulse"
            >
              🚀 Запустить загрузку ({downloadStats.pendingInQueue + downloadStats.queuedInQueue})
            </Button>
          )}
          {/* Показываем кнопку паузы/возобновления только если есть активные загрузки */}
          {(downloadStats.downloadingInQueue > 0 || downloadStats.queuedInQueue > 0 || progressData.is_active) && (
            <div className="flex gap-3">
              <Button
                variant={isPaused ? "success" : "warning"}
                onClick={togglePause}
                icon={isPaused ? Play : Pause}
                size="lg"
                className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              >
                {isPaused ? '▶️ Возобновить загрузку' : '⏸️ Приостановить загрузку'}
              </Button>
              <Button
                variant="secondary"
                onClick={restartWorker}
                icon={RefreshCw}
                size="lg"
                className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              >
                🔄 Перезапустить
              </Button>
            </div>
          )}
          {downloadStats.completedInQueue > 0 && (
            <Button
              variant="secondary"
              onClick={clearCompleted}
              size="sm"
              icon={Trash2}
            >
              Очистить завершенные ({downloadStats.completedInQueue})
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
          getFilteredTracks().map(track => (
            <Card
              key={track.id}
              className={`p-4 transition-all duration-200 ${track.status === 'completed' ? 'border-l-4 border-l-success-500' :
                track.status === 'downloading' ? 'border-l-4 border-l-primary-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg' :
                  track.status === 'processing' ? 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
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

                {/* Обложка трека */}
                <div className="md:col-span-1 flex justify-center">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {track.cover ? (
                      <img
                        src={`http://localhost:8000/api/queue/track/${track.track_id}/cover`}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <Music size={20} className={`text-gray-400 ${track.cover ? 'hidden' : ''}`} />
                  </div>
                </div>

                {/* Статус */}
                <div className="md:col-span-1 flex justify-center">
                  {getStatusIcon(track.status)}
                </div>

                {/* Информация о треке */}
                <div className="md:col-span-3 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                    {track.title}
                    {track.status === 'downloading' && (
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">
                        СЕЙЧАС ЗАГРУЖАЕТСЯ
                      </span>
                    )}
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
                        className={`h-3 rounded-full transition-all duration-500 ease-out ${track.status === 'downloading' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                          track.status === 'processing' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                        style={{
                          width: `${Math.min(Math.max(track.progress || 0, 0), 100)}%`
                        }}
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