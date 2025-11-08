import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Crown, AlertCircle, User, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const { login, register, isOwner, registrationEnabled, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/'

  useEffect(() => {
    if (isOwner) {
      navigate(from, { replace: true })
    }
  }, [isOwner, navigate, from])

  // Check registration status
  useEffect(() => {
    if (!authLoading && !registrationEnabled && isRegister) {
      setIsRegister(false)
      setError('Registration is currently disabled')
    }
  }, [registrationEnabled, authLoading, isRegister])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required')
      setIsLoading(false)
      return
    }

    if (isRegister && !registrationEnabled) {
      setError('Registration is currently disabled')
      setIsLoading(false)
      return
    }

    try {
      if (isRegister) {
        const result = await register(username, password, email || undefined)
        if (result.success) {
          // Small delay to ensure auth state is updated
          setTimeout(() => {
            navigate(from, { replace: true })
          }, 100)
        } else {
          setError(result.error || 'Registration failed. Please try again.')
          setPassword('')
        }
      } else {
        const success = await login(username, password)
        if (success) {
          // Small delay to ensure auth state is updated
          setTimeout(() => {
            navigate(from, { replace: true })
          }, 100)
        } else {
          // Check if it's a network error (server not running)
          const testConnection = await fetch('http://localhost:3001/api/health').catch(() => null)
          if (!testConnection || !testConnection.ok) {
            setError('Cannot connect to server. Make sure the backend server is running. In development, run: npm run dev')
          } else {
            setError('Invalid credentials. Please try again.')
          }
          setPassword('')
        }
      }
    } catch (err: any) {
      console.error('Login form error:', err)
      // Check if it's a network error
      if (err.message?.includes('fetch') || err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
        setError('Cannot connect to server. Make sure the backend server is running. In development, run: npm run dev')
      } else {
        setError(err.response?.data?.error || err.message || 'An error occurred. Please try again.')
      }
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: 'var(--text-muted)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg-secondary)',
          padding: '32px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              background: 'var(--accent)',
              borderRadius: '50%',
              marginBottom: '16px',
            }}
          >
            <Lock size={32} style={{ color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
            {isRegister ? 'Create Account' : 'Login'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {isRegister
              ? 'Create a new account to get started'
              : 'Enter your credentials to access the app'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={20}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                placeholder="Enter your username"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  background: 'var(--bg-tertiary)',
                  border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'
                }}
              />
            </div>
          </div>

          {isRegister && (
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}
              >
                Email (optional)
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={20}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your email (optional)"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={20}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  background: 'var(--bg-tertiary)',
                  border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'
                }}
              />
            </div>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  color: 'var(--danger)',
                  fontSize: '13px',
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: isLoading ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              marginBottom: '16px',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'var(--accent-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'var(--accent)'
              }
            }}
          >
            {isLoading
              ? isRegister
                ? 'Creating Account...'
                : 'Logging in...'
              : isRegister
              ? 'Create Account'
              : 'Login'}
          </button>

          {registrationEnabled && (
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setError('')
                  setPassword('')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
              </button>
            </div>
          )}

          {!registrationEnabled && !authLoading && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px' }}>
                Registration is currently disabled. Only existing users can login.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const status = await authAPI.getRegistrationStatus()
                    console.log('Manual refresh - Registration status:', status.registrationEnabled)
                    // Force update by reloading the page to re-check
                    window.location.reload()
                  } catch (error) {
                    console.error('Failed to refresh registration status:', error)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Refresh Status
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
