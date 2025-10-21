import { Check, Edit, Key, Plus, Power, PowerOff, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input } from './ui/Input'

interface SavedToken {
    id: number
    name: string
    token_type: 'oauth' | 'session_id'
    is_active: boolean
    created_at: string
    last_used: string | null
    token_preview: string
}

interface TokenManagerProps {
    onTokenChange: (token: string) => void
}

function TokenManager({ onTokenChange }: TokenManagerProps) {
    const [tokens, setTokens] = useState<SavedToken[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newTokenName, setNewTokenName] = useState('')
    const [newToken, setNewToken] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [editingTokenId, setEditingTokenId] = useState<number | null>(null)
    const [editingTokenName, setEditingTokenName] = useState('')

    const loadTokens = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch('http://localhost:8000/api/tokens')
            if (response.ok) {
                const data = await response.json()
                setTokens(data)
            }
        } catch (error) {
            console.error('Ошибка загрузки токенов:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadTokens()
    }, [loadTokens])

    const saveToken = async () => {
        if (!newTokenName.trim() || !newToken.trim()) {
            return
        }

        setIsSaving(true)
        try {
            const response = await fetch('http://localhost:8000/api/tokens/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newTokenName,
                    token: newToken
                })
            })

            if (response.ok) {
                await loadTokens()
                setShowAddForm(false)
                setNewTokenName('')
                setNewToken('')
                onTokenChange(newToken)
            } else {
                const error = await response.json()
                alert(`Ошибка сохранения токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка сохранения токена:', error)
            alert('Ошибка сохранения токена')
        } finally {
            setIsSaving(false)
        }
    }

    const activateToken = async (tokenId: number) => {
        try {
            const response = await fetch('http://localhost:8000/api/tokens/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token_id: tokenId
                })
            })

            if (response.ok) {
                await loadTokens()
                const token = tokens.find(t => t.id === tokenId)
                if (token) {
                    onTokenChange(token.token_preview)
                }
            } else {
                const error = await response.json()
                alert(`Ошибка активации токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка активации токена:', error)
            alert('Ошибка активации токена')
        }
    }

    const deactivateToken = async (tokenId: number) => {
        try {
            const response = await fetch('http://localhost:8000/api/tokens/deactivate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token_id: tokenId
                })
            })

            if (response.ok) {
                await loadTokens()
                onTokenChange('')
            } else {
                const error = await response.json()
                alert(`Ошибка деактивации токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка деактивации токена:', error)
            alert('Ошибка деактивации токена')
        }
    }

    const deleteToken = async (tokenId: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот токен?')) {
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/api/tokens/${tokenId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await loadTokens()
                const deletedToken = tokens.find(t => t.id === tokenId)
                if (deletedToken?.is_active) {
                    onTokenChange('')
                }
            } else {
                const error = await response.json()
                alert(`Ошибка удаления токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка удаления токена:', error)
            alert('Ошибка удаления токена')
        }
    }

    const startEditing = (tokenId: number, currentName: string) => {
        setEditingTokenId(tokenId)
        setEditingTokenName(currentName)
    }

    const cancelEditing = () => {
        setEditingTokenId(null)
        setEditingTokenName('')
    }

    const saveRename = async () => {
        if (!editingTokenName.trim() || !editingTokenId) {
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/api/tokens/${editingTokenId}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editingTokenName
                })
            })

            if (response.ok) {
                await loadTokens()
                cancelEditing()
            } else {
                const error = await response.json()
                alert(`Ошибка переименования токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка переименования токена:', error)
            alert('Ошибка переименования токена')
        }
    }

    const getTokenTypeColor = useCallback((type: string) => {
        return type === 'oauth' ? 'bg-blue-500' : 'bg-purple-500'
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-300 border-t-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Заголовок и кнопка добавления */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Key size={20} className="text-primary-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Управление токенами</h3>
                </div>
                <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setShowAddForm(true)}
                    icon={Plus}
                    className="shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                    Добавить токен
                </Button>
            </div>

            {/* Форма добавления нового токена */}
            {showAddForm && (
                <Card className="p-6 border-2 border-primary-200 dark:border-primary-800 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-primary-500" />
                        Добавить новый токен
                    </h4>
                    <div className="space-y-4">
                        <Input
                            label="Название токена"
                            value={newTokenName}
                            onChange={setNewTokenName}
                            placeholder="Например: Мой аккаунт"
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                Токен
                            </label>
                            <textarea
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                                placeholder="Вставьте токен..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                            />
                        </div>
                        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowAddForm(false)
                                    setNewTokenName('')
                                    setNewToken('')
                                }}
                                icon={X}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-md"
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="success"
                                onClick={saveToken}
                                disabled={isSaving || !newTokenName.trim() || !newToken.trim()}
                                loading={isSaving}
                                icon={Save}
                                className="bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg"
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Список токенов */}
            <div className="space-y-4">
                {tokens.length === 0 ? (
                    <Card className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Key size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="mb-2 text-lg font-medium">Нет сохраненных токенов</p>
                        <p>Добавьте токен, чтобы начать работу</p>
                    </Card>
                ) : (
                    tokens.map((token) => (
                        <Card
                            key={token.id}
                            className={`p-6 transition-all duration-200 hover:shadow-lg ${token.is_active
                                ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20 shadow-green-100 dark:shadow-green-900/20'
                                : 'hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    {/* Название токена */}
                                    <div className="flex items-center gap-3 mb-4">
                                        {editingTokenId === token.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="text"
                                                    value={editingTokenName}
                                                    onChange={(e) => setEditingTokenName(e.target.value)}
                                                    className="flex-1 px-3 py-2 border-2 border-primary-500 rounded-lg text-base font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            saveRename()
                                                        } else if (e.key === 'Escape') {
                                                            cancelEditing()
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={saveRename}
                                                    disabled={!editingTokenName.trim()}
                                                    icon={Check}
                                                    className="bg-green-500 hover:bg-green-600 shadow-md"
                                                >
                                                    Сохранить
                                                </Button>
                                                <Button
                                                    variant="error"
                                                    size="sm"
                                                    onClick={cancelEditing}
                                                    icon={X}
                                                    className="bg-red-500 hover:bg-red-600 shadow-md"
                                                >
                                                    Отмена
                                                </Button>
                                            </div>
                                        ) : (
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {token.name}
                                            </h4>
                                        )}
                                    </div>

                                    {/* Бейджи типов */}
                                    <div className="flex gap-2 mb-3">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm ${getTokenTypeColor(token.token_type)}`}
                                        >
                                            {token.token_type === 'oauth' ? '🔑 OAuth' : '🍪 Session ID'}
                                        </span>
                                        {token.is_active && (
                                            <span className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold shadow-sm">
                                                <Check size={12} />
                                                ✓ Активный
                                            </span>
                                        )}
                                    </div>

                                    {/* Токен */}
                                    <div className="mb-3">
                                        <code className="bg-gray-100 dark:bg-gray-800 text-green-600 dark:text-green-400 px-3 py-2 rounded-lg text-sm font-mono border border-gray-200 dark:border-gray-700">
                                            {token.token_preview}
                                        </code>
                                    </div>

                                    {/* Даты */}
                                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                                        <span>Создан: {new Date(token.created_at).toLocaleDateString()}</span>
                                        {token.last_used && (
                                            <span>Использован: {new Date(token.last_used).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Кнопки действий */}
                                <div className="flex flex-col gap-2 ml-4">
                                    {editingTokenId !== token.id && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => startEditing(token.id, token.name)}
                                            icon={Edit}
                                            className="bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                                        >
                                            Переименовать
                                        </Button>
                                    )}

                                    {!token.is_active ? (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => activateToken(token.id)}
                                            icon={Power}
                                            className="bg-green-500 hover:bg-green-600 shadow-md"
                                        >
                                            Активировать
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="warning"
                                            size="sm"
                                            onClick={() => deactivateToken(token.id)}
                                            icon={PowerOff}
                                            className="bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                                        >
                                            Отключить
                                        </Button>
                                    )}

                                    <Button
                                        variant="error"
                                        size="sm"
                                        onClick={() => deleteToken(token.id)}
                                        icon={Trash2}
                                        className="bg-red-500 hover:bg-red-600 shadow-md"
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

export default TokenManager