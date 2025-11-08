export interface UploadLog {
  id: string
  timestamp: string
  type: 'audio' | 'decal'
  fileName: string
  assetId?: string
  status: 'success' | 'error' | 'pending'
  error?: string
  fileSize: number
  duration?: number // Upload duration in ms
}

const HISTORY_KEY = 'uploadHistory'

export function addLog(log: Omit<UploadLog, 'id' | 'timestamp'>): UploadLog {
  const history = getHistory()
  const newLog: UploadLog = {
    ...log,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
  }
  history.unshift(newLog) // Add to beginning
  // Keep only last 1000 logs
  if (history.length > 1000) {
    history.splice(1000)
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return newLog
}

export function getHistory(): UploadLog[] {
  const stored = localStorage.getItem(HISTORY_KEY)
  return stored ? JSON.parse(stored) : []
}

export function getLogs(): UploadLog[] {
  return getHistory()
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

export function exportHistory(): string {
  const history = getHistory()
  return JSON.stringify(history, null, 2)
}

export function importHistory(json: string): void {
  try {
    const history = JSON.parse(json)
    if (Array.isArray(history)) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }
  } catch (error) {
    throw new Error('Invalid history format')
  }
}

