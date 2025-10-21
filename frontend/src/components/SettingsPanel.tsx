import { useState } from 'react'
import { Save, Key, FolderOpen, CheckCircle, AlertCircle } from 'lucide-react'
import './SettingsPanel.css'

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

  const testConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    // TODO: Реальная проверка подключения к API
    setTimeout(() => {
      const success = token.length > 0
      setTestResult(success ? 'success' : 'error')
      setIsConnected(success)
      onConnectionChange(success)
      setIsTesting(false)
    }, 1500)
  }

  const saveSettings = async () => {
    // TODO: Сохранить настройки на сервере
    console.log('Сохранение настроек:', {
      token,
      downloadPath,
      quality,
      autoSync,
      syncInterval
    })
  }

  return (
    <div className="settings-panel">
      <h2>Настройки</h2>

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

          <div className="help-text">
            <a href="https://music.yandex.ru/api" target="_blank" rel="noopener noreferrer">
              Как получить токен?
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
    </div>
  )
}

export default SettingsPanel

