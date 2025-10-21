import { useState } from 'react'
import { FolderOpen, FileAudio, HardDrive, Music, RefreshCw } from 'lucide-react'
import './FileAnalyzer.css'

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

  const [recentFiles, setRecentFiles] = useState<AudioFile[]>([
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
    // TODO: Запрос к API для анализа файлов
    setTimeout(() => {
      setLoading(false)
    }, 1500)
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
    <div className="file-analyzer">
      <div className="analyzer-header">
        <h2>Анализ файлов</h2>
        <button onClick={analyzeFiles} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Обновить анализ
        </button>
      </div>

      <div className="path-selector">
        <label>Путь к загруженным файлам:</label>
        <div className="path-input-group">
          <input 
            type="text" 
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            placeholder="/path/to/music"
          />
          <button onClick={selectFolder}>
            <FolderOpen size={18} />
            Выбрать
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FileAudio size={32} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Всего файлов</div>
            <div className="stat-value">{stats.totalFiles}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HardDrive size={32} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Общий размер</div>
            <div className="stat-value">{formatSize(stats.totalSize)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Music size={32} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Средний размер</div>
            <div className="stat-value">
              {formatSize(stats.totalSize / stats.totalFiles)}
            </div>
          </div>
        </div>
      </div>

      <div className="analysis-section">
        <h3>Распределение по форматам</h3>
        <div className="format-list">
          {Object.entries(stats.byFormat).map(([format, data]) => (
            <div key={format} className="format-item">
              <div className="format-info">
                <span className="format-name">{format}</span>
                <span className="format-count">{data.count} файлов</span>
              </div>
              <div className="format-size">{formatSize(data.size)}</div>
              <div className="format-bar">
                <div 
                  className="format-bar-fill"
                  style={{ 
                    width: `${(data.count / stats.totalFiles) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="analysis-section">
        <h3>Качество аудио</h3>
        <div className="quality-grid">
          {Object.entries(stats.byQuality).map(([quality, count]) => (
            <div key={quality} className="quality-badge">
              <div className="quality-name">{quality}</div>
              <div className="quality-count">{count} файлов</div>
            </div>
          ))}
        </div>
      </div>

      <div className="analysis-section">
        <h3>Недавно добавленные</h3>
        <div className="recent-files">
          {recentFiles.map((file, index) => (
            <div key={index} className="file-item">
              <FileAudio size={24} className="file-icon" />
              <div className="file-info">
                <div className="file-title">{file.title}</div>
                <div className="file-artist">{file.artist}</div>
                <div className="file-path">{file.path}</div>
              </div>
              <div className="file-specs">
                <span className="file-format">{file.format}</span>
                <span className="file-quality">{file.bitrate} / {file.sampleRate}</span>
                <span className="file-size">{formatSize(file.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FileAnalyzer

