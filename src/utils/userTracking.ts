// User tracking and identification
export interface UserSession {
  userId: string
  machineId: string
  firstSeen: string
  lastActive: string
  uploadCount: number
  blockedUploads: number
}

export interface MonitoredUpload {
  uploadId: string
  userId: string
  machineId: string
  fileName: string
  fileType: 'audio' | 'decal'
  fileSize: number
  fileHash?: string
  timestamp: string
  status: 'pending' | 'uploading' | 'completed' | 'blocked' | 'failed'
  assetId?: string
  flagged: boolean
  flagReason?: string
  blockedBy?: string // Owner who blocked it
  blockedAt?: string
}

const USER_ID_KEY = 'userTrackingId'
const MACHINE_ID_KEY = 'machineId'
const MONITORED_UPLOADS_KEY = 'monitoredUploads'
const USER_SESSIONS_KEY = 'userSessions'

// Generate or retrieve user ID
export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

// Generate or retrieve machine ID
export function getMachineId(): string {
  let machineId = localStorage.getItem(MACHINE_ID_KEY)
  if (!machineId) {
    // Create a semi-unique machine ID based on available info
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    const language = navigator.language
    const timestamp = localStorage.getItem('appFirstRun') || Date.now().toString()
    if (!localStorage.getItem('appFirstRun')) {
      localStorage.setItem('appFirstRun', timestamp)
    }
    
    // Create hash-like ID
    const combined = `${userAgent}_${platform}_${language}_${timestamp}`
    machineId = btoa(combined).substring(0, 16).replace(/[^a-zA-Z0-9]/g, '')
    localStorage.setItem(MACHINE_ID_KEY, machineId)
  }
  return machineId
}

// Get all monitored uploads
export function getMonitoredUploads(): MonitoredUpload[] {
  try {
    const data = localStorage.getItem(MONITORED_UPLOADS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// Save monitored upload
export function saveMonitoredUpload(upload: MonitoredUpload): void {
  const uploads = getMonitoredUploads()
  uploads.push(upload)
  // Keep only last 1000 uploads to prevent storage bloat
  if (uploads.length > 1000) {
    uploads.splice(0, uploads.length - 1000)
  }
  localStorage.setItem(MONITORED_UPLOADS_KEY, JSON.stringify(uploads))
  
  // Update user session
  updateUserSession(upload.userId, upload.machineId)
}

// Update user session
export function updateUserSession(userId: string, machineId: string): void {
  const sessions = getUserSessions()
  const existing = sessions.find(s => s.userId === userId && s.machineId === machineId)
  
  if (existing) {
    existing.lastActive = new Date().toISOString()
    existing.uploadCount++
  } else {
    sessions.push({
      userId,
      machineId,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      uploadCount: 1,
      blockedUploads: 0,
    })
  }
  
  localStorage.setItem(USER_SESSIONS_KEY, JSON.stringify(sessions))
}

// Get all user sessions
export function getUserSessions(): UserSession[] {
  try {
    const data = localStorage.getItem(USER_SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// Get active users (active in last 24 hours)
export function getActiveUsers(): UserSession[] {
  const sessions = getUserSessions()
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  return sessions.filter(s => new Date(s.lastActive).getTime() > oneDayAgo)
}

// Block an upload
export function blockUpload(uploadId: string, blockedBy: string, reason?: string): boolean {
  const uploads = getMonitoredUploads()
  const upload = uploads.find(u => u.uploadId === uploadId)
  
  if (upload) {
    upload.status = 'blocked'
    upload.blockedBy = blockedBy
    upload.blockedAt = new Date().toISOString()
    if (reason) {
      upload.flagReason = reason
    }
    
    localStorage.setItem(MONITORED_UPLOADS_KEY, JSON.stringify(uploads))
    
    // Update user session blocked count
    const sessions = getUserSessions()
    const userSession = sessions.find(s => s.userId === upload.userId && s.machineId === upload.machineId)
    if (userSession) {
      userSession.blockedUploads++
      localStorage.setItem(USER_SESSIONS_KEY, JSON.stringify(sessions))
    }
    
    return true
  }
  
  return false
}

// Update upload status
export function updateUploadStatus(uploadId: string, status: MonitoredUpload['status'], assetId?: string): void {
  const uploads = getMonitoredUploads()
  const upload = uploads.find(u => u.uploadId === uploadId)
  
  if (upload) {
    upload.status = status
    if (assetId) {
      upload.assetId = assetId
    }
    localStorage.setItem(MONITORED_UPLOADS_KEY, JSON.stringify(uploads))
  }
}

