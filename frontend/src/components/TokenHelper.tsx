import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Monitor,
  MousePointer,
  Shield,
  X,
  XCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface TokenHelperProps {
  isOpen: boolean
  onClose: () => void
  onTokenReceived: (tokens: { oauthToken: string; sessionIdToken: string }) => void
}

function TokenHelper({ isOpen, onClose, onTokenReceived }: TokenHelperProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [showToken, setShowToken] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')
  const [extractedToken, setExtractedToken] = useState('')
  const [apiResponse, setApiResponse] = useState('')
  const [extractedSessionId, setExtractedSessionId] = useState('')
  const [oauthToken, setOauthToken] = useState('')
  const [sessionIdToken, setSessionIdToken] = useState('')
  const [isCreatingRecord, setIsCreatingRecord] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testConnectionResult, setTestConnectionResult] = useState<'success' | 'error' | null>(null)
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null)
  const [hasLosslessAccess, setHasLosslessAccess] = useState<boolean | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)

  // Сброс состояния при открытии
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setShowToken(false)
      setOauthUrl('')
      setExtractedToken('')
      setApiResponse('')
      setExtractedSessionId('')
      setOauthToken('')
      setSessionIdToken('')
      setIsCreatingRecord(false)
      setIsTestingConnection(false)
      setTestConnectionResult(null)
      setHasSubscription(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const steps = [
    {
      id: 1,
      title: 'Получение OAuth токена',
      description: 'Для полноценной работы нужны оба токена. Начнем с OAuth токена',
      icon: <Shield size={24} />,
      action: 'Начать получение токенов',
      color: '#667eea'
    },
    {
      id: 2,
      title: 'OAuth авторизация',
      description: 'Перейдите по ссылке, авторизуйтесь (если не авторизованы) и скопируйте адресную строку в поле ниже',
      icon: <ExternalLink size={24} />,
      action: 'Получить OAuth токен',
      url: 'https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d',
      color: '#764ba2'
    },
    {
      id: 3,
      title: 'Получение Session ID токена',
      description: 'Необходимо для полноценной работы приложения',
      icon: <Monitor size={24} />,
      action: 'Перейти на music.yandex.ru',
      url: 'https://music.yandex.ru',
      color: '#4facfe'
    },
    {
      id: 4,
      title: 'Откройте DevTools и Network',
      description: 'Нажмите F12, перейдите на вкладку Network, обновите страницу и запустите любой трек из ЛЮБОГО СВОЕГО ПЛЕЙЛИСТА',
      icon: <Monitor size={24} />,
      action: 'Нажмите F12',
      color: '#fa709a'
    },
    {
      id: 5,
      title: 'Найдите API запрос',
      description: 'В DevTools → Network → в поле ПОИСК введите api.music.yandex.ru/tracks и найдите POST запрос',
      icon: <MousePointer size={24} />,
      action: 'Найдите запрос',
      color: '#fed6e3'
    },
    {
      id: 6,
      title: 'Токены готовы',
      description: 'Оба токена получены и заполнены в полях справа. Теперь вы можете протестировать соединение и создать запись в реестре',
      icon: <CheckCircle size={24} />,
      action: 'Завершить настройку',
      color: '#4ade80'
    }
  ]

  const currentStepData = steps.find(step => step.id === currentStep)
  const totalSteps = steps.length

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }


  const extractTokenFromUrl = (url: string) => {
    try {
      // Ищем токен в URL после авторизации
      // Формат: https://oauth.yandex.ru/verification_code?code=TOKEN
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')
      if (code) {
        return code
      }

      // Альтернативный формат: https://oauth.yandex.ru/verification_code#access_token=TOKEN
      const hash = urlObj.hash
      if (hash) {
        const tokenMatch = hash.match(/access_token=([^&]+)/)
        if (tokenMatch) {
          return tokenMatch[1]
        }
      }

      return null
    } catch (error) {
      console.error('Ошибка при извлечении токена:', error)
      return null
    }
  }

  const handleOauthUrlChange = (url: string) => {
    setOauthUrl(url)
    const token = extractTokenFromUrl(url)
    if (token) {
      setExtractedToken(token)
      setOauthToken(token) // Заполняем поле OAuth токена в навигации
    } else {
      setExtractedToken('')
    }
  }

  const extractSessionIdFromResponse = (response: string) => {
    try {
      console.log('Searching for Session ID in Cookie header...')

      // Ищем Session_id в заголовке Cookie (формат: Session_id=3:1761166780.5.0.1760904011676:9_Q7BQ:f702.1.2:1|13968483.-1.2.3:1760904011.6:2174090753.7:1761166780|3:11321388.370848.I0KAWK0LFEYW9S1pE4l0z7_BffU)
      const sessionIdMatch = response.match(/Session_id=([^;\s\n\r]+)/i)
      if (sessionIdMatch) {
        console.log('Found Session_id:', sessionIdMatch[1])
        return sessionIdMatch[1]
      }

      // Альтернативно ищем sessionid2
      const sessionId2Match = response.match(/sessionid2=([^;\s\n\r]+)/i)
      if (sessionId2Match) {
        console.log('Found sessionid2:', sessionId2Match[1])
        return sessionId2Match[1]
      }

      // Ищем в заголовках cookie (если скопировали весь заголовок)
      const cookieMatch = response.match(/cookie[:\s]+[^;]*Session_id=([^;\s\n\r]+)/i)
      if (cookieMatch) {
        console.log('Found in cookie header:', cookieMatch[1])
        return cookieMatch[1]
      }

      // Ищем в любом месте текста
      const anyMatch = response.match(/Session_id=([^;\s\n\r]+)/i)
      if (anyMatch) {
        console.log('Found anywhere:', anyMatch[1])
        return anyMatch[1]
      }

      console.log('No Session ID found. Make sure you copied the Cookie header from Request Headers.')
      return null
    } catch (error) {
      console.error('Ошибка при извлечении Session ID:', error)
      return null
    }
  }

  const handleApiResponseChange = (response: string) => {
    setApiResponse(response)
    console.log('API Response received:', response.substring(0, 200) + '...')
    const sessionId = extractSessionIdFromResponse(response)
    console.log('Extracted Session ID:', sessionId)
    if (sessionId) {
      setExtractedSessionId(sessionId)
      setSessionIdToken(sessionId) // Заполняем поле Session ID токена в навигации
    } else {
      setExtractedSessionId('')
    }
  }

  const createTokenRecord = async () => {
    if (!oauthToken.trim() || !sessionIdToken.trim()) {
      alert('Пожалуйста, заполните оба токена')
      return
    }

    setIsCreatingRecord(true)
    try {
      // Здесь будет API вызов для создания записи в реестре токенов
      // Пока что просто показываем успех
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Вызываем callback с токенами
      onTokenReceived({
        oauthToken: oauthToken.trim(),
        sessionIdToken: sessionIdToken.trim()
      })

      onClose()
    } catch (error) {
      console.error('Ошибка при создании записи:', error)
      alert('Ошибка при создании записи в реестре токенов')
    } finally {
      setIsCreatingRecord(false)
    }
  }

  const testConnection = async () => {
    if (!oauthToken.trim() || !sessionIdToken.trim()) {
      setTestConnectionResult('error')
      setHasSubscription(false)
      setHasLosslessAccess(false)
      return
    }

    setIsTestingConnection(true)
    setTestConnectionResult(null)
    setHasSubscription(null)
    setHasLosslessAccess(null)
    setSubscriptionDetails(null)

    try {
      const response = await fetch('/api/auth/test-dual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oauth_token: oauthToken.trim(),
          session_id_token: sessionIdToken.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        setTestConnectionResult('success')
        setHasSubscription(result.has_subscription)
        setHasLosslessAccess(result.has_lossless_access || false)
        setSubscriptionDetails(result.subscription_details)

        console.log('Subscription details:', result.subscription_details)
      } else {
        await response.json()
        setTestConnectionResult('error')
        setHasSubscription(false)
        setHasLosslessAccess(false)
        setSubscriptionDetails(null)
      }
    } catch (err) {
      console.error('Ошибка при тестировании соединения:', err)
      setTestConnectionResult('error')
      setHasSubscription(false)
      setHasLosslessAccess(false)
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-[70vw] h-[95vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <div>
              <h2 className="text-xl font-semibold">Получение токена Яндекс.Музыки</h2>
              <p className="text-sm opacity-90">Пошаговое руководство для безопасного получения токена</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={onClose}
            icon={X}
            className="p-2"
          >
            Закрыть
          </Button>
        </div>

        {/* Прогресс бар */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Шаг {currentStep} из {totalSteps}
          </div>
        </div>

        {/* Контент */}
        <div className="flex flex-col lg:flex-row min-h-0 flex-1">
          {/* Левая часть - текущий шаг */}
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div
                    className="p-3 rounded-lg text-white"
                    style={{ backgroundColor: currentStepData?.color }}
                  >
                    {currentStepData?.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {currentStepData?.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {currentStepData?.description}
                    </p>
                  </div>
                </div>

                {/* Визуализация шага */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-500 rounded-lg text-white">
                            <Shield size={20} />
                          </div>
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">Получение токенов</h4>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                          Для полноценной работы приложения нужны оба токена:
                        </p>
                        <div className="space-y-2 text-sm text-blue-600 dark:text-blue-400">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span><strong>OAuth токен</strong> - для авторизации</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span><strong>Session ID токен</strong> - для доступа к API</span>
                          </div>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-3">
                          Мы получим их последовательно, начиная с OAuth токена.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-3">
                      {/* Компактная OAuth ссылка */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                          <ExternalLink size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">OAuth авторизация</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded border font-mono text-xs break-all mb-2">
                          https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => window.open('https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d', '_blank')}
                            icon={ExternalLink}
                          >
                            Открыть OAuth
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText('https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d')}
                            icon={Copy}
                          >
                            Копировать
                          </Button>
                        </div>
                      </div>

                      {/* Компактная инструкция */}
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                          <span className="font-medium text-yellow-800 dark:text-yellow-200">После авторизации</span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Скопируйте весь URL из адресной строки и вставьте ниже
                        </p>
                      </div>

                      {/* Поле для ввода */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Вставьте URL с токеном:
                        </label>
                        <textarea
                          value={oauthUrl}
                          onChange={(e) => handleOauthUrlChange(e.target.value)}
                          placeholder="https://oauth.yandex.ru/verification_code?code=YOUR_TOKEN_HERE"
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs resize-none max-h-24 overflow-y-auto"
                          rows={2}
                        />
                      </div>

                      {/* Результат извлечения */}
                      {extractedToken && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                            <span className="font-medium text-green-800 dark:text-green-200">Токен извлечен!</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded border font-mono text-xs break-all mb-2 max-h-16 overflow-y-auto">
                            {extractedToken}
                          </div>
                        </div>
                      )}

                      {/* Сообщение об ошибке */}
                      {!extractedToken && oauthUrl && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                            <span className="font-medium text-red-800 dark:text-red-200">Токен не найден</span>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Убедитесь, что скопировали полный URL после авторизации
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      {/* Объяснение про Session ID */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                          <ExternalLink size={20} className="text-blue-600 dark:text-blue-400" />
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200">Откройте сайт Яндекс.Музыка</h4>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Откройте Яндекс.Музыку и авторизуйтесь в своем аккаунте
                        </p>
                      </div>

                      {/* Инструкция про Яндекс.Музыку */}
                      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center gap-2">
                          <div className="flex gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">music.yandex.ru</div>
                        </div>
                        <div className="p-6 text-center">
                          <div className="text-2xl mb-4">🎵 Яндекс.Музыка</div>
                          <div className="space-y-2">
                            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-8 bg-primary-500 rounded text-white flex items-center justify-center">
                              Войти
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-4">
                      {/* DevTools и Network */}
                      <div className="flex items-center justify-center gap-8">
                        <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg font-mono text-lg">
                          F12
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="text-sm font-medium mb-2">Developer Tools</div>
                          <div className="flex gap-2">
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Elements</span>
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Console</span>
                            <span className="px-2 py-1 bg-primary-500 text-white rounded text-xs">Network</span>
                          </div>
                        </div>
                      </div>

                      {/* Инструкция про обновление страницы и запуск трека */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Info size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">Важно!</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          После открытия DevTools → Network <strong>обновите страницу</strong> и <strong>запустите любой трек из ЛЮБОГО СВОЕГО ПЛЕЙЛИСТА</strong> в Яндекс.Музыке.
                          Это необходимо для того, чтобы появился запрос к API, который мы будем анализировать на следующем шаге.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-3">
                      {/* Компактная инструкция */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Info size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">Найдите POST запрос к api.music.yandex.ru/tracks</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                          В DevTools → Network → в поле ПОИСК введите{' '}
                          <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded font-mono text-blue-800 dark:text-blue-200">
                            api.music.yandex.ru/tracks
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText('api.music.yandex.ru/tracks')}
                            className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            <Copy size={12} />
                            Скопировать
                          </button>
                          {' '}и найдите POST запрос
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">POST</span>
                          <span className="font-mono text-blue-800 dark:text-blue-200">api.music.yandex.ru/tracks</span>
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">200</span>
                        </div>
                      </div>

                      {/* Компактная инструкция по копированию */}
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                          <span className="font-medium text-yellow-800 dark:text-yellow-200">Скопируйте заголовок Cookie</span>
                        </div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                          <p>1. Кликните на POST запрос → вкладка <strong>"Headers"</strong></p>
                          <p>2. Найдите <strong>"Request Headers"</strong> → строку <code>Cookie:</code></p>
                          <p>3. Скопируйте всю длинную строку Cookie</p>
                        </div>
                      </div>

                      {/* Поле для ввода */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Вставьте заголовок Cookie:
                        </label>
                        <textarea
                          value={apiResponse}
                          onChange={(e) => handleApiResponseChange(e.target.value)}
                          placeholder="Cookie: Session_id=3:1761166780.5.0.1760904011676:9_Q7BQ:f702.1.2:1|13968483..."
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs resize-none max-h-32 overflow-y-auto"
                          rows={4}
                        />
                      </div>

                      {/* Результат извлечения */}
                      {extractedSessionId && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                            <span className="font-medium text-green-800 dark:text-yellow-200">Session ID извлечен!</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded border font-mono text-xs break-all mb-2 max-h-16 overflow-y-auto">
                            {extractedSessionId}
                          </div>
                        </div>
                      )}

                      {/* Сообщение об ошибке */}
                      {!extractedSessionId && apiResponse && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                            <span className="font-medium text-red-800 dark:text-red-200">Session ID не найден</span>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Убедитесь, что скопировали именно заголовок <code>Cookie:</code> из Request Headers
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Токены готовы (только на последнем шаге) */}
                  {currentStep === 6 && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-500 rounded-lg text-white">
                            <CheckCircle size={20} />
                          </div>
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">Токены готовы</h4>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                          Оба токена получены и заполнены в полях справа. Теперь вы можете:
                        </p>
                        <div className="space-y-2 text-sm text-blue-600 dark:text-blue-400">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span>Протестировать соединение с Яндекс.Музыкой</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span>Создать запись в реестре токенов</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        onClick={testConnection}
                        disabled={isTestingConnection || !oauthToken.trim() || !sessionIdToken.trim()}
                        loading={isTestingConnection}
                        icon={CheckCircle}
                        className="w-full"
                      >
                        Тест соединения
                      </Button>

                      <Button
                        variant="success"
                        onClick={createTokenRecord}
                        disabled={isCreatingRecord || !oauthToken.trim() || !sessionIdToken.trim()}
                        loading={isCreatingRecord}
                        icon={CheckCircle}
                        className="w-full"
                      >
                        Создать запись в реестре
                      </Button>

                      {/* Результат теста соединения */}
                      {testConnectionResult && (
                        <div className={`p-3 rounded-lg border ${testConnectionResult === 'success'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          }`}>
                          <div className="flex items-center gap-2">
                            {testConnectionResult === 'success' ? (
                              <>
                                <div className="p-1 bg-green-500 rounded text-white">
                                  <CheckCircle size={16} />
                                </div>
                                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                  Соединение успешно
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="p-1 bg-red-500 rounded text-white">
                                  <XCircle size={16} />
                                </div>
                                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                                  Ошибка соединения
                                </span>
                              </>
                            )}
                          </div>
                          {hasSubscription !== null && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Подписка: {hasSubscription ? 'Активна' : 'Неактивна'}
                              </p>
                              {hasLosslessAccess !== null && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Lossless: {hasLosslessAccess ? 'Доступен' : 'Недоступен'}
                                </p>
                              )}
                              {subscriptionDetails && (
                                <details className="text-xs text-gray-500 dark:text-gray-500">
                                  <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                                    Детали подписки
                                  </summary>
                                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-20">
                                    {JSON.stringify(subscriptionDetails, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>

          {/* Правая часть - токены и подсказки */}
          <div className="lg:w-[28rem] p-4 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
            <div className="space-y-4">
              {/* Поля для токенов */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Токены
                </h3>

                {/* OAuth токен */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    OAuth токен
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={oauthToken}
                      onChange={(e) => setOauthToken(e.target.value)}
                      placeholder="y0_AgAAAAAAxxx..."
                      className="w-full pr-10 input-field text-xs"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Session ID токен */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Session ID токен
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={sessionIdToken}
                      onChange={(e) => setSessionIdToken(e.target.value)}
                      placeholder="3:1760904011.5.0..."
                      className="w-full pr-10 input-field text-xs"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Подсказки */}
              <Card className="p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">💡 Подсказки:</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• <strong>OAuth токен</strong> начинается с <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">y0_</code> и получается через официальную авторизацию</li>
                  <li>• <strong>Session ID токен</strong> начинается с <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">3:</code> и извлекается через DevTools</li>
                  <li>• Длина токена обычно больше 20 символов</li>
                  <li>• Не делитесь токеном с другими людьми</li>
                  <li>• При изменении пароля токен может перестать работать</li>
                  <li>• OAuth токен более стабилен и рекомендуется к использованию</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>

        {/* Навигация визарда - прижата к низу окна */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={prevStep}
              disabled={currentStep === 1}
              icon={ChevronLeft}
              className="px-3 py-2"
            >
              Назад
            </Button>

            <div className="flex gap-1">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setCurrentStep(step.id)
                  }}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${currentStep === step.id
                    ? 'bg-blue-500 text-white'
                    : currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                >
                  {step.id}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              onClick={nextStep}
              disabled={currentStep === totalSteps}
              icon={ChevronRight}
              className="px-3 py-2"
            >
              Далее
            </Button>
          </div>
        </div>

      </Card>
    </div>
  )
}

export default TokenHelper