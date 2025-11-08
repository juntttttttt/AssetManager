import { useState, useRef, useCallback } from 'react'
import { Upload as UploadIcon, Music, Image, Settings, Loader, X } from 'lucide-react'
import { robloxAPI, RobloxConfig } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'

interface FileWithProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  assetId?: string
  error?: string
}

export default function UploadEnhanced() {
  const toast = useToast()
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
  const [uploadType, setUploadType] = useState<'audio' | 'decal'>('audio')
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConfigSave = () => {
    robloxAPI.setConfig(config)
    localStorage.setItem('robloxConfig', JSON.stringify(config))
    setShowConfig(false)
    toast.success('Configuration saved!')
  }

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    
    const newFiles: FileWithProgress[] = Array.from(selectedFiles).map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }))
    
    setFiles((prev) => [...prev, ...newFiles])
    toast.info(`Added ${newFiles.length} file(s)`)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [])

  const uploadFile = async (fileWithProgress: FileWithProgress, index: number) => {
    setFiles((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], status: 'uploading', progress: 10 }
      return updated
    })

    try {
      const result = uploadType === 'audio'
        ? await robloxAPI.uploadAudio(fileWithProgress.file, fileWithProgress.file.name.replace(/\.[^/.]+$/, ''))
        : await robloxAPI.uploadDecal(fileWithProgress.file, fileWithProgress.file.name.replace(/\.[^/.]+$/, ''))

      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: result.assetId ? 'success' : 'error',
          progress: 100,
          assetId: result.assetId,
          error: result.error,
        }
        return updated
      })

      if (result.assetId) {
        // Save to localStorage
        const assetData = {
          assetId: result.assetId,
          name: fileWithProgress.file.name.replace(/\.[^/.]+$/, ''),
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

        toast.success(`Uploaded: ${fileWithProgress.file.name}`)
      } else {
        toast.error(`Failed: ${fileWithProgress.file.name} - ${result.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          progress: 0,
          error: error.message,
        }
        return updated
      })
      toast.error(`Error uploading ${fileWithProgress.file.name}: ${error.message}`)
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

    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) {
      toast.info('No files to upload')
      return
    }

    // Upload files sequentially with progress simulation
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await uploadFile(files[i], i)
        // Small delay between uploads
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    const successCount = files.filter((f) => f.status === 'success').length
    const errorCount = files.filter((f) => f.status === 'error').length
    
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`)
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} file(s) failed to upload`)
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isDragging ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {isDragging ? 'Drop files here' : 'Click to select files or drag and drop'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {uploadType === 'audio' ? 'Audio files (MP3, OGG, etc.)' : 'Image files (PNG, JPG, etc.)'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={uploadType === 'audio' ? 'audio/*' : 'image/*'}
            onChange={(e) => handleFileSelect(e.target.files)}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
                Selected files: {files.length}
              </p>
              <button
                onClick={() => setFiles([])}
                style={{
                  padding: '4px 8px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((fileWithProgress, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fileWithProgress.file.name}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {(fileWithProgress.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        marginLeft: '8px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--danger)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {fileWithProgress.status === 'uploading' && (
                    <div style={{ marginTop: '8px' }}>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${fileWithProgress.progress}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                        {fileWithProgress.progress}%
                      </p>
                    </div>
                  )}

                  {fileWithProgress.status === 'success' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: 'var(--success)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        SUCCESS
                      </span>
                      {fileWithProgress.assetId && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID: {fileWithProgress.assetId}
                        </span>
                      )}
                    </div>
                  )}

                  {fileWithProgress.status === 'error' && (
                    <div style={{ marginTop: '8px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: 'var(--danger)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        ERROR
                      </span>
                      {fileWithProgress.error && (
                        <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
                          {fileWithProgress.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || files.every((f) => f.status !== 'pending')}
          style={{
            width: '100%',
            padding: '12px',
            background: files.length === 0 || files.every((f) => f.status !== 'pending') ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: files.length === 0 || files.every((f) => f.status !== 'pending') ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <UploadIcon size={18} />
          Upload {files.filter((f) => f.status === 'pending').length > 0 
            ? `${files.filter((f) => f.status === 'pending').length} file${files.filter((f) => f.status === 'pending').length > 1 ? 's' : ''}`
            : 'Files'}
        </button>
      </div>
    </div>
  )
}

