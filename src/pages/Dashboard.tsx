import { useState, useEffect } from 'react'
import { BarChart3, Music, Image, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, TrendingDown, Activity, Calendar, RefreshCw } from 'lucide-react'
import { getLogs } from '../utils/uploadHistory'
import { BarChart, LineChart, DonutChart } from '../components/Charts'

interface Stats {
  totalAudios: number
  totalDecals: number
  totalAssets: number
  accepted: number
  declined: number
  pending: number
  recentUploads: any[]
  successRate: number
  todayUploads: number
  weekUploads: number
  dailyUploads: Array<{ date: string; count: number; accepted: number; declined: number }>
  weeklySuccessRate: Array<{ week: string; rate: number }>
  monthlyTrends: Array<{ month: string; uploads: number; successRate: number }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalAudios: 0,
    totalDecals: 0,
    totalAssets: 0,
    accepted: 0,
    declined: 0,
    pending: 0,
    recentUploads: [],
    successRate: 0,
    todayUploads: 0,
    weekUploads: 0,
    dailyUploads: [],
    weeklySuccessRate: [],
    monthlyTrends: [],
  })
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = async () => {
    setRefreshing(true)
    const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
    const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
    const historyLogs = getLogs()
    
    const allAssets = [
      ...audios.map((a: any) => ({ ...a, type: 'audio' })),
      ...decals.map((d: any) => ({ ...d, type: 'decal' })),
    ]

    const accepted = allAssets.filter((a: any) => a.status === 'accepted').length
    const declined = allAssets.filter((a: any) => a.status === 'declined').length
    const pending = allAssets.filter((a: any) => a.status === 'pending' || !a.status).length

    // Calculate success rate
    const processed = accepted + declined
    const successRate = processed > 0 ? (accepted / processed) * 100 : 0

    // Get today's uploads
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayUploads = allAssets.filter((a: any) => {
      const uploadDate = new Date(a.createdAt || 0)
      return uploadDate >= today
    }).length

    // Get this week's uploads
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekUploads = allAssets.filter((a: any) => {
      const uploadDate = new Date(a.createdAt || 0)
      return uploadDate >= weekAgo
    }).length

    // Get recent uploads (last 10, sorted by date)
    const recent = [...allAssets]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
      .slice(0, 10)

    // Calculate daily uploads for the selected time range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const dailyData: Map<string, { count: number; accepted: number; declined: number }> = new Map()
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      dailyData.set(dateStr, { count: 0, accepted: 0, declined: 0 })
    }

    // Populate with actual data
    allAssets.forEach((asset: any) => {
      if (asset.createdAt) {
        const date = new Date(asset.createdAt)
        if (date >= startDate) {
          const dateStr = date.toISOString().split('T')[0]
          const existing = dailyData.get(dateStr) || { count: 0, accepted: 0, declined: 0 }
          existing.count++
          if (asset.status === 'accepted') existing.accepted++
          if (asset.status === 'declined') existing.declined++
          dailyData.set(dateStr, existing)
        }
      }
    })

    const dailyUploads = Array.from(dailyData.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate weekly success rate
    const weeklyData: Map<string, { accepted: number; declined: number }> = new Map()
    const weeks = Math.ceil(days / 7)
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate)
      weekStart.setDate(weekStart.getDate() + i * 7)
      const weekKey = `Week ${i + 1}`
      weeklyData.set(weekKey, { accepted: 0, declined: 0 })
    }

    allAssets.forEach((asset: any) => {
      if (asset.createdAt) {
        const date = new Date(asset.createdAt)
        if (date >= startDate) {
          const weekIndex = Math.floor((date.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
          const weekKey = `Week ${weekIndex + 1}`
          const existing = weeklyData.get(weekKey) || { accepted: 0, declined: 0 }
          if (asset.status === 'accepted') existing.accepted++
          if (asset.status === 'declined') existing.declined++
          weeklyData.set(weekKey, existing)
        }
      }
    })

    const weeklySuccessRate = Array.from(weeklyData.entries())
      .map(([week, data]) => {
        const total = data.accepted + data.declined
        return {
          week,
          rate: total > 0 ? (data.accepted / total) * 100 : 0,
        }
      })

    // Calculate monthly trends
    const monthlyData: Map<string, { uploads: number; accepted: number; declined: number }> = new Map()
    const months = Math.ceil(days / 30)
    
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(startDate)
      monthStart.setMonth(monthStart.getMonth() + i)
      const monthKey = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      monthlyData.set(monthKey, { uploads: 0, accepted: 0, declined: 0 })
    }

    allAssets.forEach((asset: any) => {
      if (asset.createdAt) {
        const date = new Date(asset.createdAt)
        if (date >= startDate) {
          const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          const existing = monthlyData.get(monthKey) || { uploads: 0, accepted: 0, declined: 0 }
          existing.uploads++
          if (asset.status === 'accepted') existing.accepted++
          if (asset.status === 'declined') existing.declined++
          monthlyData.set(monthKey, existing)
        }
      }
    })

    const monthlyTrends = Array.from(monthlyData.entries())
      .map(([month, data]) => {
        const total = data.accepted + data.declined
        return {
          month,
          uploads: data.uploads,
          successRate: total > 0 ? (data.accepted / total) * 100 : 0,
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.month)
        const dateB = new Date(b.month)
        return dateA.getTime() - dateB.getTime()
      })

    setStats({
      totalAudios: audios.length,
      totalDecals: decals.length,
      totalAssets: allAssets.length,
      accepted,
      declined,
      pending,
      recentUploads: recent,
      successRate,
      todayUploads,
      weekUploads,
      dailyUploads,
      weeklySuccessRate,
      monthlyTrends,
    })
    await new Promise(resolve => setTimeout(resolve, 300)) // Visual feedback
    setRefreshing(false)
  }

  useEffect(() => {
    loadStats()
  }, [timeRange])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs-fixing':
        return 'var(--text-muted)'
      case 'accepted':
        return 'var(--success)'
      case 'declined':
        return 'var(--danger)'
      default:
        return 'var(--pending)'
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart3 size={28} />
            Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
            Overview of your uploads and statistics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '6px' }}>
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
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
                {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : 'All'}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      {/* Stats Cards */}
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
              <TrendingUp size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Assets</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.totalAssets}
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
              <Music size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Audios</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.totalAudios}
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
              <Image size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Decals</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.totalDecals}
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
              <CheckCircle size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Accepted</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.accepted}
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
                background: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Declined</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.declined}
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
                background: 'var(--pending)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pending</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.pending}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
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
                background: stats.successRate >= 80 ? 'var(--success)' : stats.successRate >= 50 ? 'var(--warning)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Success Rate</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.successRate.toFixed(1)}%
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
              <Clock size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Today</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.todayUploads}
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
              <TrendingDown size={20} style={{ color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>This Week</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.weekUploads}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Daily Uploads Chart */}
        {stats.dailyUploads.length > 0 ? (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Activity size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Daily Uploads</h2>
            </div>
            <BarChart data={stats.dailyUploads} height={250} showStacked={true} />
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--success)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Accepted</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--danger)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Declined</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              textAlign: 'center',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No upload data available for the selected time range
            </p>
          </div>
        )}

        {/* Success Rate Over Time */}
        {stats.weeklySuccessRate.length > 0 ? (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <TrendingUp size={20} style={{ color: 'var(--success)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Success Rate Trend</h2>
            </div>
            <LineChart data={stats.weeklySuccessRate} height={250} label="Success Rate (%)" />
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Average: {stats.weeklySuccessRate.length > 0
                  ? (stats.weeklySuccessRate.reduce((sum, d) => sum + d.rate, 0) / stats.weeklySuccessRate.length).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              textAlign: 'center',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No success rate data available
            </p>
          </div>
        )}

        {/* Status Distribution */}
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
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Status Distribution</h2>
          </div>
          <DonutChart
            data={[
              { label: 'Accepted', value: stats.accepted, color: 'var(--success)' },
              { label: 'Declined', value: stats.declined, color: 'var(--danger)' },
              { label: 'Pending', value: stats.pending, color: 'var(--pending)' },
            ]}
            size={200}
          />
        </div>

        {/* Monthly Trends */}
        {stats.monthlyTrends.length > 0 && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Calendar size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Monthly Trends</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.monthlyTrends.map((trend, index) => (
                <div key={index} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {trend.month}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {trend.uploads} uploads
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${trend.successRate}%`,
                          height: '100%',
                          background: trend.successRate >= 80
                            ? 'var(--success)'
                            : trend.successRate >= 50
                            ? 'var(--warning)'
                            : 'var(--danger)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '45px', textAlign: 'right' }}>
                      {trend.successRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Uploads */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Recent Uploads</h2>
        </div>
        {stats.recentUploads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            No uploads yet. Start uploading to see your recent activity here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.recentUploads.map((asset: any, index: number) => (
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
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {asset.name || 'Unnamed Asset'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {asset.type}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      ID: {asset.assetId}
                    </span>
                    {asset.createdAt && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(asset.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: getStatusColor(asset.status || 'pending'),
                    color: 'white',
                  }}
                >
                  {(asset.status === 'needs-fixing' ? '(needs fixing)' : (asset.status || 'pending').toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

