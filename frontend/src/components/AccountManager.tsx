import {
    Calendar,
    CheckCircle,
    Clock,
    Copy,
    Crown,
    Edit2,
    Eye,
    EyeOff,
    Key,
    Monitor,
    Music,
    Plus,
    Shield,
    Trash2,
    User,
    XCircle,
    AlertCircle
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import config from '../config'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { StatusBadge } from './ui/StatusBadge'

interface YandexAccount {
    id: number
    name: string
    username?: string
    oauth_token_preview?: string
    session_id_token_preview?: string
    is_active: boolean
    has_subscription: boolean
    has_lossless_access: boolean
    subscription_details?: string
    created_at: string
    last_used?: string
    updated_at: string
}

interface AccountManagerProps {
    onAccountChange: (account: YandexAccount | null) => void
}

function AccountManager({ onAccountChange }: AccountManagerProps) {
    const [accounts, setAccounts] = useState<YandexAccount[]>([])
    // const [fullTokens, setFullTokens] = useState<{ [key: number]: { oauth?: string, session_id?: string } }>({}) // Не используется
    const [isLoading, setIsLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newAccountName, setNewAccountName] = useState('')
    const [newOAuthToken, setNewOAuthToken] = useState('')
    const [newSessionIdToken, setNewSessionIdToken] = useState('')
    const [newUsername, setNewUsername] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
    const [editingAccountName, setEditingAccountName] = useState('')
    const [showOAuthTokens, setShowOAuthTokens] = useState<{ [key: number]: boolean }>({})
    const [showSessionIdTokens, setShowSessionIdTokens] = useState<{ [key: number]: boolean }>({})
    const [editingTokens, setEditingTokens] = useState<{ [key: number]: boolean }>({})
    const [editOAuthToken, setEditOAuthToken] = useState('')
    const [editSessionIdToken, setEditSessionIdToken] = useState('')
    const [testingTokens, setTestingTokens] = useState<{ [key: number]: { oauth?: boolean, session_id?: boolean, both?: boolean } }>({})
    const [testResults, setTestResults] = useState<{ [key: number]: { oauth?: any, session_id?: any, both?: any } }>({})

    const loadAccounts = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts`)
            if (response.ok) {
                const data = await response.json()
                setAccounts(data)
                
                // Уведомляем о текущем активном аккаунте
                const activeAccount = data.find((acc: YandexAccount) => acc.is_active)
                onAccountChange(activeAccount || null)
            }
        } catch (error) {
            console.error('Ошибка загрузки аккаунтов:', error)
        } finally {
            setIsLoading(false)
        }
    }, [onAccountChange])

    useEffect(() => {
        loadAccounts()
    }, [loadAccounts])

    const saveAccount = async () => {
        if (!newAccountName.trim()) {
            alert('Пожалуйста, введите название аккаунта')
            return
        }

        setIsSaving(true)
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newAccountName,
                    oauth_token: newOAuthToken || null,
                    session_id_token: newSessionIdToken || null,
                    username: newUsername || null,
                })
            })

            if (response.ok) {
                await loadAccounts()
                setShowAddForm(false)
                setNewAccountName('')
                setNewOAuthToken('')
                setNewSessionIdToken('')
                setNewUsername('')
            } else {
                const error = await response.json()
                alert(`Ошибка сохранения аккаунта: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка сохранения аккаунта:', error)
            alert('Ошибка сохранения аккаунта')
        } finally {
            setIsSaving(false)
        }
    }

    const activateAccount = async (accountId: number) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_id: accountId
                })
            })

            if (response.ok) {
                await loadAccounts()
                const account = accounts.find(a => a.id === accountId)
                if (account) {
                    onAccountChange(account)
                }
            } else {
                const error = await response.json()
                alert(`Ошибка активации аккаунта: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка активации аккаунта:', error)
            alert('Ошибка активации аккаунта')
        }
    }

    const deactivateAccount = async (accountId: number) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/deactivate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_id: accountId
                })
            })

            if (response.ok) {
                await loadAccounts()
                onAccountChange(null)
            } else {
                const error = await response.json()
                alert(`Ошибка деактивации аккаунта: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка деактивации аккаунта:', error)
            alert('Ошибка деактивации аккаунта')
        }
    }

    const deleteAccount = async (accountId: number) => {
        const account = accounts.find(acc => acc.id === accountId)
        if (!account) return

        const confirmMessage = `Вы уверены, что хотите удалить аккаунт "${account.name}"?\n\nЭто действие удалит:\n• Все токены аккаунта\n• Информацию о подписке\n• Историю использования\n\nЭто действие нельзя отменить!`
        
        if (!confirm(confirmMessage)) {
            return
        }

        // Дополнительное подтверждение для активного аккаунта
        if (account.is_active) {
            const activeConfirmMessage = `ВНИМАНИЕ! Вы пытаетесь удалить АКТИВНЫЙ аккаунт "${account.name}".\n\nПосле удаления приложение может перестать работать.\n\nВы уверены, что хотите продолжить?`
            if (!confirm(activeConfirmMessage)) {
                return
            }
        }

        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/${accountId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await loadAccounts()
                onAccountChange(null)
                
                // Показываем уведомление об успешном удалении
                alert(`Аккаунт "${account.name}" успешно удален`)
            } else {
                const error = await response.json()
                alert(`Ошибка удаления аккаунта: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка удаления аккаунта:', error)
            alert('Ошибка удаления аккаунта')
        }
    }

    const renameAccount = async (accountId: number) => {
        if (!editingAccountName.trim()) {
            alert('Пожалуйста, введите новое название')
            return
        }

        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/${accountId}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editingAccountName
                })
            })

            if (response.ok) {
                await loadAccounts()
                setEditingAccountId(null)
                setEditingAccountName('')
            } else {
                const error = await response.json()
                alert(`Ошибка переименования аккаунта: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка переименования аккаунта:', error)
            alert('Ошибка переименования аккаунта')
        }
    }

    const updateUsername = async (accountId: number) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/${accountId}/update-username`, {
                method: 'PUT'
            })

            if (response.ok) {
                await loadAccounts()
            } else {
                const error = await response.json()
                alert(`Ошибка обновления username: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка обновления username:', error)
            alert('Ошибка обновления username')
        }
    }

    const toggleOAuthTokenVisibility = (accountId: number) => {
        setShowOAuthTokens(prev => ({
            ...prev,
            [accountId]: !prev[accountId]
        }))
    }

    const toggleSessionIdTokenVisibility = (accountId: number) => {
        setShowSessionIdTokens(prev => ({
            ...prev,
            [accountId]: !prev[accountId]
        }))
    }

    const toggleTokenEditing = (accountId: number) => {
        const isOpening = !editingTokens[accountId]
        
        setEditingTokens(prev => ({
            ...prev,
            [accountId]: !prev[accountId]
        }))
        
        // Загружаем полные токены при открытии формы редактирования
        if (isOpening) {
            loadFullTokens(accountId)
            // Очищаем результаты тестирования при открытии
            setTestResults(prev => ({ ...prev, [accountId]: {} }))
        } else {
            // Сбрасываем поля редактирования при закрытии
            setEditOAuthToken('')
            setEditSessionIdToken('')
            // Очищаем результаты тестирования при закрытии
            setTestResults(prev => ({ ...prev, [accountId]: {} }))
        }
    }

    const loadFullTokens = async (accountId: number) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/${accountId}/tokens`)
            if (response.ok) {
                const data = await response.json()
                setEditOAuthToken(data.oauth_token || '')
                setEditSessionIdToken(data.session_id_token || '')
            }
        } catch (error) {
            console.error('Ошибка загрузки токенов:', error)
        }
    }

    // const copyToClipboard = async (text: string) => {
    //     try {
    //         await navigator.clipboard.writeText(text)
    //         // Можно добавить уведомление об успешном копировании
    //     } catch (error) {
    //         console.error('Ошибка копирования:', error)
    //     }
    // }

    const copyTokenToClipboard = async (accountId: number, tokenType: 'oauth' | 'session_id') => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/${accountId}/tokens`)
            if (response.ok) {
                const data = await response.json()
                const token = tokenType === 'oauth' ? data.oauth_token : data.session_id_token
                if (token) {
                    await navigator.clipboard.writeText(token)
                }
            }
        } catch (error) {
            console.error('Ошибка получения токена:', error)
        }
    }

    const saveTokenChanges = async (accountId: number) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/accounts/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: accounts.find(a => a.id === accountId)?.name,
                    oauth_token: editOAuthToken || null,
                    session_id_token: editSessionIdToken || null,
                })
            })

            if (response.ok) {
                await loadAccounts()
                setEditingTokens(prev => ({ ...prev, [accountId]: false }))
                setEditOAuthToken('')
                setEditSessionIdToken('')
                // Очищаем результаты тестирования при сохранении
                setTestResults(prev => ({ ...prev, [accountId]: {} }))
            } else {
                const error = await response.json()
                alert(`Ошибка сохранения токенов: ${error.detail}`)
            }
        } catch (error) {
            console.error('Ошибка сохранения токенов:', error)
            alert('Ошибка сохранения токенов')
        }
    }

    const testOAuthToken = async (accountId: number) => {
        if (!editOAuthToken.trim()) {
            alert('Пожалуйста, введите OAuth токен для тестирования')
            return
        }

        setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], oauth: true } }))
        setTestResults(prev => ({ ...prev, [accountId]: { ...prev[accountId], oauth: undefined } }))

        try {
            const response = await fetch(`${config.apiBaseUrl}/auth/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: editOAuthToken
                })
            })

            const data = await response.json()
            
            if (response.ok) {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        oauth: {
                            success: true,
                            message: data.message || 'OAuth токен работает корректно'
                        }
                    }
                }))
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        oauth: {
                            success: false,
                            message: data.detail || 'Ошибка тестирования OAuth токена'
                        }
                    }
                }))
            }
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                [accountId]: {
                    ...prev[accountId],
                    oauth: {
                        success: false,
                        message: error instanceof Error ? error.message : 'Ошибка тестирования OAuth токена'
                    }
                }
            }))
        } finally {
            setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], oauth: false } }))
        }
    }

    const testSessionIdToken = async (accountId: number) => {
        if (!editSessionIdToken.trim()) {
            alert('Пожалуйста, введите Session ID токен для тестирования')
            return
        }

        setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], session_id: true } }))
        setTestResults(prev => ({ ...prev, [accountId]: { ...prev[accountId], session_id: undefined } }))

        try {
            const response = await fetch(`${config.apiBaseUrl}/auth/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: editSessionIdToken
                })
            })

            const data = await response.json()
            
            if (response.ok) {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        session_id: {
                            success: true,
                            message: data.message || 'Session ID токен работает корректно'
                        }
                    }
                }))
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        session_id: {
                            success: false,
                            message: data.detail || 'Ошибка тестирования Session ID токена'
                        }
                    }
                }))
            }
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                [accountId]: {
                    ...prev[accountId],
                    session_id: {
                        success: false,
                        message: error instanceof Error ? error.message : 'Ошибка тестирования Session ID токена'
                    }
                }
            }))
        } finally {
            setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], session_id: false } }))
        }
    }

    const testBothTokens = async (accountId: number) => {
        if (!editOAuthToken.trim() || !editSessionIdToken.trim()) {
            alert('Пожалуйста, введите оба токена для тестирования')
            return
        }

        setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], both: true } }))
        setTestResults(prev => ({ ...prev, [accountId]: { ...prev[accountId], both: undefined } }))

        try {
            const response = await fetch(`${config.apiBaseUrl}/auth/test-dual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    oauth_token: editOAuthToken,
                    session_id_token: editSessionIdToken
                })
            })

            const data = await response.json()
            
            if (response.ok) {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        both: {
                            success: true,
                            message: data.message || 'Оба токена работают корректно',
                            oauth_valid: data.oauth_valid,
                            session_id_valid: data.session_id_valid,
                            has_subscription: data.has_subscription,
                            has_lossless_access: data.has_lossless_access,
                            subscription_details: data.subscription_details
                        }
                    }
                }))
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [accountId]: {
                        ...prev[accountId],
                        both: {
                            success: false,
                            message: data.detail || 'Ошибка тестирования токенов',
                            oauth_valid: false,
                            session_id_valid: false
                        }
                    }
                }))
            }
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                [accountId]: {
                    ...prev[accountId],
                    both: {
                        success: false,
                        message: error instanceof Error ? error.message : 'Ошибка тестирования токенов',
                        oauth_valid: false,
                        session_id_valid: false
                    }
                }
            }))
        } finally {
            setTestingTokens(prev => ({ ...prev, [accountId]: { ...prev[accountId], both: false } }))
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU')
    }

    // const getTokenIcon = (tokenType: 'oauth' | 'session_id') => {
    //     return tokenType === 'oauth' ? <Shield size={16} /> : <Monitor size={16} />
    // }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Key size={24} className="text-primary-500" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Аккаунты Яндекс.Музыки
                    </h2>
                </div>
                <Button
                    variant="primary"
                    onClick={() => setShowAddForm(true)}
                    icon={Plus}
                >
                    Добавить аккаунт
                </Button>
            </div>

            {/* Форма добавления аккаунта */}
            {showAddForm && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Добавить новый аккаунт</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Название аккаунта</label>
                            <Input
                                value={newAccountName}
                                onChange={(value) => setNewAccountName(value)}
                                placeholder="Например: Основной аккаунт"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Username (опционально)</label>
                            <Input
                                value={newUsername}
                                onChange={(value) => setNewUsername(value)}
                                placeholder="Имя пользователя"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">OAuth токен (опционально)</label>
                            <Input
                                value={newOAuthToken}
                                onChange={(value) => setNewOAuthToken(value)}
                                placeholder="y0_AgAAAAAAxxx..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Session ID токен (опционально)</label>
                            <Input
                                value={newSessionIdToken}
                                onChange={(value) => setNewSessionIdToken(value)}
                                placeholder="3:1760904011.5.0.176..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="primary"
                                onClick={saveAccount}
                                loading={isSaving}
                                disabled={!newAccountName.trim()}
                            >
                                Сохранить
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowAddForm(false)
                                    setNewAccountName('')
                                    setNewOAuthToken('')
                                    setNewSessionIdToken('')
                                    setNewUsername('')
                                }}
                            >
                                Отмена
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Список аккаунтов */}
            {isLoading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">Загрузка аккаунтов...</p>
                </div>
            ) : accounts.length === 0 ? (
                <Card className="p-8 text-center">
                    <Key size={48} className="mx-auto text-gray-500 dark:text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Нет сохраненных аккаунтов
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Добавьте аккаунт Яндекс.Музыки для начала работы
                    </p>
                    <Button
                        variant="primary"
                        onClick={() => setShowAddForm(true)}
                        icon={Plus}
                    >
                        Добавить аккаунт
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {accounts.map((account) => (
                        <Card key={account.id} className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
                            {/* Заголовок карточки */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${account.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                        {editingAccountId === account.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={editingAccountName}
                                                    onChange={(value) => setEditingAccountName(value)}
                                                    className="w-48"
                                                />
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() => renameAccount(account.id)}
                                                >
                                                    ✓
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingAccountId(null)
                                                        setEditingAccountName('')
                                                    }}
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        ) : (
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                                {account.name}
                                            </h3>
                                        )}
                                    </div>
                                    <StatusBadge
                                        status={account.is_active ? 'connected' : 'disconnected'}
                                    >
                                        {account.is_active ? 'Активен' : 'Неактивен'}
                                    </StatusBadge>
                                </div>

                                <div className="flex items-center gap-2">
                                    {account.is_active ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => deactivateAccount(account.id)}
                                            icon={XCircle}
                                        >
                                            Деактивировать
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => activateAccount(account.id)}
                                            icon={CheckCircle}
                                        >
                                            Активировать
                                        </Button>
                                    )}

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setEditingAccountId(account.id)
                                            setEditingAccountName(account.name)
                                        }}
                                        icon={Edit2}
                                    >
                                        Переименовать
                                    </Button>

                                    <Button
                                        variant="error"
                                        size="sm"
                                        onClick={() => deleteAccount(account.id)}
                                        icon={Trash2}
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            </div>

                            {/* Информация о пользователе */}
                            {account.username && (
                                <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <User size={16} className="text-blue-600 dark:text-blue-400" />
                                    <span className="text-blue-800 dark:text-blue-200 font-medium">
                                        {account.username}
                                    </span>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => updateUsername(account.id)}
                                        icon={User}
                                        className="ml-auto"
                                    >
                                        Обновить
                                    </Button>
                                </div>
                            )}

                            {/* Статус подписки */}
                            {(account.has_subscription || account.has_lossless_access) && (
                                <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <Crown size={16} className="text-green-600 dark:text-green-400" />
                                    <span className="text-green-800 dark:text-green-200 font-medium">
                                        Подписка активна
                                    </span>
                                    {account.has_lossless_access && (
                                        <>
                                            <Music size={16} className="text-blue-600 dark:text-blue-400" />
                                            <span className="text-blue-800 dark:text-blue-200 font-medium">
                                                Lossless доступен
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Токены */}
                            <div className="space-y-3 mb-4">
                                {/* OAuth токен */}
                                {account.oauth_token_preview && (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Shield size={16} className="text-purple-600 dark:text-purple-400" />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    OAuth токен
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => toggleOAuthTokenVisibility(account.id)}
                                                    icon={showOAuthTokens[account.id] ? EyeOff : Eye}
                                                >
                                                    {showOAuthTokens[account.id] ? 'Скрыть' : 'Показать'}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => copyTokenToClipboard(account.id, 'oauth')}
                                                    icon={Copy}
                                                >
                                                    Копировать
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="font-mono text-xs text-gray-600 dark:text-gray-300 break-all bg-gray-100 dark:bg-gray-700 p-2 rounded border">
                                            {showOAuthTokens[account.id] ? account.oauth_token_preview : '••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                        </div>
                                    </div>
                                )}

                                {/* Session ID токен */}
                                {account.session_id_token_preview && (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Monitor size={16} className="text-blue-600 dark:text-blue-400" />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Session ID токен
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => toggleSessionIdTokenVisibility(account.id)}
                                                    icon={showSessionIdTokens[account.id] ? EyeOff : Eye}
                                                >
                                                    {showSessionIdTokens[account.id] ? 'Скрыть' : 'Показать'}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => copyTokenToClipboard(account.id, 'session_id')}
                                                    icon={Copy}
                                                >
                                                    Копировать
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="font-mono text-xs text-gray-600 dark:text-gray-300 break-all bg-gray-100 dark:bg-gray-700 p-2 rounded border">
                                            {showSessionIdTokens[account.id] ? account.session_id_token_preview : '••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                        </div>
                                    </div>
                                )}

                                {/* Кнопка редактирования токенов */}
                                <div className="flex justify-center">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => toggleTokenEditing(account.id)}
                                        icon={Edit2}
                                    >
                                        {editingTokens[account.id] ? 'Отменить редактирование' : 'Редактировать токены'}
                                    </Button>
                                </div>

                                {/* Форма редактирования токенов */}
                                {editingTokens[account.id] && (
                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                        <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
                                            Редактирование токенов
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    OAuth токен
                                                </label>
                                                <textarea
                                                    value={editOAuthToken}
                                                    onChange={(e) => setEditOAuthToken(e.target.value)}
                                                    placeholder="y0_AgAAAAAAxxx..."
                                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs resize-none"
                                                    rows={3}
                                                />
                                                <div className="flex items-center justify-between mt-1">
                                                    <div className="text-xs text-gray-500 dark:text-gray-300">
                                                        Длина: {editOAuthToken.length} символов
                                                    </div>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => testOAuthToken(account.id)}
                                                        disabled={testingTokens[account.id]?.oauth || !editOAuthToken.trim()}
                                                        loading={testingTokens[account.id]?.oauth}
                                                        icon={Shield}
                                                    >
                                                        {testingTokens[account.id]?.oauth ? 'Тестирование...' : 'Тестировать OAuth'}
                                                    </Button>
                                                </div>
                                                {testResults[account.id]?.oauth && (
                                                    <div className={`mt-2 p-2 rounded-lg text-xs ${
                                                        testResults[account.id].oauth.success
                                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            {testResults[account.id].oauth.success ? (
                                                                <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
                                                            ) : (
                                                                <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                                                            )}
                                                            <span className={testResults[account.id].oauth.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                                                                {testResults[account.id].oauth.message}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Session ID токен
                                                </label>
                                                <textarea
                                                    value={editSessionIdToken}
                                                    onChange={(e) => setEditSessionIdToken(e.target.value)}
                                                    placeholder="3:1760904011.5.0.176..."
                                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs resize-none"
                                                    rows={3}
                                                />
                                                <div className="flex items-center justify-between mt-1">
                                                    <div className="text-xs text-gray-500 dark:text-gray-300">
                                                        Длина: {editSessionIdToken.length} символов
                                                    </div>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => testSessionIdToken(account.id)}
                                                        disabled={testingTokens[account.id]?.session_id || !editSessionIdToken.trim()}
                                                        loading={testingTokens[account.id]?.session_id}
                                                        icon={Monitor}
                                                    >
                                                        {testingTokens[account.id]?.session_id ? 'Тестирование...' : 'Тестировать Session ID'}
                                                    </Button>
                                                </div>
                                                {testResults[account.id]?.session_id && (
                                                    <div className={`mt-2 p-2 rounded-lg text-xs ${
                                                        testResults[account.id].session_id.success
                                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            {testResults[account.id].session_id.success ? (
                                                                <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
                                                            ) : (
                                                                <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                                                            )}
                                                            <span className={testResults[account.id].session_id.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                                                                {testResults[account.id].session_id.message}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pt-2 border-t border-yellow-300 dark:border-yellow-700">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => testBothTokens(account.id)}
                                                    disabled={testingTokens[account.id]?.both || !editOAuthToken.trim() || !editSessionIdToken.trim()}
                                                    loading={testingTokens[account.id]?.both}
                                                    icon={Key}
                                                    className="w-full"
                                                >
                                                    {testingTokens[account.id]?.both ? 'Тестирование...' : 'Тестировать оба токена'}
                                                </Button>
                                                {testResults[account.id]?.both && (
                                                    <div className={`mt-3 p-3 rounded-lg text-xs ${
                                                        testResults[account.id].both.success
                                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                                    }`}>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                {testResults[account.id].both.success ? (
                                                                    <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
                                                                ) : (
                                                                    <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                                                                )}
                                                                <span className={testResults[account.id].both.success ? 'text-green-800 dark:text-green-200 font-medium' : 'text-red-800 dark:text-red-200 font-medium'}>
                                                                    {testResults[account.id].both.message}
                                                                </span>
                                                            </div>
                                                            {testResults[account.id].both.success && (
                                                                <div className="space-y-1 pl-5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={testResults[account.id].both.oauth_valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                                                                            OAuth: {testResults[account.id].both.oauth_valid ? '✓ Работает' : '✗ Не работает'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={testResults[account.id].both.session_id_valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                                                                            Session ID: {testResults[account.id].both.session_id_valid ? '✓ Работает' : '✗ Не работает'}
                                                                        </span>
                                                                    </div>
                                                                    {testResults[account.id].both.has_subscription !== undefined && (
                                                                        <div className="flex items-center gap-2">
                                                                            <Crown size={12} className="text-yellow-600 dark:text-yellow-400" />
                                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                                Подписка: {testResults[account.id].both.has_subscription ? 'Активна' : 'Неактивна'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {testResults[account.id].both.has_lossless_access !== undefined && (
                                                                        <div className="flex items-center gap-2">
                                                                            <Music size={12} className="text-blue-600 dark:text-blue-400" />
                                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                                Lossless: {testResults[account.id].both.has_lossless_access ? 'Доступен' : 'Недоступен'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => saveTokenChanges(account.id)}
                                                >
                                                    Сохранить
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        toggleTokenEditing(account.id)
                                                        // Очищаем результаты тестирования при отмене
                                                        setTestResults(prev => ({ ...prev, [account.id]: {} }))
                                                    }}
                                                >
                                                    Отмена
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Метаданные */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        <span>Создан: {formatDate(account.created_at)}</span>
                                    </div>
                                    {account.last_used && (
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            <span>Использован: {formatDate(account.last_used)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-gray-400">
                                    ID: {account.id}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

export default AccountManager
