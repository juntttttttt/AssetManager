import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireOwner?: boolean
  requireAuth?: boolean
}

export default function ProtectedRoute({ 
  children, 
  requireOwner = false,
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isOwner, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        color: 'var(--text-muted)'
      }}>
        Loading...
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireOwner && !isOwner) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

