import { useState, useEffect } from 'react'
import { 
  History as HistoryIcon, Download, Trash2, Filter, Calendar, Search, 
  BarChart3, ArrowUpDown, TrendingUp, TrendingDown, FileText, Copy, ExternalLink,
  ChevronDown, ChevronUp, CheckSquare, Square, X, RefreshCw, Music, Image
} from 'lucide-react'
import { getHistory, clearHistory, exportHistory, UploadLog } from '../utils/uploadHistory'
import { useToast } from '../contexts/ToastContext'
import QuickActions from '../components/QuickActions'

export default function History() {
  const toast = useToast()
  const [logs, setLogs] = useState<UploadLog[]>([])
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'pending'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'audio' | 'decal'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status' | 'type' | 'duration' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showStats, setShowStats] = useState(true)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu && !(event.target as Element).closest('[data-export-menu]')) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  const loadHistory = async () => {
    setRefreshing(true)
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300))
    setLogs(getHistory())
    setRefreshing(false)
  }

  // Calculate statistics
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    error: logs.filter(l => l.status === 'error').length,
    pending: logs.filter(l => l.status === 'pending').length,
    audios: logs.filter(l => l.type === 'audio').length,
    decals: logs.filter(l => l.type === 'decal').length,
    totalSize: logs.reduce((sum, log) => sum + log.fileSize, 0),
    avgDuration: logs.filter(l => l.duration).length > 0
      ? logs.filter(l => l.duration).reduce((sum, log) => sum + (log.duration || 0), 0) / logs.filter(l => l.duration).length
      : 0,
    successRate: logs.length > 0 
      ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)
      : 0,
  }

  // Filter and sort logs
  const filteredLogs = logs
    .filter((log) => {
      const matchesStatus = filter === 'all' || log.status === filter
      const matchesType = typeFilter === 'all' || log.type === typeFilter
      const matchesSearch =
        log.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.assetId?.toLowerCase().includes(searchTerm.toLowerCase())
      
      let matchesDate = true
      if (dateFilter === 'custom') {
        if (dateRange.start || dateRange.end) {
          const logDate = new Date(log.timestamp)
          if (dateRange.start && logDate < new Date(dateRange.start)) {
            matchesDate = false
          }
          if (dateRange.end && logDate > new Date(dateRange.end + 'T23:59:59')) {
            matchesDate = false
          }
        }
      } else if (dateFilter !== 'all') {
        const logDate = new Date(log.timestamp)
        const now = new Date()
        const diffTime = now.getTime() - logDate.getTime()
        const diffDays = diffTime / (1000 * 60 * 60 * 24)
        
        if (dateFilter === 'today') {
          matchesDate = diffDays < 1
        } else if (dateFilter === 'week') {
          matchesDate = diffDays < 7
        } else if (dateFilter === 'month') {
          matchesDate = diffDays < 30
        }
      }
      
      return matchesStatus && matchesType && matchesSearch && matchesDate
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName)
          break
        case 'status':
          const statusOrder = { 'success': 1, 'pending': 2, 'error': 3 }
          comparison = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0)
          break
        case 'size':
          comparison = a.fileSize - b.fileSize
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleExportJSON = () => {
    const data = exportHistory()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `upload-history-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('History exported to JSON!')
    setShowExportMenu(false)
  }

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Type', 'File Name', 'Asset ID', 'Status', 'File Size (MB)', 'Duration (s)', 'Error']
    const rows = filteredLogs.map(log => [
      log.timestamp,
      log.type,
      log.fileName,
      log.assetId || '',
      log.status,
      (log.fileSize / 1024 / 1024).toFixed(2),
      log.duration ? (log.duration / 1000).toFixed(2) : '',
      log.error || '',
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `upload-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('History exported to CSV!')
    setShowExportMenu(false)
  }

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  const toggleSelect = (logId: string) => {
    setSelectedLogs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedLogs.size === filteredLogs.length) {
      setSelectedLogs(new Set())
    } else {
      setSelectedLogs(new Set(filteredLogs.map(l => l.id)))
    }
  }

  const handleBulkDelete = () => {
    if (selectedLogs.size === 0) {
      toast.warning('No logs selected')
      return
    }

    const count = selectedLogs.size
    if (!confirm(`Are you sure you want to delete ${count} log entry(ies)? This cannot be undone.`)) {
      return
    }

    const updatedLogs = logs.filter(log => !selectedLogs.has(log.id))
    localStorage.setItem('uploadHistory', JSON.stringify(updatedLogs))
    setLogs(updatedLogs)
    setSelectedLogs(new Set())
    toast.success(`Deleted ${count} log entry(ies)`)
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all upload history? This cannot be undone.')) {
      clearHistory()
      setLogs([])
      toast.success('History cleared!')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'var(--success)'
      case 'error':
        return 'var(--danger)'
      default:
        return 'var(--pending)'
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HistoryIcon size={28} />
            Upload History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
            Detailed logs of all upload attempts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadHistory}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: refreshing ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
              color: refreshing ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              border: '1px solid var(--border)',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: showStats ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: showStats ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <BarChart3 size={18} />
            {showStats ? 'Hide' : 'Show'} Stats
          </button>
          <div style={{ position: 'relative' }} data-export-menu>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
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
                border: '1px solid var(--border)',
              }}
            >
              <Download size={18} />
              Export
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '4px',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: '150px',
                }}
              >
                <button
                  onClick={handleExportJSON}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <FileText size={14} />
                  Export JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <FileText size={14} />
                  Export CSV
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'var(--danger)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <Trash2 size={18} />
            Clear All
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      {showStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Logs</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{stats.total}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.audios} audio, {stats.decals} decal
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Success</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--success)' }}>{stats.success}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.successRate}% success rate
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Errors</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--danger)' }}>{stats.error}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.total > 0 ? Math.round((stats.error / stats.total) * 100) : 0}% of total
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Size</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {(stats.totalSize / 1024 / 1024).toFixed(1)} MB
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.avgDuration > 0 ? `Avg: ${(stats.avgDuration / 1000).toFixed(1)}s` : 'No duration data'}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedLogs.size > 0 && (
        <div
          style={{
            background: 'var(--accent)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>
            {selectedLogs.size} log(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            style={{
              padding: '8px 16px',
              background: 'var(--danger)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
            }}
          >
            <Trash2 size={16} />
            Delete Selected
          </button>
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by filename or asset ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                style={{
                  padding: '6px 12px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Status and Type Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</span>
            {(['all', 'success', 'error', 'pending'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: '6px 12px',
                  background: filter === status ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: filter === status ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  textTransform: 'capitalize',
                }}
              >
                {status}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Type:</span>
            {(['all', 'audio', 'decal'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '6px 12px',
                  background: typeFilter === type ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: typeFilter === type ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  textTransform: 'capitalize',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {type === 'audio' && <Music size={12} />}
                {type === 'decal' && <Image size={12} />}
                {type}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
            <ArrowUpDown size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="type">Type</option>
              <option value="duration">Duration</option>
              <option value="size">File Size</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <HistoryIcon size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '8px' }}>
            No history found
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {searchTerm || filter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload files to see history here'}
          </p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button
              onClick={toggleSelectAll}
              style={{
                padding: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-primary)',
              }}
            >
              {selectedLogs.size === filteredLogs.length && filteredLogs.length > 0 ? (
                <CheckSquare size={20} />
              ) : (
                <Square size={20} />
              )}
            </button>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {selectedLogs.size > 0 ? `${selectedLogs.size} selected` : 'Select all'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: selectedLogs.has(log.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                  <button
                    onClick={() => toggleSelect(log.id)}
                    style={{
                      padding: '4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: selectedLogs.has(log.id) ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '2px',
                    }}
                  >
                    {selectedLogs.has(log.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: log.type === 'audio' ? 'var(--accent)' : 'var(--success)',
                          color: 'white',
                          textTransform: 'capitalize',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {log.type === 'audio' ? <Music size={10} /> : <Image size={10} />}
                        {log.type}
                      </span>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: getStatusColor(log.status),
                          color: 'white',
                          textTransform: 'uppercase',
                        }}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {log.fileName}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {log.assetId && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {log.assetId}</span>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {(log.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {log.duration && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Duration: {(log.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.assetId && (
                      <div style={{ marginBottom: '8px' }}>
                        <QuickActions assetId={log.assetId} type={log.type} />
                      </div>
                    )}
                    {log.error && (
                      <div
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(242, 63, 66, 0.1)',
                          border: '1px solid var(--danger)',
                          borderRadius: '6px',
                          marginTop: '8px',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: 'var(--danger)', margin: 0, fontWeight: 500 }}>
                          Error: {log.error}
                        </p>
                      </div>
                    )}
                    {expandedLogs.has(log.id) && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Log ID:</strong> {log.id}
                          </div>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Timestamp:</strong> {new Date(log.timestamp).toISOString()}
                          </div>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>File Size:</strong> {log.fileSize} bytes ({(log.fileSize / 1024 / 1024).toFixed(2)} MB)
                          </div>
                          {log.duration && (
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Upload Duration:</strong> {log.duration}ms ({(log.duration / 1000).toFixed(2)}s)
                            </div>
                          )}
                          {log.assetId && (
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Asset ID:</strong> {log.assetId}
                            </div>
                          )}
                          <div>
                            <strong>Status:</strong> {log.status}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    style={{
                      padding: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={expandedLogs.has(log.id) ? 'Collapse' : 'Expand details'}
                  >
                    {expandedLogs.has(log.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

