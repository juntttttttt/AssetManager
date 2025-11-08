import { Plugin, PluginManifest, PluginContext, AutomationScript } from '../types/plugin'
import { getUploadedAudios, getUploadedDecals } from './storage'
import { robloxAPI } from '../services/robloxApi'

const PLUGINS_STORAGE_KEY = 'roblox_uploader_plugins'
const AUTOMATION_SCRIPTS_KEY = 'roblox_uploader_automation_scripts'

// Plugin event system
type PluginEventListener = (data: any) => void | Promise<void>
const pluginEventListeners: Map<string, PluginEventListener[]> = new Map()

export function getPlugins(): Plugin[] {
  try {
    const stored = localStorage.getItem(PLUGINS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading plugins:', error)
    return []
  }
}

export function savePlugins(plugins: Plugin[]): void {
  try {
    localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(plugins))
  } catch (error) {
    console.error('Error saving plugins:', error)
  }
}

export function installPlugin(manifest: PluginManifest): Plugin {
  const plugins = getPlugins()
  
  // Check if plugin already exists
  const existingIndex = plugins.findIndex(p => p.manifest.id === manifest.id)
  
  const plugin: Plugin = {
    manifest,
    enabled: existingIndex >= 0 ? plugins[existingIndex].enabled : true,
    settings: existingIndex >= 0 
      ? plugins[existingIndex].settings 
      : manifest.settings?.reduce((acc, setting) => {
          acc[setting.key] = setting.defaultValue
          return acc
        }, {} as Record<string, any>) || {},
    installedAt: existingIndex >= 0 ? plugins[existingIndex].installedAt : Date.now(),
    updatedAt: Date.now(),
  }
  
  if (existingIndex >= 0) {
    plugins[existingIndex] = plugin
  } else {
    plugins.push(plugin)
  }
  
  savePlugins(plugins)
  return plugin
}

export function uninstallPlugin(pluginId: string): boolean {
  const plugins = getPlugins()
  const index = plugins.findIndex(p => p.manifest.id === pluginId)
  
  if (index >= 0) {
    plugins.splice(index, 1)
    savePlugins(plugins)
    return true
  }
  
  return false
}

export function togglePlugin(pluginId: string, enabled: boolean): boolean {
  const plugins = getPlugins()
  const plugin = plugins.find(p => p.manifest.id === pluginId)
  
  if (plugin) {
    plugin.enabled = enabled
    plugin.updatedAt = Date.now()
    savePlugins(plugins)
    return true
  }
  
  return false
}

export function updatePluginSettings(pluginId: string, settings: Record<string, any>): boolean {
  const plugins = getPlugins()
  const plugin = plugins.find(p => p.manifest.id === pluginId)
  
  if (plugin) {
    plugin.settings = { ...plugin.settings, ...settings }
    plugin.updatedAt = Date.now()
    savePlugins(plugins)
    return true
  }
  
  return false
}

// Plugin context creation
export function createPluginContext(plugin: Plugin): PluginContext {
  return {
    getAssets: async (type?: 'audio' | 'decal') => {
      if (type === 'audio') {
        return getUploadedAudios()
      } else if (type === 'decal') {
        return getUploadedDecals()
      } else {
        return [...getUploadedAudios(), ...getUploadedDecals()]
      }
    },
    
    uploadAsset: async (file: File, assetType: 'audio' | 'decal', options?: any) => {
      // This would need to integrate with the upload system
      // For now, return a placeholder
      throw new Error('Plugin upload not yet implemented')
    },
    
    deleteAsset: async (assetId: string, type: 'audio' | 'decal') => {
      return await robloxAPI.deleteAsset(assetId, type)
    },
    
    getConfig: () => {
      try {
        const config = localStorage.getItem('robloxConfig')
        return config ? JSON.parse(config) : null
      } catch {
        return null
      }
    },
    
    setConfig: (config: any) => {
      localStorage.setItem('robloxConfig', JSON.stringify(config))
    },
    
    getStorage: (key: string) => {
      try {
        const value = localStorage.getItem(`plugin_${plugin.manifest.id}_${key}`)
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    },
    
    setStorage: (key: string, value: any) => {
      localStorage.setItem(`plugin_${plugin.manifest.id}_${key}`, JSON.stringify(value))
    },
    
    showNotification: (title: string, body: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      // This would integrate with the toast system
      console.log(`[Plugin ${plugin.manifest.name}] Notification:`, { title, body, type })
    },
    
    request: async (url: string, options?: RequestInit) => {
      return fetch(url, options)
    },
    
    log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
      console[level](`[Plugin ${plugin.manifest.name}]`, message)
    },
  }
}

// Event system
export function emitPluginEvent(hook: string, data: any): void {
  const listeners = pluginEventListeners.get(hook) || []
  listeners.forEach(listener => {
    try {
      listener(data)
    } catch (error) {
      console.error(`Error in plugin event listener for ${hook}:`, error)
    }
  })
}

export function onPluginEvent(hook: string, listener: PluginEventListener): () => void {
  if (!pluginEventListeners.has(hook)) {
    pluginEventListeners.set(hook, [])
  }
  pluginEventListeners.get(hook)!.push(listener)
  
  // Return unsubscribe function
  return () => {
    const listeners = pluginEventListeners.get(hook) || []
    const index = listeners.indexOf(listener)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

// Automation scripts
export function getAutomationScripts(): AutomationScript[] {
  try {
    const stored = localStorage.getItem(AUTOMATION_SCRIPTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading automation scripts:', error)
    return []
  }
}

export function saveAutomationScripts(scripts: AutomationScript[]): void {
  try {
    localStorage.setItem(AUTOMATION_SCRIPTS_KEY, JSON.stringify(scripts))
  } catch (error) {
    console.error('Error saving automation scripts:', error)
  }
}

export function createAutomationScript(script: Omit<AutomationScript, 'id' | 'createdAt' | 'runCount'>): AutomationScript {
  const scripts = getAutomationScripts()
  const newScript: AutomationScript = {
    ...script,
    id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    runCount: 0,
  }
  scripts.push(newScript)
  saveAutomationScripts(scripts)
  return newScript
}

export function updateAutomationScript(scriptId: string, updates: Partial<AutomationScript>): boolean {
  const scripts = getAutomationScripts()
  const script = scripts.find(s => s.id === scriptId)
  
  if (script) {
    Object.assign(script, updates)
    saveAutomationScripts(scripts)
    return true
  }
  
  return false
}

export function deleteAutomationScript(scriptId: string): boolean {
  const scripts = getAutomationScripts()
  const index = scripts.findIndex(s => s.id === scriptId)
  
  if (index >= 0) {
    scripts.splice(index, 1)
    saveAutomationScripts(scripts)
    return true
  }
  
  return false
}

export async function runAutomationScript(script: AutomationScript, context?: any): Promise<any> {
  try {
    // Create a safe execution context
    const pluginContext = {
      ...context,
      console: {
        log: (...args: any[]) => console.log('[Automation Script]', ...args),
        error: (...args: any[]) => console.error('[Automation Script]', ...args),
        warn: (...args: any[]) => console.warn('[Automation Script]', ...args),
      },
    }
    
    // Execute script in a sandboxed environment
    // Note: In a production app, you'd want to use a proper sandbox like vm2 or isolated-vm
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const fn = new AsyncFunction('context', script.code)
    const result = await fn(pluginContext)
    
    // Update run count
    updateAutomationScript(script.id, {
      lastRun: Date.now(),
      runCount: script.runCount + 1,
    })
    
    return result
  } catch (error) {
    console.error('Error running automation script:', error)
    throw error
  }
}

