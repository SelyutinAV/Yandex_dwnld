import { Download, FolderOpen, ListMusic, Music, Settings } from 'lucide-react'
import { useState } from 'react'
import './App.css'
import DownloadQueue from './components/DownloadQueue'
import FileAnalyzer from './components/FileAnalyzer'
import PlaylistManager from './components/PlaylistManager'
import SettingsPanel from './components/SettingsPanel'

type Tab = 'playlists' | 'downloads' | 'files' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('playlists')
  const [isConnected, setIsConnected] = useState(false)

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Music size={32} />
            <h1>Yandex Music Downloader</h1>
          </div>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
            <span>{isConnected ? 'Подключено' : 'Не подключено'}</span>
          </div>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          <ListMusic size={20} />
          Плейлисты
        </button>
        <button
          className={`nav-tab ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => setActiveTab('downloads')}
        >
          <Download size={20} />
          Загрузки
        </button>
        <button
          className={`nav-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <FolderOpen size={20} />
          Файлы
        </button>
        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} />
          Настройки
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'playlists' && <PlaylistManager />}
        {activeTab === 'downloads' && <DownloadQueue />}
        {activeTab === 'files' && <FileAnalyzer />}
        {activeTab === 'settings' && <SettingsPanel onConnectionChange={setIsConnected} />}
      </main>
    </div>
  )
}

export default App

