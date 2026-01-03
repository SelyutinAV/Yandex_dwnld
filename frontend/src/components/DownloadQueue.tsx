import { AlertCircle, CheckCircle, Download, Pause, Play, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import config from '../config'
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
  const { } = useAppContext()

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
      const response = await fetch(`${config.apiBaseUrl}/downloads/progress`)
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
      const response = await fetch(`${config.apiBaseUrl}/queue/list`)

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
      const response = await fetch(`${config.apiBaseUrl}/queue/stats`)
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
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
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


  const removeTrack = async (trackId: string) => {
    try {
      // Используем новый эндпоинт удаления
      const response = await fetch(`${config.apiBaseUrl}/queue/track/${trackId}`, {
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
      const response = await fetch(`${config.apiBaseUrl}/downloads/${trackId}/retry`, {
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


  const clearCompleted = async () => {
    try {
      // Используем новый эндпоинт
      const response = await fetch(`${config.apiBaseUrl}/queue/clear-completed`, {
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
      const response = await fetch(`${config.apiBaseUrl}/queue/start`, {
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
    <div className="w-full min-h-screen">
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


        {/* Общий прогресс-бар загрузки - показываем только при активной загрузке или когда есть прогресс */}
        {(progressData.is_active || progressData.overall_progress > 0) && (
          <ProgressBar
            overallProgress={progressData.overall_progress}
            overallTotal={progressData.overall_total}
            currentProgress={progressData.current_progress}
            currentFileName={undefined}
            currentStatus={progressData.current_status || undefined}
            isActive={progressData.is_active}
          />
        )}

        {/* Простая панель управления */}
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-4 gap-4">
            <Button
              variant="secondary"
              onClick={selectAllTracks}
              size="sm"
              disabled={tracks.length === 0}
            >
              Выбрать все
            </Button>
            
            <Button
              variant="success"
              onClick={startDownloadQueue}
              size="sm"
              icon={Play}
              disabled={downloadStats.pendingInQueue === 0 && downloadStats.queuedInQueue === 0}
            >
              Запустить
            </Button>
            
              <Button
                variant={isPaused ? "success" : "warning"}
                onClick={togglePause}
                icon={isPaused ? Play : Pause}
              size="sm"
              disabled={!progressData.is_active}
              >
              {isPaused ? 'Возобновить' : 'Пауза'}
              </Button>
            
            <Button
              variant="error"
              onClick={clearCompleted}
              size="sm"
              icon={Trash2}
              disabled={downloadStats.completedInQueue === 0}
            >
              Очистить ({downloadStats.completedInQueue})
            </Button>
          </div>
        </div>
      </div>

      {/* Простая таблица треков */}
      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Download size={48} className="mx-auto mb-4 animate-pulse" />
            <p>Загрузка данных...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Download size={48} className="mx-auto mb-4" />
            <p>Очередь пуста</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedTracks.size === tracks.length && tracks.length > 0}
                    onChange={selectedTracks.size === tracks.length ? clearSelection : selectAllTracks}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Обложка
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[200px]">
                  Трек
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Качество
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[300px]">
                  Прогресс
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {getFilteredTracks().map((track) => (
                    <tr key={track.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${track.status === 'downloading' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTracks.has(track.track_id)}
                      onChange={() => toggleTrackSelection(track.track_id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {getStatusIcon(track.status)}
                  </td>
                  <td className="px-4 py-3">
                    {track.cover ? (
                      <img 
                        src={track.cover} 
                        alt={`${track.title} - ${track.artist}`}
                        className="w-12 h-12 rounded-lg object-cover shadow-sm"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-400 dark:text-gray-500 text-xs">🎵</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {track.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {track.artist}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {track.quality || '—'}
                  </td>
                  <td className="px-4 py-3 min-w-[300px]">
                    {track.status === 'downloading' ? (
                      <div className="space-y-2">
                        {/* Статус-бар только для загружающегося трека */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Download size={16} className="text-blue-500" />
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              Загружается: {track.status}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {(progressData.current_progress || track.progress || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(Math.max(progressData.current_progress || track.progress || 0, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {track.status}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(track.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-1">
                  {track.status === 'error' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => retryTrack(track.track_id)}
                      icon={Play}
                          className="p-1"
                    >
                      Повторить
                    </Button>
                  )}
                  <Button
                    variant="error"
                    size="sm"
                    onClick={() => removeTrack(track.track_id)}
                    icon={X}
                        className="p-1"
                  >
                    Удалить
                  </Button>
                </div>
                  </td>
                    </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default DownloadQueue