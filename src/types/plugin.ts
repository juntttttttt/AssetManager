export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  entryPoint: string // Path to plugin script
  permissions?: PluginPermission[]
  hooks?: PluginHook[]
  settings?: PluginSetting[]
}

export type PluginPermission = 
  | 'read-assets'
  | 'write-assets'
  | 'delete-assets'
  | 'read-config'
  | 'write-config'
  | 'notifications'
  | 'network-requests'

export type PluginHook = 
  | 'before-upload'
  | 'after-upload'
  | 'before-delete'
  | 'after-delete'
  | 'asset-status-changed'
  | 'app-startup'
  | 'app-shutdown'

export interface PluginSetting {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  defaultValue: any
  options?: { label: string; value: any }[] // For select type
  description?: string
}

export interface Plugin {
  manifest: PluginManifest
  enabled: boolean
  settings: Record<string, any>
  installedAt: number
  updatedAt: number
  error?: string
}

export interface PluginContext {
  // Asset operations
  getAssets: (type?: 'audio' | 'decal') => Promise<any[]>
  uploadAsset: (file: File, type: 'audio' | 'decal', options?: any) => Promise<any>
  deleteAsset: (assetId: string, type: 'audio' | 'decal') => Promise<boolean>
  
  // Configuration
  getConfig: () => any
  setConfig: (config: any) => void
  
  // Storage
  getStorage: (key: string) => any
  setStorage: (key: string, value: any) => void
  
  // Notifications
  showNotification: (title: string, body: string, type?: 'info' | 'success' | 'error' | 'warning') => void
  
  // Network requests
  request: (url: string, options?: RequestInit) => Promise<Response>
  
  // Logging
  log: (message: string, level?: 'info' | 'warn' | 'error') => void
}

export interface AutomationScript {
  id: string
  name: string
  description: string
  code: string
  enabled: boolean
  trigger: 'manual' | 'on-upload' | 'on-status-change' | 'scheduled'
  schedule?: string // Cron expression for scheduled triggers
  createdAt: number
  lastRun?: number
  runCount: number
}

