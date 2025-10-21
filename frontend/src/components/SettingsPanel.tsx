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
import TokenHelper from './TokenHelper'
import TokenManager from './TokenManager'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { StatusBadge } from './ui/StatusBadge'

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
      <Card className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 p-6 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-t-xl">
          <SettingsIcon size={24} />
          <h2 className="text-2xl font-semibold">Настройки</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-300 border-t-primary-500 mb-4"></div>
          <p>Загрузка настроек...</p>
        </div>
      </Card>
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

  const navSections = [
    { id: 'tokens', label: 'Токены', icon: Key },
    { id: 'download', label: 'Загрузка', icon: Download },
    { id: 'files', label: 'Файлы', icon: FileText },
    { id: 'sync', label: 'Синхронизация', icon: Clock }
  ] as const

  return (
    <Card className="max-w-4xl mx-auto overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
        <div className="flex items-center gap-3">
          <SettingsIcon size={24} />
          <h2 className="text-2xl font-semibold">Настройки</h2>
        </div>
        <StatusBadge
          status={isConnected ? 'connected' : 'disconnected'}
          icon={isConnected ? Wifi : WifiOff}
        >
          {isConnected ? 'Подключено' : 'Не подключено'}
        </StatusBadge>
      </div>

      {/* Навигация по разделам */}
      <div className="flex bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {navSections.map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-3 border-transparent ${activeSection === section.id
                  ? 'text-primary-500 bg-white dark:bg-gray-900 border-primary-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveSection(section.id)}
            >
              <Icon size={18} />
              <span>{section.label}</span>
            </button>
          )
        })}
      </div>

      {/* Контент разделов */}
      <div className="p-6 min-h-96">
        {activeSection === 'tokens' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Key size={20} className="text-primary-500" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Управление токенами</h3>
                <p className="text-gray-600 dark:text-gray-400">Добавляйте, редактируйте и управляйте токенами Яндекс.Музыки</p>
              </div>
            </div>
            <TokenManager onTokenChange={handleTokenChange} />
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="secondary"
                onClick={() => setIsTokenHelperOpen(true)}
                icon={HelpCircle}
              >
                Как получить токен?
              </Button>
            </div>
          </div>
        )}

        {activeSection === 'download' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Download size={20} className="text-primary-500" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Настройки загрузки</h3>
                <p className="text-gray-600 dark:text-gray-400">Настройте путь сохранения и качество аудио</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <FolderOpen size={16} />
                  Путь для сохранения
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
                    onClick={() => console.log('Выбор папки')}
                    icon={FolderOpen}
                    className="px-3"
                  >
                    Выбрать
                  </Button>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <Palette size={16} />
                  Качество аудио
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="input-field"
                >
                  <option value="lossless">Lossless (FLAC 24-bit/96kHz)</option>
                  <option value="high">Высокое (FLAC 16-bit/44.1kHz)</option>
                  <option value="medium">Среднее (320 kbps MP3)</option>
                  <option value="low">Стандартное (256 kbps AAC)</option>
                </select>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-gray-100">Рекомендуется:</strong> Lossless для аудиофильского оборудования
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'files' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              <FileText size={20} className="text-primary-500" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Структура файлов</h3>
                <p className="text-gray-600 dark:text-gray-400">Настройте шаблоны имен файлов и папок</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Шаблон имени файла"
                value={fileTemplate}
                onChange={setFileTemplate}
                placeholder="{artist} - {title}"
                helpText="Доступные переменные: {artist}, {title}, {album}, {year}, {track}"
                className="font-mono text-sm"
              />

              <Input
                label="Структура папок"
                value={folderStructure}
                onChange={setFolderStructure}
                placeholder="{artist}/{album}"
                helpText="Создавать подпапки по исполнителю и альбому"
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}

        {activeSection === 'sync' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Clock size={20} className="text-primary-500" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Автоматическая синхронизация</h3>
                <p className="text-gray-600 dark:text-gray-400">Настройте автоматическое обновление плейлистов</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Включить автоматическую синхронизацию
                </label>
              </div>

              {autoSync && (
                <div>
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <Clock size={16} />
                    Интервал синхронизации
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                      className="w-24 text-center input-field"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">часов</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Минимум: 1 час, максимум: 168 часов (1 неделя)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="flex justify-end p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="success"
          onClick={saveSettings}
          disabled={isSaving}
          loading={isSaving}
          icon={Save}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
        </Button>
      </div>

      {/* Модальное окно помощи */}
      <TokenHelper
        isOpen={isTokenHelperOpen}
        onClose={() => setIsTokenHelperOpen(false)}
        onTokenReceived={handleTokenReceived}
      />
    </Card>
  )
}

export default SettingsPanel