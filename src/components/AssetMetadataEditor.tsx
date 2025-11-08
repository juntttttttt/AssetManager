import { useState, useEffect } from 'react'
import { Edit3, X, Save, FileText, Calendar, Hash } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface AssetMetadataEditorProps {
  asset: {
    assetId: string
    name?: string
    description?: string
    notes?: string
    category?: string
    createdAt?: string
    [key: string]: any
  }
  type: 'audio' | 'decal'
  isOpen: boolean
  onClose: () => void
  onSave: (updatedAsset: any) => void
}

export default function AssetMetadataEditor({
  asset,
  type,
  isOpen,
  onClose,
  onSave,
}: AssetMetadataEditorProps) {
  const toast = useToast()
  const [name, setName] = useState(asset.name || '')
  const [description, setDescription] = useState(asset.description || '')
  const [notes, setNotes] = useState(asset.notes || '')
  const [category, setCategory] = useState(asset.category || '')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(asset.name || '')
      setDescription(asset.description || '')
      setNotes(asset.notes || '')
      setCategory(asset.category || '')
      setHasChanges(false)
    }
  }, [isOpen, asset])

  useEffect(() => {
    const changed =
      name !== (asset.name || '') ||
      description !== (asset.description || '') ||
      notes !== (asset.notes || '') ||
      category !== (asset.category || '')
    setHasChanges(changed)
  }, [name, description, notes, category, asset])

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    const updatedAsset = {
      ...asset,
      name: name.trim(),
      description: description.trim(),
      notes: notes.trim(),
      category: category.trim(),
      updatedAt: new Date().toISOString(),
    }

    onSave(updatedAsset)
    toast.success('Metadata updated successfully')
    onClose()
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Edit3 size={24} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Edit Asset Metadata
            </h2>
          </div>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Asset Info */}
          <div
            style={{
              background: 'var(--bg-tertiary)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Hash size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Asset ID: <strong style={{ color: 'var(--text-primary)' }}>{asset.assetId}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                Type: <strong style={{ color: 'var(--text-primary)' }}>{type}</strong>
              </span>
            </div>
            {asset.createdAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Created: <strong style={{ color: 'var(--text-primary)' }}>
                    {new Date(asset.createdAt).toLocaleString()}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Name Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter asset name..."
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Description Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for this asset..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {description.length} characters
            </p>
          </div>

          {/* Notes Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Notes (Private)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add private notes about this asset..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Private notes for your reference only
            </p>
          </div>

          {/* Category Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Music, Sound Effects, Backgrounds..."
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || !name.trim()}
            style={{
              padding: '10px 20px',
              background: hasChanges && name.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: hasChanges && name.trim() ? 'white' : 'var(--text-muted)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: hasChanges && name.trim() ? 'pointer' : 'not-allowed',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

