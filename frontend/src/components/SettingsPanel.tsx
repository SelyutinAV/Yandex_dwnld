import { AlertCircle, CheckCircle, FolderOpen, HelpCircle, Key, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import './SettingsPanel.css'
import TokenHelper from './TokenHelper'
import TokenManager from './TokenManager'

interface SettingsPanelProps {
  onConnectionChange: (connected: boolean) => void
}

function SettingsPanel({ onConnectionChange }: SettingsPanelProps) {
  const [token, setToken] = useState('')
  const [downloadPath, setDownloadPath] = useState('/home/user/Music/Yandex')
  const [quality, setQuality] = useState('max')
  const [autoSync, setAutoSync] = useState(false)
  const [syncInterval, setSyncInterval] = useState('24')
  const [isConnected, setIsConnected] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTokenHelperOpen, setIsTokenHelperOpen] = useState(false)

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
        setToken(settings.token || '')
        setDownloadPath(settings.downloadPath || '/home/user/Music/Yandex')
        setQuality(settings.quality || 'lossless')
        setAutoSync(settings.autoSync || false)
        setSyncInterval(settings.syncInterval?.toString() || '24')

        // Если есть токен, проверяем соединение
        if (settings.token) {
          setIsConnected(true)
          onConnectionChange(true)
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
        <h2>Настройки</h2>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  const testConnection = async () => {
    if (!token) {
      setTestResult('error')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('http://localhost:8000/api/auth/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token
        })
      })

      if (response.ok) {
        setTestResult('success')
        setIsConnected(true)
        onConnectionChange(true)
      } else {
        setTestResult('error')
        setIsConnected(false)
        onConnectionChange(false)
      }
    } catch (error) {
      console.error('Ошибка проверки подключения:', error)
      setTestResult('error')
      setIsConnected(false)
      onConnectionChange(false)
    } finally {
      setIsTesting(false)
    }
  }

  const saveSettings = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          downloadPath: downloadPath,
          quality: quality,
          autoSync: autoSync,
          syncInterval: parseInt(syncInterval)
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
    }
  }

  const handleTokenReceived = (newToken: string) => {
    setToken(newToken)
    setIsConnected(true)
    onConnectionChange(true)
    setTestResult('success')
  }

  const handleTokenChange = (newToken: string) => {
    setToken(newToken)
    if (newToken) {
      setIsConnected(true)
      onConnectionChange(true)
      setTestResult('success')
    } else {
      setIsConnected(false)
      onConnectionChange(false)
      setTestResult(null)
    }
  }

  return (
    <div className="settings-panel">
      <h2>Настройки</h2>

      <TokenManager onTokenChange={handleTokenChange} />

      <div className="settings-section">
        <h3>
          <Key size={20} />
          Подключение к Яндекс.Музыке
        </h3>

        <div className="form-group">
          <label>Токен авторизации:</label>
          <div className="token-input-group">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Введите токен Яндекс.Музыки"
            />
            <button
              onClick={testConnection}
              disabled={isTesting || !token}
              className="test-button"
            >
              {isTesting ? 'Проверка...' : 'Проверить'}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult}`}>
              {testResult === 'success' ? (
                <>
                  <CheckCircle size={16} />
                  Подключение успешно!
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  Ошибка подключения. Проверьте токен.
                </>
              )}
            </div>
          )}

          {isConnected && !testResult && (
            <div className="test-result success">
              <CheckCircle size={16} />
              Подключение активно
            </div>
          )}

          <div className="help-text">
            <button
              onClick={() => setIsTokenHelperOpen(true)}
              className="get-token-button"
            >
              <HelpCircle size={16} />
              Получить токен
            </button>
            <span className="help-divider">или</span>
            <a href="https://music.yandex.ru/api" target="_blank" rel="noopener noreferrer">
              Инструкция вручную
            </a>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>
          <FolderOpen size={20} />
          Настройки загрузки
        </h3>

        <div className="form-group">
          <label>Путь для сохранения:</label>
          <div className="path-input-group">
            <input
              type="text"
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.target.value)}
              placeholder="/path/to/music"
            />
            <button onClick={() => console.log('Выбор папки')}>
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Качество аудио:</label>
          <select value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="max">Максимальное (FLAC 24-bit/96kHz)</option>
            <option value="high">Высокое (FLAC 16-bit/44.1kHz)</option>
            <option value="medium">Среднее (320 kbps MP3)</option>
            <option value="low">Стандартное (256 kbps AAC)</option>
          </select>
          <div className="help-text">
            Рекомендуется максимальное качество для аудиофильского оборудования
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
            <span>Автоматическая синхронизация</span>
          </label>
        </div>

        {autoSync && (
          <div className="form-group">
            <label>Интервал синхронизации (часы):</label>
            <input
              type="number"
              min="1"
              max="168"
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Структура файлов</h3>

        <div className="form-group">
          <label>Шаблон имени файла:</label>
          <input
            type="text"
            defaultValue="{artist} - {title}"
            placeholder="{artist} - {title}"
          />
          <div className="help-text">
            Доступные переменные: {'{artist}'}, {'{title}'}, {'{album}'}, {'{year}'}, {'{track}'}
          </div>
        </div>

        <div className="form-group">
          <label>Структура папок:</label>
          <input
            type="text"
            defaultValue="{artist}/{album}"
            placeholder="{artist}/{album}"
          />
          <div className="help-text">
            Создавать подпапки по исполнителю и альбому
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button onClick={saveSettings} className="save-button">
          <Save size={18} />
          Сохранить настройки
        </button>
      </div>

      <TokenHelper
        isOpen={isTokenHelperOpen}
        onClose={() => setIsTokenHelperOpen(false)}
        onTokenReceived={handleTokenReceived}
      />
    </div>
  )
}

export default SettingsPanel

