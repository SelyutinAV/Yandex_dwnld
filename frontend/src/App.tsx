import { Download, FolderOpen, ListMusic, Music, Settings } from 'lucide-react'
import { useState } from 'react'
import DownloadQueue from './components/DownloadQueue'
import FileAnalyzer from './components/FileAnalyzer'
import PlaylistManager from './components/PlaylistManager'
import SettingsPanel from './components/SettingsPanel'
import { StatusBadge } from './components/ui/StatusBadge'
import { AppProvider, useAppContext } from './contexts/AppContext'

type Tab = 'playlists' | 'downloads' | 'files' | 'settings'

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('playlists')
  const [isConnected, setIsConnected] = useState(false)
  const { state } = useAppContext()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Music size={32} />
              <h1 className="text-3xl font-bold">Yandex Music Downloader</h1>
            </div>
            <div className="flex items-center gap-4">
              {state.isDownloading && (
                <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Скачивание: {state.downloadProgress}%</span>
                </div>
              )}
              <StatusBadge
                status={isConnected ? 'connected' : 'disconnected'}
              >
                {isConnected ? 'Подключено' : 'Не подключено'}
              </StatusBadge>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-2">
            <button
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 ${activeTab === 'playlists'
                ? 'bg-primary-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveTab('playlists')}
            >
              <ListMusic size={20} />
              Плейлисты
            </button>
            <button
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 ${activeTab === 'downloads'
                ? 'bg-primary-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveTab('downloads')}
            >
              <Download size={20} />
              Загрузки
            </button>
            <button
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 ${activeTab === 'files'
                ? 'bg-primary-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveTab('files')}
            >
              <FolderOpen size={20} />
              Файлы
            </button>
            <button
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 ${activeTab === 'settings'
                ? 'bg-primary-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={20} />
              Настройки
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'playlists' && <PlaylistManager key={state.refreshTrigger} />}
          {activeTab === 'downloads' && <DownloadQueue key={state.refreshTrigger} />}
          {activeTab === 'files' && <FileAnalyzer key={state.refreshTrigger} />}
          {activeTab === 'settings' && <SettingsPanel onConnectionChange={setIsConnected} key={state.refreshTrigger} />}
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App

