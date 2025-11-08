import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  checkAssetStatus: (assetId: string, type: 'audio' | 'decal', apiKey: string, cookie?: string) =>
    ipcRenderer.invoke('check-asset-status', { assetId, type, apiKey, cookie }),
  testCookie: (cookie: string) => ipcRenderer.invoke('test-cookie', cookie),
  uploadAsset: (fileData: number[], fileName: string, assetType: 'Audio' | 'Decal', cookie: string, userId?: string, groupId?: string, description?: string) =>
    ipcRenderer.invoke('upload-asset', { fileData, fileName, assetType, cookie, userId, groupId, description }),
  deleteAsset: (assetId: string, cookie: string) =>
    ipcRenderer.invoke('delete-asset', { assetId, cookie }),
  fetchAssets: (assetType: 'Audio' | 'Decal', cookie: string, userId?: string, groupId?: string) =>
    ipcRenderer.invoke('fetch-assets', { assetType, cookie, userId, groupId }),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
})

