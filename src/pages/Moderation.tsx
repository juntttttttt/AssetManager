import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, CheckCircle, XCircle, Clock, Loader, Settings } from 'lucide-react'
import { robloxAPI } from '../services/robloxApi'

export default function Moderation() {
  const navigate = useNavigate()
  const [assetId, setAssetId] = useState('')
  const [assetType, setAssetType] = useState<'audio' | 'decal'>('audio')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [configMissing, setConfigMissing] = useState(false)

  // Check if configuration is set on mount
  useEffect(() => {
    const checkConfig = () => {
      const config = robloxAPI.getConfig()
      const savedConfig = localStorage.getItem('robloxConfig')

      if (!config && savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig)
          // Migrate old config if needed
          if (parsed.openCloudApiKey && !parsed.cookie) {
            setConfigMissing(true)
            return
          }
          robloxAPI.setConfig({
            cookie: parsed.cookie || '',
            userId: parsed.userId || '',
            groupId: parsed.groupId || '',
            uploadTarget: parsed.uploadTarget || 'user',
          })
          setConfigMissing(false)
        } catch (e) {
          setConfigMissing(true)
        }
      } else if (!config && !savedConfig) {
        setConfigMissing(true)
      } else if (config && (!config.cookie || config.cookie.trim() === '')) {
        setConfigMissing(true)
      } else {
        setConfigMissing(false)
      }
    }

    checkConfig()
  }, [])

  // Extract asset ID from Roblox URLs
  const extractAssetId = (input: string): string | null => {
    const trimmed = input.trim()
    
    // If it's already just a number, return it
    if (/^\d+$/.test(trimmed)) {
      return trimmed
    }
    
    // Try to extract from various Roblox URL patterns
    const urlPatterns = [
      /\/library\/(\d+)/,                    // https://www.roblox.com/library/123456
      /\/asset\/(\d+)/,                      // https://create.roblox.com/store/asset/123456
      /\/catalog\/(\d+)/,                    // https://www.roblox.com/catalog/123456
      /assetId[=:](\d+)/,                    // assetId=123456 or assetId:123456
      /id[=:](\d+)/,                        // id=123456
      /(\d{10,})/,                          // Any long number (asset IDs are typically 10+ digits)
    ]
    
    for (const pattern of urlPatterns) {
      const match = trimmed.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    return null
  }

  const handleCheck = async () => {
    // Check configuration first
      const config = robloxAPI.getConfig()
      if (!config || !config.cookie || config.cookie.trim() === '') {
        setError('Configuration not set. Please configure your cookie in Settings.')
        setConfigMissing(true)
        return
      }

    if (!assetId.trim()) {
      setError('Please enter an asset ID or Roblox URL')
      return
    }

    // Extract asset ID from URL if provided
    const extractedId = extractAssetId(assetId)
    if (!extractedId) {
      setError('Could not extract asset ID from the provided input. Please enter a valid asset ID or Roblox URL.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setConfigMissing(false)

    try {
      const info = await robloxAPI.checkAssetStatus(extractedId, assetType)
      if (info) {
        setResult(info)
        setError(null)
      } else {
        // Provide more helpful error message
        const errorMsg = `Asset ${extractedId} not found. This could mean:
• The asset ID is incorrect
• The asset is private or restricted
• The asset was deleted
• Browser security (CORS) is blocking the request
• Your cookie doesn't have permission to view this asset

Try:
• Verifying the asset ID is correct
• Checking the asset in your browser: https://www.roblox.com/library/${extractedId}
• Ensuring your cookie is valid and not expired`
        setError(errorMsg)
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to check asset status'
      
      // Provide more specific error messages
      if (errorMessage.includes('CORS') || errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch')) {
        errorMessage = `Network error: Unable to reach Roblox servers. This might be due to:
• CORS restrictions in the browser
• Network connectivity issues
• Roblox servers being unavailable

Try checking the asset directly in your browser: https://www.roblox.com/library/${extractedId}`
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = `Authentication failed: ${errorMessage}. Please check your cookie in Settings.`
      }
      
      setError(errorMessage)
      console.error('Moderation check error:', err)
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle size={24} style={{ color: 'var(--success)' }} />
      case 'declined':
        return <XCircle size={24} style={{ color: 'var(--danger)' }} />
      default:
        return <Clock size={24} style={{ color: 'var(--pending)' }} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs-fixing':
        return 'var(--text-muted)'
      case 'accepted':
        return 'var(--success)'
      case 'declined':
        return 'var(--danger)'
      default:
        return 'var(--pending)'
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Shield size={28} />
          Moderation Check
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Enter an asset ID or Roblox URL to check its moderation status
        </p>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Asset Type
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setAssetType('audio')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: assetType === 'audio' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: assetType === 'audio' ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Audio
              </button>
              <button
                onClick={() => setAssetType('decal')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: assetType === 'decal' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: assetType === 'decal' ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Decal
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Asset ID
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="Enter asset ID or Roblox URL (e.g., 123456789 or https://www.roblox.com/library/123456789)"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={handleCheck}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  background: loading ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {loading ? (
                  <>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Check Status
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {configMissing && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '2px solid var(--warning)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px', marginBottom: '12px' }}>
            <Settings size={20} style={{ color: 'var(--warning)', marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
                   <p style={{ color: 'var(--warning)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                     Configuration Required
                   </p>
                   <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
                     You need to configure your Roblox cookie to check asset status. Go to Settings to add your .ROBLOSECURITY cookie.
                   </p>
              <button
                onClick={() => navigate('/settings')}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Settings size={16} />
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !configMissing && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--danger)',
            marginBottom: '24px',
          }}
        >
          <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
              Troubleshooting tips:
            </p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '12px', paddingLeft: '20px', margin: 0 }}>
              <li>Verify the asset ID is correct</li>
                   <li>Check that your cookie is valid and not expired</li>
              <li>For decals, ensure your cookie is valid</li>
              <li>The asset may still be processing (try again in a few minutes)</li>
              <li>Private or deleted assets cannot be checked</li>
            </ul>
          </div>
        </div>
      )}

      {result && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            {getStatusIcon(result.status)}
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                {result.name}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Asset ID: {result.assetId} • Type: {result.type}
              </p>
            </div>
            <span
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                background: getStatusColor(result.status),
                color: 'white',
              }}
            >
              {result.status === 'needs-fixing' ? '(needs fixing)' : result.status.toUpperCase()}
            </span>
          </div>

          <div
            style={{
              padding: '16px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Status:</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
                {result.status === 'accepted' ? 'Approved' : result.status === 'declined' ? 'Rejected' : 'Pending Review'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Created:</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                {new Date(result.createdAt).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Type:</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', textTransform: 'capitalize' }}>
                {result.type}
              </span>
            </div>
            <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => {
                  const url = `https://www.roblox.com/library/${result.assetId}`
                  if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
                    (window as any).electronAPI.openExternal(url)
                  } else {
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }
                }}
                style={{
                  color: 'var(--accent)',
                  fontSize: '14px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
                View on Roblox →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

