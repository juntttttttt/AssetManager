import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 second timeout
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token expiration and network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    // Enhance network error messages
    if (!error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('timeout'))) {
      error.message = 'Network Error: Cannot connect to server. Make sure the backend server is running.'
    }
    return Promise.reject(error)
  }
)

export interface LoginResponse {
  message: string
  token: string
  user: {
    id: string
    username: string
    email?: string
    role: 'owner' | 'member'
  }
}

export interface RegisterResponse extends LoginResponse {}

export interface User {
  id: string
  username: string
  email?: string
  role: 'owner' | 'member'
  createdAt: string
  lastLogin?: string
}

export const authAPI = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', { username, password })
    return response.data
  },

  register: async (username: string, password: string, email?: string): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>('/auth/register', { username, password, email })
    return response.data
  },

  getMe: async (): Promise<{ user: User }> => {
    const response = await api.get<{ user: User }>('/auth/me')
    return response.data
  },

  getRegistrationStatus: async (): Promise<{ registrationEnabled: boolean }> => {
    const response = await api.get<{ registrationEnabled: boolean }>('/auth/registration-status')
    return response.data
  },

  toggleRegistration: async (enabled: boolean): Promise<{ message: string; registrationEnabled: boolean }> => {
    const response = await api.post<{ message: string; registrationEnabled: boolean }>('/owner/toggle-registration', { enabled })
    return response.data
  },

  getUsers: async (): Promise<{ users: Array<{ id: string; username: string; email?: string; role: string; createdAt: string; lastLogin?: string }> }> => {
    const response = await api.get<{ users: Array<{ id: string; username: string; email?: string; role: string; createdAt: string; lastLogin?: string }> }>('/owner/users')
    return response.data
  },
}

export default api

