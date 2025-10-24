import { FileAudio, FolderPlus, HardDrive, Headphones, Music, RefreshCw, Volume2, VolumeX, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import FolderBrowser from './FolderBrowser'
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
  const [allFiles, setAllFiles] = useState<AudioFile[]>([])
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const { state, triggerRefresh } = useAppContext()

  // Состояние для браузера папок
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false)

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

      // Загружаем все файлы
      const allFilesResponse = await fetch('http://localhost:8000/api/files/list?limit=1000')
      if (allFilesResponse.ok) {
        const allFilesData = await allFilesResponse.json()
        setAllFiles(allFilesData.files || [])
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

  const handleSelectDownloadPath = () => {
    setIsFolderBrowserOpen(true)
  }

  const handleFolderConfirm = async (selectedPath: string) => {
    try {
      // Сохраняем выбранный путь в настройках
      const response = await fetch('http://localhost:8000/api/settings/download-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          downloadPath: selectedPath
        })
      })

      if (response.ok) {
        setDownloadPath(selectedPath)
        // Обновляем анализ файлов с новым путем
        await analyzeFiles()
      } else {
        console.error('Ошибка при сохранении пути')
        alert('Ошибка при сохранении пути')
      }
    } catch (error) {
      console.error('Ошибка при подтверждении выбора:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
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

  const handleQualityFilter = (quality: string | null) => {
    setSelectedQuality(quality)
    setShowAllFiles(true)
    loadFilteredFiles(quality)
  }

  const loadFilteredFiles = async (quality: string | null = null) => {
    setLoading(true)
    try {
      const url = quality 
        ? `http://localhost:8000/api/files/list?quality=${encodeURIComponent(quality)}&limit=1000`
        : 'http://localhost:8000/api/files/list?limit=1000'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAllFiles(data.files || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки отфильтрованных файлов:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredFiles = () => {
    if (!showAllFiles) return []
    
    if (selectedQuality) {
      return allFiles.filter(file => file.quality === selectedQuality)
    }
    
    return allFiles
  }

  const getQualityBadgeColor = (quality: string) => {
    // Улучшенная логика определения цвета с учетом и битрейта, и частоты дискретизации
    // Извлекаем параметры качества
    let bitDepth = 0
    let sampleRate = 0
    let bitrate = 0
    
    // Парсим битовую глубину
    if (quality.includes('24-bit')) {
      bitDepth = 24
    } else if (quality.includes('16-bit')) {
      bitDepth = 16
    } else if (quality.includes('32-bit')) {
      bitDepth = 32
    }
    
    // Парсим частоту дискретизации
    if (quality.includes('48.0kHz') || quality.includes('48kHz')) {
      sampleRate = 48000
    } else if (quality.includes('44.1kHz') || quality.includes('44kHz')) {
      sampleRate = 44100
    } else if (quality.includes('32kHz')) {
      sampleRate = 32000
    } else if (quality.includes('22kHz')) {
      sampleRate = 22000
    }
    
    // Парсим битрейт
    const bitrateMatch = quality.match(/(\d+)kbps/)
    if (bitrateMatch) {
      bitrate = parseInt(bitrateMatch[1])
    } else {
      const bitrateMatch2 = quality.match(/(\d+)(?=\/)/)
      if (bitrateMatch2) {
        bitrate = parseInt(bitrateMatch2[1])
      }
    }
    
    // Определяем цвет на основе качества - упрощенная и логичная схема
    if (bitDepth > 0) {  // Lossless качество - фиолетовый (лучшее)
      return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
    } else if (bitrate > 0) {  // Сжатое качество
      // Логичная цветовая прогрессия: зеленый -> синий -> желтый -> красный
      if (bitrate >= 320) {  // 320kbps - зеленый (отличное)
        return 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg'
      } else if (bitrate >= 296) {  // 296kbps - бирюзовый (очень хорошее)
        return 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg'
      } else if (bitrate >= 256) {  // 256kbps - синий (хорошее)
        return 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
      } else if (bitrate >= 224) {  // 224kbps - голубой (хорошее)
        return 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg'
      } else if (bitrate >= 192) {  // 192kbps - светло-синий (среднее)
        return 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-lg'
      } else if (bitrate >= 160) {  // 160kbps - желто-зеленый (среднее)
        return 'bg-gradient-to-r from-lime-600 to-green-600 text-white shadow-lg'
      } else if (bitrate >= 128) {  // 128kbps - желтый (низкое)
        return 'bg-gradient-to-r from-yellow-600 to-amber-700 text-white shadow-lg'
      } else if (bitrate >= 96) {   // 96kbps - оранжевый (очень низкое)
        return 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
      } else {  // Менее 96kbps - красный (плохое)
        return 'bg-gradient-to-r from-red-600 to-red-800 text-white shadow-lg'
      }
    } else {
      return 'bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg'
    }
  }

  const getQualitySortOrder = (quality: string) => {
    // Определяем порядок сортировки качества с учетом битовой глубины и частоты дискретизации
    // Извлекаем параметры качества
    let bitDepth = 0
    let sampleRate = 0
    let bitrate = 0
    
    // Парсим битовую глубину
    if (quality.includes('24-bit')) {
      bitDepth = 24
    } else if (quality.includes('16-bit')) {
      bitDepth = 16
    } else if (quality.includes('32-bit')) {
      bitDepth = 32
    }
    
    // Парсим частоту дискретизации
    if (quality.includes('48.0kHz') || quality.includes('48kHz')) {
      sampleRate = 48000
    } else if (quality.includes('44.1kHz') || quality.includes('44kHz')) {
      sampleRate = 44100
    } else if (quality.includes('32kHz')) {
      sampleRate = 32000
    } else if (quality.includes('22kHz')) {
      sampleRate = 22000
    }
    
    // Парсим битрейт - используем регулярные выражения для извлечения числа
    const bitrateMatch = quality.match(/(\d+)kbps/)
    if (bitrateMatch) {
      bitrate = parseInt(bitrateMatch[1])
    } else {
      // Попробуем найти число без kbps (например, "296/44.1kHz")
      const bitrateMatch2 = quality.match(/(\d+)(?=\/)/)
      if (bitrateMatch2) {
        bitrate = parseInt(bitrateMatch2[1])
      }
    }
    
    // Определяем порядок сортировки
    if (bitDepth > 0) {  // Lossless качество
      // Для lossless: 24-bit/48kHz лучше чем 16-bit/44.1kHz
      if (bitDepth === 24 && sampleRate >= 48000) {
        return 1  // Лучшее lossless
      } else if (bitDepth === 24 && sampleRate >= 44100) {
        return 2  // Хорошее lossless
      } else if (bitDepth === 16 && sampleRate >= 48000) {
        return 3  // Стандартное lossless высокое
      } else if (bitDepth === 16 && sampleRate >= 44100) {
        return 4  // Стандартное lossless
      } else {
        return 5  // Другое lossless
      }
    } else if (bitrate > 0) {  // Сжатое качество
      // Для сжатого: выше битрейт = лучше
      // Используем обратную сортировку: чем выше битрейт, тем меньше номер (лучше)
      // Формула: 6 + (1000 - bitrate) для максимально точной сортировки
      return 6 + (1000 - bitrate)  // 320kbps = 686, 296kbps = 710, 256kbps = 750, etc.
    } else {
      return 12  // Неизвестное качество
    }
  }

  const getQualityIcon = (quality: string) => {
    // Иконки для разных уровней качества с улучшенной контрастностью
    if (quality.includes('Lossless') || quality.includes('16-bit') || quality.includes('24-bit')) {
      return <Zap size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('320kbps') || quality.includes('320')) {
      return <Volume2 size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('256kbps') || quality.includes('256')) {
      return <Volume2 size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('192kbps') || quality.includes('192')) {
      return <Music size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('160kbps') || quality.includes('160')) {
      return <Music size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('128kbps') || quality.includes('128')) {
      return <Headphones size={16} className="text-white drop-shadow-lg" />
    }
    if (quality.includes('96kbps') || quality.includes('96')) {
      return <Headphones size={16} className="text-white drop-shadow-lg" />
    }
    return <VolumeX size={16} className="text-white drop-shadow-lg" />
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Анализ файлов</h2>
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
            variant="primary"
            onClick={handleSelectDownloadPath}
            icon={FolderPlus}
          >
            Выбрать папку
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
              {Object.entries(stats.byQuality)
                .sort(([a], [b]) => getQualitySortOrder(a) - getQualitySortOrder(b))
                .map(([quality, count]) => (
                <button
                  key={quality}
                  onClick={() => handleQualityFilter(quality)}
                  className={`p-4 rounded-lg transition-all duration-200 hover:scale-105 transform ${
                    selectedQuality === quality
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        {getQualityIcon(quality)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{quality}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{count} файлов</div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getQualityBadgeColor(quality)}`}>
                      {getQualityIcon(quality)}
                      {quality}
                    </span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedQuality(null)
                  setShowAllFiles(true)
                  loadFilteredFiles(null)
                }}
                className={`p-4 rounded-lg transition-all duration-200 hover:scale-105 transform ${
                  !selectedQuality && showAllFiles
                    ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <Music size={20} className="text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Все качества</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Показать все файлы</div>
                  </div>
                </div>
              </button>
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

      {recentFiles.length > 0 && !showAllFiles && (
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
                      const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null
                      if (nextEl) nextEl.style.display = 'flex'
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getQualityBadgeColor(file.quality)}`}>
                      <span>{getQualityIcon(file.quality)}</span>
                      {file.quality}
                    </span>
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

      {showAllFiles && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {selectedQuality ? `Файлы с качеством: ${selectedQuality}` : 'Все файлы'}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedQuality(null)
                  setShowAllFiles(false)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Скрыть список
              </button>
              <Button
                variant="secondary"
                onClick={() => loadFilteredFiles(selectedQuality)}
                disabled={loading}
                icon={RefreshCw}
                loading={loading}
              >
                Обновить
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {getFilteredFiles().length > 0 ? (
              getFilteredFiles().map((file) => (
                <div key={file.track_id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <img
                      src={`http://localhost:8000/api/files/cover/${file.track_id}`}
                      alt={`${file.artist} - ${file.title}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null
                        if (nextEl) nextEl.style.display = 'flex'
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getQualityBadgeColor(file.quality)}`}>
                      <span>{getQualityIcon(file.quality)}</span>
                      {file.quality}
                    </span>
                  )}
                    {file.file_size && (
                      <span className="text-gray-500 dark:text-gray-500">{formatSize(file.file_size)}</span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {formatDate(file.download_date)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileAudio size={64} className="mx-auto text-gray-400 mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Файлы не найдены</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedQuality 
                    ? `Нет файлов с качеством "${selectedQuality}"`
                    : 'Нет файлов для отображения'
                  }
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Браузер папок */}
      <FolderBrowser
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onConfirm={handleFolderConfirm}
        title="Выберите папку для анализа файлов"
        initialPath={downloadPath}
      />
    </div>
  )
}

export default FileAnalyzer