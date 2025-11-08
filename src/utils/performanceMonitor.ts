export interface PerformanceMetric {
  id: string
  timestamp: string
  type: 'upload' | 'api' | 'system'
  metric: string
  value: number
  unit: string
  metadata?: Record<string, any>
}

export interface UploadPerformance {
  uploadId: string
  startTime: number
  endTime?: number
  duration?: number
  fileSize: number
  fileType: 'audio' | 'decal'
  uploadSpeed?: number // MB/s
  status: 'success' | 'error' | 'pending'
  error?: string
  apiResponseTime?: number // ms
  queueWaitTime?: number // ms
  accountId?: string
  groupId?: string
}

export interface PerformanceStats {
  averageUploadSpeed: number // MB/s
  averageResponseTime: number // ms
  errorRate: number // percentage
  totalUploads: number
  successfulUploads: number
  failedUploads: number
  averageUploadDuration: number // ms
  uploadsPerMinute: number
  averageFileSize: number // bytes
  successRateByHour: Array<{ hour: number; rate: number; count: number }>
  performanceByFileType: {
    audio: { averageSpeed: number; averageDuration: number; count: number }
    decal: { averageSpeed: number; averageDuration: number; count: number }
  }
  networkBandwidth: {
    totalBytes: number
    averageSpeed: number // MB/s
  }
  queueMetrics: {
    averageWaitTime: number
    averageProcessingTime: number
    totalProcessed: number
  }
}

const PERFORMANCE_KEY = 'performanceMetrics'
const UPLOAD_PERFORMANCE_KEY = 'uploadPerformance'
const MAX_METRICS = 10000 // Keep last 10k metrics
const MAX_UPLOAD_RECORDS = 5000 // Keep last 5k upload records

// Store individual metrics
export function recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): PerformanceMetric {
  const metrics = getMetrics()
  const newMetric: PerformanceMetric = {
    ...metric,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
  }
  metrics.unshift(newMetric)
  
  // Keep only last MAX_METRICS
  if (metrics.length > MAX_METRICS) {
    metrics.splice(MAX_METRICS)
  }
  
  localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(metrics))
  return newMetric
}

// Store upload performance data
export function recordUploadPerformance(performance: Omit<UploadPerformance, 'uploadId'>): UploadPerformance {
  const uploads = getUploadPerformance()
  const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  
  const uploadRecord: UploadPerformance = {
    ...performance,
    uploadId,
  }
  
  // Calculate upload speed if we have duration and file size
  if (performance.duration && performance.duration > 0 && performance.fileSize > 0) {
    uploadRecord.uploadSpeed = (performance.fileSize / (1024 * 1024)) / (performance.duration / 1000) // MB/s
  }
  
  uploads.unshift(uploadRecord)
  
  // Keep only last MAX_UPLOAD_RECORDS
  if (uploads.length > MAX_UPLOAD_RECORDS) {
    uploads.splice(MAX_UPLOAD_RECORDS)
  }
  
  localStorage.setItem(UPLOAD_PERFORMANCE_KEY, JSON.stringify(uploads))
  return uploadRecord
}

// Update upload performance when upload completes
export function updateUploadPerformance(
  uploadId: string,
  updates: Partial<UploadPerformance>
): UploadPerformance | null {
  const uploads = getUploadPerformance()
  const index = uploads.findIndex((u) => u.uploadId === uploadId)
  
  if (index === -1) return null
  
  const updated = {
    ...uploads[index],
    ...updates,
  }
  
  // Recalculate upload speed if duration changed
  if (updates.duration !== undefined && updated.duration && updated.duration > 0 && updated.fileSize > 0) {
    updated.uploadSpeed = (updated.fileSize / (1024 * 1024)) / (updated.duration / 1000) // MB/s
  }
  
  uploads[index] = updated
  localStorage.setItem(UPLOAD_PERFORMANCE_KEY, JSON.stringify(uploads))
  return updated
}

// Get all metrics
export function getMetrics(): PerformanceMetric[] {
  const stored = localStorage.getItem(PERFORMANCE_KEY)
  return stored ? JSON.parse(stored) : []
}

// Get all upload performance records
export function getUploadPerformance(): UploadPerformance[] {
  const stored = localStorage.getItem(UPLOAD_PERFORMANCE_KEY)
  return stored ? JSON.parse(stored) : []
}

// Calculate comprehensive performance statistics
export function calculatePerformanceStats(timeRange?: { start: Date; end: Date }): PerformanceStats {
  const uploads = getUploadPerformance()
  const metrics = getMetrics()
  
  // Filter by time range if provided
  let filteredUploads = uploads
  let filteredMetrics = metrics
  
  if (timeRange) {
    filteredUploads = uploads.filter((u) => {
      const timestamp = new Date(u.startTime)
      return timestamp >= timeRange.start && timestamp <= timeRange.end
    })
    
    filteredMetrics = metrics.filter((m) => {
      const timestamp = new Date(m.timestamp)
      return timestamp >= timeRange.start && timestamp <= timeRange.end
    })
  }
  
  // Calculate basic stats
  const successfulUploads = filteredUploads.filter((u) => u.status === 'success' && u.duration)
  const failedUploads = filteredUploads.filter((u) => u.status === 'error')
  const totalUploads = filteredUploads.length
  
  // Calculate average upload speed (MB/s)
  const uploadsWithSpeed = successfulUploads.filter((u) => u.uploadSpeed && u.uploadSpeed > 0)
  const averageUploadSpeed =
    uploadsWithSpeed.length > 0
      ? uploadsWithSpeed.reduce((sum, u) => sum + (u.uploadSpeed || 0), 0) / uploadsWithSpeed.length
      : 0
  
  // Calculate average response time
  const apiMetrics = filteredMetrics.filter((m) => m.type === 'api' && m.metric === 'responseTime')
  const averageResponseTime =
    apiMetrics.length > 0 ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length : 0
  
  // Calculate error rate
  const errorRate = totalUploads > 0 ? (failedUploads.length / totalUploads) * 100 : 0
  
  // Calculate average upload duration
  const averageUploadDuration =
    successfulUploads.length > 0
      ? successfulUploads.reduce((sum, u) => sum + (u.duration || 0), 0) / successfulUploads.length
      : 0
  
  // Calculate uploads per minute
  if (filteredUploads.length === 0) {
    return getEmptyStats()
  }
  
  const timeSpan = timeRange
    ? timeRange.end.getTime() - timeRange.start.getTime()
    : Date.now() - Math.min(...filteredUploads.map((u) => u.startTime))
  const minutes = Math.max(timeSpan / (1000 * 60), 1) // At least 1 minute
  const uploadsPerMinute = filteredUploads.length / minutes
  
  // Calculate average file size
  const averageFileSize =
    filteredUploads.length > 0
      ? filteredUploads.reduce((sum, u) => sum + u.fileSize, 0) / filteredUploads.length
      : 0
  
  // Calculate success rate by hour
  const successRateByHour: Array<{ hour: number; rate: number; count: number }> = []
  for (let hour = 0; hour < 24; hour++) {
    const hourUploads = filteredUploads.filter((u) => {
      const date = new Date(u.startTime)
      return date.getHours() === hour
    })
    const hourSuccessful = hourUploads.filter((u) => u.status === 'success').length
    const rate = hourUploads.length > 0 ? (hourSuccessful / hourUploads.length) * 100 : 0
    successRateByHour.push({ hour, rate, count: hourUploads.length })
  }
  
  // Calculate performance by file type
  const audioUploads = successfulUploads.filter((u) => u.fileType === 'audio')
  const decalUploads = successfulUploads.filter((u) => u.fileType === 'decal')
  
  const audioSpeed =
    audioUploads.length > 0
      ? audioUploads.reduce((sum, u) => sum + (u.uploadSpeed || 0), 0) / audioUploads.length
      : 0
  const audioDuration =
    audioUploads.length > 0
      ? audioUploads.reduce((sum, u) => sum + (u.duration || 0), 0) / audioUploads.length
      : 0
  
  const decalSpeed =
    decalUploads.length > 0
      ? decalUploads.reduce((sum, u) => sum + (u.uploadSpeed || 0), 0) / decalUploads.length
      : 0
  const decalDuration =
    decalUploads.length > 0
      ? decalUploads.reduce((sum, u) => sum + (u.duration || 0), 0) / decalUploads.length
      : 0
  
  // Calculate network bandwidth
  const totalBytes = filteredUploads.reduce((sum, u) => sum + u.fileSize, 0)
  const networkAverageSpeed = averageUploadSpeed // Already in MB/s
  
  // Calculate queue metrics
  const queueMetrics = filteredMetrics.filter((m) => m.type === 'upload' && m.metric === 'queueWaitTime')
  const averageQueueWaitTime =
    queueMetrics.length > 0 ? queueMetrics.reduce((sum, m) => sum + m.value, 0) / queueMetrics.length : 0
  
  const processingMetrics = filteredMetrics.filter((m) => m.type === 'upload' && m.metric === 'processingTime')
  const averageProcessingTime =
    processingMetrics.length > 0
      ? processingMetrics.reduce((sum, m) => sum + m.value, 0) / processingMetrics.length
      : 0
  
  return {
    averageUploadSpeed,
    averageResponseTime,
    errorRate,
    totalUploads,
    successfulUploads: successfulUploads.length,
    failedUploads: failedUploads.length,
    averageUploadDuration,
    uploadsPerMinute,
    averageFileSize,
    successRateByHour,
    performanceByFileType: {
      audio: {
        averageSpeed: audioSpeed,
        averageDuration: audioDuration,
        count: audioUploads.length,
      },
      decal: {
        averageSpeed: decalSpeed,
        averageDuration: decalDuration,
        count: decalUploads.length,
      },
    },
    networkBandwidth: {
      totalBytes,
      averageSpeed: networkAverageSpeed,
    },
    queueMetrics: {
      averageWaitTime: averageQueueWaitTime,
      averageProcessingTime,
      totalProcessed: filteredUploads.length,
    },
  }
}

function getEmptyStats(): PerformanceStats {
  return {
    averageUploadSpeed: 0,
    averageResponseTime: 0,
    errorRate: 0,
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    averageUploadDuration: 0,
    uploadsPerMinute: 0,
    averageFileSize: 0,
    successRateByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, rate: 0, count: 0 })),
    performanceByFileType: {
      audio: { averageSpeed: 0, averageDuration: 0, count: 0 },
      decal: { averageSpeed: 0, averageDuration: 0, count: 0 },
    },
    networkBandwidth: {
      totalBytes: 0,
      averageSpeed: 0,
    },
    queueMetrics: {
      averageWaitTime: 0,
      averageProcessingTime: 0,
      totalProcessed: 0,
    },
  }
}

// Get performance data for a specific time range
export function getPerformanceData(timeRange: { start: Date; end: Date }) {
  return calculatePerformanceStats(timeRange)
}

// Export performance data
export function exportPerformanceData(format: 'json' | 'csv' = 'json'): string {
  const uploads = getUploadPerformance()
  const metrics = getMetrics()
  
  if (format === 'csv') {
    // CSV format for uploads
    const headers = [
      'Upload ID',
      'Start Time',
      'End Time',
      'Duration (ms)',
      'File Size (bytes)',
      'File Type',
      'Upload Speed (MB/s)',
      'Status',
      'Error',
      'API Response Time (ms)',
      'Queue Wait Time (ms)',
    ]
    
    const rows = uploads.map((u) => [
      u.uploadId,
      new Date(u.startTime).toISOString(),
      u.endTime ? new Date(u.endTime).toISOString() : '',
      u.duration || '',
      u.fileSize,
      u.fileType,
      u.uploadSpeed?.toFixed(2) || '',
      u.status,
      u.error || '',
      u.apiResponseTime || '',
      u.queueWaitTime || '',
    ])
    
    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
  }
  
  // JSON format
  return JSON.stringify(
    {
      uploads,
      metrics,
      stats: calculatePerformanceStats(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  )
}

// Clear performance data
export function clearPerformanceData(): void {
  localStorage.removeItem(PERFORMANCE_KEY)
  localStorage.removeItem(UPLOAD_PERFORMANCE_KEY)
}

// Get real-time performance metrics (last N uploads)
export function getRealTimeMetrics(count: number = 10): {
  recentUploads: UploadPerformance[]
  averageSpeed: number
  averageResponseTime: number
  currentErrorRate: number
} {
  const uploads = getUploadPerformance().slice(0, count)
  const recentSuccessful = uploads.filter((u) => u.status === 'success' && u.uploadSpeed)
  
  const averageSpeed =
    recentSuccessful.length > 0
      ? recentSuccessful.reduce((sum, u) => sum + (u.uploadSpeed || 0), 0) / recentSuccessful.length
      : 0
  
  const recentWithResponseTime = uploads.filter((u) => u.apiResponseTime)
  const averageResponseTime =
    recentWithResponseTime.length > 0
      ? recentWithResponseTime.reduce((sum, u) => sum + (u.apiResponseTime || 0), 0) / recentWithResponseTime.length
      : 0
  
  const errorRate = uploads.length > 0 ? (uploads.filter((u) => u.status === 'error').length / uploads.length) * 100 : 0
  
  return {
    recentUploads: uploads,
    averageSpeed,
    averageResponseTime,
    currentErrorRate: errorRate,
  }
}

