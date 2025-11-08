import { useEffect } from 'react'
import { emitPluginEvent, getPlugins, getAutomationScripts, runAutomationScript } from '../utils/pluginManager'
import { Plugin } from '../types/plugin'

/**
 * Hook to emit plugin events and run automation scripts
 */
export function usePluginHooks() {
  useEffect(() => {
    // Emit app startup event
    emitPluginEvent('app-startup', { timestamp: Date.now() })
    
    // Cleanup on app shutdown
    return () => {
      emitPluginEvent('app-shutdown', { timestamp: Date.now() })
    }
  }, [])
}

/**
 * Emit before-upload event
 */
export function emitBeforeUpload(file: File, type: 'audio' | 'decal', options?: any) {
  emitPluginEvent('before-upload', { file, type, options, timestamp: Date.now() })
}

/**
 * Emit after-upload event
 */
export function emitAfterUpload(result: any, file: File, type: 'audio' | 'decal') {
  emitPluginEvent('after-upload', { result, file, type, timestamp: Date.now() })
  
  // Run automation scripts triggered by upload
  const scripts = getAutomationScripts()
  scripts
    .filter(s => s.enabled && s.trigger === 'on-upload')
    .forEach(async (script) => {
      try {
        await runAutomationScript(script, { event: 'after-upload', result, file, type })
      } catch (error) {
        console.error(`Error running automation script ${script.name}:`, error)
      }
    })
}

/**
 * Emit before-delete event
 */
export function emitBeforeDelete(assetId: string, type: 'audio' | 'decal') {
  emitPluginEvent('before-delete', { assetId, type, timestamp: Date.now() })
}

/**
 * Emit after-delete event
 */
export function emitAfterDelete(assetId: string, type: 'audio' | 'decal', success: boolean) {
  emitPluginEvent('after-delete', { assetId, type, success, timestamp: Date.now() })
}

/**
 * Emit asset-status-changed event
 */
export function emitAssetStatusChanged(assetId: string, type: 'audio' | 'decal', oldStatus: string, newStatus: string) {
  emitPluginEvent('asset-status-changed', { assetId, type, oldStatus, newStatus, timestamp: Date.now() })
  
  // Run automation scripts triggered by status change
  const scripts = getAutomationScripts()
  scripts
    .filter(s => s.enabled && s.trigger === 'on-status-change')
    .forEach(async (script) => {
      try {
        await runAutomationScript(script, { 
          event: 'asset-status-changed', 
          assetId, 
          type, 
          oldStatus, 
          newStatus 
        })
      } catch (error) {
        console.error(`Error running automation script ${script.name}:`, error)
      }
    })
}

