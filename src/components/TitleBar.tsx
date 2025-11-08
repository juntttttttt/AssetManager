import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize?.()
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximize?.()
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close?.()
    }
  }

  return (
    <div
      style={{
        height: '32px',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        WebkitAppRegion: 'drag',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        Asset Manager
      </div>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          style={{
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          style={{
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleClose}
          style={{
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--danger)'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

