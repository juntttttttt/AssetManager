import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Image as ImageIcon, Music } from 'lucide-react'

interface AssetPreviewProps {
  file: File
  type: 'audio' | 'decal'
  assetId?: string
}

export default function AssetPreview({ file, type, assetId }: AssetPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (type === 'decal' && file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [file, type])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  if (type === 'decal') {
    return (
      <div
        style={{
          width: '100%',
          height: '120px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border)',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Decal preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <ImageIcon size={32} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        padding: '12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <button
        onClick={togglePlay}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <audio
        ref={audioRef}
        src={assetId ? `https://www.roblox.com/library/${assetId}` : URL.createObjectURL(file)}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
    </div>
  )
}

