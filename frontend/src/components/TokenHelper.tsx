import { AlertCircle, CheckCircle, Copy, ExternalLink, HelpCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import './TokenHelper.css'

interface TokenHelperProps {
  isOpen: boolean
  onClose: () => void
  onTokenReceived: (token: string) => void
}

function TokenHelper({ isOpen, onClose, onTokenReceived }: TokenHelperProps) {
  const [step, setStep] = useState(1)
  const [token, setToken] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [copiedStep, setCopiedStep] = useState<number | null>(null)
  const [showVisualGuide, setShowVisualGuide] = useState(false)
  const [showStepDetails, setShowStepDetails] = useState(true)

  // Автоматически скрываем детали на мобильных устройствах
  useEffect(() => {
    const isMobile = window.innerWidth <= 768
    setShowStepDetails(!isMobile)
    setShowVisualGuide(!isMobile)
  }, [])

  if (!isOpen) return null

  const steps = [
    {
      number: 1,
      title: 'Откройте Яндекс.Музыку',
      description: 'Перейдите на сайт Яндекс.Музыки и авторизуйтесь в своем аккаунте',
      action: 'Перейти на music.yandex.ru',
      url: 'https://music.yandex.ru'
    },
    {
      number: 2,
      title: 'Откройте инструменты разработчика',
      description: 'Нажмите F12 или Ctrl+Shift+I для открытия DevTools',
      action: 'Нажмите F12'
    },
    {
      number: 3,
      title: 'Перейдите на вкладку Network',
      description: 'В DevTools выберите вкладку "Network" (Сеть)',
      action: 'Кликните на Network'
    },
    {
      number: 4,
      title: 'Обновите страницу',
      description: 'Нажмите F5 или Ctrl+R для обновления страницы',
      action: 'Нажмите F5'
    },
    {
      number: 5,
      title: 'Найдите запрос к API',
      description: 'В списке запросов найдите любой запрос к music.yandex.ru (обычно это запросы с длинными именами, содержащими "playlist", "track", "user" или "auth")',
      action: 'Найдите запрос',
      details: 'Ищите запросы с доменом music.yandex.ru в колонке "Name". Обычно это запросы типа:\n• /handlers/playlist/\n• /handlers/track/\n• /handlers/user/\n• /handlers/auth/\n• /api/v1/ или /api/v2.1/\n\nКликните на любой из таких запросов.'
    },
    {
      number: 6,
      title: 'Откройте заголовки',
      description: 'Кликните на запрос и перейдите на вкладку "Headers"',
      action: 'Кликните на Headers',
      details: 'После клика на запрос справа откроется панель с деталями. Найдите вкладку "Headers" и кликните на неё.'
    },
    {
      number: 7,
      title: 'Скопируйте токен',
      description: 'Найдите заголовок "Authorization" или "Cookie" и скопируйте токен',
      action: 'Скопируйте токен',
      details: 'В разделе "Request Headers" найдите один из заголовков:\n\n1. Authorization: OAuth y0_AgAAAAAAxxx...\n   (скопируйте только часть после "OAuth ")\n\n2. Cookie: Session_id=3:1760904011.5.0...\n   (скопируйте значение Session_id полностью)\n\nТокен должен начинаться с "y0_" или "3:" и быть длинным.\nОба типа токенов поддерживаются!'
    }
  ]

  const copyToClipboard = (text: string, stepNumber: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStep(stepNumber)
      setTimeout(() => setCopiedStep(null), 2000)
    })
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
        body: JSON.stringify({ token: token.trim() })
      })

      if (response.ok) {
        setTestResult('success')
        onTokenReceived(token.trim())
        setTimeout(() => {
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

  const handleClose = () => {
    setStep(1)
    setToken('')
    setTestResult(null)
    setCopiedStep(null)
    onClose()
  }

  return (
    <div className="token-helper-overlay">
      <div className="token-helper-modal">
        <div className="token-helper-header">
          <h2>
            <HelpCircle size={24} />
            Получение токена Яндекс.Музыки
          </h2>
          <button onClick={handleClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="token-helper-content">
          <div className="steps-container">
            <div className="steps-progress">
              <div className="steps-header">
                <h4>Пошаговая инструкция:</h4>
                <button
                  onClick={() => setShowStepDetails(!showStepDetails)}
                  className="toggle-details-button"
                >
                  {showStepDetails ? 'Скрыть детали' : 'Показать детали'}
                </button>
              </div>
              {steps.map((stepItem) => (
                <div
                  key={stepItem.number}
                  className={`step-item ${step <= stepItem.number ? 'active' : ''} ${step > stepItem.number ? 'completed' : ''}`}
                >
                  <div className="step-number">
                    {step > stepItem.number ? <CheckCircle size={16} /> : stepItem.number}
                  </div>
                  <div className="step-content">
                    <h4>{stepItem.title}</h4>
                    <p>{stepItem.description}</p>
                    {showStepDetails && stepItem.details && (
                      <div className="step-details">
                        <pre>{stepItem.details}</pre>
                      </div>
                    )}
                    {stepItem.action && (
                      <div className="step-action">
                        {stepItem.url ? (
                          <a
                            href={stepItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-link"
                          >
                            <ExternalLink size={14} />
                            {stepItem.action}
                          </a>
                        ) : (
                          <span className="action-text">{stepItem.action}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="token-input-section">
              <h3>Вставьте полученный токен:</h3>
              <div className="token-input-group">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="y0_AgAAAAAAxxx... или 3:1760904011.5.0..."
                  className="token-input"
                />
                <button
                  onClick={testToken}
                  disabled={isTesting || !token.trim()}
                  className="test-token-button"
                >
                  {isTesting ? 'Проверка...' : 'Проверить'}
                </button>
              </div>

              {testResult && (
                <div className={`test-result ${testResult}`}>
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle size={16} />
                      Токен работает! Настройки сохранены.
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      Токен не работает. Проверьте правильность ввода.
                    </>
                  )}
                </div>
              )}

              <div className="help-section">
                <h4>Примеры токенов:</h4>
                <div className="token-examples">
                  <div className="token-example">
                    <code>y0_AgAAAAAAxxx...</code>
                    <button
                      onClick={() => copyToClipboard('y0_AgAAAAAAxxx...', 1)}
                      className="copy-button"
                    >
                      {copiedStep === 1 ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="token-example">
                    <code>3:1760904011.5.0.1760904011676:9_Q7BQ:f702.1.2:1|13968483...</code>
                    <button
                      onClick={() => copyToClipboard('3:1760904011.5.0.1760904011676:9_Q7BQ:f702.1.2:1|13968483...', 2)}
                      className="copy-button"
                    >
                      {copiedStep === 2 ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <p className="help-text">
                  Токен может начинаться с <code>y0_</code> (OAuth) или <code>3:</code> (Session_id) и быть длиной более 20 символов
                </p>

                <div className="visual-guide">
                  <div className="visual-guide-header">
                    <h4>Как выглядит DevTools:</h4>
                    <button
                      onClick={() => setShowVisualGuide(!showVisualGuide)}
                      className="toggle-guide-button"
                    >
                      {showVisualGuide ? 'Скрыть' : 'Показать'}
                    </button>
                  </div>
                  {showVisualGuide && (
                    <div className="devtools-preview">
                      <div className="devtools-header">
                        <span className="tab active">Network</span>
                        <span className="tab">Console</span>
                        <span className="tab">Elements</span>
                      </div>
                      <div className="devtools-content">
                        <div className="request-list">
                          <div className="request-item">
                            <span className="method">GET</span>
                            <span className="url">music.yandex.ru/handlers/playlist/...</span>
                            <span className="status">200</span>
                          </div>
                          <div className="request-item">
                            <span className="method">GET</span>
                            <span className="url">music.yandex.ru/handlers/track/...</span>
                            <span className="status">200</span>
                          </div>
                          <div className="request-item">
                            <span className="method">GET</span>
                            <span className="url">music.yandex.ru/api/v1/...</span>
                            <span className="status">200</span>
                          </div>
                        </div>
                        <div className="request-details">
                          <div className="details-tabs">
                            <span className="tab active">Headers</span>
                            <span className="tab">Response</span>
                          </div>
                          <div className="headers-content">
                            <div className="header-item">
                              <span className="header-name">Authorization:</span>
                              <span className="header-value">OAuth y0_AgAAAAAAxxx...</span>
                            </div>
                            <div className="header-item">
                              <span className="header-name">Cookie:</span>
                              <span className="header-value">Session_id=3:1760904011.5.0.1760904011676:9_Q7BQ...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="token-helper-footer">
          <button onClick={handleClose} className="cancel-button">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default TokenHelper
