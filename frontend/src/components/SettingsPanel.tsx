import {
  Clock,
  Download,
  FileText,
  FolderOpen,
  HelpCircle,
  Key,
  Palette,
  Save,
  Settings as SettingsIcon,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useEffect, useState } from 'react'
import './SettingsPanel.css'
import TokenHelper from './TokenHelper'
import TokenManager from './TokenManager'

interface SettingsPanelProps {
  onConnectionChange: (connected: boolean) => void
}

function SettingsPanel({ onConnectionChange }: SettingsPanelProps) {
  // Состояние для настроек
  const [downloadPath, setDownloadPath] = useState('/home/user/Music/Yandex')
  const [quality, setQuality] = useState('lossless')
  const [autoSync, setAutoSync] = useState(false)
  const [syncInterval, setSyncInterval] = useState(24)
  const [fileTemplate, setFileTemplate] = useState('{artist} - {title}')
  const [folderStructure, setFolderStructure] = useState('{artist}/{album}')

  // Состояние для соединения
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Состояние для UI
  const [isTokenHelperOpen, setIsTokenHelperOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'tokens' | 'download' | 'files' | 'sync'>('tokens')

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/settings')
      if (response.ok) {
        const settings = await response.json()
        setDownloadPath(settings.downloadPath || '/home/user/Music/Yandex')
        setQuality(settings.quality || 'lossless')
        setAutoSync(settings.autoSync || false)
        setSyncInterval(settings.syncInterval || 24)

        // Проверяем соединение по наличию токена
        if (settings.token) {
          setIsConnected(true)
          onConnectionChange(true)
        } else {
          setIsConnected(false)
          onConnectionChange(false)
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className="settings-panel">
        <div className="settings-header">
          <SettingsIcon size={24} />
          <h2>Настройки</h2>
        </div>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          downloadPath: downloadPath,
          quality: quality,
          autoSync: autoSync,
          syncInterval: syncInterval
        })
      })

      if (response.ok) {
        console.log('Настройки сохранены успешно')
        // Можно добавить уведомление пользователю
      } else {
        console.error('Ошибка сохранения настроек')
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTokenReceived = () => {
    setIsConnected(true)
    onConnectionChange(true)
  }

  const handleTokenChange = (newToken: string) => {
    if (newToken) {
      setIsConnected(true)
      onConnectionChange(true)
    } else {
      setIsConnected(false)
      onConnectionChange(false)
    }
  }


  return (
    <div className="settings-panel">
      {/* Заголовок */}
      <div className="settings-header">
        <SettingsIcon size={24} />
        <h2>Настройки</h2>
        <div className="connection-status">
          {isConnected ? (
            <div className="status-connected">
              <Wifi size={16} />
              <span>Подключено</span>
            </div>
          ) : (
            <div className="status-disconnected">
              <WifiOff size={16} />
              <span>Не подключено</span>
            </div>
          )}
        </div>
      </div>

      {/* Навигация по разделам */}
      <div className="settings-nav">
        <button
          className={`nav-button ${activeSection === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveSection('tokens')}
        >
          <Key size={18} />
          <span>Токены</span>
        </button>
        <button
          className={`nav-button ${activeSection === 'download' ? 'active' : ''}`}
          onClick={() => setActiveSection('download')}
        >
          <Download size={18} />
          <span>Загрузка</span>
        </button>
        <button
          className={`nav-button ${activeSection === 'files' ? 'active' : ''}`}
          onClick={() => setActiveSection('files')}
        >
          <FileText size={18} />
          <span>Файлы</span>
        </button>
        <button
          className={`nav-button ${activeSection === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveSection('sync')}
        >
          <Clock size={18} />
          <span>Синхронизация</span>
        </button>
      </div>

      {/* Контент разделов */}
      <div className="settings-content">
        {activeSection === 'tokens' && (
          <div className="settings-section">
            <div className="section-header">
              <Key size={20} />
              <h3>Управление токенами</h3>
              <p>Добавляйте, редактируйте и управляйте токенами Яндекс.Музыки</p>
            </div>
            <TokenManager onTokenChange={handleTokenChange} />
            <div className="help-section">
              <button
                onClick={() => setIsTokenHelperOpen(true)}
                className="help-button"
              >
                <HelpCircle size={16} />
                Как получить токен?
              </button>
            </div>
          </div>
        )}

        {activeSection === 'download' && (
          <div className="settings-section">
            <div className="section-header">
              <Download size={20} />
              <h3>Настройки загрузки</h3>
              <p>Настройте путь сохранения и качество аудио</p>
            </div>

            <div className="form-group">
              <label>
                <FolderOpen size={16} />
                Путь для сохранения
              </label>
              <div className="path-input-group">
                <input
                  type="text"
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  placeholder="/path/to/music"
                />
                <button
                  className="folder-button"
                  onClick={() => console.log('Выбор папки')}
                  title="Выбрать папку"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>
                <Palette size={16} />
                Качество аудио
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="quality-select"
              >
                <option value="lossless">Lossless (FLAC 24-bit/96kHz)</option>
                <option value="high">Высокое (FLAC 16-bit/44.1kHz)</option>
                <option value="medium">Среднее (320 kbps MP3)</option>
                <option value="low">Стандартное (256 kbps AAC)</option>
              </select>
              <div className="help-text">
                <strong>Рекомендуется:</strong> Lossless для аудиофильского оборудования
              </div>
            </div>
          </div>
        )}

        {activeSection === 'files' && (
          <div className="settings-section">
            <div className="section-header">
              <FileText size={20} />
              <h3>Структура файлов</h3>
              <p>Настройте шаблоны имен файлов и папок</p>
            </div>

            <div className="form-group">
              <label>Шаблон имени файла</label>
              <input
                type="text"
                value={fileTemplate}
                onChange={(e) => setFileTemplate(e.target.value)}
                placeholder="{artist} - {title}"
                className="template-input"
              />
              <div className="help-text">
                <strong>Доступные переменные:</strong> {'{artist}'}, {'{title}'}, {'{album}'}, {'{year}'}, {'{track}'}
              </div>
            </div>

            <div className="form-group">
              <label>Структура папок</label>
              <input
                type="text"
                value={folderStructure}
                onChange={(e) => setFolderStructure(e.target.value)}
                placeholder="{artist}/{album}"
                className="template-input"
              />
              <div className="help-text">
                Создавать подпапки по исполнителю и альбому
              </div>
            </div>
          </div>
        )}

        {activeSection === 'sync' && (
          <div className="settings-section">
            <div className="section-header">
              <Clock size={20} />
              <h3>Автоматическая синхронизация</h3>
              <p>Настройте автоматическое обновление плейлистов</p>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                />
                <span>Включить автоматическую синхронизацию</span>
              </label>
            </div>

            {autoSync && (
              <div className="form-group">
                <label>
                  <Clock size={16} />
                  Интервал синхронизации
                </label>
                <div className="sync-interval-group">
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                    className="interval-input"
                  />
                  <span className="interval-label">часов</span>
                </div>
                <div className="help-text">
                  Минимум: 1 час, максимум: 168 часов (1 неделя)
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="settings-actions">
        <button
          onClick={saveSettings}
          className="save-button"
          disabled={isSaving}
        >
          <Save size={18} />
          {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>

      {/* Модальное окно помощи */}
      <TokenHelper
        isOpen={isTokenHelperOpen}
        onClose={() => setIsTokenHelperOpen(false)}
        onTokenReceived={handleTokenReceived}
      />
    </div>
  )
}

export default SettingsPanel

