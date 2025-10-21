import { FileAudio, FolderOpen, HardDrive, Music, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface FileStats {
  totalFiles: number
  totalSize: number
  byFormat: Record<string, { count: number; size: number }>
  byQuality: Record<string, number>
}

interface AudioFile {
  path: string
  title: string
  artist: string
  format: string
  bitrate: string
  sampleRate: string
  size: number
}

function FileAnalyzer() {
  const [loading, setLoading] = useState(false)
  const [downloadPath, setDownloadPath] = useState('/home/user/Music/Yandex')
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 342,
    totalSize: 28.7 * 1024, // в МБ
    byFormat: {
      'FLAC': { count: 256, size: 22.3 * 1024 },
      'MP3': { count: 68, size: 4.2 * 1024 },
      'AAC': { count: 18, size: 2.2 * 1024 }
    },
    byQuality: {
      '24-bit/96kHz': 128,
      '24-bit/48kHz': 98,
      '16-bit/44.1kHz': 30,
      '320 kbps': 68,
      '256 kbps': 18
    }
  })

  const [recentFiles] = useState<AudioFile[]>([
    {
      path: '/home/user/Music/Yandex/Queen/Bohemian Rhapsody.flac',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      format: 'FLAC',
      bitrate: '24-bit',
      sampleRate: '96kHz',
      size: 87.3
    },
    {
      path: '/home/user/Music/Yandex/Eagles/Hotel California.flac',
      title: 'Hotel California',
      artist: 'Eagles',
      format: 'FLAC',
      bitrate: '24-bit',
      sampleRate: '96kHz',
      size: 92.1
    }
  ])

  const analyzeFiles = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/files/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Ошибка получения статистики файлов')
      }
    } catch (error) {
      console.error('Ошибка анализа файлов:', error)
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

  const selectFolder = () => {
    // TODO: Открыть диалог выбора папки
    console.log('Выбор папки')
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Анализ файлов</h2>
        <Button
          variant="secondary"
          onClick={analyzeFiles}
          disabled={loading}
          icon={RefreshCw}
          loading={loading}
        >
          Обновить анализ
        </Button>
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
          />
          <Button
            variant="secondary"
            onClick={selectFolder}
            icon={FolderOpen}
          >
            Выбрать
          </Button>
        </div>
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
                {formatSize(stats.totalSize / stats.totalFiles)}
              </div>
            </div>
          </div>
        </Card>
      </div>

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

      <Card className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Недавно добавленные</h3>
        <div className="space-y-4">
          {recentFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FileAudio size={24} className="text-primary-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{file.artist}</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{file.path}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs font-medium">
                  {file.format}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{file.bitrate} / {file.sampleRate}</span>
                <span className="text-gray-500 dark:text-gray-500">{formatSize(file.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default FileAnalyzer