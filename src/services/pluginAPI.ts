/**
 * Plugin API Service
 * Provides a safe API for plugins to interact with the application
 */

import { Plugin, PluginContext } from '../types/plugin'
import { createPluginContext } from '../utils/pluginManager'

export class PluginAPI {
  private context: PluginContext | null = null
  
  constructor(private plugin: Plugin) {
    this.context = createPluginContext(plugin)
  }
  
  // Asset operations
  async getAssets(type?: 'audio' | 'decal') {
    if (!this.hasPermission('read-assets')) {
      throw new Error('Plugin does not have read-assets permission')
    }
    return this.context!.getAssets(type)
  }
  
  async uploadAsset(file: File, type: 'audio' | 'decal', options?: any) {
    if (!this.hasPermission('write-assets')) {
      throw new Error('Plugin does not have write-assets permission')
    }
    return this.context!.uploadAsset(file, type, options)
  }
  
  async deleteAsset(assetId: string, type: 'audio' | 'decal') {
    if (!this.hasPermission('delete-assets')) {
      throw new Error('Plugin does not have delete-assets permission')
    }
    return this.context!.deleteAsset(assetId, type)
  }
  
  // Configuration
  getConfig() {
    if (!this.hasPermission('read-config')) {
      throw new Error('Plugin does not have read-config permission')
    }
    return this.context!.getConfig()
  }
  
  setConfig(config: any) {
    if (!this.hasPermission('write-config')) {
      throw new Error('Plugin does not have write-config permission')
    }
    this.context!.setConfig(config)
  }
  
  // Storage
  getStorage(key: string) {
    return this.context!.getStorage(key)
  }
  
  setStorage(key: string, value: any) {
    this.context!.setStorage(key, value)
  }
  
  // Notifications
  showNotification(title: string, body: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
    if (!this.hasPermission('notifications')) {
      throw new Error('Plugin does not have notifications permission')
    }
    this.context!.showNotification(title, body, type)
  }
  
  // Network requests
  async request(url: string, options?: RequestInit) {
    if (!this.hasPermission('network-requests')) {
      throw new Error('Plugin does not have network-requests permission')
    }
    return this.context!.request(url, options)
  }
  
  // Logging
  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.context!.log(message, level)
  }
  
  // Permission checking
  private hasPermission(permission: string): boolean {
    const permissions = this.plugin.manifest.permissions || []
    return permissions.includes(permission as any)
  }
}

// Export a factory function
export function createPluginAPI(plugin: Plugin): PluginAPI {
  return new PluginAPI(plugin)
}

