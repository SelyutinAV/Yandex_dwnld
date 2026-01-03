// Конфигурация API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

export const config = {
  apiUrl: API_URL,
  apiBaseUrl: `${API_URL}/api`,
}

export default config

