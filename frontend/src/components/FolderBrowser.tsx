import { FolderOpen, X } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import config from '../config'
import { Button } from './ui/Button'

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
        <div className="select-none">
            <div
                className={`flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' : ''
                    }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={onSelect}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggle()
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    disabled={!hasChildren}
                >
                    {hasChildren ? (isExpanded ? '📂' : '📁') : '📄'}
                </button>
                <span className={`flex-1 text-sm ${isSelected ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                    {name}
                </span>
            </div>
            {isExpanded && children && (
                <div className="ml-2">
                    {children}
                </div>
            )}
        </div>
    )
}

interface FolderBrowserProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (path: string) => void
    title: string
    initialPath?: string
}

const FolderBrowser: React.FC<FolderBrowserProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    initialPath = '/home/urch'
}) => {
    const [selectedPath, setSelectedPath] = useState(initialPath)
    const [editablePath, setEditablePath] = useState(initialPath)
    const [isEditingPath, setIsEditingPath] = useState(false)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/home/urch']))
    const [folderContents, setFolderContents] = useState<Record<string, Array<{ name: string, hasChildren: boolean }>>>({})
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set())

    // Загружаем содержимое папки через API
    const loadFolderContents = useCallback(async (path: string) => {
        console.log('loadFolderContents called for:', path)
        console.log('Current folderContents keys:', Object.keys(folderContents))
        
        if (folderContents[path]) {
            console.log('Folder already loaded:', path)
            return // Уже загружено
        }

        console.log('Loading folder:', path)
        setLoadingFolders(prev => new Set(prev).add(path))

        try {
            console.log('Fetching folders for path:', path)
            const response = await fetch(`${config.apiBaseUrl}/folders/list`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path })
            })

            if (response.ok) {
                const data = await response.json()
                console.log('API response for path:', path, 'data:', data)
                
                // Сохраняем полную информацию о папках, используя path из ответа API
                const folders = (data.folders || []).map((folder: any) => {
                    // Используем path из API, если он есть
                    const folderPath = folder.path || (path === '/' ? `/${folder.name}` : `${path}/${folder.name}`)
                    return {
                        name: folder.name,
                        path: folderPath,
                        hasChildren: folder.hasChildren
                    }
                })
                
                console.log('Processed folders:', folders)
                
                setFolderContents(prev => ({
                    ...prev,
                    [path]: folders
                }))
            } else {
                console.error('Ошибка загрузки папки:', path)
                setFolderContents(prev => ({
                    ...prev,
                    [path]: []
                }))
            }
        } catch (error) {
            console.error('Ошибка загрузки папки:', error)
            setFolderContents(prev => ({
                ...prev,
                [path]: []
            }))
        } finally {
            setLoadingFolders(prev => {
                const newSet = new Set(prev)
                newSet.delete(path)
                return newSet
            })
        }
    }, [folderContents])

    // Загружаем корневую папку при открытии
    useEffect(() => {
        if (isOpen) {
            loadFolderContents('/')
        }
    }, [isOpen, loadFolderContents])

    const toggleFolder = async (path: string) => {
        console.log('toggleFolder called with path:', path)
        const newExpandedFolders = new Set(expandedFolders)

        if (expandedFolders.has(path)) {
            console.log('Closing folder:', path)
            newExpandedFolders.delete(path)
        } else {
            console.log('Opening folder:', path)
            newExpandedFolders.add(path)
            // Загружаем содержимое папки при раскрытии
            console.log('Loading folder contents for:', path)
            await loadFolderContents(path)
        }

        setExpandedFolders(newExpandedFolders)
    }

    const buildFullPath = (parentPath: string, folderName: string): string => {
        if (parentPath === '/') return `/${folderName}`
        return `${parentPath}/${folderName}`
    }

    const hasSubfolders = (path: string): boolean => {
        const folders = folderContents[path]
        return folders && folders.length > 0 && folders.some(folder => folder.hasChildren)
    }

    const renderFolderTree = (parentPath: string, level: number = 0): React.ReactNode => {
        const folders = folderContents[parentPath]
        console.log(`renderFolderTree for ${parentPath}, folders:`, folders)
        
        if (!folders || folders.length === 0) {
            console.log(`No folders for ${parentPath}`)
            return null
        }

        return folders.map((folder) => {
            // Используем path из объекта папки, если он есть, иначе строим его
            const fullPath = (folder as any).path || buildFullPath(parentPath, folder.name)
            const isExpanded = expandedFolders.has(fullPath)
            const isSelected = selectedPath === fullPath
            const hasChildren = folder.hasChildren
            const isLoading = loadingFolders.has(fullPath)
            
            console.log(`Rendering folder: ${folder.name}, fullPath: ${fullPath}, hasChildren: ${hasChildren}, isExpanded: ${isExpanded}`)

            return (
                <FolderTreeItem
                    key={fullPath}
                    path={fullPath}
                    name={folder.name}
                    level={level}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    hasChildren={hasChildren}
                    onToggle={() => toggleFolder(fullPath)}
                    onSelect={() => setSelectedPath(fullPath)}
                >
                    {isLoading ? (
                        <div className="ml-4 p-2 text-sm text-gray-500">
                            Загрузка...
                        </div>
                    ) : (
                        renderFolderTree(fullPath, level + 1)
                    )}
                </FolderTreeItem>
            )
        })
    }

    const handleConfirm = () => {
        onConfirm(selectedPath)
        onClose()
    }

    const handleEditPath = () => {
        setIsEditingPath(true)
        setEditablePath(selectedPath)
    }

    const handleApplyEdit = () => {
        setSelectedPath(editablePath)
        setIsEditingPath(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                {/* Заголовок */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FolderOpen size={24} className="text-primary-500" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={20} />
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
                            {!isEditingPath && (
                                <button
                                    onClick={handleEditPath}
                                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                >
                                    Редактировать
                                </button>
                            )}
                        </div>

                        {isEditingPath ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={editablePath}
                                    onChange={(e) => setEditablePath(e.target.value)}
                                    className="flex-1 input-field"
                                    placeholder="/path/to/folder"
                                    autoFocus
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleApplyEdit}
                                    disabled={!editablePath.trim()}
                                >
                                    Применить
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsEditingPath(false)}
                                >
                                    Отмена
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                                    {selectedPath}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirm}
                            disabled={!selectedPath.trim()}
                        >
                            Выбрать папку
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FolderBrowser
