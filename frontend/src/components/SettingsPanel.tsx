import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Info,
  Key,
  Palette,
  RefreshCw,
  Save,
  ScrollText,
  Settings as SettingsIcon,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import TokenHelper from './TokenHelper'
import TokenManager from './TokenManager'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface SettingsPanelProps {
  onConnectionChange: (connected: boolean) => void
}

interface FolderTreeItemProps {
  path: string
  name: string
  level: number
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  onToggle: () => void
  onSelect: () => void
  children?: React.ReactNode
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  name,
  level,
  isExpanded,
  isSelected,
  hasChildren,
  onToggle,
  onSelect,
  children
}) => {
  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            {isExpanded ? (
              <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        {isExpanded && hasChildren ? (
          <FolderOpen size={18} className="text-blue-500" />
        ) : (
          <Folder size={18} className="text-blue-500" />
        )}
        <span
          className="flex-1 text-sm text-gray-900 dark:text-gray-100"
          onClick={onToggle}
        >
          {name}
        </span>
        <Button
          variant="secondary"
          onClick={onSelect}
          className={`text-xs px-2 py-1 ${isSelected
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-green-100 hover:bg-green-200 text-green-700'
            }`}
        >
          {isSelected ? <Check size={12} /> : 'Выбрать'}
        </Button>
      </div>
      {isExpanded && children}
    </div>
  )
}

function SettingsPanel({ onConnectionChange }: SettingsPanelProps) {
  // Состояние для настроек
  const [downloadPath, setDownloadPath] = useState('/home/urch/Music/Yandex')
  const [quality, setQuality] = useState('lossless')

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


  // Состояние для UI
  const [isTokenHelperOpen, setIsTokenHelperOpen] = useState(false)
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'tokens' | 'download' | 'logs'>('tokens')

  // Состояние для файлового браузера
  const [selectedPath, setSelectedPath] = useState('')
  const [editablePath, setEditablePath] = useState('')
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/home/urch']))
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  // Структура дерева папок (моковые данные)
  const folderTree: Record<string, string[]> = {
    '/': ['home', 'mnt', 'usr', 'opt'],
    '/home': ['urch'],
    '/home/urch': ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'Projects'],
    '/home/urch/Music': ['Yandex', 'Spotify', 'iTunes'],
    '/home/urch/Documents': ['Work', 'Personal', 'Archive'],
    '/home/urch/Downloads': [],
    '/home/urch/Projects': ['yandex_downloads', 'other-project'],
    '/mnt': ['storage', 'backup'],
    '/usr': ['local', 'share', 'bin'],
    '/opt': []
  }

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    loadSettings()
    loadLogStats()
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
        alert(`Логи очищены! Удалено файлов: ${result.files.length}`)
        setLogs([])
        loadLogStats()
      }
    } catch (error) {
      console.error('Ошибка очистки логов:', error)
      alert('Ошибка при очистке логов')
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
          quality: quality
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
    setSelectedPath(downloadPath)
    setEditablePath(downloadPath)
    setIsEditingPath(false)
    setIsFolderBrowserOpen(true)
  }

  const toggleFolder = (path: string) => {
    const newExpandedFolders = new Set(expandedFolders)
    if (expandedFolders.has(path)) {
      newExpandedFolders.delete(path)
    } else {
      newExpandedFolders.add(path)
    }
    setExpandedFolders(newExpandedFolders)
  }

  const handleCreateFolder = async () => {
    const folderName = prompt('Введите имя новой папки:')
    if (!folderName || !folderName.trim()) return

    const newFolderPath = selectedPath ? `${selectedPath}/${folderName.trim()}` : `/${folderName.trim()}`

    setIsCreatingFolder(true)
    try {
      const response = await fetch('http://localhost:8000/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: newFolderPath })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка создания папки')
      }

      await response.json()
      alert(`Папка "${newFolderPath}" успешно создана!`)
      setEditablePath(newFolderPath)
      setSelectedPath(newFolderPath)
    } catch (error) {
      console.error('Ошибка создания папки:', error)
      alert(`Ошибка при создании папки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const handleConfirmSelection = async () => {
    const pathToUse = isEditingPath ? editablePath : selectedPath

    if (pathToUse) {
      try {
        // Проверяем существование папки
        const checkResponse = await fetch(`http://localhost:8000/api/folders/exists?path=${encodeURIComponent(pathToUse)}`)
        const checkResult = await checkResponse.json()

        if (!checkResult.exists) {
          // Если папка не существует, предлагаем создать
          const shouldCreate = confirm(`Папка "${pathToUse}" не существует. Создать её?`)

          if (shouldCreate) {
            const createResponse = await fetch('http://localhost:8000/api/folders/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ path: pathToUse })
            })

            if (!createResponse.ok) {
              const error = await createResponse.json()
              throw new Error(error.detail || 'Ошибка создания папки')
            }

            alert(`Папка "${pathToUse}" успешно создана!`)
          } else {
            return // Не закрываем диалог если пользователь отказался
          }
        }

        setDownloadPath(pathToUse)
      } catch (error) {
        console.error('Ошибка при подтверждении выбора:', error)
        alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
        return // Не закрываем диалог при ошибке
      }
    }
    setIsFolderBrowserOpen(false)
    setIsEditingPath(false)
  }

  const buildFullPath = (parentPath: string, folderName: string): string => {
    if (parentPath === '/') return `/${folderName}`
    return `${parentPath}/${folderName}`
  }

  const hasSubfolders = (path: string): boolean => {
    return folderTree[path] && folderTree[path].length > 0
  }

  const renderFolderTree = (parentPath: string, level: number = 0): React.ReactNode => {
    const folders = folderTree[parentPath]
    if (!folders || folders.length === 0) return null

    return folders.map((folderName) => {
      const fullPath = buildFullPath(parentPath, folderName)
      const isExpanded = expandedFolders.has(fullPath)
      const isSelected = selectedPath === fullPath
      const hasChildren = hasSubfolders(fullPath)

      return (
        <FolderTreeItem
          key={fullPath}
          path={fullPath}
          name={folderName}
          level={level}
          isExpanded={isExpanded}
          isSelected={isSelected}
          hasChildren={hasChildren}
          onToggle={() => toggleFolder(fullPath)}
          onSelect={() => setSelectedPath(fullPath)}
        >
          {renderFolderTree(fullPath, level + 1)}
        </FolderTreeItem>
      )
    })
  }

  const navSections = [
    { id: 'tokens', label: 'Токены', icon: Key, description: 'Управление токенами доступа' },
    { id: 'download', label: 'Загрузка', icon: Download, description: 'Настройки загрузки музыки' },
    { id: 'logs', label: 'Логи', icon: ScrollText, description: 'Просмотр и очистка логов' }
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
                    className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700"
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
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Структура сохранения</h4>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">📁 Структура папок:</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                        {downloadPath}/<span className="text-primary-600 dark:text-primary-400">Исполнитель</span>/<span className="text-secondary-600 dark:text-secondary-400">Альбом</span>/
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">🎵 Формат имени файла:</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                        <span className="text-primary-600 dark:text-primary-400">Исполнитель</span> - <span className="text-secondary-600 dark:text-secondary-400">Название</span>.<span className="text-green-600 dark:text-green-400">flac/mp3</span>
                      </p>
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        <strong>Пример:</strong> {downloadPath}/Pink Floyd/The Dark Side of the Moon/Pink Floyd - Money.flac
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
                    onClick={loadLogs}
                    disabled={isLoadingLogs}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw size={16} className={isLoadingLogs ? 'animate-spin' : ''} />
                    {isLoadingLogs ? 'Загрузка...' : 'Обновить'}
                  </Button>

                  <Button
                    onClick={clearLogs}
                    variant="secondary"
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
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
        </div>
      </div>

      {/* Модальное окно помощи */}
      <TokenHelper
        isOpen={isTokenHelperOpen}
        onClose={() => setIsTokenHelperOpen(false)}
        onTokenReceived={handleTokenReceived}
      />

      {/* Модальное окно выбора папки */}
      {isFolderBrowserOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Заголовок */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FolderOpen size={24} className="text-primary-500" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Выберите папку для сохранения
                  </h3>
                </div>
                <button
                  onClick={() => setIsFolderBrowserOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Дерево папок */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {/* Корневая папка */}
                <FolderTreeItem
                  path="/"
                  name="Корневая папка (/)"
                  level={0}
                  isExpanded={expandedFolders.has('/')}
                  isSelected={selectedPath === '/'}
                  hasChildren={hasSubfolders('/')}
                  onToggle={() => toggleFolder('/')}
                  onSelect={() => setSelectedPath('/')}
                >
                  {renderFolderTree('/', 1)}
                </FolderTreeItem>
              </div>
            </div>

            {/* Выбранный путь и кнопки */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {isEditingPath ? 'Редактирование пути:' : 'Выбранный путь:'}
                  </p>
                  {selectedPath && !isEditingPath && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setIsEditingPath(true)
                          setEditablePath(selectedPath)
                        }}
                        icon={Edit}
                        className="text-xs px-2 py-1"
                      >
                        Изменить
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleCreateFolder}
                        icon={FolderPlus}
                        loading={isCreatingFolder}
                        className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700"
                      >
                        Создать папку
                      </Button>
                    </div>
                  )}
                </div>
                {isEditingPath ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editablePath}
                      onChange={(e) => setEditablePath(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="/home/user/Music/Yandex"
                    />
                    <Button
                      variant="success"
                      onClick={() => {
                        setSelectedPath(editablePath)
                        setIsEditingPath(false)
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      ✓
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsEditingPath(false)
                        setEditablePath(selectedPath)
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-3 rounded-lg text-sm font-mono text-primary-700 dark:text-primary-300">
                    {selectedPath || 'Не выбрано'}
                  </div>
                )}
              </div>

              {isEditingPath && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Подсказка:</strong> Вы можете указать несуществующую папку, и она будет создана автоматически при первой загрузке.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsFolderBrowserOpen(false)
                    setIsEditingPath(false)
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSelection}
                  disabled={!selectedPath && !editablePath}
                  className="bg-primary-500 hover:bg-primary-600"
                >
                  Подтвердить выбор
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPanel