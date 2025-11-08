import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Upload as UploadIcon, Music, Image, Loader, X, Pause, Play, RotateCcw, ArrowUp, ArrowDown, Bookmark, Settings, Edit3, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react'
import { robloxAPI, RobloxConfig } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'
import { validateAudioFile, validateDecalFile, calculateFileHash } from '../utils/fileValidation'
import { getPresets, savePreset, deletePreset, updatePreset, UploadPreset } from '../utils/uploadPresets'
import PresetEditor from '../components/PresetEditor'
import { addLog } from '../utils/uploadHistory'
import { emitBeforeUpload, emitAfterUpload } from '../hooks/usePluginHooks'
import { checkDuplicate, DuplicateCheckResult } from '../utils/duplicateDetection'
import { rateLimiter } from '../utils/rateLimiter'
import { recordUploadPerformance, recordMetric, updateUploadPerformance } from '../utils/performanceMonitor'
import { isUserBlacklisted, getBlacklistReason } from '../utils/userBlacklist'
import { getUserId, getMachineId, saveMonitoredUpload, updateUploadStatus, getMonitoredUploads } from '../utils/userTracking'
import { detectInappropriateContent } from '../utils/contentDetection'

interface FileWithProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  assetId?: string
  error?: string
  fileHash?: string
}

export default function Upload() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Check if current user is blacklisted
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState<string | null>(null)
  
  useEffect(() => {
    const checkBlacklist = () => {
      const userId = getUserId()
      const machineId = getMachineId()
      const blacklisted = isUserBlacklisted(userId, machineId)
      setIsBlacklisted(blacklisted)
      if (blacklisted) {
        setBlacklistReason(getBlacklistReason(userId, machineId))
      }
    }
    checkBlacklist()
    // Re-check periodically in case user gets blacklisted while on the page
    const interval = setInterval(checkBlacklist, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const [config, setConfig] = useState<RobloxConfig>(() => {
    const saved = localStorage.getItem('robloxConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Migrate old config format if needed
        if (parsed.openCloudApiKey && !parsed.cookie) {
          return {
            cookie: '',
            userId: '',
            groupId: '',
            uploadTarget: 'user' as const,
          }
        }
        robloxAPI.setConfig(parsed)
        return parsed
      } catch (e) {
        console.error('Failed to parse saved config:', e)
      }
    }
    return {
      cookie: '',
      userId: '',
      groupId: '',
      uploadTarget: 'user' as const,
    }
  })
  const [uploadType, setUploadType] = useState<'audio' | 'decal'>('audio')
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [presets, setPresets] = useState<UploadPreset[]>(getPresets())
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [editingPreset, setEditingPreset] = useState<UploadPreset | null>(null)
  const [showPresetEditor, setShowPresetEditor] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(() => {
    const saved = localStorage.getItem('skipDuplicates')
    return saved === 'true'
  })

  // Save skip duplicates preference
  useEffect(() => {
    localStorage.setItem('skipDuplicates', skipDuplicates.toString())
  }, [skipDuplicates])

  // Audio description setting (only for audio uploads)
  const [audioDescription, setAudioDescription] = useState<string>(() => {
    const saved = localStorage.getItem('audioDescription')
    return saved || 'Uploaded by Asset Manager'
  })

  // Save audio description preference
  useEffect(() => {
    localStorage.setItem('audioDescription', audioDescription)
  }, [audioDescription])

  // Update rate limit status periodically
  useEffect(() => {
    const updateRateLimitStatus = () => {
      const status = rateLimiter.getStatus('upload')
      setRateLimitStatus(status)
    }

    updateRateLimitStatus()
    const interval = setInterval(updateRateLimitStatus, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])
  const [duplicateSummary, setDuplicateSummary] = useState<{
    skipped: number
    rejected: number
    details: Array<{ fileName: string; reason: string; existingAsset?: any }>
  } | null>(null)
  const [rateLimitStatus, setRateLimitStatus] = useState<{
    canMakeRequest: boolean
    waitTime: number
    requestsInWindow: number
    maxRequests: number
  } | null>(null)
  const [isWaitingForRateLimit, setIsWaitingForRateLimit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortControllerRef = useRef<AbortController | null>(null)

  // Reload config when navigating to this page (e.g., after saving settings)
  useEffect(() => {
    const saved = localStorage.getItem('robloxConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        robloxAPI.setConfig(parsed)
        setConfig(parsed)
      } catch (e) {
        console.error('Failed to parse saved config:', e)
      }
    }
  }, [location.key]) // Reload when route changes


  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    
    // Check if user is blacklisted
    const userId = getUserId()
    const machineId = getMachineId()
    if (isUserBlacklisted(userId, machineId)) {
      const reason = getBlacklistReason(userId, machineId) || 'You have been blacklisted'
      toast.error(`Cannot add files: You have been blacklisted. Reason: ${reason}`, { duration: 8000 })
      return
    }
    
    const newFiles: FileWithProgress[] = []
    const validationErrors: string[] = []
    const duplicateDetails: Array<{ fileName: string; reason: string; existingAsset?: any }> = []
    let skippedCount = 0
    let rejectedCount = 0
    
    // Block decal uploads
    if (uploadType === 'decal') {
      toast.error('Decal uploads are temporarily disabled (getting fixed)', { duration: 5000 })
      return
    }

    for (const file of Array.from(selectedFiles)) {
      // Validate file
      const validation = uploadType === 'audio' 
        ? validateAudioFile(file)
        : validateDecalFile(file)
      
      if (!validation.valid) {
        validationErrors.push(`${file.name}: ${validation.errors.join(', ')}`)
        continue
      }
      
      // Check for duplicates (consider group ID - same file can be uploaded to different groups)
      try {
        const currentGroupId = config.uploadTarget === 'group' ? config.groupId : undefined
        const duplicateCheck = await checkDuplicate(file, uploadType, undefined, currentGroupId)
        
        if (duplicateCheck.isDuplicate) {
          const reasonText = duplicateCheck.reason === 'file-hash' 
            ? 'Same file content (file hash match)'
            : 'Same asset ID already exists'
          
          if (skipDuplicates) {
            // Skip the duplicate
            skippedCount++
            duplicateDetails.push({
              fileName: file.name,
              reason: reasonText,
              existingAsset: duplicateCheck.existingAsset,
            })
            continue
          } else {
            // Reject the duplicate
            rejectedCount++
            validationErrors.push(`${file.name}: Duplicate detected - ${reasonText}`)
            duplicateDetails.push({
              fileName: file.name,
              reason: reasonText,
              existingAsset: duplicateCheck.existingAsset,
            })
            continue
          }
        }
        
        // Calculate hash for non-duplicates
        const fileHash = await calculateFileHash(file)
        newFiles.push({
          file,
          progress: 0,
          status: 'pending' as const,
          fileHash,
        })
        
        // Show warnings if any
        if (validation.warnings.length > 0) {
          toast.warning(`${file.name}: ${validation.warnings.join(', ')}`)
        }
      } catch (error) {
        // If hash calculation fails, still allow the file
        console.warn('Error checking duplicate for', file.name, error)
        newFiles.push({
          file,
          progress: 0,
          status: 'pending' as const,
        })
      }
    }
    
    // Update duplicate summary
    if (skippedCount > 0 || rejectedCount > 0) {
      setDuplicateSummary({
        skipped: skippedCount,
        rejected: rejectedCount,
        details: duplicateDetails,
      })
    } else {
      setDuplicateSummary(null)
    }
    
    if (validationErrors.length > 0) {
      toast.error(`Some files were rejected:\n${validationErrors.join('\n')}`)
    }
    
    if (skippedCount > 0) {
      toast.info(`Skipped ${skippedCount} duplicate file(s)`)
    }
    
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles])
      toast.success(`Added ${newFiles.length} file(s)`)
    } else if (skippedCount === 0 && rejectedCount === 0) {
      toast.warning('No valid files to add')
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles((prev) => {
      const newFiles = [...prev]
      if (direction === 'up' && index > 0) {
        [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]]
      } else if (direction === 'down' && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]]
      }
      return newFiles
    })
  }

  const handleRetry = async (index: number) => {
    setFiles((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        status: 'pending',
        progress: 0,
        error: undefined,
      }
      return updated
    })
    // If not currently uploading, start upload for this file
    if (!isUploading) {
      setIsUploading(true)
      await uploadFile(files[index], index)
      setIsUploading(false)
    }
  }

  const handlePause = () => {
    setIsPaused(true)
    toast.info('Upload paused')
  }

  const handleResume = () => {
    setIsPaused(false)
    toast.info('Upload resumed')
  }

  const handleCancel = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort()
    }
    uploadAbortControllerRef.current = new AbortController()
    setIsPaused(false)
    setIsUploading(false)
    setFiles((prev) =>
      prev.map((f) => {
        if (f.status === 'uploading') {
          return { ...f, status: 'pending', progress: 0 }
        }
        return f
      })
    )
    toast.warning('Upload cancelled')
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [])

  const uploadFile = async (fileWithProgress: FileWithProgress, index: number) => {
    const userId = getUserId()
    const machineId = getMachineId()
    
    // Check if user is blacklisted BEFORE starting upload
    if (isUserBlacklisted(userId, machineId)) {
      const reason = getBlacklistReason(userId, machineId) || 'You have been blacklisted'
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: `Upload blocked: ${reason}`,
        }
        return updated
      })
      toast.error(`Upload blocked: You have been blacklisted. Reason: ${reason}`, { duration: 8000 })
      return
    }
    
    // Check for inappropriate content
    const contentCheck = detectInappropriateContent(fileWithProgress.file.name, uploadType)
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // Record upload for monitoring
    const monitoredUpload = {
      uploadId,
      userId,
      machineId,
      fileName: fileWithProgress.file.name,
      fileType: uploadType,
      fileSize: fileWithProgress.file.size,
      timestamp: new Date().toISOString(),
      status: 'pending' as const,
      flagged: contentCheck.flagged,
      flagReason: contentCheck.reason,
    }
    saveMonitoredUpload(monitoredUpload)
    
    // If flagged, show warning but allow owner to review
    if (contentCheck.flagged) {
      toast.warning(`⚠️ Flagged content detected: ${contentCheck.reason}. Upload will be monitored.`, { duration: 5000 })
    }
    
    // Double-check if user is still blacklisted before API call
    if (isUserBlacklisted(userId, machineId)) {
      const reason = getBlacklistReason(userId, machineId) || 'You have been blacklisted'
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: `Upload blocked: ${reason}`,
        }
        return updated
      })
      toast.error(`Upload blocked: You have been blacklisted. Reason: ${reason}`, { duration: 8000 })
      return
    }
    
    // Check if upload has been blocked by owner
    const allUploads = getMonitoredUploads()
    const currentUpload = allUploads.find(u => u.uploadId === uploadId)
    if (currentUpload?.status === 'blocked') {
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: 'Upload blocked by owner',
        }
        return updated
      })
      toast.error('Upload blocked by owner')
      return
    }
    
    // Check for duplicates before uploading (in case asset was uploaded elsewhere or file hash matches)
    // Consider group ID - same file can be uploaded to different groups
    if (skipDuplicates) {
      const currentGroupId = config.uploadTarget === 'group' ? config.groupId : undefined
      const duplicateCheck = await checkDuplicate(fileWithProgress.file, uploadType, undefined, currentGroupId)
      if (duplicateCheck.isDuplicate) {
        setFiles((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: `Skipped: Duplicate detected (${duplicateCheck.reason === 'file-hash' ? 'file hash' : 'asset ID'})`,
          }
          return updated
        })
        toast.info(`Skipped ${fileWithProgress.file.name}: Duplicate detected`)
        return
      }
    }
    
    const startTime = Date.now()
    
    // Record upload start
    const uploadRecord = recordUploadPerformance({
      startTime,
      fileSize: fileWithProgress.file.size,
      fileType: uploadType,
      status: 'pending',
      accountId: config.userId,
      groupId: config.groupId,
    })
    
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], status: 'uploading', progress: 10 }
        return updated
      })
      
      // Update monitoring status to uploading
      updateUploadStatus(uploadId, 'uploading')

    try {
      // Ensure we have the latest config before uploading
      const saved = localStorage.getItem('robloxConfig')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          robloxAPI.setConfig(parsed)
          // Update local state if it's different
          if (parsed.cookie !== config.cookie || parsed.userId !== config.userId || parsed.groupId !== config.groupId || parsed.uploadTarget !== config.uploadTarget) {
            setConfig(parsed)
          }
        } catch (e) {
          console.error('Failed to reload config before upload:', e)
        }
      }

      // Emit before-upload plugin event
      emitBeforeUpload(fileWithProgress.file, uploadType)

      // Check if we need to wait for rate limit
      const status = rateLimiter.getStatus('upload')
      let queueWaitTime = 0
      if (!status.canMakeRequest && status.waitTime > 0) {
        const waitStart = Date.now()
        setIsWaitingForRateLimit(true)
        setFiles((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            progress: 5,
            error: `Waiting for rate limit (${Math.ceil(status.waitTime / 1000)}s)...`,
          }
          return updated
        })
        
        // Wait for rate limit
        await rateLimiter.waitForRateLimit('upload')
        queueWaitTime = Date.now() - waitStart
        
        // Record queue wait time
        recordMetric({
          type: 'upload',
          metric: 'queueWaitTime',
          value: queueWaitTime,
          unit: 'ms',
        })
      }

      // Check if upload has been blocked before making API call
      const blockedCheckAgain = getMonitoredUploads().find(u => u.uploadId === uploadId)
      if (blockedCheckAgain?.status === 'blocked') {
        updateUploadStatus(uploadId, 'blocked')
        setFiles((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: 'Upload blocked by owner',
          }
          return updated
        })
        toast.error('Upload blocked by owner')
        return
      }

      // Block decal uploads
      if (uploadType === 'decal') {
        setFiles((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: 'Decal uploads are temporarily disabled (getting fixed)',
          }
          return updated
        })
        toast.error('Decal uploads are temporarily disabled (getting fixed)', { duration: 5000 })
        return
      }

      // Record API call start
      const apiStartTime = Date.now()
      const result = uploadType === 'audio'
        ? await robloxAPI.uploadAudio(
            fileWithProgress.file, 
            fileWithProgress.file.name.replace(/\.[^/.]+$/, ''),
            3,
            audioDescription
          )
        : await robloxAPI.uploadDecal(fileWithProgress.file, fileWithProgress.file.name.replace(/\.[^/.]+$/, ''))
      const apiResponseTime = Date.now() - apiStartTime

      // Record API response time
      recordMetric({
        type: 'api',
        metric: 'responseTime',
        value: apiResponseTime,
        unit: 'ms',
        metadata: { uploadType, success: !!result.assetId },
      })

      setIsWaitingForRateLimit(false)

      const duration = Date.now() - startTime
      const isSuccess = !!result.assetId
      
      // Update upload performance record
      updateUploadPerformance(uploadRecord.uploadId, {
        endTime: Date.now(),
        duration,
        status: isSuccess ? 'success' : 'error',
        error: result.error,
        apiResponseTime,
        queueWaitTime,
      })

      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: isSuccess ? 'success' : 'error',
          progress: 100,
          assetId: result.assetId,
          error: result.error,
        }
        return updated
      })

      // Log to history
      addLog({
        type: uploadType,
        fileName: fileWithProgress.file.name,
        assetId: result.assetId,
        status: isSuccess ? 'success' : 'error',
        error: result.error,
        fileSize: fileWithProgress.file.size,
        duration,
      })

      // Update monitoring status
      if (result.assetId) {
        updateUploadStatus(uploadId, 'completed', result.assetId)
        // Save to localStorage (include groupId so duplicate detection can differentiate)
        const assetData = {
          assetId: result.assetId,
          name: fileWithProgress.file.name.replace(/\.[^/.]+$/, ''),
          status: result.status,
          createdAt: new Date().toISOString(),
          fileHash: fileWithProgress.fileHash,
          groupId: config.uploadTarget === 'group' ? config.groupId : undefined,
        }

        if (uploadType === 'audio') {
          const existing = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
          existing.push(assetData)
          localStorage.setItem('uploadedAudios', JSON.stringify(existing))
        } else {
          const existing = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
          existing.push(assetData)
          localStorage.setItem('uploadedDecals', JSON.stringify(existing))
        }

        toast.success(`Uploaded: ${fileWithProgress.file.name}`)
      } else {
        // Update monitoring status to failed
        updateUploadStatus(uploadId, 'failed')
        
        toast.error(`Failed: ${fileWithProgress.file.name} - ${result.error || 'Unknown error'}`)
      }

      // Emit after-upload plugin event
      emitAfterUpload(result, fileWithProgress.file, uploadType)
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      // Update upload performance record with error
      if (uploadRecord) {
        updateUploadPerformance(uploadRecord.uploadId, {
          endTime: Date.now(),
          duration,
          status: 'error',
          error: error.message,
        })
      }
      
      // Record error metric
      recordMetric({
        type: 'upload',
        metric: 'error',
        value: 1,
        unit: 'count',
        metadata: { errorType: error.message, uploadType },
      })
      
      // Update monitoring status to failed
      if (uploadId) {
        updateUploadStatus(uploadId, 'failed')
      }
      
      setFiles((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          progress: 0,
          error: error.message,
        }
        return updated
      })
      
      // Log error to history
      addLog({
        type: uploadType,
        fileName: fileWithProgress.file.name,
        status: 'error',
        error: error.message,
        fileSize: fileWithProgress.file.size,
        duration,
      })
      
      toast.error(`Error uploading ${fileWithProgress.file.name}: ${error.message}`)
    }
  }

  const handleUpload = async () => {
    // Check blacklist
    const userId = getUserId()
    const machineId = getMachineId()
    
    // Check if user is blacklisted
    if (isUserBlacklisted(userId, machineId)) {
      const reason = getBlacklistReason(userId, machineId) || 'You have been blacklisted'
      toast.error(`Upload blocked: You have been blacklisted. Reason: ${reason}`, { duration: 8000 })
      return
    }
    
    // Block decal uploads
    if (uploadType === 'decal') {
      toast.error('Decal uploads are temporarily disabled (getting fixed)', { duration: 5000 })
      return
    }

    if (files.length === 0) {
      toast.warning('Please select files to upload')
      return
    }

    if (!config.cookie || config.cookie.trim() === '') {
      toast.error('Cookie is required. Please configure it in Settings.')
      return
    }

    if (config.uploadTarget === 'user' && (!config.userId || config.userId.trim() === '')) {
      toast.error('User ID is required for user uploads. Please configure it in Settings.')
      return
    }

    if (config.uploadTarget === 'group' && (!config.groupId || config.groupId.trim() === '')) {
      toast.error('Group ID is required for group uploads. Please configure it in Settings.')
      return
    }

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error')
    if (pendingFiles.length === 0) {
      toast.info('No files to upload')
      return
    }

    setIsUploading(true)
    uploadAbortControllerRef.current = new AbortController()

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      if (uploadAbortControllerRef.current?.signal.aborted) break
      
      // Wait if paused
      while (isPaused && !uploadAbortControllerRef.current?.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      if (uploadAbortControllerRef.current?.signal.aborted) break

      if (files[i].status === 'pending' || files[i].status === 'error') {
        await uploadFile(files[i], i)
        // Small delay between uploads
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    setIsUploading(false)
    const successCount = files.filter((f) => f.status === 'success').length
    const errorCount = files.filter((f) => f.status === 'error').length
    
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`)
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} file(s) failed to upload`)
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Upload Assets</h1>
      </div>

      {isBlacklisted && (
        <div
          style={{
            background: 'var(--danger)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={24} color="white" />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
              ⛔ You have been blacklisted
            </h3>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>
              {blacklistReason || 'You have been blacklisted and cannot upload files.'}
            </p>
          </div>
        </div>
      )}

      {(!config.cookie || (config.uploadTarget === 'user' && !config.userId) || (config.uploadTarget === 'group' && !config.groupId)) && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '2px solid var(--warning)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <Settings size={20} style={{ color: 'var(--warning)' }} />
            <div>
              <p style={{ color: 'var(--warning)', fontSize: '14px', fontWeight: 600, margin: 0, marginBottom: '4px' }}>
                Configuration Incomplete
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                Please configure your Roblox cookie and {config.uploadTarget === 'user' ? 'User ID' : 'Group ID'} in Settings before uploading.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
            }}
          >
            <Settings size={14} />
            Go to Settings
          </button>
        </div>
      )}


      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
          <button
            onClick={() => setUploadType('audio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: uploadType === 'audio' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: uploadType === 'audio' ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Music size={18} />
            Audio
          </button>
          <button
            onClick={() => {
              toast.warning('Decal uploads are temporarily disabled (getting fixed)', { duration: 4000 })
            }}
            disabled
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'not-allowed',
              opacity: 0.6,
              position: 'relative',
            }}
            title="Decal uploads are temporarily disabled (getting fixed)"
          >
            <Image size={18} />
            Decal
            <span style={{ fontSize: '10px', marginLeft: '4px', color: 'var(--warning)' }}>(Broken)</span>
          </button>
          <button
            onClick={() => {
              setShowPresets(!showPresets)
              if (!showPresets) {
                setPresets(getPresets())
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: showPresets ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: showPresets ? 'white' : 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <Bookmark size={18} />
            Presets
          </button>
        </div>

        {/* Audio Description Setting (only show for audio uploads) */}
        {uploadType === 'audio' && (
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid var(--border)',
              opacity: 0.6,
            }}
          >
            <label
              htmlFor="audioDescription"
              style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                fontWeight: 500,
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Audio Description
            </label>
            <input
              type="text"
              id="audioDescription"
              value="(needs updating)"
              disabled
              readOnly
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'not-allowed',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              This feature is currently disabled and needs updating
            </span>
          </div>
        )}

        {/* Duplicate Detection Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid var(--border)',
          }}
        >
          <input
            type="checkbox"
            id="skipDuplicates"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
          <label
            htmlFor="skipDuplicates"
            style={{
              fontSize: '14px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              flex: 1,
            }}
          >
            Skip duplicates automatically
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              When enabled, duplicate files will be skipped instead of rejected
            </span>
          </label>
        </div>

        {/* Duplicate Summary */}
        {duplicateSummary && (duplicateSummary.skipped > 0 || duplicateSummary.rejected > 0) && (
          <div
            style={{
              background: 'var(--bg-tertiary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertCircle size={18} style={{ color: 'var(--warning)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Duplicate Detection Summary
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
              {duplicateSummary.skipped > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  <span>{duplicateSummary.skipped} skipped</span>
                </div>
              )}
              {duplicateSummary.rejected > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <X size={14} style={{ color: 'var(--danger)' }} />
                  <span>{duplicateSummary.rejected} rejected</span>
                </div>
              )}
            </div>
            {duplicateSummary.details.length > 0 && (
              <details style={{ fontSize: '12px' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    userSelect: 'none',
                  }}
                >
                  View details ({duplicateSummary.details.length})
                </summary>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'var(--bg-primary)',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {duplicateSummary.details.map((detail, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px',
                        marginBottom: '8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {detail.fileName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {detail.reason}
                      </div>
                      {detail.existingAsset && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Existing asset: {detail.existingAsset.name} (ID: {detail.existingAsset.assetId})
                          {detail.existingAsset.status && (
                            <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>
                              Status: {detail.existingAsset.status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <button
              onClick={() => setDuplicateSummary(null)}
              style={{
                marginTop: '12px',
                padding: '6px 12px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Rate Limit Status */}
        {rateLimitStatus && (
          <div
            style={{
              background: 'var(--bg-tertiary)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Zap size={16} style={{ color: rateLimitStatus.canMakeRequest ? 'var(--success)' : 'var(--warning)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Rate Limit Status
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {rateLimitStatus.requestsInWindow} / {rateLimitStatus.maxRequests} requests in the last{' '}
                {Math.floor(rateLimitStatus.windowMs / 1000)}s
                {!rateLimitStatus.canMakeRequest && rateLimitStatus.waitTime > 0 && (
                  <span style={{ color: 'var(--warning)', marginLeft: '8px' }}>
                    • Wait {Math.ceil(rateLimitStatus.waitTime / 1000)}s
                  </span>
                )}
              </div>
            </div>
            {!rateLimitStatus.canMakeRequest && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  background: 'var(--warning)',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                <Clock size={12} />
                Throttled
              </div>
            )}
          </div>
        )}

        {showPresets && (
          <div
            style={{
              background: 'var(--bg-tertiary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Upload Presets</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setEditingPreset(null)
                    setShowPresetEditor(true)
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                  }}
                >
                  <Bookmark size={14} />
                  New Preset
                </button>
              </div>
            </div>
            {presets.filter((p) => p.uploadType === uploadType).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>
                  No presets for {uploadType} uploads
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Create a preset to save your upload configurations
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {presets
                  .filter((p) => p.uploadType === uploadType)
                  .map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        padding: '12px',
                        background: selectedPreset === preset.id ? 'var(--accent)' : 'var(--bg-secondary)',
                        borderRadius: '6px',
                        border: selectedPreset === preset.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => {
                        setSelectedPreset(preset.id)
                        // Apply preset settings
                        if (preset.namePattern) {
                          toast.info(`Preset "${preset.name}" applied`)
                        } else {
                          toast.info(`Preset "${preset.name}" selected`)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPreset !== preset.id) {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPreset !== preset.id) {
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span
                              style={{
                                color: selectedPreset === preset.id ? 'white' : 'var(--text-primary)',
                                fontWeight: 600,
                                fontSize: '14px',
                              }}
                            >
                              {preset.name}
                            </span>
                            {preset.usageCount && preset.usageCount > 0 && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: selectedPreset === preset.id ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                }}
                              >
                                ({preset.usageCount}x)
                              </span>
                            )}
                          </div>
                          {preset.description && (
                            <p
                              style={{
                                fontSize: '12px',
                                color: selectedPreset === preset.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
                                marginBottom: '4px',
                              }}
                            >
                              {preset.description}
                            </p>
                          )}
                          {preset.namePattern && (
                            <p
                              style={{
                                fontSize: '11px',
                                color: selectedPreset === preset.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                                fontFamily: 'monospace',
                              }}
                            >
                              Pattern: {preset.namePattern}
                            </p>
                          )}
                          {preset.tags && preset.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {preset.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    background: selectedPreset === preset.id
                                      ? 'rgba(255,255,255,0.2)'
                                      : 'var(--bg-tertiary)',
                                    borderRadius: '4px',
                                    color: selectedPreset === preset.id ? 'white' : 'var(--text-muted)',
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                              {preset.tags.length > 3 && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: selectedPreset === preset.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                                  }}
                                >
                                  +{preset.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPreset(preset)
                              setShowPresetEditor(true)
                            }}
                            style={{
                              padding: '4px',
                              background: 'transparent',
                              border: 'none',
                              color: selectedPreset === preset.id ? 'white' : 'var(--text-muted)',
                              cursor: 'pointer',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = selectedPreset === preset.id
                                ? 'rgba(255,255,255,0.2)'
                                : 'var(--bg-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                            }}
                            title="Edit preset"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Delete this preset?')) {
                                deletePreset(preset.id)
                                setPresets(presets.filter((p) => p.id !== preset.id))
                                if (selectedPreset === preset.id) {
                                  setSelectedPreset(null)
                                }
                                toast.success('Preset deleted')
                              }
                            }}
                            style={{
                              padding: '4px',
                              background: 'transparent',
                              border: 'none',
                              color: selectedPreset === preset.id ? 'white' : 'var(--text-muted)',
                              cursor: 'pointer',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = selectedPreset === preset.id
                                ? 'rgba(255,255,255,0.2)'
                                : 'var(--bg-hover)'
                              e.currentTarget.style.color = 'var(--danger)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = selectedPreset === preset.id ? 'white' : 'var(--text-muted)'
                            }}
                            title="Delete preset"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {showPresetEditor && (
          <PresetEditor
            preset={editingPreset}
            uploadType={uploadType}
            isOpen={showPresetEditor}
            onClose={() => {
              setShowPresetEditor(false)
              setEditingPreset(null)
            }}
            onSave={() => {
              setPresets(getPresets())
            }}
          />
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isDragging ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {isDragging ? 'Drop files here' : 'Click to select files or drag and drop'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {uploadType === 'audio' ? 'Audio files (MP3, OGG, etc.)' : 'Image files (PNG, JPG, etc.)'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={uploadType === 'audio' ? 'audio/*' : 'image/*'}
            onChange={(e) => handleFileSelect(e.target.files)}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {/* Queue Progress Indicator */}
            {(isUploading || files.some((f) => f.status === 'uploading' || f.status === 'success' || f.status === 'error')) && (
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Upload Queue Progress</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {files.filter((f) => f.status === 'success').length} / {files.length} completed
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      width: `${(files.filter((f) => f.status === 'success').length / files.length) * 100}%`,
                      height: '100%',
                      background: 'var(--success)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>
                    Pending: <strong style={{ color: 'var(--text-primary)' }}>{files.filter((f) => f.status === 'pending').length}</strong>
                  </span>
                  <span>
                    Uploading: <strong style={{ color: 'var(--accent)' }}>{files.filter((f) => f.status === 'uploading').length}</strong>
                  </span>
                  <span>
                    Success: <strong style={{ color: 'var(--success)' }}>{files.filter((f) => f.status === 'success').length}</strong>
                  </span>
                  <span>
                    Failed: <strong style={{ color: 'var(--danger)' }}>{files.filter((f) => f.status === 'error').length}</strong>
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
                Queue: {files.length} file{files.length !== 1 ? 's' : ''}
                {files.filter((f) => f.status === 'pending' || f.status === 'error').length > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                    ({files.filter((f) => f.status === 'pending' || f.status === 'error').length} pending)
                  </span>
                )}
              </p>
              <button
                onClick={() => setFiles([])}
                style={{
                  padding: '4px 8px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((fileWithProgress, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, minWidth: '24px' }}>
                        #{index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fileWithProgress.file.name}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {(fileWithProgress.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {(fileWithProgress.status === 'pending' || fileWithProgress.status === 'error') && (
                        <>
                          <button
                            onClick={() => moveFile(index, 'up')}
                            disabled={index === 0}
                            style={{
                              padding: '4px',
                              background: index === 0 ? 'var(--bg-secondary)' : 'var(--bg-hover)',
                              color: index === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                              borderRadius: '4px',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Move up in queue"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => moveFile(index, 'down')}
                            disabled={index === files.length - 1}
                            style={{
                              padding: '4px',
                              background: index === files.length - 1 ? 'var(--bg-secondary)' : 'var(--bg-hover)',
                              color: index === files.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                              borderRadius: '4px',
                              cursor: index === files.length - 1 ? 'not-allowed' : 'pointer',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Move down in queue"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                        title="Remove from queue"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {fileWithProgress.status === 'uploading' && (
                    <div style={{ marginTop: '8px' }}>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${fileWithProgress.progress}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                        {fileWithProgress.progress}%
                      </p>
                    </div>
                  )}

                  {fileWithProgress.status === 'success' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: 'var(--success)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        SUCCESS
                      </span>
                      {fileWithProgress.assetId && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID: {fileWithProgress.assetId}
                        </span>
                      )}
                    </div>
                  )}

                  {fileWithProgress.status === 'error' && (
                    <div style={{ marginTop: '8px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: 'var(--danger)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        ERROR
                      </span>
                      {fileWithProgress.error && (
                        <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
                          {fileWithProgress.error}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {(fileWithProgress.error?.toLowerCase().includes('authentication') || 
                          fileWithProgress.error?.toLowerCase().includes('cookie') ||
                          fileWithProgress.error?.toLowerCase().includes('not authenticated')) && (
                          <button
                            onClick={() => navigate('/settings')}
                            style={{
                              padding: '4px 8px',
                              background: 'var(--accent)',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Settings size={12} />
                            Go to Settings
                          </button>
                        )}
                        <button
                          onClick={() => handleRetry(index)}
                          style={{
                            padding: '4px 8px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={12} />
                          Retry
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          {!isUploading ? (
            <button
              onClick={handleUpload}
              disabled={isBlacklisted || files.length === 0 || files.every((f) => f.status !== 'pending' && f.status !== 'error')}
              title={isBlacklisted ? 'You have been blacklisted and cannot upload' : undefined}
              style={{
                flex: 1,
                padding: '12px',
                background: files.length === 0 || files.every((f) => f.status !== 'pending' && f.status !== 'error') ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: files.length === 0 || files.every((f) => f.status !== 'pending' && f.status !== 'error') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <UploadIcon size={18} />
              Upload {files.filter((f) => f.status === 'pending' || f.status === 'error').length > 0 
                ? `${files.filter((f) => f.status === 'pending' || f.status === 'error').length} file${files.filter((f) => f.status === 'pending' || f.status === 'error').length > 1 ? 's' : ''}`
                : 'Files'}
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={handleResume}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--success)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={18} />
                  Resume
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--warning)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Pause size={18} />
                  Pause
                </button>
              )}
              <button
                onClick={handleCancel}
                style={{
                  padding: '12px 24px',
                  background: 'var(--danger)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

