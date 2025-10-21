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
import './TokenHelper.css'

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
    <div className="token-helper-overlay">
      <div className="token-helper-modal">
        {/* Заголовок */}
        <div className="modal-header">
          <div className="header-content">
            <Shield size={24} />
            <div>
              <h2>Получение токена Яндекс.Музыки</h2>
              <p>Пошаговое руководство для безопасного получения токена</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        {/* Прогресс бар */}
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            Шаг {currentStep} из {totalSteps}
          </div>
        </div>

        {/* Контент */}
        <div className="modal-content">
          {/* Левая часть - текущий шаг */}
          <div className="step-content">
            <div className="step-header">
              <div
                className="step-icon"
                style={{ backgroundColor: currentStepData?.color }}
              >
                {currentStepData?.icon}
              </div>
              <div className="step-info">
                <h3>{currentStepData?.title}</h3>
                <p>{currentStepData?.description}</p>
              </div>
            </div>

            <div className="step-visual">
              {currentStep === 1 && (
                <div className="visual-music-site">
                  <div className="browser-window">
                    <div className="browser-header">
                      <div className="browser-buttons">
                        <span className="browser-button red"></span>
                        <span className="browser-button yellow"></span>
                        <span className="browser-button green"></span>
                      </div>
                      <div className="browser-url">music.yandex.ru</div>
                    </div>
                    <div className="browser-content">
                      <div className="music-logo">🎵 Яндекс.Музыка</div>
                      <div className="login-form">
                        <div className="login-field"></div>
                        <div className="login-field"></div>
                        <div className="login-button">Войти</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="visual-devtools">
                  <div className="keyboard">
                    <div className="key">F12</div>
                  </div>
                  <div className="devtools-window">
                    <div className="devtools-header">Developer Tools</div>
                    <div className="devtools-tabs">
                      <span className="tab active">Elements</span>
                      <span className="tab">Console</span>
                      <span className="tab">Network</span>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="visual-network">
                  <div className="devtools-panel">
                    <div className="devtools-tabs">
                      <span className="tab">Elements</span>
                      <span className="tab">Console</span>
                      <span className="tab active">Network</span>
                    </div>
                    <div className="network-content">
                      <div className="network-requests">
                        <div className="request-item">music.yandex.ru/api/...</div>
                        <div className="request-item">music.yandex.ru/handlers/...</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="visual-refresh">
                  <div className="keyboard">
                    <div className="key">F5</div>
                  </div>
                  <div className="refresh-arrow">🔄</div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="visual-find">
                  <div className="network-list">
                    <div className="request-item highlighted">
                      <span className="method">GET</span>
                      <span className="url">music.yandex.ru/handlers/playlist/...</span>
                      <span className="status">200</span>
                    </div>
                    <div className="request-item">
                      <span className="method">GET</span>
                      <span className="url">music.yandex.ru/api/v2.1/...</span>
                      <span className="status">200</span>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="visual-headers">
                  <div className="request-details">
                    <div className="details-tabs">
                      <span className="tab">Headers</span>
                      <span className="tab">Response</span>
                    </div>
                    <div className="headers-content">
                      <div className="header-row">
                        <span className="header-name">Authorization:</span>
                        <span className="header-value">OAuth y0_AgAAAAAAxxx...</span>
                      </div>
                      <div className="header-row">
                        <span className="header-name">Cookie:</span>
                        <span className="header-value">Session_id=3:1760904011...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 7 && (
                <div className="visual-copy">
                  <div className="token-examples">
                    <div className="token-example">
                      <div className="token-type">OAuth токен</div>
                      <div className="token-value">y0_AgAAAAAAxxx...</div>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard('y0_AgAAAAAAxxx...')}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <div className="token-example">
                      <div className="token-type">Session ID токен</div>
                      <div className="token-value">3:1760904011.5.0...</div>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard('3:1760904011.5.0...')}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {currentStepData?.url && (
              <div className="step-action">
                <a
                  href={currentStepData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-button"
                  style={{ backgroundColor: currentStepData.color }}
                >
                  <ExternalLink size={16} />
                  {currentStepData.action}
                </a>
              </div>
            )}
          </div>

          {/* Правая часть - ввод токена */}
          <div className="token-input-section">
            <div className="token-header">
              <h3>Вставьте полученный токен</h3>
              <p>Скопируйте токен из DevTools и вставьте его ниже</p>
            </div>

            <div className="token-input-container">
              <div className="token-input-group">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="y0_AgAAAAAAxxx... или 3:1760904011.5.0..."
                  className="token-input"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="toggle-visibility"
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                onClick={testToken}
                disabled={isTesting || !token.trim()}
                className="test-token-button"
              >
                {isTesting ? (
                  <>
                    <div className="spinner-small"></div>
                    Проверка...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Проверить токен
                  </>
                )}
              </button>

              {testResult && (
                <div className={`test-result ${testResult}`}>
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle size={16} />
                      <span>Токен валиден! Подключение установлено.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      <span>Ошибка проверки токена. Проверьте правильность.</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="token-tips">
              <h4>💡 Подсказки:</h4>
              <ul>
                <li>Токен может начинаться с <code>y0_</code> (OAuth) или <code>3:</code> (Session ID)</li>
                <li>Длина токена обычно больше 20 символов</li>
                <li>Не делитесь токеном с другими людьми</li>
                <li>При изменении пароля токен может перестать работать</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <div className="modal-navigation">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="nav-button prev"
          >
            <ChevronLeft size={16} />
            Назад
          </button>

          <div className="step-indicators">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`step-indicator ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              >
                <span className="step-number">{step.id}</span>
              </button>
            ))}
          </div>

          <button
            onClick={nextStep}
            disabled={currentStep === totalSteps}
            className="nav-button next"
          >
            Далее
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TokenHelper