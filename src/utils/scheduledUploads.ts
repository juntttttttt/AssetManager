export interface ScheduledUpload {
  id: string
  name: string
  files: string[] // File paths or file names
  uploadType: 'audio' | 'decal'
  scheduledTime: string // ISO date string
  accountId?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  completedAt?: string
  error?: string
}

const SCHEDULED_UPLOADS_KEY = 'scheduledUploads'

export function getScheduledUploads(): ScheduledUpload[] {
  const stored = localStorage.getItem(SCHEDULED_UPLOADS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function saveScheduledUpload(upload: Omit<ScheduledUpload, 'id' | 'createdAt' | 'status'>): ScheduledUpload {
  const uploads = getScheduledUploads()
  const newUpload: ScheduledUpload = {
    ...upload,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  uploads.push(newUpload)
  localStorage.setItem(SCHEDULED_UPLOADS_KEY, JSON.stringify(uploads))
  return newUpload
}

export function updateScheduledUpload(id: string, updates: Partial<ScheduledUpload>): void {
  const uploads = getScheduledUploads()
  const index = uploads.findIndex((u) => u.id === id)
  if (index !== -1) {
    uploads[index] = { ...uploads[index], ...updates }
    localStorage.setItem(SCHEDULED_UPLOADS_KEY, JSON.stringify(uploads))
  }
}

export function deleteScheduledUpload(id: string): void {
  const uploads = getScheduledUploads()
  const filtered = uploads.filter((u) => u.id !== id)
  localStorage.setItem(SCHEDULED_UPLOADS_KEY, JSON.stringify(filtered))
}

export function getPendingScheduledUploads(): ScheduledUpload[] {
  const uploads = getScheduledUploads()
  const now = new Date()
  return uploads.filter((u) => {
    if (u.status !== 'pending') return false
    const scheduledTime = new Date(u.scheduledTime)
    return scheduledTime <= now
  })
}

