import { useState, useEffect } from 'react'
import { Image, Search, RefreshCw, Edit3 } from 'lucide-react'
import { robloxAPI } from '../services/robloxApi'
import QuickActions from '../components/QuickActions'
import AssetTags from '../components/AssetTags'
import AssetMetadataEditor from '../components/AssetMetadataEditor'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function Decals() {
  const [decals, setDecals] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // STATUS CHECKING DISABLED - needs fixing
  const loadDecals = async () => {
    setRefreshing(true)
    setLoading(true)
    const stored = localStorage.getItem('uploadedDecals')
    if (stored) {
      const storedDecals = JSON.parse(stored)
      // Set all statuses to 'needs-fixing' to indicate status checking is disabled
      const decalsWithDisabledStatus = storedDecals.map((decal: any) => ({
        ...decal,
        status: 'needs-fixing',
      }))
      setDecals(decalsWithDisabledStatus)
    }
    await new Promise(resolve => setTimeout(resolve, 300)) // Visual feedback
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadDecals()
  }, [])

  // Auto-refresh status for pending decals - DISABLED (needs fixing)
  // useAutoRefresh(
  //   decals.map((d) => ({ assetId: d.assetId, type: 'decal' as const, status: d.status || 'pending', name: d.name })),
  //   (updated) => {
  //     loadDecals() // Reload when status changes
  //   },
  //   true
  // )

  const [statusFilter, setStatusFilter] = useState<'all' | 'accepted' | 'declined' | 'pending'>('all')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [editingAsset, setEditingAsset] = useState<any | null>(null)

  useEffect(() => {
    const tags = JSON.parse(localStorage.getItem('allTags') || '[]')
    setAvailableTags(tags)
  }, [decals])

  const filteredDecals = decals.filter((decal) => {
    const matchesSearch =
      decal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      decal.assetId?.toString().includes(searchTerm)
    const matchesStatus = statusFilter === 'all' || decal.status === statusFilter
    const matchesTag = !tagFilter || (decal.tags || []).includes(tagFilter)
    return matchesSearch && matchesStatus && matchesTag
  })

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image size={28} />
          Decals
        </h1>
        <button
          onClick={loadDecals}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--bg-tertiary)',
            color: refreshing ? 'var(--text-muted)' : 'var(--text-primary)',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              position: 'relative',
              flex: 1,
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
              placeholder="Search decals by name or asset ID..."
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
          {availableTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '10px 16px',
              background: statusFilter === 'all' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: statusFilter === 'all' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('accepted')}
            style={{
              padding: '10px 16px',
              background: statusFilter === 'accepted' ? 'var(--success)' : 'var(--bg-tertiary)',
              color: statusFilter === 'accepted' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Accepted
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{
              padding: '10px 16px',
              background: statusFilter === 'pending' ? 'var(--pending)' : 'var(--bg-tertiary)',
              color: statusFilter === 'pending' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('declined')}
            style={{
              padding: '10px 16px',
              background: statusFilter === 'declined' ? 'var(--danger)' : 'var(--bg-tertiary)',
              color: statusFilter === 'declined' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Declined
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading decals...
        </div>
      ) : filteredDecals.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <Image size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '8px' }}>
            No decals found
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {searchTerm ? 'Try a different search term' : 'Upload decals to see them here'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredDecals.map((decal) => (
            <div
              key={decal.assetId}
              style={{
                background: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {decal.name || 'Unnamed Decal'}
                    </h3>
                    <button
                      onClick={() => setEditingAsset(decal)}
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)'
                        e.currentTarget.style.color = 'var(--accent)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }}
                      title="Edit metadata"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ID: {decal.assetId}
                  </p>
                  {decal.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                      {decal.description}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background:
                      decal.status === 'needs-fixing'
                        ? 'var(--text-muted)'
                        : decal.status === 'accepted'
                        ? 'var(--success)'
                        : decal.status === 'declined'
                        ? 'var(--danger)'
                        : 'var(--pending)',
                    color: 'white',
                  }}
                >
                  {decal.status === 'needs-fixing' ? '(needs fixing)' : (decal.status?.toUpperCase() || 'PENDING')}
                </span>
              </div>
              {decal.createdAt && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Uploaded: {new Date(decal.createdAt).toLocaleDateString()}
                </p>
              )}
              <div style={{ marginBottom: '12px' }}>
                <AssetTags
                  assetId={decal.assetId}
                  type="decal"
                  currentTags={decal.tags || []}
                  onTagsChange={(tags) => {
                    const updated = decals.map((d) =>
                      d.assetId === decal.assetId ? { ...d, tags } : d
                    )
                    setDecals(updated)
                    localStorage.setItem('uploadedDecals', JSON.stringify(updated))
                  }}
                />
              </div>
              <QuickActions assetId={decal.assetId} type="decal" />
            </div>
          ))}
        </div>
      )}

      {editingAsset && (
        <AssetMetadataEditor
          asset={editingAsset}
          type="decal"
          isOpen={!!editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={(updatedAsset) => {
            const updated = decals.map((d) =>
              d.assetId === updatedAsset.assetId ? updatedAsset : d
            )
            setDecals(updated)
            localStorage.setItem('uploadedDecals', JSON.stringify(updated))
            setEditingAsset(null)
          }}
        />
      )}
    </div>
  )
}

