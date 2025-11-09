import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import { spawn, ChildProcess } from 'child_process'
import { Readable, PassThrough } from 'stream'
import fs from 'fs'
import os from 'os'
import https from 'https'
import { URL } from 'url'
import { autoUpdater } from 'electron-updater'

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

// Configure auto-updater
function setupAutoUpdater() {
  // Only enable auto-updater in production
  if (!app.isPackaged) {
    console.log('🔧 Auto-updater disabled in development mode')
    return
  }

  // Configure auto-updater
  autoUpdater.autoDownload = false // Don't auto-download, let user choose
  autoUpdater.autoInstallOnAppQuit = true // Install on app quit after download

  // Check for updates on startup (after a short delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err)
    })
  }, 5000) // Wait 5 seconds after app start

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err)
    })
  }, 4 * 60 * 60 * 1000) // 4 hours

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...')
    if (mainWindow) {
      mainWindow.webContents.send('update-checking')
    }
  })

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version)
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })
    }

    // Show notification dialog
    if (mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: 'Update Available',
          message: `A new version (${info.version}) is available!`,
          detail: 'Would you like to download it now?',
          buttons: ['Download', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            // User clicked "Download"
            autoUpdater.downloadUpdate().catch((err) => {
              console.error('Failed to download update:', err)
              if (mainWindow) {
                dialog.showErrorBox('Update Error', 'Failed to download update. Please try again later.')
              }
            })
          }
        })
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('✅ App is up to date:', info.version)
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', {
        version: info.version,
      })
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('❌ Auto-updater error:', err)
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: err.message,
      })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`⬇️ Download progress: ${Math.round(progress.percent)}%`)
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version)
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })

      // Show dialog asking user to restart
      dialog
        .showMessageBox(mainWindow!, {
          type: 'info',
          title: 'Update Ready',
          message: `Update ${info.version} has been downloaded!`,
          detail: 'The application will restart to install the update.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            // User clicked "Restart Now"
            autoUpdater.quitAndInstall(false, true) // Restart app after install
          }
        })
    }
  })
}

// IPC handlers for manual update checks
ipcMain.handle('check-for-updates', async (event) => {
  if (!app.isPackaged) {
    return { success: false, error: 'Auto-updater is disabled in development mode' }
  }

  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('download-update', async (event) => {
  if (!app.isPackaged) {
    return { success: false, error: 'Auto-updater is disabled in development mode' }
  }

  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('install-update', async (event) => {
  if (!app.isPackaged) {
    return { success: false, error: 'Auto-updater is disabled in development mode' }
  }

  try {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Set up Content Security Policy
function setupCSP() {
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  // In development, allow unsafe-eval for Vite HMR
  // In production, use stricter CSP
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; style-src 'self' 'unsafe-inline' http://localhost:*; img-src 'self' data: https: http://localhost:*; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; frame-src 'none';"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3001; frame-src 'none';"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}

async function createWindow() {
  try {
    // Set up icon path
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'build', 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico')
    
    // Check if icon exists, fallback to default if not
    let icon: string | undefined
    if (fs.existsSync(iconPath)) {
      icon = iconPath
      console.log('✅ Using custom icon:', iconPath)
    } else {
      console.log('ℹ️ Custom icon not found, using default Electron icon')
    }
    
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      backgroundColor: '#1e1f22',
      titleBarStyle: 'hidden',
      frame: false,
      icon: icon, // Set window icon (for taskbar on Windows)
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      show: false // Don't show until ready
    })
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      if (mainWindow) {
        mainWindow.show()
        console.log('✅ Window is ready and visible')
      }
    })

    // Check if we're in development (Vite dev server running)
    const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // Try multiple ports in case Vite uses a different one
      const vitePorts = [5173, 5174, 5175, 5176, 5177]
      const http = require('http')
      
      const tryLoadVite = (port: number): Promise<boolean> => {
        return new Promise((resolve) => {
          const req = http.get(`http://localhost:${port}`, (res: any) => {
            if (res.statusCode === 200) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
          req.on('error', () => resolve(false))
          req.setTimeout(2000, () => {
            req.destroy()
            resolve(false)
          })
        })
      }
      
      // Wait a bit for Vite to be ready, then find the port
      let vitePort = 5173
      let found = false
      
      // Try each port with a small delay
      for (const port of vitePorts) {
        const isAvailable = await tryLoadVite(port)
        if (isAvailable) {
          vitePort = port
          found = true
          break
        }
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (!found) {
        console.warn('⚠️  Could not find Vite dev server, defaulting to port 5173')
        vitePort = 5173
      }
      
      console.log(`Loading Vite dev server on port ${vitePort}`)
      
      // Wait a moment before loading to ensure Vite is fully ready
      await new Promise(resolve => setTimeout(resolve, 500))
      
      try {
        await mainWindow.loadURL(`http://localhost:${vitePort}`)
        console.log('✅ Successfully loaded Vite dev server')
        mainWindow.webContents.openDevTools()
      } catch (error) {
        console.error('❌ Failed to load Vite dev server:', error)
        // Show error in window
        if (mainWindow) {
          mainWindow.loadURL(`data:text/html,<html><body style="font-family: Arial; padding: 20px; background: #1e1f22; color: white;"><h1>Failed to connect to Vite dev server</h1><p>Make sure Vite is running on port ${vitePort}</p><p>Error: ${error}</p></body></html>`)
        }
      }
      
      // Handle errors
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed to load:', errorCode, errorDescription, validatedURL)
        // Try to reload after a delay
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('Retrying load...')
            mainWindow.reload()
          }
        }, 2000)
      })
    } else {
      const indexPath = path.join(__dirname, '../dist/index.html')
      console.log('Loading production index.html from:', indexPath)
      
      // Check if file exists
      const fs = require('fs')
      if (!fs.existsSync(indexPath)) {
        console.error('❌ Production index.html not found at:', indexPath)
        console.error('Trying alternative paths...')
        
        const altPaths = [
          path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
          path.join(app.getAppPath(), 'dist', 'index.html'),
        ]
        
        let found = false
        for (const altPath of altPaths) {
          console.log('Trying:', altPath)
          if (fs.existsSync(altPath)) {
            console.log('✅ Found index.html at:', altPath)
            mainWindow.loadFile(altPath)
            found = true
            break
          }
        }
        
        if (!found) {
          console.error('❌ Could not find index.html in any location')
          // Try loading anyway - Electron might find it
          mainWindow.loadFile(indexPath).catch((err: any) => {
            console.error('Failed to load index.html:', err)
          })
        }
      } else {
        try {
          await mainWindow.loadFile(indexPath)
          console.log('✅ Successfully loaded production index.html')
        } catch (error) {
          console.error('❌ Failed to load production index.html:', error)
        }
      }
    }
  } catch (error) {
    console.error('❌ Error creating window:', error)
    // Show error window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`data:text/html,<html><body style="font-family: Arial; padding: 20px; background: #1e1f22; color: white;"><h1>Error creating window</h1><p>${error}</p></body></html>`)
      mainWindow.show()
    }
  }

  if (mainWindow) {
    mainWindow.on('closed', () => {
      mainWindow = null
    })
    
    // Log when page is ready
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Page finished loading')
    })
  }
}

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

// IPC handler for checking asset status (bypasses CORS)
ipcMain.handle('check-asset-status', async (event, { assetId, type, apiKey, cookie }) => {
  // apiKey parameter kept for backward compatibility but not used
  try {
    // Default to pending - only mark as accepted with strong evidence
    let assetName = `Asset ${assetId}`
    let actualStatus: 'pending' | 'accepted' | 'declined' = 'pending'

    // First, try Asset Delivery API WITHOUT cookie to check public accessibility
    // This is critical: when logged in, we can access declined assets (owner can see them)
    // We need to check if the asset is PUBLICLY accessible, not just accessible to the owner
    let assetDeliveryStatusPublic: number | null = null
    let assetDeliveryStatusAuth: number | null = null
    
    try {
      // Check WITHOUT authentication first (public access check)
      const assetDeliveryPublicResponse = await axios.get(
        `https://assetdelivery.roblox.com/v2/assetId/${assetId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            // NO Cookie header - check public accessibility
          },
          responseType: 'arraybuffer',
          validateStatus: (status) => status < 500,
          timeout: 10000,
        }
      )

      assetDeliveryStatusPublic = assetDeliveryPublicResponse.status
      console.log(`Asset ${assetId}: Public Asset Delivery API check returned ${assetDeliveryStatusPublic}`)

      // If public access returns 200, asset is definitely ACCEPTED (publicly accessible)
      if (assetDeliveryPublicResponse.status === 200) {
        console.log(`Asset ${assetId}: Public Asset Delivery API returned 200 - asset is PUBLICLY accessible = ACCEPTED`)
        // Continue to get asset name, but status is confirmed as accepted
      }

      // If public access returns 404, asset is DECLINED (not publicly available)
      if (assetDeliveryPublicResponse.status === 404) {
        console.log(`Asset ${assetId}: Public Asset Delivery API returned 404 - asset is not publicly accessible = DECLINED`)
        // Continue to verify with authenticated check, but this is strong evidence of decline
      }

      // If public access returns 403, asset exists but not publicly accessible (likely pending)
      if (assetDeliveryPublicResponse.status === 403) {
        console.log(`Asset ${assetId}: Public Asset Delivery API returned 403 - asset exists but not publicly accessible = PENDING`)
      }

      // Also check WITH authentication to see if owner can access it
      if (cookie) {
        try {
          const assetDeliveryAuthResponse = await axios.get(
            `https://assetdelivery.roblox.com/v2/assetId/${assetId}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
              },
              responseType: 'arraybuffer',
              validateStatus: (status) => status < 500,
              timeout: 10000,
            }
          )

          assetDeliveryStatusAuth = assetDeliveryAuthResponse.status
          console.log(`Asset ${assetId}: Authenticated Asset Delivery API check returned ${assetDeliveryStatusAuth}`)

          // If authenticated access works but public doesn't, it's likely PENDING or DECLINED (owner-only access)
          if (assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== 200) {
            console.log(`Asset ${assetId}: Owner can access but public cannot - likely PENDING or DECLINED`)
            // This is a key indicator: if owner can see it but public can't, it's not accepted
          }
        } catch (authError) {
          // Ignore authenticated check errors
        }
      }
    } catch (assetDeliveryError: any) {
      // Continue to other checks if asset delivery fails
      console.warn(`Asset ${assetId}: Asset Delivery API check failed, continuing with other methods`)
    }
    
    // Use public status as primary indicator (more accurate)
    const assetDeliveryStatus = assetDeliveryStatusPublic

    // CRITICAL: Check library page FIRST - it has the most reliable status information
    // Library page shows actual moderation status, not just accessibility
    try {
      const libraryUrl = `https://www.roblox.com/library/${assetId}`
      const libraryResponse = await axios.get(libraryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(cookie ? { 'Cookie': `.ROBLOSECURITY=${cookie}` } : {}),
        },
        validateStatus: (status) => status < 500,
        timeout: 5000,
      })

      if (libraryResponse.status === 404) {
        console.log(`Asset ${assetId}: Library page returned 404 - marking as DECLINED`)
        return {
          success: true,
          data: {
            assetId,
            name: assetName,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          },
        }
      }

      if (libraryResponse.status === 200) {
        const html = libraryResponse.data
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i)
        if (nameMatch) {
          assetName = nameMatch[1].trim()
        }
        
        // CRITICAL: Check for declined/deleted indicators FIRST - these override everything
        // Look for explicit moderation status messages in the HTML
        const declinedPatterns = [
          /this item is not available/gi,
          /item is not available/gi,
          /this item is unavailable/gi,
          /not available for sale/gi,
          /no longer available/gi,
          /declined/gi,
          /rejected/gi,
          /removed/gi,
          /blocked/gi,
          /denied/gi,
          /moderation.*declined/gi,
          /has been declined/gi,
          /was declined/gi,
          /has been rejected/gi,
          /was rejected/gi,
          /this item has been removed/gi,
          /content deleted/gi,
          /item deleted/gi,
          /has been deleted/gi,
          /was deleted/gi,
          /moderation.*rejected/gi,
          /content.*removed/gi,
          /this.*has been.*deleted/gi,
          /this.*was.*deleted/gi,
          /content.*has been.*removed/gi,
          /item.*has been.*removed/gi,
          /moderation.*removed/gi,
          /asset.*removed/gi,
          /asset.*deleted/gi,
        ]
        
        const hasDeclinedIndicator = declinedPatterns.some(pattern => pattern.test(html))
        
        if (hasDeclinedIndicator) {
          console.log(`Asset ${assetId}: Library page shows DECLINED/DELETED - marking as DECLINED (overrides public accessibility)`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
        
        // Check for deletion keywords even if patterns don't match exactly
        const deletionKeywords = ['deleted', 'removed', 'no longer', 'unavailable', 'not available']
        const hasDeletionKeywords = deletionKeywords.some(keyword => {
          const regex = new RegExp(keyword, 'gi')
          const matches = html.match(regex)
          if (matches && matches.length > 0) {
            // Check context around the keyword
            const keywordIndex = html.toLowerCase().indexOf(keyword.toLowerCase())
            const context = html.substring(Math.max(0, keywordIndex - 50), Math.min(html.length, keywordIndex + 50))
            // If it's in context with item/content/asset, it's likely a decline message
            return /(item|content|asset|this)/i.test(context)
          }
          return false
        })
        
        if (hasDeletionKeywords && !html.includes('pending') && !html.includes('review') && !html.includes('under review')) {
          console.log(`Asset ${assetId}: Library page contains deletion keywords in context - marking as DECLINED`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
        
        // Check for pending indicators
        const pendingPatterns = [
          /pending/gi,
          /under review/gi,
          /moderation/gi,
          /reviewing/gi,
          /awaiting/gi,
          /being reviewed/gi,
          /in review/gi,
        ]
        
        const hasPendingIndicator = pendingPatterns.some(pattern => pattern.test(html))
        
        if (hasPendingIndicator) {
          console.log(`Asset ${assetId}: Library page shows PENDING - marking as PENDING`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'pending',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
      }
    } catch (libraryError: any) {
      console.warn(`Asset ${assetId}: Library page check failed, continuing with catalog check:`, libraryError.message)
    }

    // Check catalog API (secondary check for additional metadata)
    try {
      const catalogResponse = await axios.post(
        `https://catalog.roblox.com/v1/catalog/items/details`,
        {
          items: [{ itemType: 'Asset', id: parseInt(assetId) }],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { 'Cookie': `.ROBLOSECURITY=${cookie}` } : {}),
          },
          validateStatus: (status: number) => status < 500,
          timeout: 3000,
        }
      )

      if (catalogResponse.status === 200 && catalogResponse.data?.data?.[0]) {
        const item = catalogResponse.data.data[0]
        assetName = item.name || assetName
        
        console.log(`Asset ${assetId}: Found in Catalog API`, {
          name: item.name,
          isForSale: item.isForSale,
          isRestricted: item.isRestricted,
          isLimited: item.isLimited,
          priceStatus: item.priceStatus,
        })
        
        // Library page was already checked above, so if we got here, the library page didn't show decline indicators
        // Now check catalog + public accessibility to determine final status
        // Improved acceptance detection with public accessibility check:
        // CRITICAL: Only mark as ACCEPTED if asset is PUBLICLY accessible (not just owner-accessible)
        if (item.id) {
          const createdDate = item.created ? new Date(item.created) : null
          const now = new Date()
          const minutesSinceCreation = createdDate ? (now.getTime() - createdDate.getTime()) / (1000 * 60) : null
          
          // Strong indicators of acceptance:
          // 1. Public Asset Delivery API returned 200 (asset is publicly accessible) = DEFINITELY ACCEPTED
          // 2. Item is in catalog, not restricted, and publicly accessible
          // 3. Item isForSale is true and publicly accessible
          const isPubliclyAccessible = assetDeliveryStatusPublic === 200
          const isOwnerOnlyAccessible = assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== 200
          const isNotRestricted = !item.isRestricted && !item.isLimited && !item.isLimitedUnique
          const isAvailableForSale = item.isForSale === true || item.priceStatus === 'OnSale' || item.price !== undefined
          
          // CRITICAL: If owner can access but public cannot, it's NOT accepted (likely pending or declined)
          if (isOwnerOnlyAccessible) {
            console.log(`Asset ${assetId}: Owner can access but public cannot - checking for decline indicators`)
            // This suggests the asset is pending or declined
            // We need to check library page for explicit status
            actualStatus = 'pending' // Default to pending, will check library page
          }
          // If public access returns 200, check if item is restricted (declined assets might still be accessible but restricted)
          else if (isPubliclyAccessible) {
            // Even if publicly accessible, check if it's restricted - restricted items might be declined
            if (item.isRestricted) {
              console.log(`Asset ${assetId}: Publicly accessible but RESTRICTED - likely DECLINED or pending moderation`)
              actualStatus = 'pending' // Continue to check library page for explicit status
            } else {
              // Item is in catalog, publicly accessible, not restricted - likely ACCEPTED
              // But we already checked library page above, so if we got here, it's probably accepted
              console.log(`Asset ${assetId}: Marking as ACCEPTED - In catalog, publicly accessible, not restricted`)
              actualStatus = 'accepted'
              return {
                success: true,
                data: {
                  assetId,
                  name: item.name || assetName,
                  status: actualStatus,
                  createdAt: item.created || new Date().toISOString(),
                  type,
                },
              }
            }
          }
          // If public access returns 404, asset is declined
          else if (assetDeliveryStatusPublic === 404) {
            console.log(`Asset ${assetId}: Marking as DECLINED - Public Asset Delivery API returned 404 (not publicly accessible)`)
            actualStatus = 'declined'
            // Continue to verify with library page, but strong indicator of decline
          }
          // If item is in catalog but not publicly accessible, check more carefully
          else if (isNotRestricted && (isAvailableForSale || item.isForSale !== false)) {
            // Item is in catalog and available, but we need to verify public accessibility
            // If it's been more than 5 minutes and still not publicly accessible, it might be declined
            if (minutesSinceCreation && minutesSinceCreation > 5) {
              // Check if it's actually publicly accessible
              if (assetDeliveryStatusPublic === 404) {
                console.log(`Asset ${assetId}: Item in catalog but not publicly accessible (404) - likely DECLINED`)
                actualStatus = 'declined'
              } else {
                console.log(`Asset ${assetId}: Item in catalog but public access returned ${assetDeliveryStatusPublic} - keeping as PENDING`)
                actualStatus = 'pending'
              }
            } else {
              console.log(`Asset ${assetId}: Item created ${minutesSinceCreation?.toFixed(1)} minutes ago - keeping as PENDING (might still be processing)`)
              actualStatus = 'pending'
            }
          }
          
          // If item is restricted/limited, it might still be pending or private
          if (item.isRestricted || item.isLimited) {
            console.log(`Asset ${assetId}: Item is restricted/limited - keeping as PENDING`)
            actualStatus = 'pending'
          }
        }
      } else if (catalogResponse.status === 200 && (!catalogResponse.data?.data || catalogResponse.data.data.length === 0)) {
        // Item NOT found in catalog - this is a STRONG indicator it's DECLINED or DELETED
        // Even if publicly accessible, if it's not in catalog, it's likely declined/deleted
        console.log(`Asset ${assetId}: NOT found in Catalog API - likely DECLINED or DELETED`)
        
        // Check library page for explicit deletion/decline messages before finalizing
        // But if not in catalog, it's almost certainly declined
        if (assetDeliveryStatusPublic === 404) {
          console.log(`Asset ${assetId}: Not in catalog and Public Asset Delivery API returned 404 - marking as DECLINED`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        } else {
          // Not in catalog but might still be accessible - check library page for explicit status
          // But mark as declined by default since it's not in catalog
          console.log(`Asset ${assetId}: Not in catalog (even if accessible) - marking as DECLINED (will verify with library page)`)
          actualStatus = 'declined'
          // Continue to library page check to confirm
        }
      }
    } catch (catalogError: any) {
      // Catalog API failed, continue to library page check
    }

    // Fallback: Check library page for explicit status indicators
    try {
      const libraryUrl = `https://www.roblox.com/library/${assetId}`
      const response = await axios.get(libraryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(cookie ? { 'Cookie': `.ROBLOSECURITY=${cookie}` } : {}),
        },
        validateStatus: (status) => status < 500,
        timeout: 3000,
      })

      if (response.status === 404) {
        return {
          success: true,
          data: {
            assetId,
            name: assetName,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          },
        }
      }

      if (response.status === 200) {
        const html = response.data
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i)
        if (nameMatch) {
          assetName = nameMatch[1].trim()
        }
        
        // Check for declined/rejected indicators FIRST (before pending)
        // Common patterns for declined assets:
        // - "This item is not available"
        // - "Item is not available"
        // - "This item is unavailable"
        // - "declined", "rejected", "removed", "blocked", "denied"
        // - "not available for sale"
        // - "no longer available"
              const declinedPatterns = [
                /this item is not available/gi,
                /item is not available/gi,
                /this item is unavailable/gi,
                /not available for sale/gi,
                /no longer available/gi,
                /declined/gi,
                /rejected/gi,
                /removed/gi,
                /blocked/gi,
                /denied/gi,
                /moderation.*declined/gi,
                /has been declined/gi,
                /was declined/gi,
                /has been rejected/gi,
                /was rejected/gi,
                /this item has been removed/gi,
                /content deleted/gi,
                /item deleted/gi,
                /has been deleted/gi,
                /was deleted/gi,
                /moderation.*rejected/gi,
                /content.*removed/gi,
              ]
              
              const hasDeclinedIndicator = declinedPatterns.some(pattern => pattern.test(html))
              
              if (hasDeclinedIndicator) {
                actualStatus = 'declined'
                console.log(`Asset ${assetId} detected as DECLINED based on library page content`)
                return {
                  success: true,
                  data: {
                    assetId,
                    name: assetName,
                    status: actualStatus,
                    createdAt: new Date().toISOString(),
                    type,
                  },
                }
              }
              
              // Also check if the page shows the asset is deleted/removed but still accessible
              // Sometimes declined assets are still accessible but show deletion messages
              if (html.includes('deleted') || html.includes('removed') || html.includes('no longer')) {
                console.log(`Asset ${assetId}: Library page contains deletion/removal indicators`)
                // Even if publicly accessible, if the page says it's deleted, it's declined
                if (assetDeliveryStatusPublic === 200) {
                  // Asset is accessible but page says deleted - check more carefully
                  const deletionPatterns = [
                    /this.*has been.*deleted/gi,
                    /this.*was.*deleted/gi,
                    /content.*has been.*removed/gi,
                    /item.*has been.*removed/gi,
                  ]
                  if (deletionPatterns.some(pattern => pattern.test(html))) {
                    console.log(`Asset ${assetId}: Asset is accessible but marked as deleted - marking as DECLINED`)
                    return {
                      success: true,
                      data: {
                        assetId,
                        name: assetName,
                        status: 'declined',
                        createdAt: new Date().toISOString(),
                        type,
                      },
                    }
                  }
                }
              }
        
        // Check for explicit pending/under review indicators
        const pendingPatterns = [
          /pending/gi,
          /under review/gi,
          /moderation/gi,
          /reviewing/gi,
          /awaiting/gi,
          /being reviewed/gi,
          /in review/gi,
        ]
        
        const hasPendingIndicator = pendingPatterns.some(pattern => pattern.test(html))
        
        if (hasPendingIndicator) {
          actualStatus = 'pending'
          console.log(`Asset ${assetId} detected as PENDING based on library page content`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: actualStatus,
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
        
        // Check public accessibility: if library page exists but public delivery API returns 404, it's declined
        // (Owner can see declined assets on library page, but they're not publicly accessible)
        if (assetDeliveryStatusPublic === 404) {
          console.log(`Asset ${assetId} detected as DECLINED: library page exists but public delivery API returns 404`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
        
        // If owner can access but public cannot, check for explicit decline indicators
        if (assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== 200) {
          console.log(`Asset ${assetId}: Owner can access but public cannot - checking HTML for decline status`)
          // The HTML patterns should catch declined status, but if not, we'll mark as pending
          // This is safer than marking as accepted when it's owner-only accessible
        }
        
        // If page exists but no explicit status indicators found
        // Use PUBLIC Asset Delivery API status as the primary indicator:
        // - Public 200 = publicly accessible = ACCEPTED
        // - Public 404 = not publicly accessible = DECLINED (owner can see but public can't)
        // - Public 403 = exists but not public = PENDING
        // CRITICAL: If owner can access but public cannot, it's NOT accepted
        if (assetDeliveryStatusPublic === 200) {
          console.log(`Asset ${assetId}: Library page exists, Public Asset Delivery API returned 200 - marking as ACCEPTED`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'accepted',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        } else if (assetDeliveryStatusPublic === 404) {
          // Public can't access but library page exists - likely declined (owner can still see it)
          console.log(`Asset ${assetId}: Library page exists but public cannot access (404) - marking as DECLINED`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        } else if (assetDeliveryStatusPublic === 403) {
          console.log(`Asset ${assetId}: Library page exists, Public Asset Delivery API returned 403 - marking as PENDING`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'pending',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        } else if (assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== 200) {
          // Owner can access but public cannot - this is a strong indicator it's NOT accepted
          console.log(`Asset ${assetId}: Owner can access but public cannot - marking as DECLINED (not publicly accessible)`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'declined',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        } else {
          // No clear indicator, default to pending
          console.log(`Asset ${assetId}: No clear status indicator, defaulting to PENDING`)
          return {
            success: true,
            data: {
              assetId,
              name: assetName,
              status: 'pending',
              createdAt: new Date().toISOString(),
              type,
            },
          }
        }
      }
    } catch (htmlError: any) {
      // Library page check failed, continue
    }

    // Final fallback: Use PUBLIC Asset Delivery API status if we have it
    // CRITICAL: Use public status, not authenticated status (owner can see declined assets)
    if (assetDeliveryStatusPublic === 200) {
      console.log(`Asset ${assetId}: Final fallback - Public Asset Delivery API returned 200, marking as ACCEPTED`)
      return {
        success: true,
        data: {
          assetId,
          name: assetName,
          status: 'accepted',
          createdAt: new Date().toISOString(),
          type,
        },
      }
    } else if (assetDeliveryStatusPublic === 404) {
      // Public can't access - if owner can, it's declined (not publicly accessible)
      if (assetDeliveryStatusAuth === 200) {
        console.log(`Asset ${assetId}: Final fallback - Owner can access but public cannot (404), marking as DECLINED`)
        return {
          success: true,
          data: {
            assetId,
            name: assetName,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          },
        }
      } else {
        console.log(`Asset ${assetId}: Final fallback - Public Asset Delivery API returned 404, marking as DECLINED`)
        return {
          success: true,
          data: {
            assetId,
            name: assetName,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          },
        }
      }
    } else if (assetDeliveryStatusPublic === 403) {
      console.log(`Asset ${assetId}: Final fallback - Public Asset Delivery API returned 403, marking as PENDING`)
      return {
        success: true,
        data: {
          assetId,
          name: assetName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          type,
        },
      }
    }
    
    // If we can't determine status and have no delivery API status, default to pending
    console.log(`Asset ${assetId}: Unable to determine status, defaulting to PENDING`)
    return {
      success: true,
      data: {
        assetId,
        name: assetName,
        status: 'pending',
        createdAt: new Date().toISOString(),
        type,
      },
    }
  } catch (error: any) {
    console.error('Error checking asset status:', error)
    return {
      success: false,
      error: error.message || 'Failed to check asset status',
    }
  }
})

function parseStatus(data: any): 'pending' | 'accepted' | 'declined' {
  const status = data.moderationStatus || data.moderationResult || data.status || data.reviewStatus
  
  if (!status) {
    if (data.id || data.assetId) {
      return 'accepted'
    }
    return 'pending'
  }

  const statusLower = String(status).toLowerCase()
  
  if (statusLower.includes('approved') || statusLower.includes('accepted') || statusLower === 'approved') {
    return 'accepted'
  }
  if (statusLower.includes('rejected') || statusLower.includes('declined') || statusLower === 'rejected') {
    return 'declined'
  }
  if (statusLower.includes('reviewing') || statusLower.includes('pending') || statusLower === 'reviewing') {
    return 'pending'
  }
  
  return 'pending'
}

// IPC handler for testing cookie (bypasses CORS)
ipcMain.handle('test-cookie', async (event, cookie: string) => {
  try {
    if (!cookie || cookie.trim() === '') {
      return { valid: false, error: 'Cookie is empty' }
    }

    // Test cookie by trying to get authenticated user info
    const response = await axios.get(
      'https://users.roblox.com/v1/users/authenticated',
      {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
        },
        timeout: 10000,
        validateStatus: (status: number) => status < 500,
      }
    )

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Cookie is invalid or expired' }
    }

    if (response.status === 200 && response.data) {
      return { 
        valid: true,
        userId: response.data.id?.toString() || '',
        username: response.data.name || '',
      }
    }

    return { valid: false, error: `Unexpected response: ${response.status}` }
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        return { valid: false, error: 'Cookie is invalid or expired' }
      }
      return { valid: false, error: `Cookie test failed: ${error.response.status}` }
    }
    
    if (error.message?.includes('timeout')) {
      return { valid: false, error: 'Request timed out. Check your internet connection.' }
    }
    
    if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch') || error.code === 'ERR_NETWORK') {
      return { 
        valid: false, 
        error: 'Network error. The cookie format looks correct, but we cannot verify it due to network issues.' 
      }
    }

    return { valid: false, error: error.message || 'Failed to test cookie' }
  }
})

// IPC handler for uploading assets (bypasses CORS)
ipcMain.handle('upload-asset', async (event, { 
  fileData, 
  fileName, 
  assetType, 
  cookie, 
  userId, 
  groupId,
  description
}: { 
  fileData: Uint8Array | number[] | ArrayLike<number> // ArrayBuffer as Uint8Array for IPC (supports both typed arrays and regular arrays)
  fileName: string
  assetType: 'Audio' | 'Decal'
  cookie: string
  userId?: string
  groupId?: string
  description?: string
}) => {
  try {
    console.log('IPC upload-asset called:', {
      fileName,
      assetType,
      fileDataLength: fileData?.length,
      hasCookie: !!cookie,
      userId,
      groupId,
    })

    if (!cookie || cookie.trim() === '') {
      return { success: false, error: 'Cookie is required' }
    }

    if (!fileData || fileData.length === 0) {
      return { success: false, error: 'File data is empty' }
    }

    // Validate cookie by checking authentication
    try {
      const authCheck = await axios.get('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
        },
        validateStatus: () => true,
      })
      
      if (authCheck.status !== 200 || !authCheck.data?.id) {
        console.error('Cookie validation failed:', authCheck.status, authCheck.data)
        return { 
          success: false, 
          error: 'Cookie is invalid or expired. Please update your cookie in Settings.' 
        }
      }
      
      const authenticatedUser = authCheck.data
      console.log('✅ Cookie validated - User ID:', authenticatedUser.id)
      console.log('✅ User name:', authenticatedUser.name)
      
      // Note: Audio uploads require a verified account (email + phone/ID)
      // Unverified accounts may receive 500 errors with isValid: false
      // We can't check verification status via API, but the upload will fail if account is unverified
    } catch (authError: any) {
      console.error('❌ Cookie validation check failed:', authError.message)
      return { 
        success: false, 
        error: 'Failed to validate cookie. Please check your .ROBLOSECURITY cookie in Settings.' 
      }
    }

    // Convert Uint8Array to Buffer
    const buffer = Buffer.from(fileData)
    const fileSizeMB = buffer.length / (1024 * 1024)
    console.log('Buffer created, size:', buffer.length, `(${fileSizeMB.toFixed(2)}MB)`)
    
    // Validate file size - Roblox has a 20 MB limit for audio files
    if (assetType === 'Audio' && fileSizeMB > 20) {
      return { 
        success: false, 
        error: `File size (${fileSizeMB.toFixed(2)}MB) exceeds Roblox's 20 MB limit for audio files` 
      }
    }

    // Fetch CSRF token first
    let csrfToken = ''
    try {
      const csrfResponse = await axios.post(
        'https://auth.roblox.com/v2/logout',
        {},
        {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
          },
          validateStatus: () => true,
        }
      )
      csrfToken = csrfResponse.headers['x-csrf-token'] || ''
      if (!csrfToken) {
        console.warn('⚠️ CSRF token not obtained - upload may fail')
      } else {
        console.log('✅ CSRF token obtained')
      }
    } catch (csrfError) {
      console.warn('Failed to fetch CSRF token:', csrfError)
    }

    // Create FormData in Node.js
    const assetName = fileName.replace(/\.[^/.]+$/, '')
    console.log('Asset name extracted:', assetName)
    
    // CRITICAL: Roblox has two separate upload systems:
    // - Audio: publish.roblox.com/v1/audio (Publishing Service)
    // - Images, meshes, models, videos: apis.roblox.com/assets/v1/upload (Assets API)
    // Sending audio to the Assets API endpoint returns 404 with blank error
    const endpoint = assetType === 'Audio'
      ? 'https://publish.roblox.com/v1/audio'
      : 'https://apis.roblox.com/assets/v1/upload'
    
    console.log('Using endpoint for', assetType + ':', endpoint)
    const endpoints = [endpoint]
    
    let lastError: any = null
    let response: any = null
    
    for (const endpoint of endpoints) {
      try {
        // Verify buffer is valid
        if (!buffer || buffer.length === 0) {
          console.error('ERROR: Buffer is empty or invalid')
          lastError = { response: { data: { error: 'File buffer is empty' }, status: 400 } }
          response = null
          continue
        }
        
        // Detect correct Content-Type from file extension (for reference/logging)
        let contentType = 'audio/mpeg' // Default for audio
        const fileExtension = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1] || ''
        if (assetType === 'Audio') {
          if (fileExtension === 'mp3') {
            contentType = 'audio/mpeg'
          } else if (fileExtension === 'ogg') {
            contentType = 'audio/ogg'
          } else if (fileExtension === 'wav') {
            contentType = 'audio/wav'
          } else if (fileExtension === 'm4a') {
            contentType = 'audio/mp4'
          } else {
            contentType = 'audio/mpeg'
            console.warn(`Unknown audio extension: ${fileExtension}, defaulting to audio/mpeg`)
          }
        } else {
          contentType = 'image/png' // Default for decals
        }
        
        console.log('File info - Extension:', fileExtension, 'Content-Type:', contentType, 'FileName:', fileName)
        
        // CRITICAL: publish.roblox.com/v1/audio endpoint requires JSON, NOT multipart/form-data!
        // The API expects:
        // - Content-Type: application/json
        // - Body: JSON with base64-encoded file string
        // - Fields: name (string), file (base64 string), groupId (integer, optional)
        
        if (assetType === 'Audio') {
          // Audio endpoint (publish.roblox.com/v1/audio) expects JSON:
          // {
          //   "name": "AssetName",
          //   "file": "base64-encoded-file-content",
          //   "groupId": 123456 (optional, integer)
          // }
          // Content-Type: application/json (NOT multipart/form-data)
          
          // Ensure buffer is a proper Node.js Buffer
          const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
          
          // Convert buffer to base64 string (pure base64, no data URI prefix)
          const base64File = fileBuffer.toString('base64')
          
          console.log('Preparing JSON request for audio upload')
          console.log('  - File size:', fileBuffer.length, 'bytes')
          console.log('  - Base64 length:', base64File.length, 'characters')
          console.log('  - Asset name:', assetName)
          console.log('  - Description:', description || '(not provided)')
          
          // Build JSON request body
          const requestBody: any = {
            name: assetName,
            file: base64File,
            estimatedFileSize: fileBuffer.length,
          }
          
          // Add description if provided (Roblox API may support this field)
          if (description && description.trim()) {
            requestBody.description = description.trim()
            console.log('  - Description added to request:', description.trim().substring(0, 50) + '...')
          }
          
          // Add groupId if provided (must be integer, not string)
          if (groupId && groupId.trim()) {
            const groupIdInt = parseInt(groupId.trim(), 10)
            if (!isNaN(groupIdInt)) {
              requestBody.groupId = groupIdInt
              console.log('  - Group ID:', groupIdInt)
            } else {
              console.warn('Invalid groupId, skipping:', groupId)
            }
          }
          
          const requestFields = ['name', 'file', 'estimatedFileSize']
          if (requestBody.description) requestFields.push('description')
          if (requestBody.groupId) requestFields.push('groupId')
          console.log('JSON request body prepared (fields: ' + requestFields.join(', ') + ')')
          
          // Build headers for JSON request
          const headers: any = {
            'Content-Type': 'application/json', // CRITICAL: Must be application/json, not multipart/form-data
          }
          
          // Cookie must be in the format: .ROBLOSECURITY=<cookie-value>
          let cookieHeader = cookie.trim()
          if (!cookieHeader.startsWith('.ROBLOSECURITY=')) {
            cookieHeader = `.ROBLOSECURITY=${cookieHeader}`
          }
          headers['Cookie'] = cookieHeader
          
          if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken
          }
          
          // Additional headers
          headers['User-Agent'] = 'Roblox/WinInet'
          headers['Origin'] = 'https://create.roblox.com'
          headers['Referer'] = 'https://create.roblox.com/'
          
          console.log('Request headers:', Object.keys(headers))
          console.log('Content-Type: application/json (NOT multipart/form-data)')
          
          // Calculate timeout based on file size
          const uploadTimeout = Math.min(Math.max(60000, fileSizeMB * 1000 * 5), 600000)
          console.log(`Upload timeout set to ${uploadTimeout / 1000}s for ${fileSizeMB.toFixed(2)}MB file`)
          
          // Make JSON POST request using axios
          try {
            console.log('Sending JSON request to:', endpoint)
            response = await axios.post(
              endpoint,
              requestBody,
              {
                headers,
                timeout: uploadTimeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: () => true,
              }
            )
            
            console.log('Response status:', response.status)
            console.log('Response headers:', JSON.stringify(response.headers, null, 2))
          } catch (axiosError: any) {
            console.error('JSON upload error:', axiosError.message)
            lastError = { response: { data: axiosError.response?.data || { error: axiosError.message }, status: axiosError.response?.status || 500 } }
            response = null
            continue
          }
        } else {
          // For images: Create FormData and use multipart/form-data
          // Assets API endpoint (apis.roblox.com/assets/v1/upload) uses multipart/form-data
          
          // Create FormData and patch maxDataSize to allow large files
          const formData = new FormData()
          Object.defineProperty(formData, 'maxDataSize', {
            value: Infinity,
            writable: true,
            configurable: true
          })
          
          // Append file to FormData
          formData.append('file', buffer, {
            filename: fileName,
            contentType: contentType,
          })
          
          // Assets API form fields:
          // - file: The image file (required)
          // - assetType: Numeric ID - "1" for Image (required)
          // - name: Asset name (required)
          // - description: Asset description (optional)
          // - isPublic: "true" or "false" (optional, defaults to false)
          // - groupId: Group ID if uploading to group (optional)
          
          const assetTypeId = '1' // Image = 1
          formData.append('assetType', assetTypeId)
          formData.append('name', assetName)
          
          // Description (optional)
          const assetDescription = description && description.trim() 
            ? description.trim() 
            : ''
          if (assetDescription) {
            formData.append('description', assetDescription)
          }
          
          formData.append('isPublic', 'false')
          
          if (groupId) {
            formData.append('groupId', groupId.trim())
            console.log('Uploading to group:', groupId)
          }
          
          console.log('Image upload form fields: file, assetType, name, description, isPublic', groupId ? ', groupId' : '')
          console.log(`Asset type ID: ${assetTypeId} (Image)`)
          
          // Get FormData headers (includes Content-Type with boundary)
          const formDataHeaders = formData.getHeaders()
          
          // Build headers - FormData headers first, then authentication
          const headers: any = {
            ...formDataHeaders, // This includes Content-Type with correct boundary
          }
          
          // Cookie must be in the format: .ROBLOSECURITY=<cookie-value>
          let cookieHeader = cookie.trim()
          if (!cookieHeader.startsWith('.ROBLOSECURITY=')) {
            cookieHeader = `.ROBLOSECURITY=${cookieHeader}`
          }
          headers['Cookie'] = cookieHeader
          
          if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken
          }
          
          // Additional headers required for Assets API
          headers['User-Agent'] = 'Roblox/WinInet'
          headers['Origin'] = 'https://create.roblox.com'
          headers['Referer'] = 'https://create.roblox.com/'
          
          // Log upload details
          console.log('Uploading to endpoint:', endpoint)
          console.log('File size:', buffer.length, 'bytes (', fileSizeMB.toFixed(2), 'MB)')
          console.log('Asset name:', assetName)
          console.log('Asset type:', assetType)
          console.log('Content-Type:', headers['content-type'] || headers['Content-Type'])
          
          // Calculate timeout based on file size
          const uploadTimeout = Math.min(Math.max(60000, fileSizeMB * 1000 * 5), 600000)
          console.log(`Upload timeout set to ${uploadTimeout / 1000}s for ${fileSizeMB.toFixed(2)}MB file`)
          
          // Make multipart/form-data POST request using axios
          try {
            response = await axios.post(
              endpoint,
              formData,
              {
                headers,
                timeout: uploadTimeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: () => true,
              }
            )
            
            console.log('Response status:', response.status)
            console.log('Response headers:', JSON.stringify(response.headers, null, 2))
          } catch (axiosError: any) {
            console.error('Axios upload error:', axiosError.message)
            lastError = { response: { data: axiosError.response?.data || { error: axiosError.message }, status: axiosError.response?.status || 500 } }
            response = null
            continue
          }
        }
        
        // Modern Assets API returns JSON responses
        // Check response data type first
        let responseText = ''
        let responseJson: any = null
        
        if (typeof response.data === 'string') {
          responseText = response.data
          console.log('Response data (text):', responseText.substring(0, 200)) // Log first 200 chars
          // Try to parse as JSON
          try {
            responseJson = JSON.parse(responseText)
            console.log('Response data (parsed JSON):', JSON.stringify(responseJson, null, 2))
          } catch (e) {
            // Not JSON, treat as plain text
            console.log('Response is plain text (not JSON)')
          }
        } else {
          responseJson = response.data
          console.log('Response data (object):', JSON.stringify(response.data, null, 2))
        }
        
        // Check for success (modern Assets API returns JSON)
        if (response.status >= 200 && response.status < 300) {
          // Modern Assets API returns JSON with asset information
          // Response format: { "id": 123456789, "name": "AssetName", ... }
          const assetId = responseJson?.id 
            || responseJson?.Id 
            || responseJson?.assetId
            || responseJson?.path?.match(/\/(\d+)/)?.[1] // Extract ID from path if present
          
          if (assetId) {
            console.log(`✅ SUCCESS - Upload completed!`)
            console.log(`Asset ID: ${assetId}`)
            console.log(`Asset name: ${responseJson?.name || assetName}`)
            
            // If description was provided and assetType is Audio, try to update the description
            // The publish.roblox.com/v1/audio endpoint may not support description in the initial upload
            // So we'll try to update it after upload using the Asset Configuration API
            if (assetType === 'Audio' && description && description.trim()) {
              try {
                console.log('Attempting to update audio asset description...')
                
                // Prepare cookie header for update request
                let updateCookieHeader = cookie.trim()
                if (!updateCookieHeader.startsWith('.ROBLOSECURITY=')) {
                  updateCookieHeader = `.ROBLOSECURITY=${updateCookieHeader}`
                }
                
                // Try to update asset description using the Asset Configuration API
                // Endpoint: POST https://www.roblox.com/asset/update
                const updateResponse = await axios.post(
                  'https://www.roblox.com/asset/update',
                  {
                    assetId: parseInt(assetId, 10),
                    description: description.trim(),
                  },
                  {
                    headers: {
                      'Cookie': updateCookieHeader,
                      'Content-Type': 'application/json',
                      'X-CSRF-TOKEN': csrfToken || '',
                      'User-Agent': 'Roblox/WinInet',
                      'Origin': 'https://www.roblox.com',
                      'Referer': 'https://www.roblox.com/',
                    },
                    validateStatus: () => true,
                    timeout: 10000,
                  }
                )
                
                if (updateResponse.status === 200) {
                  console.log('✅ Asset description updated successfully')
                } else {
                  console.warn('⚠️ Failed to update asset description:', updateResponse.status, updateResponse.data)
                  // Don't fail the upload if description update fails - upload was successful
                }
              } catch (updateError: any) {
                console.warn('⚠️ Error updating asset description:', updateError.message)
                // Don't fail the upload if description update fails - upload was successful
              }
            }
            
            // Store the full response in response.data for later extraction
            response.data = { 
              id: assetId, 
              Id: assetId, 
              assetId: assetId,
              name: responseJson?.name || assetName,
              ...responseJson 
            }
            break // Success! Exit endpoint loop
          }
          
          // Check for error in successful status code
          if (responseJson?.error) {
            console.error('Error in response:', responseJson.error)
            lastError = { response: { data: responseJson, status: response.status } }
            response = null
            continue
          }
          
          // No asset ID found
          console.error('No asset ID in successful response')
          console.error('Response data:', JSON.stringify(responseJson, null, 2))
          lastError = { response: { data: responseJson || responseText, status: response.status } }
          response = null
          continue
        } else if (response.status === 400) {
          // Handle 400 errors with specific error codes
          let errorData: any = null
          try {
            errorData = responseJson || (typeof response.data === 'string' ? JSON.parse(response.data) : response.data)
          } catch (e) {
            errorData = { raw: response.data }
          }
          
          const errorCode = errorData?.errors?.[0]?.code
          const errorMsg = errorData?.errors?.[0]?.message || ''
          console.log(`400 error on endpoint:`, endpoint)
          console.log('Error code:', errorCode)
          console.log('Error message:', errorMsg)
          console.log('Full error response:', JSON.stringify(errorData, null, 2))
          
          if (errorCode === 3) {
            // Error code 3: The request did not contain a file to be uploaded
            // This is a TECHNICAL error - the file wasn't sent correctly in the request
            // NOT a content/moderation issue (pitch-shifted audio would be rejected with different codes)
            console.error('Error code 3: File not detected by Roblox server')
            console.error('This means the FormData request did not include the file properly')
            console.error('Check: FormData construction, headers, and file field name')
            lastError = { response: { data: errorData, status: response.status } }
            response = null
            continue
          } else if (errorCode === 4) {
            // Error code 4: File too large
            throw new Error(`File too large. Roblox error: ${errorMsg}`)
          } else if (errorCode === 5) {
            // Error code 5: Audio duration too long
            throw new Error(`Audio duration too long. Roblox error: ${errorMsg}`)
          } else if (errorCode === 8) {
            // Error code 8: File type not supported
            // Could be format issue (not MP3/OGG) or corrupted file
            throw new Error(`File type not supported. Roblox error: ${errorMsg}. Ensure the file is a valid MP3, OGG, WAV, or M4A file.`)
          } else if (errorCode === 9) {
            // Error code 9: File corrupted
            // File is corrupted or unreadable
            throw new Error(`File is corrupted or unreadable. Roblox error: ${errorMsg}. Try re-encoding the audio file.`)
          } else if (errorCode === 15) {
            // Error code 15: The audio file has already been reviewed and rejected
            // This is a content/moderation issue, not a technical issue
            throw new Error(`Audio file was rejected by moderation. Roblox error: ${errorMsg}. This may be due to content, pitch distortion, or other moderation reasons.`)
          }
          
          // Other 400 errors - try next endpoint
          lastError = { response: { data: errorData, status: response.status } }
          response = null
          continue
        } else if (response.status === 404) {
          console.log('404 on endpoint:', endpoint, '- trying next endpoint')
          lastError = { response: { data: responseJson || responseText || response.data, status: response.status } }
          response = null
          continue
        } else if (response.status === 500) {
          // 500 errors - log the full response to understand what went wrong
          console.error(`❌ 500 Internal Server Error on endpoint:`, endpoint)
          console.error('Response data type:', typeof response.data)
          console.error('Response data:', responseJson || responseText || JSON.stringify(response.data, null, 2))
          
          // Check if this is an authentication issue
          const responseHeaders = response.headers || {}
          const setCookieHeaders = responseHeaders['set-cookie'] || []
          const guestDataCookie = setCookieHeaders.find((c: string) => c.includes('GuestData'))
          
          if (guestDataCookie && guestDataCookie.includes('UserID=-')) {
            console.error('⚠️ AUTHENTICATION ISSUE DETECTED:')
            console.error('  - Response contains GuestData cookie (indicates not authenticated)')
            console.error('  - Your cookie may be invalid, expired, or not properly authenticated')
            console.error('  - Please verify your .ROBLOSECURITY cookie in Settings')
            lastError = { 
              response: { 
                data: { 
                  error: 'Authentication failed. Your cookie may be invalid or expired. Please update your cookie in Settings.',
                  isValid: false 
                }, 
                status: response.status 
              } 
            }
            response = null
            break // Don't try other endpoints if auth is the issue
          }
          
          // Check for specific error codes in the response
          if (responseJson?.isValid === false) {
            console.error('⚠️ Roblox returned isValid: false')
            console.error('  - Possible causes:')
            console.error('    1. File format/corruption - the file may be invalid or corrupted')
            console.error('    2. File encoding issue - the file might not be properly encoded')
            console.error('    3. File size/duration limits exceeded')
            console.error('    4. Content moderation - the file may violate Roblox guidelines')
            console.error('    5. Server-side validation failed - Roblox could not process the file')
            console.error('')
            console.error('  - Troubleshooting:')
            console.error('    • Verify the file plays correctly in a media player')
            console.error('    • Try re-encoding the audio file')
            console.error('    • Try uploading a smaller test file')
            console.error('    • Check if the file format is supported (MP3/OGG/WAV/M4A)')
          }
          
          console.error('FormData was sent with:')
          console.error('  - File field: "file"')
          console.error('  - Name field: "name"')
          console.error('  - Buffer size:', buffer.length, 'bytes')
          console.error('  - Content-Type header was set by FormData.getHeaders()')
          lastError = { response: { data: responseJson || responseText || response.data, status: response.status } }
          response = null
          continue
        } else {
          // Other error status codes
          console.log(`Unexpected status ${response.status} on endpoint:`, endpoint)
          console.log('Response data:', responseJson || responseText || JSON.stringify(response.data, null, 2))
          lastError = { response: { data: responseJson || responseText || response.data, status: response.status } }
          response = null
          continue
        }
      } catch (error: any) {
        console.error(`Exception during upload to endpoint: ${endpoint}`, error.message)
        if (error.response) {
          console.error('Error response status:', error.response.status)
          
          // Parse error response
          let errorResponseData: any = null
          try {
            if (typeof error.response.data === 'string') {
              errorResponseData = JSON.parse(error.response.data)
            } else {
              errorResponseData = error.response.data
            }
          } catch (e) {
            errorResponseData = { raw: error.response.data }
          }
          
          console.error('Error response data:', JSON.stringify(errorResponseData, null, 2))
          console.error('Error response headers:', JSON.stringify(error.response.headers, null, 2))
          
          // Handle specific error codes from error response
          if (error.response.status === 400) {
            const errorCode = errorResponseData?.errors?.[0]?.code
            if (errorCode === 4) {
              // File too large - don't try other endpoints
              throw new Error(`File too large. Roblox error: ${errorResponseData?.errors?.[0]?.message || ''}`)
            }
          } else if (error.response.status === 500) {
            // Log 500 errors in detail
            console.error('500 error details:', {
              endpoint,
              data: errorResponseData,
              headers: error.response.headers
            })
          }
        } else {
          // Network error or other non-HTTP error
          console.error('Non-HTTP error:', error.message)
          console.error('Error stack:', error.stack)
        }
        lastError = error
        response = null
        continue
      }
      
      // If we got a successful response with asset ID, break out of endpoint loop
      if (response && response.status >= 200 && response.status < 300 && (response.data?.Id || response.data?.assetId || response.data?.id)) {
        break
      }
    }
    
    // If upload failed, return detailed error
    if (!response) {
      console.error('Upload failed on all endpoints')
      console.error('Last error:', lastError)
      
      // Extract error message from last error
      let errorMsg = 'Upload failed'
      
      if (lastError?.response?.data) {
        const errorData = lastError.response.data
        
        // Check for authentication error message we set earlier
        if (errorData.error && errorData.error.includes('Authentication failed')) {
          errorMsg = errorData.error
        } else if (errorData.isValid === false && lastError?.response?.status === 500) {
          // 500 error with isValid: false - likely authentication or server issue
          errorMsg = 'Upload failed: Roblox server returned an error. This may be due to:\n' +
                    '• Invalid or expired cookie - please update your cookie in Settings\n' +
                    '• File format issue - ensure the file is a valid MP3/OGG/WAV/M4A\n' +
                    '• File size/duration limits exceeded\n' +
                    '• Temporary Roblox server issue - try again later'
        } else {
          const errorCode = errorData?.errors?.[0]?.code
          const errorMessage = errorData?.errors?.[0]?.message
          
          if (errorCode && errorMessage) {
            errorMsg = `Error code ${errorCode}: ${errorMessage}`
          } else if (errorMessage) {
            errorMsg = errorMessage
          } else if (errorData.error) {
            errorMsg = errorData.error
          } else if (typeof errorData === 'string') {
            errorMsg = errorData
          } else {
            errorMsg = `Upload failed: ${JSON.stringify(errorData)}`
          }
        }
      } else if (lastError?.message) {
        errorMsg = lastError.message
      }
      
      return {
        success: false,
        error: errorMsg,
      }
    }

    // Extract asset ID from response
    // Modern Assets API returns JSON with asset information: { "id": 123456789, "name": "...", ... }
    let assetId: string | null = null
    
    // Modern API always returns JSON, but we handle both for safety
    if (typeof response.data === 'string') {
      // Plain text response (shouldn't happen with modern API, but handle it)
      const idMatch = response.data.trim().match(/^(\d+)$/)
      if (idMatch && idMatch[1]) {
        assetId = idMatch[1]
        console.log('✅ Asset ID found in plain text response:', assetId)
      }
    } else if (response.data) {
      // JSON response from modern Assets API
      // Response format: { "id": 123456789, "name": "AssetName", ... }
      assetId = response.data.id 
        || response.data.Id 
        || response.data.assetId
        || response.data?.path?.match(/\/(\d+)/)?.[1] // Extract ID from path if present
        || response.data?.Path?.match(/\/(\d+)/)?.[1]
        || null
      
      if (assetId) {
        console.log('✅ Asset ID found in JSON response:', assetId)
      }
    }
    
    // Check Location header as fallback
    if (!assetId && (response.headers?.location || response.headers?.Location)) {
      const locationHeader = response.headers.location || response.headers.Location
      const locationMatch = locationHeader.match(/(\d+)/)
      if (locationMatch && locationMatch[1]) {
        assetId = locationMatch[1]
        console.log('✅ Asset ID found in Location header:', assetId)
      }
    }

    if (assetId) {
      return {
        success: true,
        assetId,
        status: 'pending',
      }
    }

    // No asset ID found - return error with response details
    console.error('❌ No asset ID found in response')
    console.error('Response status:', response.status)
    console.error('Response data:', typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data, null, 2))
    
    return {
      success: false,
      error: 'Upload completed but no asset ID was returned. The file may have been uploaded successfully - check your Roblox inventory.',
    }
  } catch (error: any) {
    console.error('Upload error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    })
    
    // Calculate file size for error messages (fileData is available in this scope)
    const fileSizeMB = fileData ? fileData.length / (1024 * 1024) : 0
    
    if (error.response) {
      const errorMessage = error.response.data?.errors?.[0]?.message
        || error.response.data?.message
        || error.response.data?.error
        || `Upload failed: ${error.response.status}`
      
      return {
        success: false,
        error: errorMessage,
        statusCode: error.response.status,
      }
    }

    // Check for timeout errors (common with large files)
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return {
        success: false,
        error: `Upload timed out. The file (${fileSizeMB.toFixed(2)}MB) may be too large or your connection is too slow. Try a smaller file or check your internet connection.`,
      }
    }
    
    // Check for specific network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: 'Cannot connect to Roblox servers. Check your internet connection.',
      }
    }
    
    // Check for file size errors from Roblox API
    if (error.response?.data?.errors?.[0]?.code === 4) {
      return {
        success: false,
        error: `File is too large (${fileSizeMB.toFixed(2)}MB). Roblox has file size limits based on your account type. Try a smaller file.`,
      }
    }

    return {
      success: false,
      error: error.message || 'Network error during upload',
    }
  }
})

// IPC handler for deleting assets (bypasses CORS)
ipcMain.handle('delete-asset', async (event, { assetId, cookie }: { assetId: string | number, cookie: string }) => {
  // Convert assetId to string if it's a number
  const assetIdStr = String(assetId)
  console.log('IPC delete-asset called:', { assetId: assetIdStr, hasCookie: !!cookie })

  if (!cookie || cookie.trim() === '') {
    return { success: false, error: 'Cookie is required' }
  }

  if (!assetIdStr || assetIdStr.trim() === '') {
    return { success: false, error: 'Asset ID is required' }
  }

  try {
    // Get CSRF token first (required for delete operations)
    let csrfToken = ''
    try {
      const csrfResponse = await axios.post(
        'https://auth.roblox.com/v2/logout',
        {},
        {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
          },
          validateStatus: () => true, // Don't throw on any status
        }
      )
      csrfToken = csrfResponse.headers['x-csrf-token'] || ''
      console.log('CSRF token obtained:', csrfToken ? 'Yes' : 'No')
    } catch (csrfError: any) {
      console.warn('Failed to fetch CSRF token for delete:', csrfError.message)
    }

    // Try multiple possible delete endpoints
    const endpoints = [
      `https://www.roblox.com/asset/delete/${assetIdStr}`,
      `https://www.roblox.com/asset/${assetIdStr}/delete`,
      `https://assetdelivery.roblox.com/v1/asset/${assetIdStr}`,
    ]

    const headers: any = {
      'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
      'Content-Type': 'application/json',
    }

    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken
    }

    let response: any = null
    let lastError: any = null

    // Try DELETE method first
    for (const endpoint of endpoints) {
      try {
        console.log('Attempting to delete asset:', assetIdStr)
        console.log('Trying endpoint:', endpoint)
        console.log('Method: DELETE')
        console.log('Has CSRF token:', !!csrfToken)

        response = await axios.delete(endpoint, { 
          headers,
          validateStatus: (status) => status < 500, // Don't throw on 400/403
        })

        console.log('Delete response status:', response.status)
        console.log('Delete response data:', JSON.stringify(response.data, null, 2))

        if (response.status === 200 || response.status === 204) {
          console.log('Asset deleted successfully with DELETE method')
          return { success: true }
        }

        // If 404, try next endpoint
        if (response.status === 404) {
          console.log('404 on endpoint, trying next...')
          lastError = { response: { data: response.data, status: response.status } }
          response = null
          continue
        }

        // If 403, might need POST instead
        if (response.status === 403) {
          console.log('403 on DELETE, will try POST method...')
          lastError = { response: { data: response.data, status: response.status } }
          response = null
          break // Exit loop to try POST
        }
      } catch (error: any) {
        console.log('Error with DELETE on endpoint:', endpoint, error.message)
        lastError = error
        response = null
        continue
      }
    }

    // If DELETE didn't work, try POST method (some APIs use POST for delete)
    if (!response || response.status === 403) {
      for (const endpoint of endpoints) {
        try {
          console.log('Trying POST method on endpoint:', endpoint)
          
          response = await axios.post(
            endpoint,
            { assetId },
            { 
              headers,
              validateStatus: (status) => status < 500,
            }
          )

          console.log('POST delete response status:', response.status)
          console.log('POST delete response data:', JSON.stringify(response.data, null, 2))

          if (response.status === 200 || response.status === 204) {
            console.log('Asset deleted successfully with POST method')
            return { success: true }
          }

          if (response.status === 404) {
            console.log('404 on POST endpoint, trying next...')
            lastError = { response: { data: response.data, status: response.status } }
            response = null
            continue
          }
        } catch (error: any) {
          console.log('Error with POST on endpoint:', endpoint, error.message)
          lastError = error
          response = null
          continue
        }
      }
    }

    // If we got here, all methods failed
    if (response) {
      // Handle specific error cases
      if (response.status === 403) {
        const errorMsg = response.data?.errors?.[0]?.message || response.data?.message || 'Forbidden - may need CSRF token or proper permissions'
        console.error('Delete failed: Forbidden', errorMsg)
        return { success: false, error: errorMsg }
      }

      if (response.status === 404) {
        const errorMsg = response.data?.errors?.[0]?.message || response.data?.message || 'Asset not found or already deleted'
        console.error('Delete failed: Not Found', errorMsg)
        return { success: false, error: errorMsg }
      }

      // Check response data for error messages
      if (response.data) {
        const errorMsg = response.data.errors?.[0]?.message || response.data.message || response.data.error || `HTTP ${response.status}`
        console.error('Delete failed:', errorMsg)
        return { success: false, error: errorMsg }
      }

      return { success: false, error: `Unexpected status: ${response.status}` }
    }

    // No response from any endpoint
    const finalError = lastError?.response?.data?.errors?.[0]?.message 
      || lastError?.response?.data?.message 
      || lastError?.message 
      || 'All delete methods failed'
    console.error('Delete failed: All methods failed', finalError)
    return { success: false, error: finalError }
  } catch (error: any) {
    console.error('Error deleting asset:', error)
    
    // Provide more detailed error information
    if (error.response) {
      const status = error.response.status
      const errorMsg = error.response.data?.errors?.[0]?.message 
        || error.response.data?.message 
        || error.response.data?.error
        || `HTTP ${status}`
      console.error(`Delete failed (${status}):`, errorMsg)
      return { success: false, error: errorMsg }
    } else {
      console.error('Delete failed:', error.message)
      return { success: false, error: error.message || 'Network error during delete' }
    }
  }
})

// IPC handler for opening external URLs
ipcMain.handle('open-external', async (event, url: string) => {
  await shell.openExternal(url)
})

// All IPC handlers are registered above (at module load time)
// This ensures they're available before any renderer process tries to use them
console.log('IPC handlers registered. upload-asset handler is available.')

// Start backend server (only in production/packaged mode)
function startServer() {
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  // Only start server automatically in production
  if (!isDev) {
    try {
      const fs = require('fs')
      
      // Try multiple possible paths for server files
      const possiblePaths = [
        path.join(process.resourcesPath, 'server', 'dist', 'server.js'),
        path.join(__dirname, '..', 'server', 'dist', 'server.js'),
        path.join(app.getAppPath(), 'server', 'dist', 'server.js'),
        path.join(process.resourcesPath, 'app', 'server', 'dist', 'server.js'),
      ]
      
      const possibleDirs = [
        path.join(process.resourcesPath, 'server'),
        path.join(__dirname, '..', 'server'),
        path.join(app.getAppPath(), 'server'),
        path.join(process.resourcesPath, 'app', 'server'),
      ]
      
      let serverPath: string | null = null
      let serverDir: string | null = null
      
      console.log('Starting backend server...')
      console.log('App path:', app.getAppPath())
      console.log('Resources path:', process.resourcesPath)
      console.log('__dirname:', __dirname)
      
      // Find server files
      for (let i = 0; i < possiblePaths.length; i++) {
        const testPath = possiblePaths[i]
        console.log(`Checking path ${i + 1}:`, testPath)
        if (fs.existsSync(testPath)) {
          serverPath = testPath
          serverDir = possibleDirs[i]
          console.log('✅ Found server at:', serverPath)
          break
        }
      }
      
      if (!serverPath || !serverDir) {
        console.error('❌ Server files not found in any expected location')
        console.error('Tried paths:')
        possiblePaths.forEach((p, i) => {
          console.error(`  ${i + 1}. ${p} - ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`)
        })
        console.warn('Server will not start. API features may not work.')
        return
      }
      
      // Check if server node_modules exist (needed for dependencies)
      const serverNodeModules = path.join(serverDir, 'node_modules')
      if (!fs.existsSync(serverNodeModules)) {
        console.warn('⚠️  Server node_modules not found. Server may fail to start.')
        console.warn('Server node_modules path:', serverNodeModules)
      }
      
      // Try to find Node.js
      // First, try system Node.js
      let nodePath = 'node'
      
      // Check if node is available
      const { execSync } = require('child_process')
      let nodeAvailable = false
      try {
        execSync('node --version', { timeout: 2000, stdio: 'ignore' })
        nodeAvailable = true
        console.log('✅ System Node.js found')
      } catch (error) {
        console.warn('⚠️  System Node.js not found in PATH')
        // Try to use Electron's Node.js (it's embedded but not directly accessible)
        // For now, we'll show an error if Node.js isn't available
        nodeAvailable = false
      }
      
      if (!nodeAvailable) {
        console.error('❌ Node.js is required to run the backend server')
        console.error('Please install Node.js from https://nodejs.org/')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            alert('Node.js is required to run the backend server.\\n\\nPlease install Node.js from https://nodejs.org/\\n\\nAfter installing, restart the application.');
          `).catch(() => {})
        }
        return
      }
      
      console.log('Starting server with Node.js:', nodePath)
      console.log('Server directory:', serverDir)
      
      serverProcess = spawn(nodePath, [serverPath], {
        cwd: serverDir,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '3001',
          PATH: process.env.PATH, // Preserve PATH for node
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true, // Use shell on Windows
      })
      
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log(`[Server] ${output}`)
        // Also show in main window console if available
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`console.log('[Backend Server] ${output.replace(/'/g, "\\'")}')`).catch(() => {})
        }
      })
      
      serverProcess.stderr?.on('data', (data) => {
        const error = data.toString()
        console.error(`[Server Error] ${error}`)
        // Show error in main window console if available
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`console.error('[Backend Server Error] ${error.replace(/'/g, "\\'")}')`).catch(() => {})
        }
      })
      
      serverProcess.on('error', (error: any) => {
        console.error('❌ Failed to start server:', error)
        console.error('Error details:', error.message)
        console.error('Error code:', error.code)
        
        let errorMessage = 'Failed to start backend server.'
        if (error.code === 'ENOENT') {
          errorMessage = 'Node.js not found. Please install Node.js from https://nodejs.org/'
        } else {
          errorMessage = `Failed to start server: ${error.message}`
        }
        
        console.error('Make sure Node.js is installed and available in PATH')
        
        // Show error to user
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            alert('${errorMessage}\\n\\nAfter installing Node.js, restart the application.');
          `).catch(() => {})
        }
      })
      
      serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code}, signal ${signal}`)
        if (code !== 0 && code !== null) {
          console.error('❌ Server exited with error code:', code)
          console.error('Check the server logs above for details')
        }
        serverProcess = null
      })
      
      // Wait for server to be ready with health check
      const checkServerHealth = async () => {
        const http = require('http')
        let attempts = 0
        const maxAttempts = 30 // 30 seconds
        
        console.log('Waiting for server to be ready...')
        
        const checkHealth = (): Promise<boolean> => {
          return new Promise((resolve) => {
            const req = http.get('http://localhost:3001/api/health', (res: any) => {
              if (res.statusCode === 200) {
                resolve(true)
              } else {
                resolve(false)
              }
            })
            req.on('error', () => resolve(false))
            req.setTimeout(1000, () => {
              req.destroy()
              resolve(false)
            })
          })
        }
        
        while (attempts < maxAttempts) {
          attempts++
          const isReady = await checkHealth()
          if (isReady) {
            console.log('✅ Backend server is ready and responding!')
            return true
          }
          if (attempts % 5 === 0) {
            console.log(`Still waiting for server... (${attempts}/${maxAttempts})`)
          }
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        console.error('⚠️  Backend server did not become ready after 30 seconds')
        console.error('The server may have failed to start. Check the error logs above.')
        return false
      }
      
      // Start health check after a short delay
      setTimeout(() => {
        checkServerHealth().catch(console.error)
      }, 2000)
      
      // Wait a bit to see if server starts successfully
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          console.log('✅ Backend server process started')
        } else {
          console.warn('⚠️  Server process may not have started correctly')
        }
      }, 2000)
      
      // Test if server is responding after 3 seconds
      setTimeout(async () => {
        try {
          const testResponse = await axios.get('http://localhost:3001/api/health', { timeout: 2000 })
          console.log('✅ Server is responding:', testResponse.data)
        } catch (error) {
          console.warn('⚠️  Server health check failed. Server may not be running yet or MongoDB may not be configured.')
        }
      }, 3000)
      
    } catch (error: any) {
      console.error('❌ Error starting server:', error)
      console.error('Error stack:', error.stack)
    }
  } else {
    console.log('Development mode: Server should be started manually with npm run dev:server')
  }
}

// Stop backend server
function stopServer() {
  if (serverProcess) {
    console.log('Stopping backend server...')
    serverProcess.kill()
    serverProcess = null
  }
}

app.whenReady().then(() => {
  console.log('App ready, starting server and creating window...')
  
  // Set up Content Security Policy
  setupCSP()
  
  // Set up auto-updater (only in production)
  setupAutoUpdater()
  
  // Start server first, then create window
  startServer()
  
  // Create window immediately (server will start in background)
  // Don't wait for server - window should appear even if server fails
  createWindow().catch((err) => {
    console.error('Failed to create window:', err)
  })
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

// IPC handler for fetching assets list from Roblox
ipcMain.handle('fetch-assets', async (event, { assetType, cookie, userId, groupId }: {
  assetType: 'Audio' | 'Decal'
  cookie: string
  userId?: string
  groupId?: string
}) => {
  try {
    // Get CSRF token first
    let csrfToken = ''
    try {
      const csrfResponse = await axios.post(
        'https://auth.roblox.com/v2/logout',
        {},
        {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
          },
          validateStatus: () => true,
        }
      )
      csrfToken = csrfResponse.headers['x-csrf-token'] || ''
    } catch (csrfError) {
      console.warn('Failed to fetch CSRF token for asset fetch:', csrfError)
    }

    const allAssets: any[] = []
    let nextPageCursor: string | null = null
    let hasMore = true

    while (hasMore) {
      // Build URL with pagination
      // Try different endpoint formats - Roblox API might use different structure
      let url = ''
      if (groupId) {
        url = `https://create.roblox.com/v1/groups/${groupId}/assets?assetType=${assetType}`
      } else if (userId) {
        url = `https://create.roblox.com/v1/users/${userId}/assets?assetType=${assetType}`
      } else {
        // Fallback: try the original endpoint format
        url = `https://create.roblox.com/v1/assets?type=${assetType}`
      }
      
      if (nextPageCursor) {
        url += url.includes('?') ? `&cursor=${nextPageCursor}` : `?cursor=${nextPageCursor}`
      }
      
      console.log(`Fetching assets from: ${url}`)

      const headers: any = {
        'Cookie': `.ROBLOSECURITY=${cookie.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }

      if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken
      }

      const response = await axios.get(url, {
        headers,
        validateStatus: (status) => status < 500,
        timeout: 10000,
      })

      if (response.status === 200 && response.data) {
        const assets = response.data.data || []
        
        // Map Roblox asset status to our format
        for (const asset of assets) {
          let status: 'pending' | 'accepted' | 'declined' = 'pending'
          
          // Map assetStatus field directly
          if (asset.assetStatus === 'Approved') {
            status = 'accepted'
          } else if (asset.assetStatus === 'Rejected') {
            status = 'declined'
          } else if (asset.assetStatus === 'Pending' || asset.assetStatus === 'Unprocessed') {
            status = 'pending'
          }

          allAssets.push({
            assetId: asset.id.toString(),
            name: asset.name,
            status,
            createdAt: asset.created || asset.updated || new Date().toISOString(),
            type: assetType.toLowerCase() as 'audio' | 'decal',
            fileSize: asset.fileSize,
            fileType: asset.fileType,
            groupId: asset.groupId?.toString(),
          })
        }

        // Check for pagination
        nextPageCursor = response.data.nextPageCursor || null
        hasMore = !!nextPageCursor && assets.length > 0
      } else if (response.status === 401 || response.status === 403) {
        console.error(`Authentication failed (${response.status}):`, response.data)
        return { success: false, error: 'Authentication failed. Please check your cookie.' }
      } else if (response.status === 404) {
        console.error(`Endpoint not found (404). URL: ${url}`)
        console.error('Response data:', response.data)
        // Endpoint doesn't exist - return empty array so frontend can fall back to individual status checks
        return { success: false, error: `API endpoint not found (404). The endpoint ${url} may not exist.` }
      } else {
        console.warn(`Failed to fetch assets: ${response.status}`, response.data)
        hasMore = false
      }
    }

    return { success: true, data: allAssets }
  } catch (error: any) {
    console.error('Error fetching assets:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to fetch assets' 
    }
  }
})



