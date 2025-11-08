import { useState, useRef } from 'react'
import { Upload as UploadIcon, Music, Image, Settings, Loader } from 'lucide-react'
import { robloxAPI, RobloxConfig } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'

export default function Upload() {
  const [config, setConfig] = useState<RobloxConfig>(() => {
    const saved = localStorage.getItem('robloxConfig')
    if (saved) {
      const parsed = JSON.parse(saved)
      robloxAPI.setConfig(parsed)
      return parsed
    }
    return {
      openCloudApiKey: '',
      cookie: '',
      universeId: '',
    }
  })
  const [showConfig, setShowConfig] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<'audio' | 'decal'>('audio')
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toast = useToast()

  const handleConfigSave = () => {
    robloxAPI.setConfig(config)
    localStorage.setItem('robloxConfig', JSON.stringify(config))
    setShowConfig(false)
    toast.success('Configuration saved!')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.warning('Please select files to upload')
      return
    }

    if (!config.openCloudApiKey) {
      toast.error('Please set your Open Cloud API key in settings')
      return
    }

    if (uploadType === 'decal' && !config.cookie) {
      toast.error('Cookie is required for decal uploads')
      return
    }

    setUploading(true)
    setResults([])

    const uploadResults = []

    for (const file of files) {
      try {
        const result = uploadType === 'audio'
          ? await robloxAPI.uploadAudio(file, file.name.replace(/\.[^/.]+$/, ''))
          : await robloxAPI.uploadDecal(file, file.name.replace(/\.[^/.]+$/, ''))

        uploadResults.push({
          fileName: file.name,
          ...result,
        })
      } catch (error: any) {
        uploadResults.push({
          fileName: file.name,
          assetId: '',
          status: 'declined',
          error: error.message,
        })
      }
    }

    setResults(uploadResults)
    
    // Save successful uploads to localStorage
    uploadResults.forEach((result) => {
      if (result.assetId) {
        const assetData = {
          assetId: result.assetId,
          name: result.fileName.replace(/\.[^/.]+$/, ''),
          status: result.status,
          createdAt: new Date().toISOString(),
        }
        
        if (uploadType === 'audio') {
          const existing = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
          existing.push(assetData)
          localStorage.setItem('uploadedAudios', JSON.stringify(existing))
        } else {
          const existing = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
          existing.push(assetData)
          localStorage.setItem('uploadedDecals', JSON.stringify(existing))
        }
      }
    })
    
    setUploading(false)
    setFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Upload Assets</h1>
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Settings size={18} />
          Settings
        </button>
      </div>

      {showConfig && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid var(--border)',
          }}
        >
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Configuration</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Open Cloud API Key *
              </label>
              <input
                type="password"
                value={config.openCloudApiKey}
                onChange={(e) => setConfig({ ...config, openCloudApiKey: e.target.value })}
                placeholder="Enter your Open Cloud API key"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Cookie (for decals)
              </label>
              <input
                type="password"
                value={config.cookie}
                onChange={(e) => setConfig({ ...config, cookie: e.target.value })}
                placeholder="Enter your Roblox cookie"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Universe ID (optional)
              </label>
              <input
                type="text"
                value={config.universeId}
                onChange={(e) => setConfig({ ...config, universeId: e.target.value })}
                placeholder="Enter universe ID"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
            </div>
            <button
              onClick={handleConfigSave}
              style={{
                padding: '10px 20px',
                background: 'var(--accent)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setUploadType('audio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: uploadType === 'audio' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: uploadType === 'audio' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Music size={18} />
            Audio
          </button>
          <button
            onClick={() => setUploadType('decal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: uploadType === 'decal' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: uploadType === 'decal' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Image size={18} />
            Decal
          </button>
        </div>

        <div
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.background = 'var(--bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <UploadIcon size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Click to select files or drag and drop
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {uploadType === 'audio' ? 'Audio files (MP3, OGG, etc.)' : 'Image files (PNG, JPG, etc.)'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={uploadType === 'audio' ? 'audio/*' : 'image/*'}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Selected files: {files.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflow: 'auto' }}>
              {files.map((file, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          style={{
            width: '100%',
            padding: '12px',
            background: uploading ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {uploading ? (
            <>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Uploading...
            </>
          ) : (
            <>
              <UploadIcon size={18} />
              Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div
          style={{
            marginTop: '24px',
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Upload Results</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{result.fileName}</p>
                  {result.assetId && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Asset ID: {result.assetId}
                    </p>
                  )}
                  {result.error && (
                    <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                      Error: {result.error}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background:
                      result.status === 'accepted'
                        ? 'var(--success)'
                        : result.status === 'declined'
                        ? 'var(--danger)'
                        : 'var(--pending)',
                    color: 'white',
                  }}
                >
                  {result.status.toUpperCase()}
                </span>
              </div>
            ))}
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

