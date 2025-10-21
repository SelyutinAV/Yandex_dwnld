import { Check, Edit, Key, Plus, Save, Trash2, X } from 'lucide-react'
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
                    onTokenChange('') // Очищаем поле, так как токен теперь активен
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
        if (!editingTokenId || !editingTokenName.trim()) {
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/api/tokens/${editingTokenId}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editingTokenName.trim()
                })
            })

            if (response.ok) {
                await loadTokens()
                setEditingTokenId(null)
                setEditingTokenName('')
            } else {
                const error = await response.json()
                alert(`Ошибка переименования токена: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка переименования токена:', error)
            alert('Ошибка переименования токена')
        }
    }

    const getTokenTypeLabel = useCallback((type: string) => {
        return type === 'oauth' ? 'OAuth' : 'Session ID'
    }, [])

    const getTokenTypeColor = useCallback((type: string) => {
        return type === 'oauth' ? 'bg-success-500' : 'bg-primary-500'
    }, [])

    if (isLoading) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Key size={20} className="text-primary-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Управление токенами</h3>
                </div>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Загрузка токенов...
                </div>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Key size={20} className="text-primary-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Управление токенами</h3>
                </div>
                <Button
                    variant="primary"
                    onClick={() => setShowAddForm(true)}
                    icon={Plus}
                >
                    Добавить токен
                </Button>
            </div>

            {showAddForm && (
                <Card className="p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Добавить новый токен</h4>
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
                                className="input-field resize-none"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowAddForm(false)
                                    setNewTokenName('')
                                    setNewToken('')
                                }}
                                icon={X}
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="success"
                                onClick={saveToken}
                                disabled={isSaving || !newTokenName.trim() || !newToken.trim()}
                                loading={isSaving}
                                icon={Save}
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-4">
                {tokens.length === 0 ? (
                    <Card className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="mb-2">Нет сохраненных токенов</p>
                        <p>Добавьте токен, чтобы начать работу</p>
                    </Card>
                ) : (
                    tokens.map((token) => (
                        <Card
                            key={token.id}
                            className={`p-6 transition-all duration-200 ${token.is_active
                                    ? 'ring-2 ring-success-500 bg-success-50 dark:bg-success-900/20'
                                    : 'hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        {editingTokenId === token.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="text"
                                                    value={editingTokenName}
                                                    onChange={(e) => setEditingTokenName(e.target.value)}
                                                    className="flex-1 px-3 py-1 border-2 border-primary-500 rounded-lg text-base font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-success-500 focus:ring-2 focus:ring-success-500/20"
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
                                                    className="p-2"
                                                >
                                                    Сохранить
                                                </Button>
                                                <Button
                                                    variant="error"
                                                    size="sm"
                                                    onClick={cancelEditing}
                                                    icon={X}
                                                    className="p-2"
                                                >
                                                    Отмена
                                                </Button>
                                            </div>
                                        ) : (
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {token.name}
                                            </h4>
                                        )}
                                        <div className="flex gap-2">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-semibold text-white ${getTokenTypeColor(token.token_type)}`}
                                            >
                                                {getTokenTypeLabel(token.token_type)}
                                            </span>
                                            {token.is_active && (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-success-500 text-white rounded text-xs font-semibold">
                                                    <Check size={12} />
                                                    Активный
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <code className="bg-gray-100 dark:bg-gray-800 text-success-600 dark:text-success-400 px-2 py-1 rounded text-sm font-mono">
                                            {token.token_preview}
                                        </code>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                                        <span>Создан: {new Date(token.created_at).toLocaleDateString()}</span>
                                        {token.last_used && (
                                            <span>Использован: {new Date(token.last_used).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    {!token.is_active && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => activateToken(token.id)}
                                        >
                                            Активировать
                                        </Button>
                                    )}
                                    {editingTokenId !== token.id && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => startEditing(token.id, token.name)}
                                            icon={Edit}
                                            className="p-2"
                                        >
                                            Редактировать
                                        </Button>
                                    )}
                                    <Button
                                        variant="error"
                                        size="sm"
                                        onClick={() => deleteToken(token.id)}
                                        icon={Trash2}
                                        className="p-2"
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