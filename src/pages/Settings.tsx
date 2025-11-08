import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Key, Cookie, Globe, Moon, Sun, Bell, FileText, Upload as UploadIcon, CheckCircle, XCircle, Loader, Palette, Cloud, CloudOff, RefreshCw, Download, History, Trash2 } from 'lucide-react'
import { robloxAPI, RobloxConfig } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'
import { useTheme, ColorScheme, ThemeVariant } from '../contexts/ThemeContext'
import { requestNotificationPermission, checkNotificationPermission } from '../utils/notifications'
import {
  createBackup,
  restoreBackup,
  exportBackupToFile,
  importBackupFromFile,
  getBackupVersions,
  deleteBackupVersion,
  getCloudSyncStatus,
  setCloudSyncStatus,
  syncToCloud,
  syncFromCloud,
  BackupData,
  BackupVersion,
} from '../utils/backup'

export default function Settings() {
  const toast = useToast()
  const { theme, toggleTheme, themeVariant, colorScheme, accentColor, setThemeVariant, setColorScheme, setAccentColor } = useTheme()
  const [config, setConfig] = useState<RobloxConfig>(() => {
    const saved = localStorage.getItem('robloxConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Migrate old config format if needed
        if (parsed.openCloudApiKey && !parsed.cookie) {
          // Old format - migrate
          return {
            cookie: '',
            userId: '',
            groupId: '',
            uploadTarget: 'user' as const,
          }
        }
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
  const [hasChanges, setHasChanges] = useState(false)
  const [testingCookie, setTestingCookie] = useState(false)
  const [cookieStatus, setCookieStatus] = useState<{ valid: boolean; error?: string; userId?: string; username?: string } | null>(null)
  const [backupVersions, setBackupVersions] = useState<BackupVersion[]>(getBackupVersions())
  const [cloudSyncStatus, setCloudSyncStatusState] = useState(getCloudSyncStatus())
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setBackupVersions(getBackupVersions())
    setCloudSyncStatusState(getCloudSyncStatus())
  }, [])

  const handleSave = () => {
    robloxAPI.setConfig(config)
    localStorage.setItem('robloxConfig', JSON.stringify(config))
    setHasChanges(false)
    toast.success('Settings saved successfully!')
  }

  const handleChange = (field: keyof RobloxConfig, value: string | 'user' | 'group') => {
    setConfig((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
    // Clear cookie status when cookie changes
    if (field === 'cookie') {
      setCookieStatus(null)
    }
  }

  const handleTestCookie = async () => {
    if (!config.cookie || config.cookie.trim() === '') {
      toast.error('Please enter a cookie first')
      return
    }

    setTestingCookie(true)
    setCookieStatus(null)

    // Temporarily set config to test
    const tempConfig = { ...config }
    robloxAPI.setConfig(tempConfig)

    try {
      const result = await robloxAPI.testCookie()
      setCookieStatus(result)
      
      if (result.valid) {
        // If we got user info, suggest auto-filling User ID
        if (result.userId && config.uploadTarget === 'user' && !config.userId) {
          const shouldAutoFill = confirm(`Cookie is valid! Detected User ID: ${result.userId}\n\nWould you like to auto-fill the User ID field?`)
          if (shouldAutoFill) {
            handleChange('userId', result.userId)
          }
        }
        toast.success(`Cookie is valid!${result.username ? ` Logged in as: ${result.username}` : ''}`)
      } else {
        toast.error(`Cookie test failed: ${result.error}`)
      }
    } catch (error: any) {
      setCookieStatus({ valid: false, error: error.message })
      toast.error(`Failed to test cookie: ${error.message}`)
    } finally {
      setTestingCookie(false)
    }
  }

  const exportData = () => {
    const data = {
      config: localStorage.getItem('robloxConfig'),
      audios: localStorage.getItem('uploadedAudios'),
      decals: localStorage.getItem('uploadedDecals'),
      exportDate: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roblox-uploader-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported successfully!')
  }

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data.config) {
          const parsedConfig = JSON.parse(data.config)
          setConfig(parsedConfig)
          robloxAPI.setConfig(parsedConfig)
          localStorage.setItem('robloxConfig', data.config)
        }
        if (data.audios) localStorage.setItem('uploadedAudios', data.audios)
        if (data.decals) localStorage.setItem('uploadedDecals', data.decals)
        toast.success('Data imported successfully!')
      } catch (error) {
        toast.error('Failed to import data. Invalid file format.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear ALL data? This includes:\n- Upload history\n- Monitoring data\n- User sessions\n- All settings\n\nThis cannot be undone.')) {
      // Clear main data
      localStorage.removeItem('robloxConfig')
      localStorage.removeItem('uploadedAudios')
      localStorage.removeItem('uploadedDecals')
      localStorage.removeItem('uploadHistory')
      localStorage.removeItem('scheduledUploads')
      localStorage.removeItem('uploadPresets')
      localStorage.removeItem('robloxAccounts')
      localStorage.removeItem('assetTags')
      localStorage.removeItem('allTags')
      
      // Clear monitoring/tracking data
      localStorage.removeItem('userTrackingId')
      localStorage.removeItem('machineId')
      localStorage.removeItem('monitoredUploads')
      localStorage.removeItem('userSessions')
      localStorage.removeItem('appFirstRun')
      
      // Clear performance data
      localStorage.removeItem('uploadPerformance')
      localStorage.removeItem('performanceMetrics')
      
      // Clear backup data
      localStorage.removeItem('backupVersions')
      localStorage.removeItem('currentBackup')
      localStorage.removeItem('cloudSyncStatus')
      
      setConfig({ cookie: '', userId: '', groupId: '', uploadTarget: 'user' })
      toast.success('All data cleared! The app will start fresh.')
      
      // Reload page to reset all state
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  const handleCreateBackup = () => {
    try {
      const backup = createBackup()
      exportBackupToFile(backup)
      setBackupVersions(getBackupVersions())
      toast.success('Backup created and exported!')
    } catch (error) {
      toast.error('Failed to create backup')
    }
  }

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const backup = await importBackupFromFile(file)
      const merge = confirm('Merge with existing data? (Cancel to replace)')
      restoreBackup(backup, merge)
      toast.success(`Backup restored ${merge ? '(merged)' : '(replaced)'}!`)
      // Reload page to apply changes
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore backup')
    }
    e.target.value = ''
  }

  const handleRestoreVersion = (version: BackupVersion) => {
    // For now, we'll need to import from file
    // In a full implementation, versions would be stored and restorable
    toast.info('Please use the "Restore from File" option to restore this version')
  }

  const handleDeleteVersion = (versionId: string) => {
    if (confirm('Delete this backup version?')) {
      deleteBackupVersion(versionId)
      setBackupVersions(getBackupVersions())
      toast.success('Backup version deleted')
    }
  }

  const handleToggleCloudSync = () => {
    const newStatus = {
      ...cloudSyncStatus,
      enabled: !cloudSyncStatus.enabled,
    }
    setCloudSyncStatus(newStatus)
    setCloudSyncStatusState(newStatus)
    toast.success(`Cloud sync ${newStatus.enabled ? 'enabled' : 'disabled'}`)
  }

  const handleSyncToCloud = async () => {
    setSyncing(true)
    try {
      await syncToCloud()
      setCloudSyncStatusState(getCloudSyncStatus())
      toast.success('Synced to cloud successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync to cloud')
      setCloudSyncStatusState(getCloudSyncStatus())
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncFromCloud = async () => {
    setSyncing(true)
    try {
      const backup = await syncFromCloud()
      if (backup) {
        const merge = confirm('Merge with existing data? (Cancel to replace)')
        restoreBackup(backup, merge)
        toast.success(`Synced from cloud ${merge ? '(merged)' : '(replaced)'}!`)
        window.location.reload()
      } else {
        toast.info('No backup found in cloud')
      }
      setCloudSyncStatusState(getCloudSyncStatus())
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync from cloud')
      setCloudSyncStatusState(getCloudSyncStatus())
    } finally {
      setSyncing(false)
    }
  }

  const handleNotificationPermission = async () => {
    const permission = await requestNotificationPermission()
    if (permission === 'granted') {
      toast.success('Notifications enabled!')
    } else {
      toast.warning('Notifications were denied')
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={28} />
          Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
          Configure your Roblox API credentials and manage app data
        </p>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key size={20} />
          Roblox Configuration
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Roblox Cookie (.ROBLOSECURITY) *
            </label>
            <input
              type="password"
              value={config.cookie}
              onChange={(e) => handleChange('cookie', e.target.value)}
              placeholder="Enter your .ROBLOSECURITY cookie"
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <button
                onClick={handleTestCookie}
                disabled={testingCookie || !config.cookie || config.cookie.trim() === ''}
                style={{
                  padding: '8px 16px',
                  background: testingCookie || !config.cookie || config.cookie.trim() === '' ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: testingCookie || !config.cookie || config.cookie.trim() === '' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: 'none',
                }}
              >
                {testingCookie ? (
                  <>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Test Cookie
                  </>
                )}
              </button>
              {cookieStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {cookieStatus.valid ? (
                    <>
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--success)' }}>Valid</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} style={{ color: 'var(--danger)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--danger)' }}>
                        {cookieStatus.error || 'Invalid'}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Required for all uploads. Find it in browser DevTools → Application → Cookies → .ROBLOSECURITY
            </p>
            {cookieStatus && !cookieStatus.valid && cookieStatus.error?.includes('Network error') && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px 12px', 
                background: 'var(--bg-tertiary)', 
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  <strong>Note:</strong> Network errors during testing don't necessarily mean your cookie is invalid. 
                  The cookie format looks correct. You can skip the test and try uploading a file directly - if the cookie is valid, the upload will work.
                </p>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Upload Target
            </label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <button
                onClick={() => handleChange('uploadTarget', 'user')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: config.uploadTarget === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: config.uploadTarget === 'user' ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
              >
                User
              </button>
              <button
                onClick={() => handleChange('uploadTarget', 'group')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: config.uploadTarget === 'group' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: config.uploadTarget === 'group' ? 'white' : 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
              >
                Group
              </button>
            </div>
          </div>

          {config.uploadTarget === 'user' && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                User ID *
              </label>
              <input
                type="text"
                value={config.userId || ''}
                onChange={(e) => handleChange('userId', e.target.value)}
                placeholder="Enter your Roblox User ID"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Your Roblox User ID. You can find it on your profile page URL (roblox.com/users/USER_ID/profile)
              </p>
            </div>
          )}

          {config.uploadTarget === 'group' && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Group ID *
              </label>
              <input
                type="text"
                value={config.groupId || ''}
                onChange={(e) => handleChange('groupId', e.target.value)}
                placeholder="Enter your Roblox Group ID"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Enter a GROUP ID. You can find it on your communities page URL (https://www.roblox.com/communities/GROUP_ID)
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!hasChanges}
            style={{
              padding: '12px 24px',
              background: hasChanges ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'flex-start',
            }}
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          Appearance
        </h2>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Theme
          </label>
          <button
            onClick={toggleTheme}
            style={{
              padding: '12px 24px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Theme Colors ({theme === 'dark' ? 'Dark' : 'Light'} Mode)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {(theme === 'dark' 
              ? ['default', 'darker', 'amoled', 'blue-dark', 'green-dark', 'warmer-dark', 'cooler-dark', 'lighter', 'spectrum', 'neon', 'sunset', 'ocean', 'forest', 'purple-dream', 'cyberpunk', 'aurora'] as ThemeVariant[]
              : ['default', 'lighter', 'warm', 'cool', 'blue-light', 'green-light', 'warmer-dark', 'cooler-dark', 'spectrum', 'neon', 'sunset', 'ocean', 'forest', 'purple-dream', 'cyberpunk', 'aurora'] as ThemeVariant[]
            ).map((variant) => {
              const isSelected = themeVariant === variant
              // Get preview color from theme variant
              const variantColors: Record<ThemeVariant, { dark: string; light: string }> = {
                default: { dark: '#1e1f22', light: '#ffffff' },
                darker: { dark: '#0f0f10', light: '#ffffff' },
                amoled: { dark: '#000000', light: '#ffffff' },
                'blue-dark': { dark: '#1a1d2e', light: '#f0f4ff' },
                'green-dark': { dark: '#1a2e1a', light: '#f1f8f4' },
                'warmer-dark': { dark: '#1f1c1a', light: '#fffaf5' },
                'cooler-dark': { dark: '#1a1d22', light: '#f8f9fa' },
                lighter: { dark: '#2b2d31', light: '#fafbfc' },
                warm: { dark: '#1e1b18', light: '#fffef9' },
                cool: { dark: '#1a1d22', light: '#f8fafb' },
                'blue-light': { dark: '#1a1d2e', light: '#f0f4ff' },
                'green-light': { dark: '#1a2e1a', light: '#f1f8f4' },
                spectrum: { dark: '#1a0f1f', light: '#fff5f5' },
                neon: { dark: '#0a0a0f', light: '#f0fff4' },
                sunset: { dark: '#1a0f0a', light: '#fff8f0' },
                ocean: { dark: '#0a1a2a', light: '#e0f2f1' },
                forest: { dark: '#0a1a0a', light: '#e8f5e9' },
                'purple-dream': { dark: '#1a0f2a', light: '#f3e5f5' },
                cyberpunk: { dark: '#0a0a1a', light: '#fff0ff' },
                aurora: { dark: '#0a1a1f', light: '#e0f7fa' },
              }
              const previewColor = theme === 'dark' ? variantColors[variant].dark : variantColors[variant].light
              
              return (
                <button
                  key={variant}
                  onClick={() => setThemeVariant(variant)}
                  style={{
                    padding: '12px',
                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  title={variant.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: previewColor,
                      border: '2px solid var(--border)',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize', textAlign: 'center' }}>
                    {variant.replace('-', ' ')}
                  </span>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Choose a color scheme for {theme === 'dark' ? 'dark' : 'light'} mode
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accent Color
            </label>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              All themes unlocked ✨
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
            {([
              'default', 'blue', 'green', 'purple', 'red', 'orange', 'pink', 'cyan',
              'yellow', 'magenta', 'gradient-ocean', 'gradient-sunset', 'gradient-neon',
              'gradient-pastel-green', 'gradient-pastel-peach', 'gradient-pastel-purple', 'gradient-pastel-yellow',
              'gradient-pastel-pink', 'gradient-pastel-blue', 'gradient-pastel-cream', 'gradient-vibrant-orange',
              'gradient-vibrant-blue', 'gradient-vibrant-green', 'gradient-vibrant-red', 'gradient-vibrant-brown',
              'gradient-vibrant-blue-green', 'gradient-vibrant-purple', 'gradient-teal-purple', 'gradient-pink-orange',
              'gradient-blue-green-dark', 'custom'
            ] as ColorScheme[]).map((scheme) => {
              const schemeColors: Record<string, string> = {
                default: '#5865f2',
                blue: '#3b82f6',
                green: '#10b981',
                purple: '#8b5cf6',
                red: '#ef4444',
                orange: '#f97316',
                pink: '#ec4899',
                cyan: '#06b6d4',
                yellow: '#eab308',
                magenta: '#d946ef',
                'gradient-ocean': 'linear-gradient(135deg, #00bfff, #0066cc, #003366)',
                'gradient-sunset': 'linear-gradient(135deg, #ff6b6b, #ffa500, #ff8c00, #ff6347)',
                'gradient-neon': 'linear-gradient(135deg, #00ff88, #00d4ff, #ff00ff, #ff0080)',
                'gradient-pastel-green': 'linear-gradient(135deg, #a8e6cf, #88d8c0, #7fd3b3)',
                'gradient-pastel-peach': 'linear-gradient(135deg, #ffd3b6, #ffc5a1, #ffb88c)',
                'gradient-pastel-purple': 'linear-gradient(135deg, #c7ceea, #b8c0e0, #a9b3d6)',
                'gradient-pastel-yellow': 'linear-gradient(135deg, #ffeaa7, #ffd93d, #fdcb6e)',
                'gradient-pastel-pink': 'linear-gradient(135deg, #ffd9e3, #ffc8d8, #ffb7cd)',
                'gradient-pastel-blue': 'linear-gradient(135deg, #d4e4f7, #c4d9f0, #b4cee9)',
                'gradient-pastel-cream': 'linear-gradient(135deg, #fff8e1, #fff3c4, #ffecb3)',
                'gradient-vibrant-orange': 'linear-gradient(135deg, #ff6b35, #f7931e, #ff9800)',
                'gradient-vibrant-blue': 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)',
                'gradient-vibrant-green': 'linear-gradient(135deg, #11998e, #38ef7d, #56ab2f)',
                'gradient-vibrant-red': 'linear-gradient(135deg, #eb3349, #f45c43, #c0392b)',
                'gradient-vibrant-brown': 'linear-gradient(135deg, #8b4513, #a0522d, #654321)',
                'gradient-vibrant-blue-green': 'linear-gradient(135deg, #1e3c72, #2a5298, #1e88e5)',
                'gradient-vibrant-purple': 'linear-gradient(135deg, #6a11cb, #2575fc, #8b00ff)',
                'gradient-teal-purple': 'linear-gradient(135deg, #00c9ff, #92fe9d, #8b5cf6)',
                'gradient-pink-orange': 'linear-gradient(135deg, #ff6b9d, #c471ed, #f64f59)',
                'gradient-blue-green-dark': 'linear-gradient(135deg, #0f4c75, #3282b8, #bbe1fa)',
                custom: accentColor,
              }
              const isSelected = colorScheme === scheme
              const isGradient = scheme.startsWith('gradient-')
              
              const displayName = scheme === 'custom' ? 'Custom' : scheme.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              
              return (
                <button
                  key={scheme}
                  onClick={() => setColorScheme(scheme)}
                  style={{
                    padding: '8px',
                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: `2px solid ${isSelected ? (isGradient ? 'var(--accent)' : schemeColors[scheme] || accentColor) : 'var(--border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    aspectRatio: '1',
                    minHeight: '60px',
                  }}
                  title={displayName}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }
                  }}
                >
                  {scheme === 'custom' ? (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                        border: '2px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Palette size={20} color="var(--text-secondary)" />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: schemeColors[scheme] || accentColor,
                        border: '2px solid var(--bg-secondary)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Accent Color {colorScheme === 'custom' && '(Custom)'}
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{
                width: '60px',
                height: '40px',
                border: '2px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => {
                const value = e.target.value
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  setAccentColor(value)
                }
              }}
              placeholder="#5865f2"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Choose a custom accent color or select a preset color scheme above
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Data Management</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={exportData}
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border)',
              }}
            >
              Export Data
            </button>
            <label
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Import Data
              <input
                type="file"
                accept=".json"
                onChange={importData}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ 
              padding: '12px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: '6px', 
              border: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Data Privacy:</strong> All data is stored locally on your device. Each installation is completely isolated - other users won't see your data, and you won't see theirs.
            </div>
            <button
              onClick={clearAllData}
              style={{
                padding: '12px',
                background: 'var(--danger)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Clear All Data
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cloud size={20} />
          Backup & Sync
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Cloud Sync Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Cloud Sync
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {cloudSyncStatus.enabled
                  ? cloudSyncStatus.lastSync
                    ? `Last synced: ${new Date(cloudSyncStatus.lastSync).toLocaleString()}`
                    : 'Not synced yet'
                  : 'Sync your data across devices'}
              </div>
              {cloudSyncStatus.error && (
                <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                  Error: {cloudSyncStatus.error}
                </div>
              )}
            </div>
            <button
              onClick={handleToggleCloudSync}
              style={{
                padding: '8px 16px',
                background: cloudSyncStatus.enabled ? 'var(--accent)' : 'var(--bg-hover)',
                color: cloudSyncStatus.enabled ? 'white' : 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {cloudSyncStatus.enabled ? <Cloud size={16} /> : <CloudOff size={16} />}
              {cloudSyncStatus.enabled ? 'Enabled' : 'Enable'}
            </button>
          </div>

          {/* Sync Actions */}
          {cloudSyncStatus.enabled && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSyncToCloud}
                disabled={syncing || cloudSyncStatus.syncInProgress}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: syncing ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {syncing ? <Loader size={16} className="spin" /> : <UploadIcon size={16} />}
                Sync to Cloud
              </button>
              <button
                onClick={handleSyncFromCloud}
                disabled={syncing || cloudSyncStatus.syncInProgress}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: syncing ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {syncing ? <Loader size={16} className="spin" /> : <Download size={16} />}
                Sync from Cloud
              </button>
            </div>
          )}

          {/* Backup Actions */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Local Backups
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={handleCreateBackup}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Download size={16} />
                Create Backup
              </button>
              <label
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <UploadIcon size={16} />
                Restore from File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Backup Versions */}
            {backupVersions.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Version History ({backupVersions.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {backupVersions.slice(0, 10).map((version) => (
                    <div
                      key={version.id}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          Version {version.version}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(version.timestamp).toLocaleString()} • {(version.size / 1024).toFixed(2)} KB
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleRestoreVersion(version)}
                          style={{
                            padding: '6px 10px',
                            background: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: 'none',
                          }}
                          title="Restore this version"
                        >
                          <History size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteVersion(version.id)}
                          style={{
                            padding: '6px 10px',
                            background: 'var(--bg-hover)',
                            color: 'var(--danger)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: 'none',
                          }}
                          title="Delete this version"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={20} />
          Notifications
        </h2>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Current permission: <strong>{checkNotificationPermission()}</strong>
          </p>
          <button
            onClick={handleNotificationPermission}
            disabled={checkNotificationPermission() === 'granted'}
            style={{
              padding: '12px 24px',
              background: checkNotificationPermission() === 'granted' ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: checkNotificationPermission() === 'granted' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Bell size={18} />
            {checkNotificationPermission() === 'granted' ? 'Notifications Enabled' : 'Enable Notifications'}
          </button>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} />
          Import/Export
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{
                padding: '12px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <UploadIcon size={18} />
              Import from CSV/JSON
              <input
                type="file"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  const reader = new FileReader()
                  reader.onload = (event) => {
                    try {
                      const content = event.target?.result as string
                      if (file.name.endsWith('.json')) {
                        const data = JSON.parse(content)
                        if (data.audios) {
                          const existing = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
                          const merged = [...existing, ...(Array.isArray(data.audios) ? data.audios : [])]
                          localStorage.setItem('uploadedAudios', JSON.stringify(merged))
                        }
                        if (data.decals) {
                          const existing = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
                          const merged = [...existing, ...(Array.isArray(data.decals) ? data.decals : [])]
                          localStorage.setItem('uploadedDecals', JSON.stringify(merged))
                        }
                        toast.success('Data imported from JSON!')
                      } else if (file.name.endsWith('.csv')) {
                        // Basic CSV parsing
                        const lines = content.split('\n')
                        const headers = lines[0].split(',')
                        const rows = lines.slice(1).filter((l) => l.trim())
                        
                        // Simple CSV import - could be enhanced
                        toast.info('CSV import: Please use JSON format for full compatibility')
                      }
                    } catch (error) {
                      toast.error('Failed to import file. Invalid format.')
                    }
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Import asset data from JSON or CSV files
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

