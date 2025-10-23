import { AlertCircle, CheckCircle, Download, Music, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface Playlist {
  id: string
  title: string
  track_count: number
  cover?: string
  isSynced: boolean
  lastSync?: string
}

function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())
  const [downloadStats, setDownloadStats] = useState({
    totalDownloaded: 0,
    totalSizeGB: 0
  })
  const [playlistProgress, setPlaylistProgress] = useState<{ [key: string]: number }>({})
  const { state } = useAppContext()

  // Функция для загрузки плейлистов с API
  const loadPlaylists = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:8000/api/playlists')

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Ошибка подключения к Яндекс.Музыке')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Загружено плейлистов:', data.length)
      setPlaylists(data)
    } catch (error) {
      console.error('Ошибка загрузки плейлистов:', error)
      setPlaylists([])
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  const loadDownloadStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/stats')
      if (response.ok) {
        const data = await response.json()
        setDownloadStats({
          totalDownloaded: data.summary.totalDownloaded,
          totalSizeGB: data.summary.totalSizeGB
        })
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error)
    }
  }

  const loadPlaylistProgress = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/downloads/queue')
      if (response.ok) {
        const data = await response.json()
        const queue = data.queue || []

        // Группируем прогресс по плейлистам (если есть такая информация)
        const progressByPlaylist: { [key: string]: { completed: number, total: number } } = {}

        queue.forEach((track: any) => {
          // Предполагаем, что треки из одного плейлиста имеют похожие ID
          const playlistKey = track.track_id.split('_')[0] || 'unknown'

          if (!progressByPlaylist[playlistKey]) {
            progressByPlaylist[playlistKey] = { completed: 0, total: 0 }
          }

          progressByPlaylist[playlistKey].total += 1
          if (track.status === 'completed') {
            progressByPlaylist[playlistKey].completed += 1
          }
        })

        // Конвертируем в проценты
        const progressPercent: { [key: string]: number } = {}
        Object.keys(progressByPlaylist).forEach(key => {
          const { completed, total } = progressByPlaylist[key]
          progressPercent[key] = total > 0 ? Math.round((completed / total) * 100) : 0
        })

        setPlaylistProgress(progressPercent)
      }
    } catch (error) {
      console.error('Ошибка загрузки прогресса плейлистов:', error)
    }
  }

  useEffect(() => {
    loadPlaylists()
    loadDownloadStats()
    loadPlaylistProgress()
  }, [])

  // Обновляем плейлисты при изменении контекста
  useEffect(() => {
    if (state.refreshTrigger > 0) {
      loadPlaylists()
      loadDownloadStats()
      loadPlaylistProgress()
    }
  }, [state.refreshTrigger])

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

    setLoading(true)
    try {
      const results = []
      let totalAdded = 0
      let totalExisting = 0

      // Шаг 1: Формируем список треков для каждого плейлиста
      for (const playlistId of selectedPlaylists) {
        const response = await fetch('http://localhost:8000/api/download/playlist/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playlist_id: playlistId,
            quality: 'lossless'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        results.push({ playlistId, result })
        totalAdded += result.added || 0
        totalExisting += result.existing || 0
        console.log(`Подготовлен плейлист ${playlistId}:`, result)
      }

      // Логируем результат подготовки
      console.log(`✅ Список подготовлен: ${totalAdded} новых треков, ${totalExisting} уже в очереди`)

      // Очищаем выбор
      setSelectedPlaylists(new Set())

      // Обновляем список плейлистов
      await loadPlaylists()
    } catch (error) {
      console.error('Ошибка подготовки плейлистов:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Никогда'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Мои плейлисты</h2>
          <div className="mt-2 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>📥 Всего скачано: <strong className="text-success-600 dark:text-success-400">{downloadStats.totalDownloaded}</strong></span>
            <span>💾 Размер: <strong className="text-primary-600 dark:text-primary-400">{downloadStats.totalSizeGB.toFixed(1)} ГБ</strong></span>
          </div>
        </div>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={loadPlaylists}
            disabled={loading}
            icon={RefreshCw}
            loading={loading}
          >
            Обновить
          </Button>
          <Button
            variant="primary"
            onClick={syncSelectedPlaylists}
            disabled={selectedPlaylists.size === 0 || loading}
            icon={Download}
            loading={loading}
          >
            {loading ? 'Синхронизация...' : `Синхронизировать (${selectedPlaylists.size})`}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="flex flex-col items-center justify-center py-16 text-red-500 dark:text-red-400 mb-6">
          <AlertCircle size={48} className="mb-4" />
          <h3 className="text-xl font-semibold mb-2">Ошибка загрузки плейлистов</h3>
          <p className="text-center mb-4">{error}</p>
          <Button
            variant="secondary"
            onClick={loadPlaylists}
            icon={RefreshCw}
            className="bg-red-100 hover:bg-red-200 text-red-700"
          >
            Попробовать снова
          </Button>
        </Card>
      )}

      {loading && playlists.length === 0 && !error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <RefreshCw size={48} className="animate-spin mb-4" />
          <p>Загрузка плейлистов...</p>
        </Card>
      ) : !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map(playlist => (
            <Card
              key={playlist.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-1 ${selectedPlaylists.has(playlist.id)
                ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800'
                }`}
              onClick={() => togglePlaylistSelection(playlist.id)}
            >
              <div className="relative w-full aspect-square bg-gradient-to-br from-gray-400 to-gray-600 dark:from-gray-600 dark:to-gray-800 rounded-lg overflow-hidden mb-4">
                {playlist.cover ? (
                  <img
                    src={playlist.cover}
                    alt={playlist.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    <Music size={48} />
                  </div>
                )}
                {playlist.isSynced && (
                  <div className="absolute top-2 right-2 bg-success-500 text-white p-1 rounded-full">
                    <CheckCircle size={16} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {playlist.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {playlist.track_count} треков
                </p>
                {playlistProgress[playlist.id] !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Прогресс синхронизации</span>
                      <span>{playlistProgress[playlist.id]}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${playlistProgress[playlist.id]}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Последняя синхронизация: {formatDate(playlist.lastSync)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && playlists.length === 0 && !error && (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <Music size={64} className="mb-4" />
          <h3 className="text-xl font-semibold mb-2">Плейлисты не найдены</h3>
          <p>Подключитесь к Яндекс.Музыке в настройках</p>
        </Card>
      )}
    </div>
  )
}

export default PlaylistManager