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
import { Input } from './ui/Input'

interface SettingsPanelProps {
  onConnectionChange: (connected: boolean) => void
}

function SettingsPanel({ onConnectionChange }: SettingsPanelProps) {
  // Состояние для настроек
  const [downloadPath, setDownloadPath] = useState('/home/urch/Music/Yandex')
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
        setDownloadPath(settings.downloadPath || '/home/urch/Music/Yandex')
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
      <div className="flex max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden min-h-[600px]">
        <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon size={24} />
              <h2 className="text-xl font-semibold">Настройки</h2>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-300 border-t-primary-500"></div>
            <p className="text-gray-500 dark:text-gray-400">Загрузка настроек...</p>
          </div>
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

  const navSections = [
    { id: 'tokens', label: 'Токены', icon: Key, description: 'Управление токенами' },
    { id: 'download', label: 'Загрузка', icon: Download, description: 'Настройки загрузки' },
    { id: 'files', label: 'Файлы', icon: FileText, description: 'Структура файлов' },
    { id: 'sync', label: 'Синхронизация', icon: Clock, description: 'Автосинхронизация' }
  ] as const

  const currentSection = navSections.find(section => section.id === activeSection)

  return (
    <div className="flex max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden min-h-[600px]">
      {/* Боковая навигация */}
      <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Заголовок */}
        <div className="p-6 bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon size={24} />
            <h2 className="text-xl font-semibold">Настройки</h2>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
                <Wifi size={12} />
                <span>Подключено</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                <WifiOff size={12} />
                <span>Не подключено</span>
              </div>
            )}
          </div>
        </div>

        {/* Навигационное меню */}
        <nav className="flex-1 p-4 space-y-2">
          {navSections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                className={`w-full flex flex-col items-start gap-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === section.id
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                onClick={() => setActiveSection(section.id as typeof activeSection)}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{section.label}</span>
                </div>
                <span className={`text-xs ml-6 ${activeSection === section.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {section.description}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Нижняя часть боковой панели */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="success"
            onClick={saveSettings}
            disabled={isSaving}
            loading={isSaving}
            icon={Save}
            className="w-full shadow-md hover:shadow-lg bg-green-500 hover:bg-green-600"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex flex-col">
        {/* Заголовок раздела */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            {currentSection && <currentSection.icon size={24} className="text-primary-500" />}
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {currentSection?.label}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {currentSection?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Контент раздела */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeSection === 'tokens' && (
            <div className="space-y-6">
              <TokenManager onTokenChange={handleTokenChange} />
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  onClick={() => setIsTokenHelperOpen(true)}
                  icon={HelpCircle}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  ? Как получить токен?
                </Button>
              </div>
            </div>
          )}

          {activeSection === 'download' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FolderOpen size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Путь для сохранения</h4>
                </div>
                <Input
                  label="Путь для сохранения"
                  value={downloadPath}
                  onChange={setDownloadPath}
                  placeholder="/path/to/music"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Укажите папку, куда будут сохраняться загруженные файлы
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Palette size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Качество аудио</h4>
                </div>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="lossless">Lossless (FLAC 24-bit/96kHz)</option>
                  <option value="high">Высокое (FLAC 16-bit/44.1kHz)</option>
                  <option value="medium">Среднее (320 kbps MP3)</option>
                  <option value="low">Стандартное (256 kbps AAC)</option>
                </select>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Рекомендуется:</strong> Lossless для аудиофильского оборудования
                </p>
              </div>
            </div>
          )}

          {activeSection === 'files' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Шаблон имени файла</h4>
                </div>
                <Input
                  label="Шаблон имени файла"
                  value={fileTemplate}
                  onChange={setFileTemplate}
                  placeholder="{artist} - {title}"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Доступные переменные:</strong> {'{artist}'}, {'{title}'}, {'{album}'}, {'{year}'}, {'{track}'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FolderOpen size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Структура папок</h4>
                </div>
                <Input
                  label="Структура папок"
                  value={folderStructure}
                  onChange={setFolderStructure}
                  placeholder="{artist}/{album}"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Создавать подпапки по исполнителю и альбому
                </p>
              </div>
            </div>
          )}

          {activeSection === 'sync' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Автоматическая синхронизация</h4>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="w-4 h-4 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                  />
                  <label htmlFor="autoSync" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Включить автоматическую синхронизацию
                  </label>
                </div>

                {autoSync && (
                  <div className="space-y-4 pl-7">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-primary-500" />
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Интервал синхронизации
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={syncInterval}
                        onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">часов</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Минимум: 1 час, максимум: 168 часов (1 неделя)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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