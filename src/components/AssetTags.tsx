import { useState } from 'react'
import { Tag, X, Plus } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface AssetTagsProps {
  assetId: string
  type: 'audio' | 'decal'
  currentTags: string[]
  onTagsChange: (tags: string[]) => void
}

export default function AssetTags({ assetId, type, currentTags, onTagsChange }: AssetTagsProps) {
  const toast = useToast()
  const [showInput, setShowInput] = useState(false)
  const [newTag, setNewTag] = useState('')

  const allTags = JSON.parse(localStorage.getItem('allTags') || '[]') as string[]

  const addTag = () => {
    if (!newTag.trim()) return

    const tag = newTag.trim().toLowerCase()
    if (currentTags.includes(tag)) {
      toast.warning('Tag already exists')
      return
    }

    const updatedTags = [...currentTags, tag]
    onTagsChange(updatedTags)

    // Save to global tags list
    if (!allTags.includes(tag)) {
      const updatedAllTags = [...allTags, tag]
      localStorage.setItem('allTags', JSON.stringify(updatedAllTags))
    }

    // Save to asset
    const storageKey = type === 'audio' ? 'uploadedAudios' : 'uploadedDecals'
    const assets = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const assetIndex = assets.findIndex((a: any) => a.assetId === assetId)
    if (assetIndex !== -1) {
      assets[assetIndex].tags = updatedTags
      localStorage.setItem(storageKey, JSON.stringify(assets))
    }

    setNewTag('')
    setShowInput(false)
    toast.success('Tag added')
  }

  const removeTag = (tagToRemove: string) => {
    const updatedTags = currentTags.filter((t) => t !== tagToRemove)
    onTagsChange(updatedTags)

    // Save to asset
    const storageKey = type === 'audio' ? 'uploadedAudios' : 'uploadedDecals'
    const assets = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const assetIndex = assets.findIndex((a: any) => a.assetId === assetId)
    if (assetIndex !== -1) {
      assets[assetIndex].tags = updatedTags
      localStorage.setItem(storageKey, JSON.stringify(assets))
    }

    toast.info('Tag removed')
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
      {currentTags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: 'var(--accent)',
            color: 'white',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          <Tag size={12} />
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {showInput ? (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addTag()
              } else if (e.key === 'Escape') {
                setShowInput(false)
                setNewTag('')
              }
            }}
            placeholder="Tag name"
            autoFocus
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '11px',
              color: 'var(--text-primary)',
              width: '100px',
            }}
          />
          <button
            onClick={addTag}
            style={{
              padding: '4px',
              background: 'var(--success)',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            borderRadius: '12px',
            fontSize: '11px',
            border: '1px dashed var(--border)',
            cursor: 'pointer',
          }}
        >
          <Plus size={12} />
          Add tag
        </button>
      )}
    </div>
  )
}

