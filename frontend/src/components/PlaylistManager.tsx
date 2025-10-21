import { CheckCircle, Download, Music, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())

  // Функция для загрузки плейлистов с API
  const loadPlaylists = async () => {
    setLoading(true)
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

      // Если ошибка связана с настройками, показываем пустой список
      if (error instanceof Error && error.message.includes('токен')) {
        setPlaylists([])
      } else {
        // Показываем пример данных только для демонстрации
        setPlaylists([
          {
            id: '1',
            title: 'Любимые треки (демо)',
            track_count: 156,
            isSynced: true,
            lastSync: '2025-10-20T10:30:00'
          },
          {
            id: '2',
            title: 'Audiophile Collection (демо)',
            track_count: 89,
            isSynced: false
          }
        ])
      }
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
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Мои плейлисты</h2>
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
            disabled={selectedPlaylists.size === 0}
            icon={Download}
          >
            Синхронизировать ({selectedPlaylists.size})
          </Button>
        </div>
      </div>

      {loading && playlists.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <RefreshCw size={48} className="animate-spin mb-4" />
          <p>Загрузка плейлистов...</p>
        </Card>
      ) : (
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
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Последняя синхронизация: {formatDate(playlist.lastSync)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && playlists.length === 0 && (
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