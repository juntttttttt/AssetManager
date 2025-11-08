import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI, User } from '../services/api'

interface AuthContextType {
  isAuthenticated: boolean
  isOwner: boolean
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string, email?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  loading: boolean
  registrationEnabled: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  // Check if user was previously logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken')
      const savedUser = localStorage.getItem('user')

      if (token && savedUser) {
        try {
          // Verify token is still valid
          const response = await authAPI.getMe()
          setUser(response.user)
          setIsAuthenticated(true)
          setIsOwner(response.user.role === 'owner')
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('authToken')
          localStorage.removeItem('user')
        }
      }

      // Check registration status
      try {
        const status = await authAPI.getRegistrationStatus()
        console.log('[Auth] Registration status from API:', status.registrationEnabled)
        setRegistrationEnabled(status.registrationEnabled)
      } catch (error) {
        console.error('Failed to check registration status:', error)
        // Default to enabled if API fails
        setRegistrationEnabled(true)
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login(username, password)
      localStorage.setItem('authToken', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      setUser(response.user)
      setIsAuthenticated(true)
      setIsOwner(response.user.role === 'owner')
      return true
    } catch (error: any) {
      console.error('Login error:', error)
      // Log more details for debugging
      if (error.response) {
        console.error('Response status:', error.response.status)
        console.error('Response data:', error.response.data)
      } else if (error.request) {
        console.error('No response received. Is the server running?')
        console.error('Request:', error.request)
      } else {
        console.error('Error setting up request:', error.message)
      }
      return false
    }
  }

  const register = async (username: string, password: string, email?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authAPI.register(username, password, email)
      localStorage.setItem('authToken', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      setUser(response.user)
      setIsAuthenticated(true)
      setIsOwner(response.user.role === 'owner')
      return { success: true }
    } catch (error: any) {
      console.error('Register error:', error)
      // Check if it's a network error
      if (error.message?.includes('Network Error') || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
        return { success: false, error: 'Cannot connect to server. Make sure the backend server is running. In development, run: npm run dev' }
      }
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed'
      return { success: false, error: errorMessage }
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
    setIsAuthenticated(false)
    setIsOwner(false)
  }

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isOwner, 
      user,
      login, 
      register,
      logout,
      loading,
      registrationEnabled
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

