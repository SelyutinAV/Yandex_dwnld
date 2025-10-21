import { ExternalLink, FileAudio, FolderOpen, HardDrive, Music, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface FileStats {
  totalFiles: number
  totalSize: number
  byFormat: Record<string, { count: number; size: number }>
  byQuality: Record<string, number>
}

interface AudioFile {
  track_id: string
  title: string
  artist: string
  album?: string
  file_path: string
  file_size?: number
  format?: string
  quality?: string
  has_cover?: boolean
  download_date: string
}

function FileAnalyzer() {
  const [loading, setLoading] = useState(false)
  const [downloadPath, setDownloadPath] = useState('/home/user/Music/Yandex')
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    totalSize: 0,
    byFormat: {},
    byQuality: {}
  })
  const [recentFiles, setRecentFiles] = useState<AudioFile[]>([])
  const { state, triggerRefresh } = useAppContext()

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    loadData()
    loadSettings()
  }, [])

  // Обновляем данные при изменении контекста
  useEffect(() => {
    if (state.refreshTrigger > 0) {
      loadData()
    }
  }, [state.refreshTrigger])

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings')
      if (response.ok) {
        const settings = await response.json()
        setDownloadPath(settings.downloadPath || '/home/user/Music/Yandex')
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Загружаем статистику файлов
      const statsResponse = await fetch('http://localhost:8000/api/files/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Загружаем недавние файлы
      const recentResponse = await fetch('http://localhost:8000/api/files/recent?limit=5')
      if (recentResponse.ok) {
        const recentData = await recentResponse.json()
        setRecentFiles(recentData.files || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeFiles = async () => {
    await loadData()
  }

  const openInFileManager = () => {
    // Открываем папку в файловом менеджере через системную команду
    window.open(`file://${downloadPath}`, '_blank')
  }

  const clearStats = async () => {
    if (window.confirm('Вы уверены, что хотите очистить статистику файлов?')) {
      try {
        const response = await fetch('http://localhost:8000/api/files/clear-stats', {
          method: 'DELETE'
        })

        if (response.ok) {
          await loadData() // Перезагружаем данные
        } else {
          console.error('Ошибка очистки статистики')
        }
      } catch (error) {
        console.error('Ошибка очистки статистики:', error)
      }
    }
  }

  const scanFilesystem = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/files/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: downloadPath })
      })

      if (response.ok) {
        await loadData() // Перезагружаем данные после сканирования
        triggerRefresh() // Уведомляем другие компоненты
      } else {
        console.error('Ошибка сканирования файловой системы')
      }
    } catch (error) {
      console.error('Ошибка сканирования файловой системы:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} ГБ`
    }
    return `${mb.toFixed(2)} МБ`
  }

  const selectFolder = async () => {
    try {
      // Открываем диалог выбора папки через API
      const response = await fetch('http://localhost:8000/api/folders/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: "/home/urch" })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Доступные папки:', data.folders)
        // TODO: Показать диалог выбора папки
      }
    } catch (error) {
      console.error('Ошибка получения списка папок:', error)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Анализ файлов</h2>
          {state.refreshTrigger > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
              <span>Обновлено</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={analyzeFiles}
            disabled={loading}
            icon={RefreshCw}
            loading={loading}
          >
            Обновить анализ
          </Button>
          <Button
            variant="primary"
            onClick={scanFilesystem}
            disabled={loading}
            icon={RefreshCw}
            loading={loading}
          >
            Сканировать файлы
          </Button>
          {stats.totalFiles > 0 && (
            <Button
              variant="error"
              onClick={clearStats}
              disabled={loading}
            >
              Очистить статистику
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Путь к загруженным файлам:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            placeholder="/path/to/music"
            className="flex-1 input-field"
            disabled
          />
          <Button
            variant="secondary"
            onClick={selectFolder}
            icon={FolderOpen}
          >
            Выбрать
          </Button>
          <Button
            variant="primary"
            onClick={openInFileManager}
            icon={ExternalLink}
          >
            Открыть папку
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Путь настраивается в разделе "Настройки" → "Загрузка"
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <FileAudio size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Всего файлов</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalFiles}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <HardDrive size={32} className="text-success-600 dark:text-success-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Общий размер</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatSize(stats.totalSize)}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
              <Music size={32} className="text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Средний размер</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalFiles > 0 ? formatSize(stats.totalSize / stats.totalFiles) : '0 МБ'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {stats.totalFiles > 0 ? (
        <>
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Распределение по форматам</h3>
            <div className="space-y-4">
              {Object.entries(stats.byFormat).map(([format, data]) => (
                <div key={format} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{format}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{data.count} файлов</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatSize(data.size)}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(data.count / stats.totalFiles) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Качество аудио</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.byQuality).map(([quality, count]) => (
                <div key={quality} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{quality}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{count} файлов</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-6">
          <div className="text-center py-8">
            <FileAudio size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Файлы не найдены</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Загрузите музыку из плейлистов, чтобы увидеть статистику файлов
            </p>
          </div>
        </Card>
      )}

      {recentFiles.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Недавно добавленные</h3>
          <div className="space-y-4">
            {recentFiles.map((file) => (
              <div key={file.track_id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <img
                    src={`http://localhost:8000/api/files/cover/${file.track_id}`}
                    alt={`${file.artist} - ${file.title}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling.style.display = 'flex'
                    }}
                  />
                  <FileAudio
                    size={24}
                    className="text-primary-500"
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{file.artist}</div>
                  {file.album && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{file.album}</div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{file.file_path}</div>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  {file.format && (
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs font-medium">
                      {file.format}
                    </span>
                  )}
                  {file.quality && (
                    <span className="text-gray-600 dark:text-gray-400">{file.quality}</span>
                  )}
                  {file.file_size && (
                    <span className="text-gray-500 dark:text-gray-500">{formatSize(file.file_size)}</span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDate(file.download_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default FileAnalyzer