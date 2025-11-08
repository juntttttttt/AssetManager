import { AlertCircle } from 'lucide-react'

export default function BlockedAccess() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <AlertCircle
        size={64}
        style={{
          color: 'var(--danger)',
          marginBottom: '24px',
        }}
      />
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '12px',
        }}
      >
        Access Blocked
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
          marginBottom: '8px',
        }}
      >
        
      </p>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          maxWidth: '500px',
        }}
      >
        This feature is currently disabled and needs to be fixed before it can be used.
      </p>
    </div>
  )
}

