// Конфигурация API
// В Docker используем относительный путь, в dev режиме - переменную окружения
const API_URL = import.meta.env.VITE_API_URL || window.location.origin

export const config = {
  apiUrl: API_URL,
  apiBaseUrl: `${API_URL}/api`,
}

export default config

