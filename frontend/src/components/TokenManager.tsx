import { Check, Key, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import './TokenManager.css'

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

    const getTokenTypeLabel = useCallback((type: string) => {
        return type === 'oauth' ? 'OAuth' : 'Session ID'
    }, [])

    const getTokenTypeColor = useCallback((type: string) => {
        return type === 'oauth' ? '#4ade80' : '#667eea'
    }, [])

    if (isLoading) {
        return (
            <div className="token-manager">
                <h3>
                    <Key size={20} />
                    Управление токенами
                </h3>
                <div className="loading">Загрузка токенов...</div>
            </div>
        )
    }

    return (
        <div className="token-manager">
            <div className="token-manager-header">
                <h3>
                    <Key size={20} />
                    Управление токенами
                </h3>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="add-token-button"
                >
                    <Plus size={16} />
                    Добавить токен
                </button>
            </div>

            {showAddForm && (
                <div className="add-token-form">
                    <h4>Добавить новый токен</h4>
                    <div className="form-group">
                        <label>Название токена:</label>
                        <input
                            type="text"
                            value={newTokenName}
                            onChange={(e) => setNewTokenName(e.target.value)}
                            placeholder="Например: Мой аккаунт"
                        />
                    </div>
                    <div className="form-group">
                        <label>Токен:</label>
                        <textarea
                            value={newToken}
                            onChange={(e) => setNewToken(e.target.value)}
                            placeholder="Вставьте токен..."
                            rows={3}
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            onClick={() => {
                                setShowAddForm(false)
                                setNewTokenName('')
                                setNewToken('')
                            }}
                            className="cancel-button"
                        >
                            <X size={16} />
                            Отмена
                        </button>
                        <button
                            onClick={saveToken}
                            disabled={isSaving || !newTokenName.trim() || !newToken.trim()}
                            className="save-button"
                        >
                            <Save size={16} />
                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            )}

            <div className="tokens-list">
                {tokens.length === 0 ? (
                    <div className="no-tokens">
                        <p>Нет сохраненных токенов</p>
                        <p>Добавьте токен, чтобы начать работу</p>
                    </div>
                ) : (
                    tokens.map((token) => (
                        <div
                            key={token.id}
                            className={`token-item ${token.is_active ? 'active' : ''}`}
                        >
                            <div className="token-info">
                                <div className="token-header">
                                    <h4>{token.name}</h4>
                                    <div className="token-badges">
                                        <span
                                            className="token-type-badge"
                                            style={{ backgroundColor: getTokenTypeColor(token.token_type) }}
                                        >
                                            {getTokenTypeLabel(token.token_type)}
                                        </span>
                                        {token.is_active && (
                                            <span className="active-badge">
                                                <Check size={12} />
                                                Активный
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="token-preview">
                                    <code>{token.token_preview}</code>
                                </div>
                                <div className="token-meta">
                                    <span>Создан: {new Date(token.created_at).toLocaleDateString()}</span>
                                    {token.last_used && (
                                        <span>Использован: {new Date(token.last_used).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="token-actions">
                                {!token.is_active && (
                                    <button
                                        onClick={() => activateToken(token.id)}
                                        className="activate-button"
                                    >
                                        Активировать
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteToken(token.id)}
                                    className="delete-button"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default TokenManager
