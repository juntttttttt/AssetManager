import { useState, useEffect } from 'react'
import { Clock, Plus, Play, Pause, Trash2, Calendar } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import {
  getScheduledUploads,
  saveScheduledUpload,
  updateScheduledUpload,
  deleteScheduledUpload,
  ScheduledUpload,
} from '../utils/scheduledUploads'
import { getAccounts } from '../utils/accounts'

export default function ScheduledUploads() {
  const toast = useToast()
  const [scheduledUploads, setScheduledUploads] = useState<ScheduledUpload[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    files: [] as string[],
    uploadType: 'audio' as 'audio' | 'decal',
    scheduledTime: '',
    accountId: '',
  })

  useEffect(() => {
    loadScheduledUploads()
    const interval = setInterval(loadScheduledUploads, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  const loadScheduledUploads = () => {
    setScheduledUploads(getScheduledUploads())
  }

  const handleSave = () => {
    if (!formData.name || !formData.scheduledTime) {
      toast.error('Name and scheduled time are required')
      return
    }

    saveScheduledUpload(formData)
    toast.success('Upload scheduled!')
    loadScheduledUploads()
    resetForm()
  }

  const resetForm = () => {
    setFormData({ name: '', files: [], uploadType: 'audio', scheduledTime: '', accountId: '' })
    setShowForm(false)
  }

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this scheduled upload?')) {
      updateScheduledUpload(id, { status: 'cancelled' })
      loadScheduledUploads()
      toast.success('Scheduled upload cancelled')
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled upload?')) {
      deleteScheduledUpload(id)
      loadScheduledUploads()
      toast.success('Scheduled upload deleted')
    }
  }

  const accounts = getAccounts()

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeUntil = (dateString: string) => {
    const now = new Date()
    const scheduled = new Date(dateString)
    const diff = scheduled.getTime() - now.getTime()
    
    if (diff <= 0) return 'Overdue'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={28} />
            Scheduled Uploads
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
            Schedule uploads to run at specific times
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={18} />
          Schedule Upload
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            marginBottom: '24px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>New Scheduled Upload</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Morning Upload Batch"
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
                Upload Type *
              </label>
              <select
                value={formData.uploadType}
                onChange={(e) => setFormData({ ...formData, uploadType: e.target.value as 'audio' | 'decal' })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <option value="audio">Audio</option>
                <option value="decal">Decal</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Scheduled Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
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
            {accounts.length > 0 && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Account (optional)
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Use Active Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Schedule
              </button>
              <button
                onClick={resetForm}
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
            </div>
          </div>
        </div>
      )}

      {scheduledUploads.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <Clock size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '8px' }}>
            No scheduled uploads
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Schedule your first upload to get started
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scheduledUploads.map((upload) => (
            <div
              key={upload.id}
              style={{
                background: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {upload.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: upload.uploadType === 'audio' ? 'var(--accent)' : 'var(--success)',
                        color: 'white',
                        textTransform: 'capitalize',
                      }}
                    >
                      {upload.uploadType}
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background:
                          upload.status === 'completed'
                            ? 'var(--success)'
                            : upload.status === 'failed'
                            ? 'var(--danger)'
                            : upload.status === 'cancelled'
                            ? 'var(--text-muted)'
                            : 'var(--pending)',
                        color: 'white',
                        textTransform: 'uppercase',
                      }}
                    >
                      {upload.status}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {formatDateTime(upload.scheduledTime)}
                    </span>
                    {upload.status === 'pending' && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        In: {getTimeUntil(upload.scheduledTime)}
                      </span>
                    )}
                  </div>
                </div>
                {upload.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleCancel(upload.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        border: '1px solid var(--border)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(upload.id)}
                      style={{
                        padding: '6px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--danger)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

