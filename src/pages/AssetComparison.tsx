import { useState, useEffect } from 'react'
import { GitCompare, X, Search } from 'lucide-react'
import { robloxAPI } from '../services/robloxApi'

export default function AssetComparison() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [assetData, setAssetData] = useState<Map<string, any>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = () => {
    const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
    const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
    
    const allAssets = [
      ...audios.map((a: any) => ({ ...a, type: 'audio' })),
      ...decals.map((d: any) => ({ ...d, type: 'decal' })),
    ]
    
    const assetMap = new Map()
    allAssets.forEach((asset) => {
      assetMap.set(asset.assetId, asset)
    })
    setAssetData(assetMap)
  }

  const toggleAsset = (assetId: string) => {
    setSelectedAssets((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId)
      } else if (prev.length < 4) {
        return [...prev, assetId]
      } else {
        return prev
      }
    })
  }

  const filteredAssets = Array.from(assetData.values()).filter((asset) => {
    return (
      asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.assetId?.toString().includes(searchTerm)
    )
  })

  const selectedAssetsData = selectedAssets
    .map((id) => assetData.get(id))
    .filter(Boolean)

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GitCompare size={28} />
          Asset Comparison
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
          Compare up to 4 assets side by side
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={20}
            style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search assets to compare..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {selectedAssets.length > 0 && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Selected Assets ({selectedAssets.length}/4)</h2>
            <button
              onClick={() => setSelectedAssets([])}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <X size={14} />
              Clear All
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${selectedAssets.length}, 1fr)`,
              gap: '16px',
            }}
          >
            {selectedAssetsData.map((asset) => (
              <div
                key={asset.assetId}
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                      {asset.name || 'Unnamed Asset'}
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {asset.assetId}</p>
                  </div>
                  <button
                    onClick={() => toggleAsset(asset.assetId)}
                    style={{
                      padding: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type:</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {asset.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status:</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background:
                          asset.status === 'needs-fixing'
                            ? 'var(--text-muted)'
                            : asset.status === 'accepted'
                            ? 'var(--success)'
                            : asset.status === 'declined'
                            ? 'var(--danger)'
                            : 'var(--pending)',
                        color: 'white',
                      }}
                    >
                      {asset.status === 'needs-fixing' ? '(needs fixing)' : (asset.status?.toUpperCase() || 'PENDING')}
                    </span>
                  </div>
                  {asset.createdAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uploaded:</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>All Assets</h2>
        {filteredAssets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            No assets found. Upload assets to compare them.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px',
            }}
          >
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssets.includes(asset.assetId)
              return (
                <div
                  key={asset.assetId}
                  onClick={() => toggleAsset(asset.assetId)}
                  style={{
                    background: isSelected ? 'var(--accent)' : 'var(--bg-tertiary)',
                    padding: '12px',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: selectedAssets.length >= 4 && !isSelected ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && selectedAssets.length < 4) {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          marginBottom: '4px',
                          color: isSelected ? 'white' : 'var(--text-primary)',
                        }}
                      >
                        {asset.name || 'Unnamed Asset'}
                      </h3>
                      <p style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                        ID: {asset.assetId}
                      </p>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          padding: '2px 6px',
                          background: 'white',
                          color: 'var(--accent)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                        color: isSelected ? 'white' : 'var(--text-primary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {asset.type}
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        background:
                          asset.status === 'needs-fixing'
                            ? 'var(--text-muted)'
                            : asset.status === 'accepted'
                            ? 'var(--success)'
                            : asset.status === 'declined'
                            ? 'var(--danger)'
                            : 'var(--pending)',
                        color: 'white',
                      }}
                    >
                      {asset.status === 'needs-fixing' ? '(needs fixing)' : (asset.status?.toUpperCase() || 'PENDING')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

