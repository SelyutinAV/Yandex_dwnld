import {
    AlertCircle,
    CheckCircle,
    Download,
    FileText,
    FolderOpen,
    FolderPlus,
    HelpCircle,
    Info,
    Key,
    Palette,
    Power,
    RefreshCw,
    Save,
    ScrollText,
    Settings as SettingsIcon,
    Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import AccountManager from './AccountManager'
import FolderBrowser from './FolderBrowser'
import TokenHelper from './TokenHelper'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { ThemeToggle } from './ui/ThemeToggle'

interface SettingsPanelProps {
  onConnectionChange: (connected: boolean) => void
}

function SettingsPanel({ onConnectionChange }: SettingsPanelProps) {
  // Состояние для настроек
  const [downloadPath, setDownloadPath] = useState('/home/urch/Music/Yandex')
  const [quality, setQuality] = useState('lossless')
  const [fileTemplate, setFileTemplate] = useState('{artist} - {title}')
  const [folderStructure, setFolderStructure] = useState('{artist}/{album}')

  // Состояние для логов
  const [logs, setLogs] = useState<string[]>([])
  const [logType, setLogType] = useState<string>('downloads')
  const [logLines, setLogLines] = useState<number>(100)
  const [logStats, setLogStats] = useState<any>(null)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  // Состояние для соединения
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Состояние для проверки файлов
  const [isCheckingFiles, setIsCheckingFiles] = useState(false)
  const [fileCheckResult, setFileCheckResult] = useState<any>(null)
  
  // Состояние для отображения количества файлов
  const [totalFilesCount, setTotalFilesCount] = useState<number>(0)


  // Состояние для UI
  const [isTokenHelperOpen, setIsTokenHelperOpen] = useState(false)
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'tokens' | 'download' | 'logs' | 'system'>('tokens')

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    loadSettings()
    loadLogStats()
    loadFilesCount()
  }, [])

  // Загрузка логов при изменении типа или количества строк
  useEffect(() => {
    if (logType) {
      loadLogs()
    }
  }, [logType, logLines])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/settings')
      if (response.ok) {
        const settings = await response.json()
        setDownloadPath(settings.downloadPath || '/home/urch/Music/Yandex')
        setQuality(settings.quality || 'lossless')
        setFileTemplate(settings.fileTemplate || '{artist} - {title}')
        setFolderStructure(settings.folderStructure || '{artist}/{album}')

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

  // Функция для загрузки количества файлов
  const loadFilesCount = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/stats')
      if (response.ok) {
        const data = await response.json()
        setTotalFilesCount(data.totalTracks || 0)
      }
    } catch (error) {
      console.error('Ошибка загрузки количества файлов:', error)
    }
  }

  // Функции для работы с логами
  const loadLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch(`http://localhost:8000/api/logs?log_type=${logType}&lines=${logLines}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки логов:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const loadLogStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/logs/stats')
      if (response.ok) {
        const stats = await response.json()
        setLogStats(stats)
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики логов:', error)
    }
  }

  const clearLogs = async () => {
    if (!confirm('Вы уверены, что хотите очистить все логи?')) {
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/logs', {
        method: 'DELETE'
      })
      if (response.ok) {
        const result = await response.json()
        // Логи успешно очищены - обновляем интерфейс без дополнительных всплывающих окон
        setLogs([])
        loadLogStats()
        console.log(`Логи очищены! Удалено файлов: ${result.files.length}`)
      }
    } catch (error) {
      console.error('Ошибка очистки логов:', error)
      // Ошибки также логируем в консоль вместо всплывающих окон
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
      // Сначала получаем текущие настройки, чтобы получить токен
      const settingsResponse = await fetch('http://localhost:8000/api/settings')
      const currentSettings = await settingsResponse.json()

      const response = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: currentSettings.token || '', // Передаем текущий токен
          downloadPath: downloadPath,
          quality: quality,
          fileTemplate: fileTemplate,
          folderStructure: folderStructure
        })
      })

      if (response.ok) {
        console.log('Настройки сохранены успешно')
        alert('Настройки успешно сохранены!')
      } else {
        const error = await response.json()
        console.error('Ошибка сохранения настроек:', error)
        alert(`Ошибка сохранения настроек: ${error.detail || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error)
      alert(`Ошибка сохранения настроек: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsSaving(false)
    }
  }


  const handleTokenReceived = () => {
    setIsConnected(true)
    onConnectionChange(true)
  }

  const handleAccountChange = (account: any) => {
    if (account) {
      setIsConnected(true)
      onConnectionChange(true)
    } else {
      setIsConnected(false)
      onConnectionChange(false)
    }
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
        setIsFolderBrowserOpen(false)
      } else {
        console.error('Ошибка при сохранении пути')
        alert('Ошибка при сохранении пути')
      }
    } catch (error) {
      console.error('Ошибка при подтверждении выбора:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  const handleSystemRestart = async () => {
    if (!window.confirm('Вы уверены, что хотите перезапустить всю систему? Это займет несколько секунд.')) {
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/system/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        alert('Система перезапускается... Пожалуйста, подождите несколько секунд и обновите страницу.')
        // Через 5 секунд обновляем страницу
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      } else {
        console.error('Ошибка при перезапуске системы')
        alert('Ошибка при перезапуске системы')
      }
    } catch (error) {
      console.error('Ошибка при перезапуске системы:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  const handleStopScanning = async () => {
    if (!window.confirm('Вы уверены, что хотите остановить сканирование папок? Это может прервать анализ файлов.')) {
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/folders/scan-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Сканирование папок остановлено. Приложение перезапускается...')
        // Через 5 секунд обновляем страницу
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      } else {
        console.error('Ошибка при остановке сканирования')
        alert('Ошибка при остановке сканирования')
      }
    } catch (error) {
      console.error('Ошибка при остановке сканирования:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  const handleCheckFiles = async () => {
    setIsCheckingFiles(true)
    setFileCheckResult(null)

    try {
      const response = await fetch('http://localhost:8000/api/files/check-missing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const result = await response.json()
        setFileCheckResult(result)
        // Обновляем количество файлов после проверки
        await loadFilesCount()
        console.log('Проверка файлов завершена:', result)
      } else {
        const error = await response.json()
        console.error('Ошибка проверки файлов:', error)
        alert(`Ошибка проверки файлов: ${error.detail || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Ошибка проверки файлов:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsCheckingFiles(false)
    }
  }

  const navSections = [
    { id: 'tokens', label: 'Токены', icon: Key, description: 'Управление токенами доступа' },
    { id: 'download', label: 'Загрузка', icon: Download, description: 'Настройки загрузки музыки' },
    { id: 'logs', label: 'Логи', icon: ScrollText, description: 'Просмотр и очистка логов' },
    { id: 'system', label: 'Система', icon: Power, description: 'Управление системой' }
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
          <div className="flex items-center justify-start">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">Тема:</span>
              <ThemeToggle />
            </div>
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
            className="w-full"
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
              <AccountManager onAccountChange={handleAccountChange} />
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  onClick={() => setIsTokenHelperOpen(true)}
                  icon={HelpCircle}
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
                <div className="flex gap-3">
                  <Input
                    label="Путь для сохранения"
                    value={downloadPath}
                    onChange={setDownloadPath}
                    placeholder="/path/to/music"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleSelectDownloadPath}
                    icon={FolderPlus}
                    className="mt-6"
                  >
                    Выбрать папку
                  </Button>
                </div>
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
                  <option value="lossless">Lossless (FLAC 16-bit/44.1kHz) - CD качество 🎵</option>
                  <option value="hq">High Quality (AAC 256kbps / MP3 320kbps)</option>
                  <option value="nq">Normal Quality (MP3 192kbps)</option>
                </select>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  💡 Для FLAC требуется подписка Яндекс.Плюс. Без подписки будет выбран лучший доступный формат.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Рекомендуется:</strong> Lossless для максимального качества звука
                </p>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
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
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Пример результата:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {fileTemplate.replace('{artist}', 'Radiohead').replace('{title}', 'Creep').replace('{album}', 'Pablo Honey').replace('{year}', '1993').replace('{track}', '01').replace('{playlist}', 'Мой плейлист')}.flac
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Доступные переменные:</p>
                  <div className="flex flex-wrap gap-2">
                    {['{artist}', '{title}', '{album}', '{year}', '{track}', '{playlist}'].map((variable) => (
                      <button
                        key={variable}
                        onClick={() => setFileTemplate(prev => prev + variable)}
                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg text-sm font-mono hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors cursor-pointer"
                        title={`Добавить ${variable} в шаблон`}
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Нажмите на переменную, чтобы добавить её в шаблон
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
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
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Пример структуры:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {downloadPath}/{folderStructure.replace('{artist}', 'Radiohead').replace('{album}', 'Pablo Honey').replace('{playlist}', 'Мой плейлист')}/
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Доступные переменные:</p>
                  <div className="flex flex-wrap gap-2">
                    {['{artist}', '{album}', '{year}', '{playlist}'].map((variable) => (
                      <button
                        key={variable}
                        onClick={() => setFolderStructure(prev => prev + variable)}
                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg text-sm font-mono hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors cursor-pointer"
                        title={`Добавить ${variable} в структуру папок`}
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Нажмите на переменную, чтобы добавить её в структуру папок
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Info size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Предварительный просмотр</h4>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">📁 Полный путь:</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                        {downloadPath}/{folderStructure.replace('{artist}', 'Pink Floyd').replace('{album}', 'The Dark Side of the Moon').replace('{playlist}', 'Мой плейлист')}/{fileTemplate.replace('{artist}', 'Pink Floyd').replace('{title}', 'Money').replace('{album}', 'The Dark Side of the Moon').replace('{year}', '1973').replace('{track}', '06').replace('{playlist}', 'Мой плейлист')}.flac
                      </p>
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        <strong>Пример:</strong> Pink Floyd - Money.flac в папке Pink Floyd/The Dark Side of the Moon/
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'logs' && (
            <div className="space-y-6">
              {/* Статистика логов */}
              {logStats && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Info size={20} className="text-blue-600 dark:text-blue-400" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Статистика логов</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{logStats.files_count}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Файлов</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{logStats.total_size_mb} МБ</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Общий размер</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {Object.values(logStats.files).reduce((sum: number, file: any) => sum + file.lines, 0)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Строк</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Настройки просмотра */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ScrollText size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Просмотр логов</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Тип логов
                    </label>
                    <select
                      value={logType}
                      onChange={(e) => setLogType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="downloads">Загрузки (downloads.log)</option>
                      <option value="errors">Ошибки (errors.log)</option>
                      <option value="main">Основные (yandex_music.log)</option>
                      <option value="all">Все логи</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Количество строк
                    </label>
                    <select
                      value={logLines}
                      onChange={(e) => setLogLines(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={50}>50 строк</option>
                      <option value={100}>100 строк</option>
                      <option value={200}>200 строк</option>
                      <option value={500}>500 строк</option>
                      <option value={0}>Все строки</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={loadLogs}
                    disabled={isLoadingLogs}
                    icon={RefreshCw}
                  >
                    {isLoadingLogs ? 'Загрузка...' : 'Обновить'}
                  </Button>

                  <Button
                    variant="error"
                    onClick={clearLogs}
                    icon={Trash2}
                  >
                    Очистить все логи
                  </Button>
                </div>
              </div>

              {/* Отображение логов */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Содержимое логов</h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {logs.length} строк
                  </span>
                </div>

                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                  {isLoadingLogs ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Загрузка логов...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-gray-500">Логи не найдены</div>
                  ) : (
                    logs.map((line, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Информация о логах */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Информация о логах</h5>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• <strong>Загрузки</strong> - логи процесса скачивания треков</li>
                      <li>• <strong>Ошибки</strong> - только ошибки и исключения</li>
                      <li>• <strong>Основные</strong> - все логи приложения</li>
                      <li>• <strong>Все логи</strong> - объединенные логи всех типов</li>
                      <li>• Логи автоматически ротируются при достижении 10 МБ</li>
                      <li>• Для отладки FLAC смотрите логи "Загрузки"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'system' && (
            <div className="space-y-6">
              {/* Управление системой */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Power size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Управление системой</h4>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">Полный перезапуск системы</h5>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                        Эта операция остановит и перезапустит все серверы приложения (backend и frontend).
                        Процесс займет несколько секунд.
                      </p>
                      <Button
                        variant="error"
                        onClick={handleSystemRestart}
                        icon={Power}
                      >
                        Перезапустить систему
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Остановить сканирование папок</h5>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                        Если приложение зависло из-за сканирования большой сетевой папки, используйте эту кнопку для принудительной остановки.
                      </p>
                      <Button
                        variant="warning"
                        onClick={handleStopScanning}
                        icon={RefreshCw}
                      >
                        Остановить сканирование
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Проверка файлов</h5>
                      <div className="mb-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Всего файлов в базе данных: <span className="font-bold">{totalFilesCount.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                        Проверить физическое наличие файлов и удалить записи о несуществующих файлах из базы данных.
                        Это поможет очистить базу от "мертвых" записей.
                      </p>
                      <Button
                        variant="primary"
                        onClick={handleCheckFiles}
                        disabled={isCheckingFiles}
                        icon={CheckCircle}
                      >
                        {isCheckingFiles ? 'Проверка...' : 'Проверить файлы'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Результаты проверки файлов */}
              {fileCheckResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-primary-500" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Результаты проверки файлов</h4>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                          ✅ Проверка завершена
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {fileCheckResult.message}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {fileCheckResult.details.total_checked}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Проверено</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            {fileCheckResult.details.existing_files}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Найдено</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-red-600 dark:text-red-400">
                            {fileCheckResult.details.missing_files}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Отсутствует</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            {fileCheckResult.details.deleted_records}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Удалено</div>
                        </div>
                      </div>
                      
                      {fileCheckResult.details.checked_tables && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Проверенные таблицы:
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {fileCheckResult.details.checked_tables.map((table: string, index: number) => (
                              <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-mono">
                                {table}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {fileCheckResult.details.missing_file_details && fileCheckResult.details.missing_file_details.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Удаленные записи:
                          </h5>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-32 overflow-y-auto">
                            {fileCheckResult.details.missing_file_details.map((file: any, index: number) => (
                              <div key={index} className="text-sm text-gray-600 dark:text-gray-400 py-1">
                                • {file.title} - {file.artist} ({file.playlist_id}) [{file.table_name}]
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Информация о системе */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Info size={20} className="text-primary-500" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Информация о системе</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Backend</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Порт: 8000</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Статус: {isConnected ? 'Подключен' : 'Отключен'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Frontend</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Порт: 3000</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Статус: Активен</p>
                  </div>
                </div>
              </div>

              {/* Предупреждение */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Важно</h5>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• Перезапуск остановит все активные загрузки</li>
                      <li>• Несохраненные настройки будут потеряны</li>
                      <li>• После перезапуска страница автоматически обновится</li>
                      <li>• Процесс займет 5-10 секунд</li>
                    </ul>
                  </div>
                </div>
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

      {/* Браузер папок */}
      <FolderBrowser
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onConfirm={handleFolderConfirm}
        title="Выберите папку для сохранения"
        initialPath={downloadPath}
      />
    </div>
  )
}

export default SettingsPanel
