import { useState, useEffect } from 'react'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Download,
  Upload as UploadIcon,
  BarChart3,
  Zap,
  Server,
  Network,
  FileText,
  Download as DownloadIcon,
  RefreshCw,
} from 'lucide-react'
import {
  calculatePerformanceStats,
  getRealTimeMetrics,
  exportPerformanceData,
  clearPerformanceData,
  getUploadPerformance,
} from '../utils/performanceMonitor'
import { BarChart, LineChart } from '../components/Charts'
import { useToast } from '../contexts/ToastContext'

export default function Performance() {
  const toast = useToast()
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d' | 'all'>('7d')
  const [stats, setStats] = useState(calculatePerformanceStats())
  const [realTimeMetrics, setRealTimeMetrics] = useState(getRealTimeMetrics(10))
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = async () => {
    setRefreshing(true)
    let timeRangeFilter: { start: Date; end: Date } | undefined

    if (timeRange !== 'all') {
      const end = new Date()
      const start = new Date()

      switch (timeRange) {
        case '1h':
          start.setHours(start.getHours() - 1)
          break
        case '24h':
          start.setHours(start.getHours() - 24)
          break
        case '7d':
          start.setDate(start.getDate() - 7)
          break
        case '30d':
          start.setDate(start.getDate() - 30)
          break
      }

      timeRangeFilter = { start, end }
    }

    setStats(calculatePerformanceStats(timeRangeFilter))
    setRealTimeMetrics(getRealTimeMetrics(10))
    await new Promise(resolve => setTimeout(resolve, 300)) // Visual feedback
    setRefreshing(false)
  }

  useEffect(() => {
    loadStats()

    if (autoRefresh) {
      const interval = setInterval(loadStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [timeRange, autoRefresh])

  const handleExport = (format: 'json' | 'csv') => {
    try {
      const data = exportPerformanceData(format)
      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `performance-report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Performance report exported as ${format.toUpperCase()}`)
    } catch (error: any) {
      toast.error(`Failed to export: ${error.message}`)
    }
  }

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all performance data? This cannot be undone.')) {
      clearPerformanceData()
      loadStats()
      toast.success('Performance data cleared')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={28} />
            Performance Monitoring
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
            Real-time and historical performance metrics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '6px' }}>
            {(['1h', '24h', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '6px 12px',
                  background: timeRange === range ? 'var(--accent)' : 'transparent',
                  color: timeRange === range ? 'white' : 'var(--text-primary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {range === '1h' ? '1H' : range === '24h' ? '24H' : range === '7d' ? '7D' : range === '30d' ? '30D' : 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '8px',
              background: autoRefresh ? 'var(--success)' : 'var(--bg-tertiary)',
              color: autoRefresh ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
            }}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <RefreshCw size={16} style={{ animation: autoRefresh ? 'spin 2s linear infinite' : undefined }} />
          </button>
          <button
            onClick={loadStats}
            disabled={refreshing}
            style={{
              padding: '8px',
              background: 'var(--bg-tertiary)',
              color: refreshing ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: '6px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              opacity: refreshing ? 0.7 : 1,
            }}
            title="Refresh"
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          </button>
          <button
            onClick={() => handleExport('json')}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--border)',
              fontSize: '12px',
            }}
            title="Export JSON"
          >
            <DownloadIcon size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadIcon size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Upload Speed</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.averageUploadSpeed.toFixed(2)} MB/s
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Avg Response Time</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatDuration(stats.averageResponseTime)}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: stats.errorRate < 5 ? 'var(--success)' : stats.errorRate < 20 ? 'var(--warning)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Error Rate</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.errorRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Uploads/Min</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.uploadsPerMinute.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Network size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Bandwidth</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatBytes(stats.networkBandwidth.totalBytes)}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Server size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Uploads</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{stats.totalUploads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Success Rate by Hour */}
        {stats.successRateByHour.some((h) => h.count > 0) && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Clock size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Success Rate by Hour</h2>
            </div>
            <BarChart
              data={stats.successRateByHour.map((h) => ({
                label: `${h.hour}:00`,
                value: h.rate,
                count: h.count,
              }))}
              height={250}
            />
          </div>
        )}

        {/* Performance by File Type */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Performance by File Type</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Audio</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {stats.performanceByFileType.audio.count} uploads
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Speed: {stats.performanceByFileType.audio.averageSpeed.toFixed(2)} MB/s</span>
                <span>Duration: {formatDuration(stats.performanceByFileType.audio.averageDuration)}</span>
              </div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Decal</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {stats.performanceByFileType.decal.count} uploads
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Speed: {stats.performanceByFileType.decal.averageSpeed.toFixed(2)} MB/s</span>
                <span>Duration: {formatDuration(stats.performanceByFileType.decal.averageDuration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Metrics */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Zap size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Queue Metrics</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Average Wait Time</span>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>{formatDuration(stats.queueMetrics.averageWaitTime)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Average Processing Time</span>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>
                {formatDuration(stats.queueMetrics.averageProcessingTime)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Processed</span>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>{stats.queueMetrics.totalProcessed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Uploads Performance */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} style={{ color: 'var(--text-secondary)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Recent Upload Performance</h2>
          </div>
          <button
            onClick={handleClearData}
            style={{
              padding: '6px 12px',
              background: 'var(--danger)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Clear Data
          </button>
        </div>
        {realTimeMetrics.recentUploads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            No performance data available. Start uploading to see metrics here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {realTimeMetrics.recentUploads.slice(0, 10).map((upload) => (
              <div
                key={upload.uploadId}
                style={{
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 100px 100px 80px',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                    {upload.fileType.toUpperCase()} • {formatBytes(upload.fileSize)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(upload.startTime).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {upload.uploadSpeed ? `${upload.uploadSpeed.toFixed(2)} MB/s` : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {upload.duration ? formatDuration(upload.duration) : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {upload.apiResponseTime ? formatDuration(upload.apiResponseTime) : 'N/A'}
                </div>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background:
                      upload.status === 'success'
                        ? 'var(--success)'
                        : upload.status === 'error'
                        ? 'var(--danger)'
                        : 'var(--pending)',
                    color: 'white',
                    textAlign: 'center',
                  }}
                >
                  {upload.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

