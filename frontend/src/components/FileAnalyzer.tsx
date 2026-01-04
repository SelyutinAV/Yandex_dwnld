import { FileAudio, FolderPlus, HardDrive, Headphones, Music, RefreshCw, Volume2, VolumeX, Zap, Search, Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppContext } from '../contexts'
import config from '../config'
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
  year?: number
  genre?: string
  label?: string
  isrc?: string
  duration?: number
  version?: string
}

interface AlternativeSearchResult {
  track_id: string
  found: boolean
  source?: string
  mbid?: string
  title?: string
  artist?: string
  releases?: Array<{
    title: string
    date?: string
    label?: string
    country?: string
  }>
  isrcs?: string[]
  message?: string
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
  const [showFilesWithCovers, setShowFilesWithCovers] = useState(false)
  const { state, triggerRefresh } = useAppContext()

  // Состояние для браузера папок
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false)

  // Состояние для поиска и фильтров
  const [searchQuery, setSearchQuery] = useState('')
  const [filterYear, setFilterYear] = useState<number | null>(null)
  const [filterGenre, setFilterGenre] = useState<string | null>(null)
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  
  // Состояние для поиска аналогов
  const [alternativeSearchResults, setAlternativeSearchResults] = useState<Record<string, AlternativeSearchResult>>({})
  const [searchingAlternatives, setSearchingAlternatives] = useState<Set<string>>(new Set())
  const [downloadingAlternatives, setDownloadingAlternatives] = useState<Set<string>>(new Set())
  
  // Состояние для обновления метаданных
  const [updatingMetadata, setUpdatingMetadata] = useState(false)
  const [metadataUpdateProgress, setMetadataUpdateProgress] = useState<{total: number, updated: number, failed: number, skipped: number} | null>(null)

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
      const response = await fetch(`${config.apiBaseUrl}/settings`)
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
      const statsResponse = await fetch(`${config.apiBaseUrl}/files/stats`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Загружаем недавние файлы
      const recentResponse = await fetch(`${config.apiBaseUrl}/files/recent?limit=5`)
      if (recentResponse.ok) {
        const recentData = await recentResponse.json()
        setRecentFiles(recentData.files || [])
      }

      // Загружаем все файлы с учетом фильтров
      const params = new URLSearchParams()
      params.append('limit', '1000')
      if (searchQuery) params.append('search', searchQuery)
      if (filterYear) params.append('year', filterYear.toString())
      if (filterGenre) params.append('genre', filterGenre)
      if (filterLabel) params.append('label', filterLabel)
      if (selectedQuality) params.append('quality', selectedQuality)
      
      const allFilesResponse = await fetch(`${config.apiBaseUrl}/files/list?${params.toString()}`)
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


  const handleSelectDownloadPath = () => {
    setIsFolderBrowserOpen(true)
  }

  const handleFolderConfirm = async (selectedPath: string) => {
    try {
      // Сохраняем выбранный путь в настройках
      const response = await fetch(`${config.apiBaseUrl}/settings/download-path`, {
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
        await loadData()
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
        const response = await fetch(`${config.apiBaseUrl}/files/clear-stats`, {
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
      const response = await fetch(`${config.apiBaseUrl}/files/scan`, {
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
        ? `${config.apiBaseUrl}/files/list?quality=${encodeURIComponent(quality)}&limit=1000`
        : `${config.apiBaseUrl}/files/list?limit=1000`
      
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

  const loadFilesWithCovers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${config.apiBaseUrl}/files/list?limit=2000`)
      if (response.ok) {
        const data = await response.json()
        const filesWithCovers = (data.files || []).filter((file: AudioFile) => file.has_cover)
        setAllFiles(filesWithCovers)
        setShowFilesWithCovers(true)
        setShowAllFiles(true)
        setSelectedQuality(null)
      }
    } catch (error) {
      console.error('Ошибка загрузки файлов с обложками:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredFiles = () => {
    if (!showAllFiles) return []
    
    let filtered = allFiles
    
    if (showFilesWithCovers) {
      filtered = filtered.filter(file => file.has_cover)
    }
    
    if (selectedQuality) {
      filtered = filtered.filter(file => file.quality === selectedQuality)
    }
    
    // Дополнительная фильтрация на клиенте (если нужно)
    if (searchQuery && !searchQuery.trim()) {
      // Поиск уже выполнен на сервере, но можно добавить дополнительную фильтрацию
    }
    
    return filtered
  }

  const findAlternative = async (trackId: string, file: AudioFile) => {
    setSearchingAlternatives(prev => new Set(prev).add(trackId))
    try {
      const response = await fetch(`${config.apiBaseUrl}/files/${trackId}/find-alternative`, {
        method: 'POST'
      })
      if (response.ok) {
        const result: AlternativeSearchResult = await response.json()
        setAlternativeSearchResults(prev => ({
          ...prev,
          [trackId]: result
        }))
      } else {
        const error = await response.json()
        setAlternativeSearchResults(prev => ({
          ...prev,
          [trackId]: {
            track_id: trackId,
            found: false,
            message: error.detail || 'Ошибка поиска аналога'
          }
        }))
      }
    } catch (error) {
      console.error('Ошибка поиска аналога:', error)
      setAlternativeSearchResults(prev => ({
        ...prev,
        [trackId]: {
          track_id: trackId,
          found: false,
          message: 'Ошибка при поиске аналога'
        }
      }))
    } finally {
      setSearchingAlternatives(prev => {
        const newSet = new Set(prev)
        newSet.delete(trackId)
        return newSet
      })
    }
  }

  const downloadAlternative = async (trackId: string) => {
    setIsFolderBrowserOpen(true)
    // Сохраняем trackId для использования после выбора папки
    const pendingDownload = trackId
    // Это будет обработано в handleFolderConfirm для альтернатив
  }

  const handleDownloadAlternativeConfirm = async (trackId: string, savePath: string) => {
    setDownloadingAlternatives(prev => new Set(prev).add(trackId))
    try {
      const response = await fetch(`${config.apiBaseUrl}/files/${trackId}/download-alternative`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          save_path: savePath
        })
      })
      if (response.ok) {
        const result = await response.json()
        alert(result.message || 'Информация об аналоге получена')
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.detail || 'Не удалось получить информацию об аналоге'}`)
      }
    } catch (error) {
      console.error('Ошибка скачивания аналога:', error)
      alert('Ошибка при скачивании аналога')
    } finally {
      setDownloadingAlternatives(prev => {
        const newSet = new Set(prev)
        newSet.delete(trackId)
        return newSet
      })
    }
  }

  const updateMetadata = async () => {
    setUpdatingMetadata(true)
    setMetadataUpdateProgress({ total: 0, updated: 0, failed: 0, skipped: 0 })
    try {
      const response = await fetch(`${config.apiBaseUrl}/files/update-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batch_size: 50
        })
      })
      if (response.ok) {
        const result = await response.json()
        setMetadataUpdateProgress(result.result)
        // Обновляем список файлов после обновления метаданных
        await loadData()
        triggerRefresh()
      } else {
        const error = await response.json()
        alert(`Ошибка обновления метаданных: ${error.detail}`)
      }
    } catch (error) {
      console.error('Ошибка обновления метаданных:', error)
      alert('Ошибка при обновлении метаданных')
    } finally {
      setUpdatingMetadata(false)
    }
  }

  // Получаем уникальные значения для фильтров
  const getUniqueYears = () => {
    const years = new Set<number>()
    allFiles.forEach(file => {
      if (file.year) years.add(file.year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }

  const getUniqueGenres = () => {
    const genres = new Set<string>()
    allFiles.forEach(file => {
      if (file.genre) genres.add(file.genre)
    })
    return Array.from(genres).sort()
  }

  const getUniqueLabels = () => {
    const labels = new Set<string>()
    allFiles.forEach(file => {
      if (file.label) labels.add(file.label)
    })
    return Array.from(labels).sort()
  }

  const getQualityBadgeColor = (quality: string, format?: string) => {
    // Улучшенная логика определения цвета с учетом битрейта и формата
    // Новая логика приоритетов:
    // 1. FLAC (Lossless) - фиолетовый (лучшее)
    // 2. AAC-MP4 (256+ kbps) - бирюзовый/синий (качественная альтернатива FLAC)
    // 3. MP3 и другие - зеленый/желтый/красный (в зависимости от битрейта)
    
    // Извлекаем параметры качества
    let bitDepth = 0
    let bitrate = 0
    const fileFormat = format?.toUpperCase() || ''
    const isAAC = fileFormat === 'AAC' || fileFormat === 'M4A' || quality.includes('AAC')
    const isMP3 = fileFormat === 'MP3' || quality.includes('MP3')
    
    // Парсим битовую глубину
    if (quality.includes('24-bit')) {
      bitDepth = 24
    } else if (quality.includes('16-bit')) {
      bitDepth = 16
    } else if (quality.includes('32-bit')) {
      bitDepth = 32
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
    
    // Определяем цвет на основе качества - новая логика с приоритетами
    if (bitDepth > 0) {  // Lossless качество (FLAC) - фиолетовый (лучшее, приоритет 1)
      return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
    } else if (isAAC && bitrate >= 256) {  // AAC-MP4 256+ kbps - бирюзовый (приоритет 2, качественная альтернатива)
      return 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg border-2 border-cyan-400/50'
    } else if (bitrate > 0) {  // Сжатое качество (MP3 и другие)
      // MP3 и другие форматы: зеленый -> синий -> желтый -> красный
      if (bitrate >= 320) {  // 320kbps - зеленый (отличное для MP3)
        return 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg'
      } else if (bitrate >= 296) {  // 296kbps - бирюзовый (очень хорошее)
        return 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg'
      } else if (bitrate >= 256) {  // 256kbps - синий (хорошее для MP3, но хуже чем AAC 256)
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

  const getQualitySortOrder = (quality: string, format?: string) => {
    // Новая логика приоритетов для сортировки:
    // 1. FLAC (Lossless) - приоритет 1-5
    // 2. AAC-MP4 (256+ kbps) - приоритет 5.5-6
    // 3. MP3 и другие - приоритет 7+
    
    // Извлекаем параметры качества
    let bitDepth = 0
    let sampleRate = 0
    let bitrate = 0
    const fileFormat = format?.toUpperCase() || ''
    const isAAC = fileFormat === 'AAC' || fileFormat === 'M4A' || quality.includes('AAC')
    const isMP3 = fileFormat === 'MP3' || quality.includes('MP3')
    
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
    
    // Определяем порядок сортировки с новой логикой приоритетов
    if (bitDepth > 0) {  // Lossless качество (FLAC) - приоритет 1
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
    } else if (isAAC && bitrate >= 256) {  // AAC-MP4 256+ kbps - приоритет 2 (качественная альтернатива FLAC)
      // AAC 256+ kbps идет после FLAC, но перед MP3 320kbps
      // Используем диапазон 5.5-6, где выше битрейт = лучше
      return 5.5 + (1000 - bitrate) / 2000  // AAC 256kbps ≈ 5.872, AAC 320kbps ≈ 5.84
    } else if (bitrate > 0) {  // MP3 и другие форматы - приоритет 3
      // Для MP3 и других: выше битрейт = лучше
      // Используем диапазон 7+, где выше битрейт = меньше номер
      return 7 + (1000 - bitrate)  // MP3 320kbps = 687, MP3 256kbps = 751, etc.
    } else {
      return 12  // Неизвестное качество
    }
  }

  const getQualityIcon = (quality: string, format?: string) => {
    // Иконки для разных уровней качества с новой логикой приоритетов
    const fileFormat = format?.toUpperCase() || ''
    const isAAC = fileFormat === 'AAC' || fileFormat === 'M4A' || quality.includes('AAC')
    const bitrateMatch = quality.match(/(\d+)kbps/)
    const bitrate = bitrateMatch ? parseInt(bitrateMatch[1]) : 0
    
    // Приоритет 1: FLAC (Lossless) - молния
    if (quality.includes('Lossless') || quality.includes('16-bit') || quality.includes('24-bit')) {
      return <Zap size={16} className="text-white drop-shadow-lg" />
    }
    
    // Приоритет 2: AAC-MP4 256+ kbps - громкость с акцентом (качественная альтернатива FLAC)
    if (isAAC && bitrate >= 256) {
      return <Volume2 size={16} className="text-white drop-shadow-lg" />
    }
    
    // Приоритет 3: MP3 и другие форматы
    if (bitrate >= 320) {
      return <Volume2 size={16} className="text-white drop-shadow-lg" />
    }
    if (bitrate >= 256) {
      return <Volume2 size={16} className="text-white drop-shadow-lg" />
    }
    if (bitrate >= 192) {
      return <Music size={16} className="text-white drop-shadow-lg" />
    }
    if (bitrate >= 160) {
      return <Music size={16} className="text-white drop-shadow-lg" />
    }
    if (bitrate >= 128) {
      return <Headphones size={16} className="text-white drop-shadow-lg" />
    }
    if (bitrate >= 96) {
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
            variant="primary"
            onClick={scanFilesystem}
            disabled={loading}
            icon={RefreshCw}
            loading={loading}
          >
            Сканировать файлы
          </Button>
          <Button
            variant="secondary"
            onClick={updateMetadata}
            disabled={updatingMetadata || loading}
            icon={RefreshCw}
            loading={updatingMetadata}
          >
            Обновить метаданные
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

      {metadataUpdateProgress && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Обновление метаданных</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Всего треков:</span>
              <span className="font-medium">{metadataUpdateProgress.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Обновлено:</span>
              <span className="font-medium text-green-600">{metadataUpdateProgress.updated}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ошибок:</span>
              <span className="font-medium text-red-600">{metadataUpdateProgress.failed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Пропущено:</span>
              <span className="font-medium text-gray-600">{metadataUpdateProgress.skipped}</span>
            </div>
            {metadataUpdateProgress.total > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-4">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(metadataUpdateProgress.updated / metadataUpdateProgress.total) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        </Card>
      )}

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
                .map(([quality, count]) => {
                  // Пытаемся определить формат из строки качества
                  let format: string | undefined = undefined
                  if (quality.includes('AAC') || quality.toLowerCase().includes('m4a')) {
                    format = 'AAC'
                  } else if (quality.includes('MP3')) {
                    format = 'MP3'
                  } else if (quality.includes('FLAC') || quality.includes('Lossless') || quality.includes('bit')) {
                    format = 'FLAC'
                  }
                  
                  return (
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
                            {getQualityIcon(quality, format)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{quality}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{count} файлов</div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getQualityBadgeColor(quality, format)}`}>
                          {getQualityIcon(quality, format)}
                          {quality}
                        </span>
                      </div>
                    </button>
                  )
                })}
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

      {(recentFiles.length > 0 || stats.totalFiles > 0) && (
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {showAllFiles ? (showFilesWithCovers ? 'Файлы с обложками' : 
               selectedQuality ? `Файлы с качеством: ${selectedQuality}` : 'Все файлы') : 'Недавно добавленные'}
            </h3>
            <div className="flex gap-2">
              {!showAllFiles && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowAllFiles(true)
                      loadData()
                    }}
                    disabled={loading}
                    icon={FileAudio}
                    loading={loading}
                  >
                    Показать все файлы
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={loadFilesWithCovers}
                    disabled={loading}
                    icon={FileAudio}
                    loading={loading}
                  >
                    Показать файлы с обложками
                  </Button>
                </>
              )}
              {showAllFiles && (
                <>
                  <button
                    onClick={() => {
                      setSelectedQuality(null)
                      setShowAllFiles(false)
                      setShowFilesWithCovers(false)
                      setSearchQuery('')
                      setFilterYear(null)
                      setFilterGenre(null)
                      setFilterLabel(null)
                      loadData()
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Скрыть список
                  </button>
                  <Button
                    variant="secondary"
                    onClick={() => loadData()}
                    disabled={loading}
                    icon={RefreshCw}
                    loading={loading}
                  >
                    Обновить
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Панель поиска и фильтров - доступна всегда */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Поиск
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        if (!showAllFiles) {
                          setShowAllFiles(true)
                        }
                        loadData()
                      }
                    }}
                    placeholder="Поиск по названию, исполнителю, альбому..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        loadData()
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Год
                </label>
                <select
                  value={filterYear || ''}
                  onChange={(e) => {
                    setFilterYear(e.target.value ? parseInt(e.target.value) : null)
                    if (!showAllFiles) {
                      setShowAllFiles(true)
                    }
                    loadData()
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Все годы</option>
                  {getUniqueYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Жанр
                </label>
                <select
                  value={filterGenre || ''}
                  onChange={(e) => {
                    setFilterGenre(e.target.value || null)
                    if (!showAllFiles) {
                      setShowAllFiles(true)
                    }
                    loadData()
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Все жанры</option>
                  {getUniqueGenres().map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Лейбл
                </label>
                <select
                  value={filterLabel || ''}
                  onChange={(e) => {
                    setFilterLabel(e.target.value || null)
                    if (!showAllFiles) {
                      setShowAllFiles(true)
                    }
                    loadData()
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Все лейблы</option>
                  {getUniqueLabels().map(label => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('')
                  setFilterYear(null)
                  setFilterGenre(null)
                  setFilterLabel(null)
                  loadData()
                }}
              >
                Сбросить
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {((!showAllFiles && recentFiles.length > 0) ? recentFiles : getFilteredFiles()).length > 0 ? (
              ((!showAllFiles && recentFiles.length > 0) ? recentFiles : getFilteredFiles()).map((file) => (
              <div key={file.track_id} className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <img
                      src={`${config.apiBaseUrl}/files/cover/${file.track_id}`}
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
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {file.year && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                          {file.year}
                        </span>
                      )}
                      {file.genre && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                          {file.genre}
                        </span>
                      )}
                      {file.label && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          {file.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{file.file_path}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-sm">
                    <div className="flex flex-col items-end gap-1">
                      {file.format && (
                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs font-medium">
                          {file.format}
                        </span>
                      )}
                      {file.quality && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getQualityBadgeColor(file.quality, file.format)}`}>
                          <span>{getQualityIcon(file.quality, file.format)}</span>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => findAlternative(file.track_id, file)}
                      disabled={searchingAlternatives.has(file.track_id)}
                      icon={Search}
                      loading={searchingAlternatives.has(file.track_id)}
                    >
                      {searchingAlternatives.has(file.track_id) ? 'Поиск...' : 'Поиск аналога'}
                    </Button>
                  </div>
                </div>
                {/* Результаты поиска аналога - вынесены за пределы flex-контейнера */}
                {alternativeSearchResults[file.track_id] && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    {alternativeSearchResults[file.track_id].found ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">Аналог найден!</h4>
                          <button
                            onClick={() => {
                              const newResults = { ...alternativeSearchResults }
                              delete newResults[file.track_id]
                              setAlternativeSearchResults(newResults)
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <div><strong>Источник:</strong> {alternativeSearchResults[file.track_id].source}</div>
                          {alternativeSearchResults[file.track_id].title && (
                            <div><strong>Название:</strong> {alternativeSearchResults[file.track_id].title}</div>
                          )}
                          {alternativeSearchResults[file.track_id].artist && (
                            <div><strong>Исполнитель:</strong> {alternativeSearchResults[file.track_id].artist}</div>
                          )}
                          {alternativeSearchResults[file.track_id].releases && alternativeSearchResults[file.track_id].releases!.length > 0 && (
                            <div className="mt-2">
                              <strong>Релизы:</strong>
                              <ul className="list-disc list-inside ml-2 space-y-1">
                                {alternativeSearchResults[file.track_id].releases!.slice(0, 3).map((release, idx) => (
                                  <li key={idx} className="text-xs">
                                    {release.title} {release.date && `(${release.date})`} {release.label && `- ${release.label}`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const savePath = prompt('Введите путь для сохранения аналога:')
                            if (savePath) {
                              handleDownloadAlternativeConfirm(file.track_id, savePath)
                            }
                          }}
                          disabled={downloadingAlternatives.has(file.track_id)}
                          icon={Download}
                          loading={downloadingAlternatives.has(file.track_id)}
                        >
                          {downloadingAlternatives.has(file.track_id) ? 'Скачивание...' : 'Скачать аналог'}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center justify-between">
                          <span>Аналог не найден</span>
                          <button
                            onClick={() => {
                              const newResults = { ...alternativeSearchResults }
                              delete newResults[file.track_id]
                              setAlternativeSearchResults(newResults)
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        {alternativeSearchResults[file.track_id].message && (
                          <div className="text-xs text-gray-500 mt-1">{alternativeSearchResults[file.track_id].message}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
            ) : (
              <div className="text-center py-8">
                <FileAudio size={64} className="mx-auto text-gray-400 mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Файлы не найдены</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery || filterYear || filterGenre || filterLabel
                    ? 'Нет файлов, соответствующих фильтрам'
                    : selectedQuality 
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