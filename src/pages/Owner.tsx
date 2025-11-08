import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Crown, Trash2, Search, AlertTriangle, RefreshCw, CheckSquare, Square, Edit3, FileText, Replace,
  Download, Upload, Filter, ArrowUpDown, BarChart3, Calendar, Copy, ExternalLink, Clock, TrendingUp, TrendingDown,
  Users, Shield, Ban, Eye, X, Lock, LogOut
} from 'lucide-react'
import { robloxAPI } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'
import { emitBeforeDelete, emitAfterDelete } from '../hooks/usePluginHooks'
import QuickActions from '../components/QuickActions'
import { 
  getMonitoredUploads, 
  getUserSessions, 
  getActiveUsers, 
  blockUpload,
  MonitoredUpload 
} from '../utils/userTracking'
import { getSeverityColor } from '../utils/contentDetection'
import {
  getBlacklistedUsers,
  addToBlacklist,
  removeFromBlacklist,
  isUserBlacklisted,
  BlacklistedUser
} from '../utils/userBlacklist'

// Owner password - stored in localStorage, default is 'owner123'
const OWNER_PASSWORD_KEY = 'ownerPassword'
const DEFAULT_OWNER_PASSWORD = 'owner123'

export default function Owner() {
  const navigate = useNavigate()
  const toast = useToast()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'decal'>('all')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [showBatchRename, setShowBatchRename] = useState(false)
  const [renameMode, setRenameMode] = useState<'pattern' | 'findreplace'>('pattern')
  const [renamePattern, setRenamePattern] = useState('')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [audios, setAudios] = useState<any[]>([])
  const [decals, setDecals] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'accepted' | 'declined' | 'pending'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showStats, setShowStats] = useState(true)
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [monitoredUploads, setMonitoredUploads] = useState<MonitoredUpload[]>([])
  const [userSessions, setUserSessions] = useState(getUserSessions())
  const [showMonitoring, setShowMonitoring] = useState(true)
  const [monitoringFilter, setMonitoringFilter] = useState<'all' | 'flagged' | 'blocked' | 'active'>('all')
  const notifiedUploadsRef = useRef<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<{ assetId: string; type: 'audio' | 'decal' } | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [showBlacklist, setShowBlacklist] = useState(false)
  const [blacklistedUsers, setBlacklistedUsers] = useState<BlacklistedUser[]>(getBlacklistedUsers())
  const [blacklistUserId, setBlacklistUserId] = useState('')
  const [blacklistReason, setBlacklistReason] = useState('')
  const [blacklistUsername, setBlacklistUsername] = useState('')

  // Check if already authenticated
  useEffect(() => {
    const savedAuth = localStorage.getItem('ownerAuthenticated')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const loadAssets = async () => {
    if (!isAuthenticated) return
    setRefreshing(true)
    setLoading(true)
    const loadedAudios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
    const loadedDecals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
    
    setAudios(loadedAudios)
    setDecals(loadedDecals)
    
    const allAssets = [
      ...loadedAudios.map((a: any) => ({ ...a, type: 'audio' })),
      ...loadedDecals.map((d: any) => ({ ...d, type: 'decal' })),
    ]
    
    setAssets(allAssets)
    await new Promise(resolve => setTimeout(resolve, 300)) // Visual feedback
    setLoading(false)
    setRefreshing(false)
  }
  
  const loadMonitoringData = () => {
    if (!isAuthenticated) return
    const uploads = getMonitoredUploads()
    setMonitoredUploads(uploads)
    setUserSessions(getUserSessions())
    
    // Check for new flagged uploads and show notifications (only once per upload)
    const flaggedUploads = uploads.filter(u => 
      u.flagged && 
      u.status !== 'blocked' && 
      !u.blockedBy &&
      !notifiedUploadsRef.current.has(u.uploadId)
    )
    
    flaggedUploads.forEach(upload => {
      const severity = upload.flagReason?.toLowerCase().includes('critical') || 
                      upload.flagReason?.toLowerCase().includes('cp') || 
                      upload.flagReason?.toLowerCase().includes('child') ||
                      upload.flagReason?.toLowerCase().includes('pedo')
        ? 'critical'
        : upload.flagReason?.toLowerCase().includes('high') || 
          upload.flagReason?.toLowerCase().includes('gore') ||
          upload.flagReason?.toLowerCase().includes('violence')
        ? 'high'
        : 'medium'
      
      // Only notify for critical and high severity
      if (severity === 'critical' || severity === 'high') {
        toast.warning(`Flagged content detected: ${upload.fileName}`, {
          description: `Reason: ${upload.flagReason}`,
          duration: 10000,
        })
        notifiedUploadsRef.current.add(upload.uploadId)
      }
    })
  }

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAssets()
      loadMonitoringData()
      
      // Refresh monitoring data every 5 seconds
      const interval = setInterval(loadMonitoringData, 5000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    
    // Get stored password or use default
    const storedPassword = localStorage.getItem(OWNER_PASSWORD_KEY) || DEFAULT_OWNER_PASSWORD
    
    if (password === storedPassword) {
      setIsAuthenticated(true)
      localStorage.setItem('ownerAuthenticated', 'true')
    } else {
      setPasswordError('Incorrect password. Access denied.')
      setPassword('')
    }
  }

  // If not authenticated, show password prompt
  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            background: 'var(--bg-secondary)',
            padding: '32px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                background: 'var(--accent)',
                borderRadius: '50%',
                marginBottom: '16px',
              }}
            >
              <Lock size={32} style={{ color: 'white' }} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
              Owner Access
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Enter the owner password to access this page
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
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
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError('')
                  }}
                  placeholder="Enter owner password"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    background: 'var(--bg-tertiary)',
                    border: passwordError ? '1px solid var(--danger)' : '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = passwordError ? 'var(--danger)' : 'var(--border)'
                  }}
                />
              </div>
              {passwordError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    color: 'var(--danger)',
                    fontSize: '13px',
                  }}
                >
                  <AlertTriangle size={16} />
                  {passwordError}
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--accent)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                marginBottom: '16px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)'
              }}
            >
              Access Owner Page
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                width: '100%',
                padding: '8px',
                background: 'transparent',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Go Back
            </button>
          </form>
        </div>
      </div>
    )
  }

  
  const handleBlockUpload = (uploadId: string) => {
    if (!confirm('Are you sure you want to block this upload? This will prevent it from completing.')) {
      return
    }
    
    const success = blockUpload(uploadId, 'owner', 'Blocked by owner')
    if (success) {
      toast.success('Upload blocked successfully')
      loadMonitoringData()
    } else {
      toast.error('Failed to block upload')
    }
  }

  const handleViewAsset = async (assetId: string, fileType: 'audio' | 'decal') => {
    setPreviewAsset({ assetId, type: fileType })
    
    if (fileType === 'audio') {
      setAudioLoading(true)
      setAudioUrl(null)
      
      let foundUrl: string | null = null
      
      // Try to get the audio URL from Asset Delivery API v2
      try {
        const response = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${assetId}`)
        if (response.ok) {
          const data = await response.json()
          // Asset Delivery API v2 returns locations array with URLs
          if (data?.locations && data.locations.length > 0) {
            foundUrl = data.locations[0].location
          } else if (data?.location) {
            foundUrl = data.location
          }
        }
      } catch (error) {
        console.error('Failed to fetch audio URL:', error)
      }
      
      // Fallback URLs if API doesn't work
      if (!foundUrl) {
        // Try multiple possible audio URLs - use the first one as fallback
        foundUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`
      }
      
      setAudioUrl(foundUrl)
      setAudioLoading(false)
    } else {
      setAudioUrl(null)
    }
  }

  const handleBlacklistUser = () => {
    if (!blacklistUserId.trim()) {
      toast.error('User ID is required')
      return
    }
    if (!blacklistReason.trim()) {
      toast.error('Reason is required')
      return
    }

    const success = addToBlacklist(
      blacklistUserId.trim(),
      blacklistReason.trim(),
      'owner',
      blacklistUsername.trim() || undefined
    )

    if (success) {
      toast.success('User blacklisted successfully')
      setBlacklistedUsers(getBlacklistedUsers())
      setBlacklistUserId('')
      setBlacklistReason('')
      setBlacklistUsername('')
      setShowBlacklist(false)
    } else {
      toast.error('User is already blacklisted')
    }
  }

  const handleUnblacklistUser = (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the blacklist?')) {
      return
    }

    const success = removeFromBlacklist(userId)
    if (success) {
      toast.success('User removed from blacklist')
      setBlacklistedUsers(getBlacklistedUsers())
    } else {
      toast.error('Failed to remove user from blacklist')
    }
  }

  const toggleSelect = (assetId: string) => {
    setSelectedAssets((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(assetId)) {
        newSet.delete(assetId)
      } else {
        newSet.add(assetId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set())
    } else {
      setSelectedAssets(new Set(filteredAssets.map((a) => a.assetId)))
    }
  }

  const handleDelete = async (assetId: string, type: 'audio' | 'decal') => {
    if (!confirm('Are you sure you want to remove this asset from the tool? This will only remove it from local records, not from Roblox.')) {
      return
    }

    setDeleting(assetId)
    try {
      emitBeforeDelete(assetId, type)
      
      // Remove from localStorage only (not from Roblox)
      if (type === 'audio') {
        const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
        const updated = audios.filter((a: any) => a.assetId !== assetId)
        localStorage.setItem('uploadedAudios', JSON.stringify(updated))
      } else {
        const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
        const updated = decals.filter((d: any) => d.assetId !== assetId)
        localStorage.setItem('uploadedDecals', JSON.stringify(updated))
      }
      
      emitAfterDelete(assetId, type, true)
      await loadAssets()
      setSelectedAssets((prev) => {
        const newSet = new Set(prev)
        newSet.delete(assetId)
        return newSet
      })
      toast.success('Asset removed from local records')
    } catch (error: any) {
      toast.error(`Error removing asset: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedAssets.size === 0) {
      toast.warning('No assets selected')
      return
    }

    if (!confirm(`Are you sure you want to remove ${selectedAssets.size} asset(s) from the tool? This will only remove them from local records, not from Roblox.`)) {
      return
    }

    const assetsToDelete = filteredAssets.filter((a) => selectedAssets.has(a.assetId))
    let successCount = 0

    // Load current data
    const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
    const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
    
    // Remove selected assets from arrays
    const updatedAudios = audios.filter((a: any) => !selectedAssets.has(a.assetId))
    const updatedDecals = decals.filter((d: any) => !selectedAssets.has(d.assetId))
    
    // Save updated data
    localStorage.setItem('uploadedAudios', JSON.stringify(updatedAudios))
    localStorage.setItem('uploadedDecals', JSON.stringify(updatedDecals))
    
    successCount = assetsToDelete.length

    await loadAssets()
    setSelectedAssets(new Set())
    
    toast.success(`Successfully removed ${successCount} asset(s) from local records`)
  }

  const generateNewName = (asset: any, assetId: string, index: number): string => {
    if (renameMode === 'findreplace') {
      if (!findText.trim()) {
        return asset.name || 'Asset'
      }
      const currentName = asset.name || 'Asset'
      const flags = caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
      return currentName.replace(regex, replaceText)
    } else {
      // Pattern mode
      if (!renamePattern.trim()) {
        return asset.name || 'Asset'
      }
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
      const randomStr = Math.random().toString(36).substring(2, 8)
      
      let newName = renamePattern
        .replace(/{index}/g, index.toString().padStart(3, '0'))
        .replace(/{name}/g, asset.name || 'Asset')
        .replace(/{id}/g, assetId)
        .replace(/{type}/g, asset.type)
        .replace(/{date}/g, dateStr)
        .replace(/{time}/g, timeStr)
        .replace(/{random}/g, randomStr)
        .replace(/{year}/g, now.getFullYear().toString())
        .replace(/{month}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
        .replace(/{day}/g, now.getDate().toString().padStart(2, '0'))
      
      return newName
    }
  }

  const getRenamePreview = (): Array<{ assetId: string; oldName: string; newName: string }> => {
    const preview: Array<{ assetId: string; oldName: string; newName: string }> = []
    let index = 1

    selectedAssets.forEach((assetId) => {
      const asset = filteredAssets.find((a) => a.assetId === assetId)
      if (asset) {
        const oldName = asset.name || 'Unnamed Asset'
        const newName = generateNewName(asset, assetId, index)
        preview.push({ assetId, oldName, newName })
        index++
      }
    })

    return preview
  }

  const handleBatchRename = () => {
    if (selectedAssets.size === 0) {
      toast.warning('No assets selected')
      return
    }

    if (renameMode === 'pattern' && !renamePattern.trim()) {
      toast.error('Please enter a rename pattern')
      return
    }

    if (renameMode === 'findreplace' && !findText.trim()) {
      toast.error('Please enter text to find')
      return
    }

    let updatedAudios = [...audios]
    let updatedDecals = [...decals]
    let index = 1

    selectedAssets.forEach((assetId) => {
      const asset = filteredAssets.find((a) => a.assetId === assetId)
      if (asset) {
        const newName = generateNewName(asset, assetId, index)

        if (asset.type === 'audio') {
          const audioIndex = updatedAudios.findIndex((a: any) => a.assetId === assetId)
          if (audioIndex !== -1) {
            updatedAudios[audioIndex].name = newName
          }
        } else {
          const decalIndex = updatedDecals.findIndex((d: any) => d.assetId === assetId)
          if (decalIndex !== -1) {
            updatedDecals[decalIndex].name = newName
          }
        }
        index++
      }
    })

    localStorage.setItem('uploadedAudios', JSON.stringify(updatedAudios))
    localStorage.setItem('uploadedDecals', JSON.stringify(updatedDecals))
    const previousSize = selectedAssets.size
    setSelectedAssets(new Set())
    setShowBatchRename(false)
    setRenamePattern('')
    setFindText('')
    setReplaceText('')
    loadAssets()
    toast.success(`Renamed ${previousSize} asset(s)`)
  }

  // Export functions
  const handleExportJSON = () => {
    const data = filteredAssets.map(asset => ({
      assetId: asset.assetId,
      name: asset.name,
      type: asset.type,
      status: asset.status || 'pending',
      createdAt: asset.createdAt,
      fileHash: asset.fileHash,
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assets_export_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported to JSON')
    setShowExportMenu(false)
  }

  const handleExportCSV = () => {
    const headers = ['Asset ID', 'Name', 'Type', 'Status', 'Created At', 'File Hash']
    const rows = filteredAssets.map(asset => [
      asset.assetId,
      asset.name || '',
      asset.type,
      asset.status || 'pending',
      asset.createdAt || '',
      asset.fileHash || '',
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
    setShowExportMenu(false)
  }

  // Bulk status refresh
  const handleBulkStatusRefresh = async () => {
    if (selectedAssets.size === 0) {
      toast.warning('No assets selected')
      return
    }

    setRefreshingStatus(true)
    const assetsToRefresh = filteredAssets.filter(a => selectedAssets.has(a.assetId))
    let updatedCount = 0

    for (const asset of assetsToRefresh) {
      try {
        const info = await robloxAPI.checkAssetStatus(asset.assetId, asset.type)
        if (info && info.status !== asset.status) {
          if (asset.type === 'audio') {
            const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
            const index = audios.findIndex((a: any) => a.assetId === asset.assetId)
            if (index !== -1) {
              audios[index].status = info.status
              localStorage.setItem('uploadedAudios', JSON.stringify(audios))
            }
          } else {
            const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
            const index = decals.findIndex((d: any) => d.assetId === asset.assetId)
            if (index !== -1) {
              decals[index].status = info.status
              localStorage.setItem('uploadedDecals', JSON.stringify(decals))
            }
          }
          updatedCount++
        }
      } catch (error) {
        console.error(`Error refreshing status for ${asset.assetId}:`, error)
      }
    }

    await loadAssets()
    setRefreshingStatus(false)
    toast.success(`Refreshed ${updatedCount} asset status(es)`)
  }

  // Calculate statistics
  const stats = {
    total: assets.length,
    audios: assets.filter(a => a.type === 'audio').length,
    decals: assets.filter(a => a.type === 'decal').length,
    accepted: assets.filter(a => a.status === 'accepted').length,
    declined: assets.filter(a => a.status === 'declined').length,
    pending: assets.filter(a => a.status === 'pending' || !a.status).length,
    successRate: assets.length > 0 
      ? Math.round((assets.filter(a => a.status === 'accepted').length / assets.length) * 100)
      : 0,
  }

  // Filter and sort assets
  const filteredAssets = assets
    .filter((asset) => {
      const matchesSearch = 
        asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.assetId?.toString().includes(searchTerm)
      const matchesType = filterType === 'all' || asset.type === filterType
      const matchesStatus = filterStatus === 'all' || asset.status === filterStatus || (filterStatus === 'pending' && !asset.status)
      
      // Date range filter
      let matchesDate = true
      if (dateRange.start || dateRange.end) {
        if (asset.createdAt) {
          const assetDate = new Date(asset.createdAt)
          if (dateRange.start && assetDate < new Date(dateRange.start)) {
            matchesDate = false
          }
          if (dateRange.end && assetDate > new Date(dateRange.end + 'T23:59:59')) {
            matchesDate = false
          }
        } else {
          matchesDate = false
        }
      }
      
      return matchesSearch && matchesType && matchesStatus && matchesDate
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          comparison = dateA - dateB
          break
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'status':
          const statusOrder = { 'accepted': 1, 'pending': 2, 'declined': 3 }
          comparison = (statusOrder[a.status as keyof typeof statusOrder] || 4) - (statusOrder[b.status as keyof typeof statusOrder] || 4)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Crown size={28} />
            Owner Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage and delete uploaded assets
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('ownerAuthenticated')
            setIsAuthenticated(false)
          }}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--danger)'
            e.currentTarget.style.color = 'var(--danger)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', flex: 1 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Owner Access:</strong> You can delete any uploaded asset here. Use this to remove inappropriate content.
        </p>
      </div>

      {/* User Statistics & Monitoring */}
      {showMonitoring ? (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={20} />
              Upload Monitoring
            </h2>
            <button
              onClick={() => setShowMonitoring(false)}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Hide
            </button>
          </div>

          {/* User Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Active Users</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={18} />
                {getActiveUsers().length}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {userSessions.length} total
              </div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Uploads</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {monitoredUploads.length}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                All time
              </div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Flagged Content</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={18} />
                {monitoredUploads.filter(u => u.flagged && u.status !== 'blocked').length}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Needs review
              </div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Blocked</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Ban size={18} />
                {monitoredUploads.filter(u => u.status === 'blocked').length}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Prevented
              </div>
            </div>
          </div>

          {/* Monitoring Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setMonitoringFilter('all')}
              style={{
                padding: '6px 12px',
                background: monitoringFilter === 'all' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: monitoringFilter === 'all' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={() => setMonitoringFilter('flagged')}
              style={{
                padding: '6px 12px',
                background: monitoringFilter === 'flagged' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: monitoringFilter === 'flagged' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Flagged ({monitoredUploads.filter(u => u.flagged && u.status !== 'blocked').length})
            </button>
            <button
              onClick={() => setMonitoringFilter('blocked')}
              style={{
                padding: '6px 12px',
                background: monitoringFilter === 'blocked' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: monitoringFilter === 'blocked' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Blocked ({monitoredUploads.filter(u => u.status === 'blocked').length})
            </button>
            <button
              onClick={() => setMonitoringFilter('active')}
              style={{
                padding: '6px 12px',
                background: monitoringFilter === 'active' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: monitoringFilter === 'active' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Active Uploads ({monitoredUploads.filter(u => u.status === 'uploading' || u.status === 'pending').length})
            </button>
          </div>

          {/* Recent Uploads List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {(() => {
              let filtered = monitoredUploads
              if (monitoringFilter === 'flagged') {
                filtered = filtered.filter(u => u.flagged && u.status !== 'blocked')
              } else if (monitoringFilter === 'blocked') {
                filtered = filtered.filter(u => u.status === 'blocked')
              } else if (monitoringFilter === 'active') {
                filtered = filtered.filter(u => u.status === 'uploading' || u.status === 'pending')
              }
              filtered = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50)
              
              if (filtered.length === 0) {
                return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No uploads to display</div>
              }
              
              return filtered.map((upload) => (
                <div
                  key={upload.uploadId}
                  style={{
                    background: upload.flagged ? 'rgba(255, 0, 0, 0.1)' : 'var(--bg-tertiary)',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    border: `1px solid ${upload.flagged ? 'var(--danger)' : 'var(--border)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{upload.fileName}</span>
                      {upload.flagged && (
                        <span
                          style={{
                            padding: '2px 6px',
                            background: 'var(--danger)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          FLAGGED
                        </span>
                      )}
                      {upload.status === 'blocked' && (
                        <span
                          style={{
                            padding: '2px 6px',
                            background: 'var(--danger)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>Type: {upload.fileType}</span>
                      <span>Size: {(upload.fileSize / 1024).toFixed(1)} KB</span>
                      <span>User: {upload.userId.substring(0, 8)}...</span>
                      <span>Time: {new Date(upload.timestamp).toLocaleString()}</span>
                      {upload.flagReason && (
                        <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                          Reason: {upload.flagReason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {upload.status !== 'blocked' && upload.status !== 'completed' && (
                      <button
                        onClick={() => handleBlockUpload(upload.uploadId)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Block
                      </button>
                    )}
                    {upload.assetId && (
                      <>
                        <button
                          onClick={() => handleViewAsset(upload.assetId!, upload.fileType)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={14} />
                          Preview
                        </button>
                        <a
                          href={`https://www.roblox.com/library/${upload.assetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ExternalLink size={14} />
                          Roblox
                        </a>
                      </>
                    )}
                    {!isUserBlacklisted(upload.userId, upload.machineId) && (
                      <button
                        onClick={() => {
                          setBlacklistUserId(upload.userId)
                          setBlacklistUsername('')
                          setBlacklistReason('User violated rules')
                          setShowBlacklist(true)
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--warning)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Blacklist this user"
                      >
                        <Ban size={14} />
                        Blacklist
                      </button>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} />
            Upload Monitoring
          </h2>
          <button
            onClick={() => setShowMonitoring(true)}
            style={{
              padding: '6px 12px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Show
          </button>
        </div>
      )}

      {/* Statistics Dashboard */}
      {showStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Assets</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{stats.total}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.audios} audio, {stats.decals} decal
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Accepted</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--success)' }}>{stats.accepted}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.successRate}% success rate
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--pending)' }}>{stats.pending}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Awaiting review</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Declined</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--danger)' }}>{stats.declined}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {stats.total > 0 ? Math.round((stats.declined / stats.total) * 100) : 0}% of total
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowStats(!showStats)}
          style={{
            padding: '8px 12px',
            background: showStats ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: showStats ? 'white' : 'var(--text-primary)',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
          }}
        >
          <BarChart3 size={16} />
          {showStats ? 'Hide' : 'Show'} Stats
        </button>
        <div style={{ position: 'relative' }} data-export-menu>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--border)',
            }}
          >
            <Download size={16} />
            Export
          </button>
          {showExportMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
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
      </div>

      {selectedAssets.size > 0 && (
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
            {selectedAssets.size} asset(s) selected
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleBulkStatusRefresh}
              disabled={refreshingStatus}
              style={{
                padding: '8px 16px',
                background: refreshingStatus ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: refreshingStatus ? 'var(--text-muted)' : 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: refreshingStatus ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
              }}
            >
              <RefreshCw 
                size={16} 
                style={refreshingStatus ? { animation: 'spin 1s linear infinite' } : {}}
              />
              Refresh Status
            </button>
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
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {/* Search and Type Filter */}
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
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '10px 16px',
                background: filterType === 'all' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: filterType === 'all' ? 'white' : 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('audio')}
              style={{
                padding: '10px 16px',
                background: filterType === 'audio' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: filterType === 'audio' ? 'white' : 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Audio
            </button>
            <button
              onClick={() => setFilterType('decal')}
              style={{
                padding: '10px 16px',
                background: filterType === 'decal' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: filterType === 'decal' ? 'white' : 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Decal
            </button>
          </div>
          <button
            onClick={async () => {
              await loadAssets()
              loadMonitoringData()
            }}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'var(--bg-tertiary)',
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
        </div>

        {/* Status Filter and Sort */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</span>
            {(['all', 'accepted', 'pending', 'declined'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '6px 12px',
                  background: filterStatus === status ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: filterStatus === status ? 'white' : 'var(--text-primary)',
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

        {/* Date Range Filter */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            placeholder="Start date"
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            placeholder="End date"
          />
          {(dateRange.start || dateRange.end) && (
            <button
              onClick={() => setDateRange({ start: '', end: '' })}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
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
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading assets...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <Crown size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '8px' }}>
            No assets found
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {searchTerm ? 'Try a different search term' : 'Upload assets to manage them here'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
              {selectedAssets.size === filteredAssets.length && filteredAssets.length > 0 ? (
                <CheckSquare size={20} />
              ) : (
                <Square size={20} />
              )}
            </button>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {selectedAssets.size > 0 ? `${selectedAssets.size} selected` : 'Select all'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Showing {filteredAssets.length} of {assets.length} assets
            </span>
            {selectedAssets.size > 0 && (
              <>
                <button
                  onClick={() => setShowBatchRename(!showBatchRename)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Edit3 size={16} />
                  Batch Rename
                </button>
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
                  }}
                >
                  <Trash2 size={16} />
                  Delete Selected ({selectedAssets.size})
                </button>
              </>
            )}
          </div>
          {showBatchRename && selectedAssets.size > 0 && (
            <div
              style={{
                background: 'var(--bg-tertiary)',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  onClick={() => setRenameMode('pattern')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: renameMode === 'pattern' ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: renameMode === 'pattern' ? 'white' : 'var(--text-primary)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: 'none',
                  }}
                >
                  <FileText size={16} />
                  Pattern
                </button>
                <button
                  onClick={() => setRenameMode('findreplace')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: renameMode === 'findreplace' ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: renameMode === 'findreplace' ? 'white' : 'var(--text-primary)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: 'none',
                  }}
                >
                  <Replace size={16} />
                  Find & Replace
                </button>
              </div>

              {renameMode === 'pattern' ? (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Rename Pattern (use placeholders):
                  </p>
                  <div style={{ 
                    background: 'var(--bg-secondary)', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.6'
                  }}>
                    Available placeholders: {'{index}'}, {'{name}'}, {'{id}'}, {'{type}'}, {'{date}'}, {'{time}'}, {'{random}'}, {'{year}'}, {'{month}'}, {'{day}'}
                  </div>
                  <input
                    type="text"
                    value={renamePattern}
                    onChange={(e) => setRenamePattern(e.target.value)}
                    placeholder="e.g., Asset_{index} or {type}_{date}_{random}"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      marginBottom: '12px',
                    }}
                  />
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Find:
                      </label>
                      <input
                        type="text"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        placeholder="Text to find..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Replace with:
                      </label>
                      <input
                        type="text"
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        placeholder="Replacement text..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={caseSensitive}
                      onChange={(e) => setCaseSensitive(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Case sensitive</span>
                  </label>
                </>
              )}

              {/* Preview */}
              {((renameMode === 'pattern' && renamePattern.trim()) || (renameMode === 'findreplace' && findText.trim())) && (
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 500 }}>
                    Preview ({getRenamePreview().length} assets):
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {getRenamePreview().slice(0, 10).map((preview) => (
                      <div key={preview.assetId} style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preview.oldName}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span style={{ color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preview.newName}
                        </span>
                      </div>
                    ))}
                    {getRenamePreview().length > 10 && (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        ... and {getRenamePreview().length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleBatchRename}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    background: 'var(--accent)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  Apply Rename
                </button>
                <button
                  onClick={() => {
                    setShowBatchRename(false)
                    setRenamePattern('')
                    setFindText('')
                    setReplaceText('')
                    setCaseSensitive(false)
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--bg-secondary)',
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
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredAssets.map((asset) => (
              <div
                key={asset.assetId}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: selectedAssets.has(asset.assetId) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!selectedAssets.has(asset.assetId)) {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                  }
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  if (!selectedAssets.has(asset.assetId)) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                    <button
                      onClick={() => toggleSelect(asset.assetId)}
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: selectedAssets.has(asset.assetId) ? 'var(--accent)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {selectedAssets.has(asset.assetId) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          marginBottom: '4px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {asset.name || 'Unnamed Asset'}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        ID: {asset.assetId}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        Type: {asset.type}
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background:
                        asset.status === 'needs-fixing'
                          ? 'var(--text-muted)'
                          : asset.status === 'accepted'
                          ? 'var(--success)'
                          : asset.status === 'declined'
                          ? 'var(--danger)'
                          : 'var(--pending)',
                      color: 'white',
                    }}
                  >
                    {asset.status === 'needs-fixing' ? '(needs fixing)' : (asset.status?.toUpperCase() || 'PENDING')}
                  </span>
                </div>
                {asset.createdAt && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Uploaded: {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <QuickActions assetId={asset.assetId} type={asset.type} />
                </div>
                <button
                  onClick={() => handleDelete(asset.assetId, asset.type)}
                  disabled={deleting === asset.assetId}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: deleting === asset.assetId ? 'var(--bg-tertiary)' : 'var(--danger)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: deleting === asset.assetId ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Trash2 size={16} />
                  {deleting === asset.assetId ? 'Deleting...' : 'Delete Asset'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* User Blacklist Section */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ban size={20} />
            User Blacklist
          </h2>
          <button
            onClick={() => setShowBlacklist(!showBlacklist)}
            style={{
              padding: '6px 12px',
              background: showBlacklist ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: showBlacklist ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {showBlacklist ? 'Hide' : 'Add User'}
          </button>
        </div>

        {showBlacklist && (
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Add User to Blacklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  User ID *
                </label>
                <input
                  type="text"
                  value={blacklistUserId}
                  onChange={(e) => setBlacklistUserId(e.target.value)}
                  placeholder="Enter user ID"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={blacklistUsername}
                  onChange={(e) => setBlacklistUsername(e.target.value)}
                  placeholder="Enter username (optional)"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Reason *
                </label>
                <textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="Enter reason for blacklisting"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>
              <button
                onClick={handleBlacklistUser}
                style={{
                  padding: '8px 16px',
                  background: 'var(--danger)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Add to Blacklist
              </button>
            </div>
          </div>
        )}

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {blacklistedUsers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No blacklisted users
            </div>
          ) : (
            blacklistedUsers.map((user) => (
              <div
                key={user.userId}
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {user.username || user.userId}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    ID: {user.userId}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Reason: {user.reason}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Blacklisted: {new Date(user.blacklistedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleUnblacklistUser(user.userId)}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Asset Preview Modal */}
      {previewAsset && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setPreviewAsset(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewAsset(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Preview: {previewAsset.type === 'decal' ? 'Image' : 'Audio'}
            </h3>
            {previewAsset.type === 'decal' ? (
              <img
                src={`https://assetdelivery.roblox.com/v1/asset/?id=${previewAsset.assetId}`}
                alt="Decal preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '6px',
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = `https://www.roblox.com/asset/?id=${previewAsset.assetId}`
                }}
              />
            ) : (
              <div>
                {audioLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading audio...
                  </div>
                ) : (
                  <>
                    <audio
                      controls
                      style={{
                        width: '100%',
                        maxWidth: '600px',
                      }}
                      key={audioUrl || previewAsset.assetId}
                    >
                      {audioUrl ? (
                        <source src={audioUrl} type="audio/mpeg" />
                      ) : (
                        <>
                          <source
                            src={`https://assetdelivery.roblox.com/v1/asset/?id=${previewAsset.assetId}`}
                            type="audio/mpeg"
                          />
                          <source
                            src={`https://www.roblox.com/asset/?id=${previewAsset.assetId}`}
                            type="audio/mpeg"
                          />
                          <source
                            src={`https://cdn.roblox.com/library/${previewAsset.assetId}`}
                            type="audio/mpeg"
                          />
                        </>
                      )}
                      Your browser does not support the audio element.
                    </audio>
                    {!audioUrl && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        If audio doesn't play, the asset may be private or pending moderation.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Asset ID: {previewAsset.assetId}
            </div>
            <a
              href={`https://www.roblox.com/library/${previewAsset.assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '12px',
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              Open on Roblox
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

