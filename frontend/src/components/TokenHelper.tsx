import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Monitor,
  MousePointer,
  RefreshCw,
  Search,
  Shield,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface TokenHelperProps {
  isOpen: boolean
  onClose: () => void
  onTokenReceived: (token: string) => void
}

function TokenHelper({ isOpen, onClose, onTokenReceived }: TokenHelperProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [token, setToken] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [showToken, setShowToken] = useState(false)

  // Сброс состояния при открытии
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setToken('')
      setIsTesting(false)
      setTestResult(null)
      setShowToken(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const steps = [
    {
      id: 1,
      title: 'Откройте Яндекс.Музыку',
      description: 'Перейдите на сайт Яндекс.Музыки и авторизуйтесь в своем аккаунте',
      icon: <ExternalLink size={24} />,
      action: 'Перейти на music.yandex.ru',
      url: 'https://music.yandex.ru',
      color: '#667eea'
    },
    {
      id: 2,
      title: 'Откройте DevTools',
      description: 'Нажмите F12 или Ctrl+Shift+I для открытия инструментов разработчика',
      icon: <Monitor size={24} />,
      action: 'Нажмите F12',
      color: '#764ba2'
    },
    {
      id: 3,
      title: 'Перейдите на вкладку Network',
      description: 'В DevTools выберите вкладку "Network" (Сеть)',
      icon: <Search size={24} />,
      action: 'Кликните на Network',
      color: '#f093fb'
    },
    {
      id: 4,
      title: 'Обновите страницу',
      description: 'Нажмите F5 или Ctrl+R для обновления и захвата запросов',
      icon: <RefreshCw size={24} />,
      action: 'Нажмите F5',
      color: '#4facfe'
    },
    {
      id: 5,
      title: 'Найдите API запрос',
      description: 'В списке запросов найдите любой запрос к music.yandex.ru',
      icon: <MousePointer size={24} />,
      action: 'Найдите запрос',
      color: '#43e97b'
    },
    {
      id: 6,
      title: 'Откройте заголовки',
      description: 'Кликните на запрос и перейдите на вкладку "Headers"',
      icon: <Eye size={24} />,
      action: 'Кликните на Headers',
      color: '#fa709a'
    },
    {
      id: 7,
      title: 'Скопируйте токен',
      description: 'Найдите заголовок "Authorization" или "Cookie" и скопируйте токен',
      icon: <Copy size={24} />,
      action: 'Скопируйте токен',
      color: '#ffecd2'
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

  const testToken = async () => {
    if (!token.trim()) {
      setTestResult('error')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('http://localhost:8000/api/auth/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        setTestResult('success')
        setTimeout(() => {
          onTokenReceived(token)
          onClose()
        }, 1500)
      } else {
        setTestResult('error')
      }
    } catch (error) {
      console.error('Ошибка проверки токена:', error)
      setTestResult('error')
    } finally {
      setIsTesting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
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
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
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

                {currentStep === 2 && (
                  <div className="flex items-center justify-center gap-8">
                    <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg font-mono text-lg">
                      F12
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium mb-2">Developer Tools</div>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-primary-500 text-white rounded text-xs">Elements</span>
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Console</span>
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Network</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex gap-2">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Elements</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Console</span>
                      <span className="px-2 py-1 bg-primary-500 text-white rounded text-xs">Network</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="text-sm font-mono text-gray-600 dark:text-gray-400">music.yandex.ru/api/...</div>
                      <div className="text-sm font-mono text-gray-600 dark:text-gray-400">music.yandex.ru/handlers/...</div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="flex items-center justify-center gap-8">
                    <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg font-mono text-lg">
                      F5
                    </div>
                    <div className="text-4xl">🔄</div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-2">
                    <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">GET</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">music.yandex.ru/handlers/playlist/...</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">200</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">GET</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">music.yandex.ru/api/v2.1/...</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">200</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex gap-2">
                      <span className="px-2 py-1 bg-primary-500 text-white rounded text-xs">Headers</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Response</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Authorization:</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">OAuth y0_AgAAAAAAxxx...</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Cookie:</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">Session_id=3:1760904011...</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 7 && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">OAuth токен</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded border text-sm">y0_AgAAAAAAxxx...</code>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Copy}
                          onClick={() => copyToClipboard('y0_AgAAAAAAxxx...')}
                        >
                          Копировать
                        </Button>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Session ID токен</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded border text-sm">3:1760904011.5.0...</code>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Copy}
                          onClick={() => copyToClipboard('3:1760904011.5.0...')}
                        >
                          Копировать
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {currentStepData?.url && (
                <div className="text-center">
                  <Button
                    variant="primary"
                    onClick={() => window.open(currentStepData.url, '_blank')}
                    icon={ExternalLink}
                  >
                    {currentStepData.action}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Правая часть - ввод токена */}
          <div className="lg:w-96 p-6 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Вставьте полученный токен
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Скопируйте токен из DevTools и вставьте его ниже
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="y0_AgAAAAAAxxx... или 3:1760904011.5.0..."
                    className="w-full pr-10 input-field"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <Button
                  variant="success"
                  onClick={testToken}
                  disabled={isTesting || !token.trim()}
                  loading={isTesting}
                  icon={CheckCircle}
                  className="w-full"
                >
                  {isTesting ? 'Проверка...' : 'Проверить токен'}
                </Button>

                {testResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${testResult === 'success'
                      ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400'
                      : 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400'
                    }`}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle size={16} />
                        <span className="text-sm">Токен валиден! Подключение установлено.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        <span className="text-sm">Ошибка проверки токена. Проверьте правильность.</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Card className="p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">💡 Подсказки:</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Токен может начинаться с <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">y0_</code> (OAuth) или <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">3:</code> (Session ID)</li>
                  <li>• Длина токена обычно больше 20 символов</li>
                  <li>• Не делитесь токеном с другими людьми</li>
                  <li>• При изменении пароля токен может перестать работать</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={prevStep}
            disabled={currentStep === 1}
            icon={ChevronLeft}
          >
            Назад
          </Button>

          <div className="flex gap-2">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${currentStep === step.id
                    ? 'bg-primary-500 text-white'
                    : currentStep > step.id
                      ? 'bg-success-500 text-white'
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
          >
            Далее
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default TokenHelper