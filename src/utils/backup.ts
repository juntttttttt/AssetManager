export interface BackupData {
  version: string
  timestamp: string
  data: {
    config?: string
    audios?: string
    decals?: string
    uploadHistory?: string
    scheduledUploads?: string
    uploadPresets?: string
    accounts?: string
    tags?: string
    theme?: string
    themeVariant?: string
    colorScheme?: string
    accentColor?: string
  }
  metadata: {
    deviceId: string
    appVersion: string
    dataSize: number
  }
}

export interface BackupVersion {
  id: string
  version: string
  timestamp: string
  size: number
  description?: string
}

const BACKUP_KEY = 'backupVersions'
const CURRENT_BACKUP_KEY = 'currentBackup'
const DEVICE_ID_KEY = 'deviceId'
const APP_VERSION = '1.0.0'

// Generate or retrieve device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

// Get all backup versions
export function getBackupVersions(): BackupVersion[] {
  const stored = localStorage.getItem(BACKUP_KEY)
  return stored ? JSON.parse(stored) : []
}

// Save a backup version
function saveBackupVersion(backup: BackupData): void {
  const versions = getBackupVersions()
  const version: BackupVersion = {
    id: `backup-${Date.now()}`,
    version: backup.version,
    timestamp: backup.timestamp,
    size: backup.metadata.dataSize,
  }
  versions.unshift(version)
  // Keep only last 50 versions
  if (versions.length > 50) {
    versions.splice(50)
  }
  localStorage.setItem(BACKUP_KEY, JSON.stringify(versions))
}

// Create a backup
export function createBackup(description?: string): BackupData {
  const data: BackupData['data'] = {}
  
  // Collect all localStorage data
  const keys = [
    'robloxConfig',
    'uploadedAudios',
    'uploadedDecals',
    'uploadHistory',
    'scheduledUploads',
    'uploadPresets',
    'robloxAccounts',
    'assetTags',
    'theme',
    'themeVariant',
    'colorScheme',
    'accentColor',
  ]
  
  keys.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value) {
      // Map to backup data structure
      if (key === 'robloxConfig') data.config = value
      else if (key === 'uploadedAudios') data.audios = value
      else if (key === 'uploadedDecals') data.decals = value
      else if (key === 'uploadHistory') data.uploadHistory = value
      else if (key === 'scheduledUploads') data.scheduledUploads = value
      else if (key === 'uploadPresets') data.uploadPresets = value
      else if (key === 'robloxAccounts') data.accounts = value
      else if (key === 'assetTags') data.tags = value
      else if (key === 'theme') data.theme = value
      else if (key === 'themeVariant') data.themeVariant = value
      else if (key === 'colorScheme') data.colorScheme = value
      else if (key === 'accentColor') data.accentColor = value
    }
  })
  
  const backupData: BackupData = {
    version: `1.${Date.now()}`,
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      deviceId: getDeviceId(),
      appVersion: APP_VERSION,
      dataSize: JSON.stringify(data).length,
    },
  }
  
  // Save as current backup
  localStorage.setItem(CURRENT_BACKUP_KEY, JSON.stringify(backupData))
  
  // Add to version history
  saveBackupVersion(backupData)
  
  return backupData
}

// Restore from backup
export function restoreBackup(backup: BackupData, merge: boolean = false): void {
  if (!merge) {
    // Clear existing data first
    const keys = [
      'robloxConfig',
      'uploadedAudios',
      'uploadedDecals',
      'uploadHistory',
      'scheduledUploads',
      'uploadPresets',
      'robloxAccounts',
      'assetTags',
      'theme',
      'themeVariant',
      'colorScheme',
      'accentColor',
    ]
    keys.forEach((key) => localStorage.removeItem(key))
  }
  
  // Restore data
  if (backup.data.config) {
    if (merge) {
      const existing = localStorage.getItem('robloxConfig')
      if (!existing) localStorage.setItem('robloxConfig', backup.data.config)
    } else {
      localStorage.setItem('robloxConfig', backup.data.config)
    }
  }
  
  if (backup.data.audios) {
    if (merge) {
      const existing = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
      const backupAudios = JSON.parse(backup.data.audios)
      localStorage.setItem('uploadedAudios', JSON.stringify([...existing, ...backupAudios]))
    } else {
      localStorage.setItem('uploadedAudios', backup.data.audios)
    }
  }
  
  if (backup.data.decals) {
    if (merge) {
      const existing = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
      const backupDecals = JSON.parse(backup.data.decals)
      localStorage.setItem('uploadedDecals', JSON.stringify([...existing, ...backupDecals]))
    } else {
      localStorage.setItem('uploadedDecals', backup.data.decals)
    }
  }
  
  if (backup.data.uploadHistory) {
    if (merge) {
      const existing = localStorage.getItem('uploadHistory')
      if (!existing) localStorage.setItem('uploadHistory', backup.data.uploadHistory)
    } else {
      localStorage.setItem('uploadHistory', backup.data.uploadHistory)
    }
  }
  
  if (backup.data.scheduledUploads) {
    if (merge) {
      const existing = JSON.parse(localStorage.getItem('scheduledUploads') || '[]')
      const backupScheduled = JSON.parse(backup.data.scheduledUploads)
      localStorage.setItem('scheduledUploads', JSON.stringify([...existing, ...backupScheduled]))
    } else {
      localStorage.setItem('scheduledUploads', backup.data.scheduledUploads)
    }
  }
  
  if (backup.data.uploadPresets) {
    if (merge) {
      const existing = JSON.parse(localStorage.getItem('uploadPresets') || '[]')
      const backupPresets = JSON.parse(backup.data.uploadPresets)
      localStorage.setItem('uploadPresets', JSON.stringify([...existing, ...backupPresets]))
    } else {
      localStorage.setItem('uploadPresets', backup.data.uploadPresets)
    }
  }
  
  if (backup.data.accounts) {
    if (merge) {
      const existing = JSON.parse(localStorage.getItem('robloxAccounts') || '[]')
      const backupAccounts = JSON.parse(backup.data.accounts)
      localStorage.setItem('robloxAccounts', JSON.stringify([...existing, ...backupAccounts]))
    } else {
      localStorage.setItem('robloxAccounts', backup.data.accounts)
    }
  }
  
  if (backup.data.tags) localStorage.setItem('assetTags', backup.data.tags)
  if (backup.data.theme) localStorage.setItem('theme', backup.data.theme)
  if (backup.data.themeVariant) localStorage.setItem('themeVariant', backup.data.themeVariant)
  if (backup.data.colorScheme) localStorage.setItem('colorScheme', backup.data.colorScheme)
  if (backup.data.accentColor) localStorage.setItem('accentColor', backup.data.accentColor)
}

// Export backup to file
export function exportBackupToFile(backup: BackupData): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-${backup.timestamp.split('T')[0]}-${backup.version}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import backup from file
export function importBackupFromFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as BackupData
        if (!backup.version || !backup.timestamp || !backup.data) {
          reject(new Error('Invalid backup file format'))
          return
        }
        resolve(backup)
      } catch (error) {
        reject(new Error('Failed to parse backup file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// Get current backup
export function getCurrentBackup(): BackupData | null {
  const stored = localStorage.getItem(CURRENT_BACKUP_KEY)
  return stored ? JSON.parse(stored) : null
}

// Delete a backup version
export function deleteBackupVersion(versionId: string): void {
  const versions = getBackupVersions()
  const filtered = versions.filter((v) => v.id !== versionId)
  localStorage.setItem(BACKUP_KEY, JSON.stringify(filtered))
}

// Cloud sync simulation (for future implementation)
export interface CloudSyncStatus {
  enabled: boolean
  lastSync: string | null
  syncInProgress: boolean
  error?: string
}

const CLOUD_SYNC_KEY = 'cloudSyncStatus'

export function getCloudSyncStatus(): CloudSyncStatus {
  const stored = localStorage.getItem(CLOUD_SYNC_KEY)
  return stored
    ? JSON.parse(stored)
    : { enabled: false, lastSync: null, syncInProgress: false }
}

export function setCloudSyncStatus(status: CloudSyncStatus): void {
  localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify(status))
}

// Simulate cloud sync (in real implementation, this would call a cloud API)
export async function syncToCloud(): Promise<void> {
  const status = getCloudSyncStatus()
  if (!status.enabled) {
    throw new Error('Cloud sync is not enabled')
  }
  
  setCloudSyncStatus({ ...status, syncInProgress: true, error: undefined })
  
  try {
    // Create backup
    const backup = createBackup('Cloud sync')
    
    // In a real implementation, this would upload to cloud storage
    // For now, we'll just simulate it
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    setCloudSyncStatus({
      enabled: true,
      lastSync: new Date().toISOString(),
      syncInProgress: false,
    })
  } catch (error: any) {
    setCloudSyncStatus({
      ...status,
      syncInProgress: false,
      error: error.message || 'Sync failed',
    })
    throw error
  }
}

// Simulate cloud restore
export async function syncFromCloud(): Promise<BackupData | null> {
  const status = getCloudSyncStatus()
  if (!status.enabled) {
    throw new Error('Cloud sync is not enabled')
  }
  
  setCloudSyncStatus({ ...status, syncInProgress: true, error: undefined })
  
  try {
    // In a real implementation, this would download from cloud storage
    // For now, we'll return the current backup
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    const backup = getCurrentBackup()
    
    setCloudSyncStatus({
      enabled: true,
      lastSync: new Date().toISOString(),
      syncInProgress: false,
    })
    
    return backup
  } catch (error: any) {
    setCloudSyncStatus({
      ...status,
      syncInProgress: false,
      error: error.message || 'Sync failed',
    })
    throw error
  }
}

