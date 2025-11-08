import { Copy, ExternalLink, Share2, Check } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'

interface QuickActionsProps {
  assetId: string
  type: 'audio' | 'decal'
}

export default function QuickActions({ assetId, type }: QuickActionsProps) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied to clipboard!`)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const openInBrowser = () => {
    const url = type === 'audio'
      ? `https://www.roblox.com/library/${assetId}`
      : `https://www.roblox.com/library/${assetId}`
    
    // Use Electron's openExternal if available (opens in default browser)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url)
      toast.info('Opening in browser...')
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
      toast.info('Opening in browser...')
    }
  }

  const copyAssetUrl = () => {
    const url = `https://www.roblox.com/library/${assetId}`
    copyToClipboard(url, 'Asset URL')
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        onClick={() => copyToClipboard(assetId, 'Asset ID')}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        title="Copy Asset ID"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        Copy ID
      </button>
      <button
        onClick={openInBrowser}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        title="Open in Roblox"
      >
        <ExternalLink size={14} />
        Open
      </button>
      <button
        onClick={copyAssetUrl}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        title="Copy Asset URL"
      >
        <Share2 size={14} />
        Share
      </button>
    </div>
  )
}

