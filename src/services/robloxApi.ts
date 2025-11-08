import axios from 'axios'
import { rateLimiter } from '../utils/rateLimiter'

export interface RobloxConfig {
  cookie: string
  userId?: string
  groupId?: string
  uploadTarget: 'user' | 'group' // Whether to upload to user or group
}

export interface UploadResult {
  assetId: string
  status: 'pending' | 'accepted' | 'declined'
  error?: string
}

export interface AssetInfo {
  assetId: string
  name: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  type: 'audio' | 'decal'
  fileSize?: number
  fileType?: string
  groupId?: string
}

export interface RobloxAsset {
  id: number
  name: string
  assetStatus: 'Approved' | 'Pending' | 'Rejected' | 'Unprocessed'
  created: string
  updated: string
  fileSize?: number
  fileType?: string
  groupId?: number
}

/**
 * Roblox API Service
 * 
 * Note: The API endpoints below are placeholders and may need to be adjusted
 * based on the actual Roblox Open Cloud API documentation.
 * 
 * For audio uploads: Check Roblox Open Cloud API docs for the correct endpoint
 * For decal uploads: May require different authentication/endpoints
 */
class RobloxAPI {
  private config: RobloxConfig | null = null

  setConfig(config: RobloxConfig) {
    this.config = config
  }

  getConfig(): RobloxConfig | null {
    return this.config
  }

  async testCookie(): Promise<{ valid: boolean; error?: string; userId?: string; username?: string }> {
    if (!this.config || !this.config.cookie) {
      return { valid: false, error: 'Cookie not configured' }
    }

    const cookie = this.config.cookie.trim()
    if (!cookie) {
      return { valid: false, error: 'Cookie is empty' }
    }

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.testCookie) {
      try {
        const result = await (window as any).electronAPI.testCookie(cookie)
        return result
      } catch (ipcError: any) {
        console.warn('IPC cookie test error, falling back to browser request:', ipcError)
        // Fall through to browser-based request
      }
    }

    try {
      // Test cookie by trying to get authenticated user info
      const response = await axios.get(
        'https://users.roblox.com/v1/users/authenticated',
        {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
          },
          timeout: 10000,
          validateStatus: (status) => status < 500,
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
      
      if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
        return { 
          valid: false, 
          error: 'Network error. The cookie format looks correct, but we cannot verify it due to network issues.' 
        }
      }

      return { valid: false, error: error.message || 'Failed to test cookie' }
    }
  }

  async uploadAudio(file: File, name: string, retries: number = 3, description?: string): Promise<UploadResult> {
    if (!this.config) {
      throw new Error('Configuration not set. Please set cookie and user/group ID.')
    }

    if (!this.config.cookie || this.config.cookie.trim() === '') {
      throw new Error('Cookie is required. Please configure it in Settings.')
    }

    if (this.config.uploadTarget === 'group' && (!this.config.groupId || this.config.groupId.trim() === '')) {
      throw new Error('Group ID is required for group uploads. Please configure it in Settings.')
    }

    if (this.config.uploadTarget === 'user' && (!this.config.userId || this.config.userId.trim() === '')) {
      throw new Error('User ID is required for user uploads. Please configure it in Settings.')
    }

    // Wait for rate limit (automatic throttling)
    await rateLimiter.waitForRateLimit('upload')

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.uploadAsset) {
      try {
        // Read file as ArrayBuffer and convert to Uint8Array for IPC
        // For large files, keep as Uint8Array to avoid memory issues with Array.from()
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // For very large files (>20MB), use Uint8Array directly (Electron IPC supports it)
        // For smaller files, convert to array for compatibility
        const fileData = file.size > 20 * 1024 * 1024 
          ? uint8Array 
          : Array.from(uint8Array)

        const result = await (window as any).electronAPI.uploadAsset(
          fileData,
          file.name,
          'Audio',
          this.config.cookie.trim(),
          this.config.uploadTarget === 'user' ? this.config.userId : undefined,
          this.config.uploadTarget === 'group' ? this.config.groupId : undefined,
          description
        )

        if (result.success) {
          // Record successful request for rate limiting
          if (result.assetId) {
            rateLimiter.recordRequest('upload')
          }
          return {
            assetId: result.assetId,
            status: 'pending',
          }
        } else {
          return {
            assetId: '',
            status: 'declined',
            error: result.error || 'Upload failed',
          }
        }
      } catch (ipcError: any) {
        console.error('IPC upload error:', ipcError)
        console.error('IPC error details:', {
          message: ipcError.message,
          stack: ipcError.stack,
        })
        // Fall through to browser-based request
      }
    }

    // Fallback to browser-based upload (may have CORS issues)
    let lastError: any = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Fetch CSRF token first (Roblox requires this for state-changing operations)
        let csrfToken = ''
        try {
          const csrfResponse = await axios.post(
            'https://auth.roblox.com/v2/logout',
            {},
            {
              headers: {
                'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
              },
              validateStatus: () => true, // Don't throw on any status
            }
          )
          csrfToken = csrfResponse.headers['x-csrf-token'] || ''
        } catch (csrfError) {
          console.warn('Failed to fetch CSRF token, continuing anyway:', csrfError)
        }

        // Browser fallback: Use Data/Upload.ashx endpoint with multipart/form-data
        // Note: Browser uploads may have CORS issues - Electron IPC is preferred
        const fileSizeMB = file.size / (1024 * 1024)
        const assetName = name.replace(/\.[^/.]+$/, '')
        
        // Validate file size - Roblox has a 20 MB limit for audio files
        if (fileSizeMB > 20) {
          return {
            assetId: '',
            status: 'declined',
            error: `File size (${fileSizeMB.toFixed(2)}MB) exceeds Roblox's 20 MB limit for audio files`,
          }
        }
        
        // Use the correct Data/Upload.ashx endpoint
        const endpoint = `https://data.roblox.com/Data/Upload.ashx?assetTypeId=3${this.config.uploadTarget === 'group' && this.config.groupId ? `&groupId=${this.config.groupId}` : this.config.uploadTarget === 'user' && this.config.userId ? `&userId=${this.config.userId}` : ''}`
        
        try {
          // Create FormData with file and name fields
          const formData = new FormData()
          formData.append('file', file)
          formData.append('name', assetName)
          
          const headers: any = {
            'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
          }

          if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken
          }

          console.log('Uploading to', endpoint, 'with multipart/form-data (file size:', fileSizeMB.toFixed(2), 'MB)')

          const response = await axios.post(
            endpoint,
            formData,
            {
              headers,
              withCredentials: true,
              timeout: Math.min(Math.max(60000, fileSizeMB * 1000 * 5), 600000),
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              validateStatus: () => true, // Handle all status codes
            }
          )
          
          console.log('Response status:', response.status)
          console.log('Response data:', typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data, null, 2))
          
          // Check if upload was successful
          if (response.status >= 200 && response.status < 300) {
            // Data/Upload.ashx typically returns the asset ID as plain text
            let assetId: string | null = null
            
            // Try to extract asset ID from response
            if (typeof response.data === 'string') {
              // Plain text response - extract numeric ID
              const idMatch = response.data.trim().match(/^(\d+)$/)
              if (idMatch && idMatch[1]) {
                assetId = idMatch[1]
              }
            } else if (response.data?.Id || response.data?.assetId || response.data?.id) {
              // JSON response with asset ID
              assetId = response.data.Id || response.data.assetId || response.data.id
            } else if (response.headers?.location || response.headers?.Location) {
              // Asset ID in Location header
              const locationMatch = (response.headers.location || response.headers.Location).match(/(\d+)/)
              if (locationMatch && locationMatch[1]) {
                assetId = locationMatch[1]
              }
            }
            
            if (assetId) {
              return {
                assetId,
                status: 'pending',
              }
            }
            
            // No asset ID found - treat as error and retry
            lastError = new Error('Upload succeeded but no asset ID was returned')
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
              continue
            }
            return {
              assetId: '',
              status: 'declined',
              error: 'Upload succeeded but no asset ID was returned',
            }
          } else if (response.status === 400) {
            // Handle 400 errors
            const errorData = response.data
            const errorCode = errorData?.errors?.[0]?.code
            const errorMsg = errorData?.errors?.[0]?.message || 'Unknown error'
            
            // Fatal errors - don't retry
            if (errorCode === 4) {
              throw new Error(`File too large. Roblox error: ${errorMsg}`)
            } else if (errorCode === 5) {
              throw new Error(`Audio duration too long. Roblox error: ${errorMsg}`)
            } else if (errorCode === 8) {
              throw new Error(`File type not supported. Roblox error: ${errorMsg}`)
            } else if (errorCode === 9) {
              throw new Error(`File is corrupted. Roblox error: ${errorMsg}`)
            } else if (errorCode === 15) {
              throw new Error(`Audio file was rejected by moderation. Roblox error: ${errorMsg}`)
            }
            
            // Retryable errors - continue to next attempt
            lastError = new Error(errorCode ? `Error code ${errorCode}: ${errorMsg}` : errorMsg)
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
              continue
            }
            
            return {
              assetId: '',
              status: 'declined',
              error: errorCode ? `Error code ${errorCode}: ${errorMsg}` : errorMsg,
            }
          } else {
            // Other error statuses - retry
            lastError = new Error(`Upload failed with status ${response.status}`)
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
              continue
            }
            
            return {
              assetId: '',
              status: 'declined',
              error: `Upload failed with status ${response.status}`,
            }
          }
        } catch (uploadError: any) {
          console.error('Browser upload error:', uploadError)
          
          // Fatal errors - don't retry
          if (uploadError.message && (
            uploadError.message.includes('File too large') ||
            uploadError.message.includes('duration too long') ||
            uploadError.message.includes('File type not supported') ||
            uploadError.message.includes('corrupted') ||
            uploadError.message.includes('rejected by moderation')
          )) {
            throw uploadError
          }
          
          // Retryable errors
          lastError = uploadError
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
            continue
          }
          
          // Last attempt failed
          const errorMsg = uploadError.response?.data?.errors?.[0]?.message || uploadError.message || 'Upload failed'
          return {
            assetId: '',
            status: 'declined',
            error: errorMsg,
          }
        }
      } catch (outerError: any) {
        // Handle errors from the outer try block (e.g., file size validation, etc.)
        lastError = outerError
        if (outerError.message && outerError.message.includes('File too large')) {
          throw outerError
        }
        
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          continue
        }
        
        throw outerError
      }
    }
    
    // If we get here, all retries failed
    return {
      assetId: '',
      status: 'declined',
      error: lastError?.message || 'Upload failed after all retry attempts',
    }
  }

  async uploadDecal(file: File, name: string, retries: number = 3): Promise<UploadResult> {
    if (!this.config) {
      throw new Error('Configuration not set. Please set cookie and user/group ID.')
    }

    if (!this.config.cookie || this.config.cookie.trim() === '') {
      throw new Error('Cookie is required. Please configure it in Settings.')
    }

    if (this.config.uploadTarget === 'group' && (!this.config.groupId || this.config.groupId.trim() === '')) {
      throw new Error('Group ID is required for group uploads. Please configure it in Settings.')
    }

    if (this.config.uploadTarget === 'user' && (!this.config.userId || this.config.userId.trim() === '')) {
      throw new Error('User ID is required for user uploads. Please configure it in Settings.')
    }

    // Wait for rate limit (automatic throttling)
    await rateLimiter.waitForRateLimit('upload')

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.uploadAsset) {
      try {
        // Read file as ArrayBuffer and convert to Uint8Array for IPC
        // For large files, keep as Uint8Array to avoid memory issues with Array.from()
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // For very large files (>20MB), use Uint8Array directly (Electron IPC supports it)
        // For smaller files, convert to array for compatibility
        const fileData = file.size > 20 * 1024 * 1024 
          ? uint8Array 
          : Array.from(uint8Array)

        const result = await (window as any).electronAPI.uploadAsset(
          fileData,
          file.name,
          'Decal',
          this.config.cookie.trim(),
          this.config.uploadTarget === 'user' ? this.config.userId : undefined,
          this.config.uploadTarget === 'group' ? this.config.groupId : undefined
        )

        if (result.success) {
          // Record successful request for rate limiting
          if (result.assetId) {
            rateLimiter.recordRequest('upload')
          }
          return {
            assetId: result.assetId,
            status: 'pending',
          }
        } else {
          return {
            assetId: '',
            status: 'declined',
            error: result.error || 'Upload failed',
          }
        }
      } catch (ipcError: any) {
        console.error('IPC upload error:', ipcError)
        console.error('IPC error details:', {
          message: ipcError.message,
          stack: ipcError.stack,
        })
        // Fall through to browser-based request
      }
    }

    // Fallback to browser-based upload (may have CORS issues)
    let lastError: any = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Fetch CSRF token first (Roblox requires this for state-changing operations)
        let csrfToken = ''
        try {
          const csrfResponse = await axios.post(
            'https://auth.roblox.com/v2/logout',
            {},
            {
              headers: {
                'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
              },
              validateStatus: () => true, // Don't throw on any status
            }
          )
          csrfToken = csrfResponse.headers['x-csrf-token'] || ''
        } catch (csrfError) {
          console.warn('Failed to fetch CSRF token, continuing anyway:', csrfError)
        }

        // Try multiple endpoints and formats
        // For publish.roblox.com/v1/images, we need to try both FormData and JSON with base64
        const endpoints = [
          {
            url: 'https://publish.roblox.com/v1/images',
            useFormData: true,
            formData: () => {
              const fd = new FormData()
              fd.append('file', file)
              fd.append('name', name)
              if (this.config!.uploadTarget === 'group' && this.config!.groupId) {
                fd.append('groupId', this.config!.groupId.trim())
              } else if (this.config!.uploadTarget === 'user' && this.config!.userId) {
                fd.append('userId', this.config!.userId.trim())
              }
              return fd
            },
          },
          {
            url: 'https://publish.roblox.com/v1/images',
            useFormData: false, // Try JSON with base64
            formData: () => {
              // This won't be used for JSON, but we need it for the structure
              return new FormData()
            },
          },
        ]

        let response: any = null
        let lastEndpointError: any = null

        for (const endpointConfig of endpoints) {
          try {
            const headers: any = {
              'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
            }

            if (csrfToken) {
              headers['X-CSRF-TOKEN'] = csrfToken
            }

            let requestPayload: any

            if (endpointConfig.useFormData) {
              // Use FormData
              const formData = endpointConfig.formData()
              requestPayload = formData
              // Don't set Content-Type - let axios set it with boundary
            } else {
              // Use JSON with base64 (for publish.roblox.com endpoints)
              const reader = new FileReader()
              const fileBase64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const result = reader.result as string
                  // Remove data URI prefix if present
                  const base64 = result.includes(',') ? result.split(',')[1] : result
                  resolve(base64)
                }
                reader.onerror = reject
                reader.readAsDataURL(file)
              })

              requestPayload = {
                name: name,
                file: fileBase64,
              }

              if (this.config!.uploadTarget === 'group' && this.config!.groupId) {
                const groupIdNum = parseInt(this.config!.groupId.trim())
                if (!isNaN(groupIdNum)) {
                  requestPayload.groupId = groupIdNum
                }
              } else if (this.config!.uploadTarget === 'user' && this.config!.userId) {
                const userIdNum = parseInt(this.config!.userId.trim())
                if (!isNaN(userIdNum)) {
                  requestPayload.userId = userIdNum
                }
              }

              headers['Content-Type'] = 'application/json'
            }

            response = await axios.post(
              endpointConfig.url,
              requestPayload,
              {
                headers,
                withCredentials: true,
                timeout: 30000, // 30 second timeout
                validateStatus: (status) => status < 500, // Don't throw on 4xx
              }
            )

            // Check if response is valid
            if (response.status >= 200 && response.status < 300) {
              // Check if we got an asset ID or valid response
              if (response.data?.assetId || response.data?.id || response.data?.Id) {
                break // Success!
              }
              
              // If response indicates invalid format, try next format
              if (response.data?.isValid === false) {
                console.log('Invalid request format, trying next format...')
                lastEndpointError = response
                response = null
                continue
              }
              
              // If response has error, try next format
              if (response.data?.error) {
                console.log('Error in response, trying next format...')
                lastEndpointError = response
                response = null
                continue
              }
              
              // If we have data but no asset ID, might be wrong format
              if (response.data && !response.data.assetId && !response.data.id && !response.data.Id) {
                lastEndpointError = response
                response = null
                continue
              }
            }

            // If 400, might be format issue - try next format
            if (response.status === 400) {
              const errorCode = response.data?.errors?.[0]?.code
              const errorMsg = response.data?.errors?.[0]?.message || ''
              if (errorCode === 3 || errorMsg?.toLowerCase().includes('file') || response.data?.isValid === false) {
                console.log('File format error, trying next format...')
                lastEndpointError = response
                response = null
                continue
              }
            }

            // If 404, try next endpoint
            if (response.status === 404) {
              lastEndpointError = response
              response = null
              continue
            }

            // If we got here with a 2xx response, assume success
            if (response.status >= 200 && response.status < 300) {
              break
            }
          } catch (endpointError: any) {
            lastEndpointError = endpointError
            response = null
            // Continue to next endpoint
            continue
          }
        }

        // If no endpoint worked, use the last error
        if (!response) {
          throw lastEndpointError || new Error('All upload endpoints failed')
        }

        // Extract asset ID from response (publish API returns Id with capital I)
        const assetId = response.data?.Id
          || response.data?.assetId 
          || response.data?.id 
          || response.data?.path?.match(/\/library\/(\d+)/)?.[1]
          || response.data?.path?.match(/\/(\d+)/)?.[1]
          || ''

        // Record successful request for rate limiting
        if (assetId) {
          rateLimiter.recordRequest('upload')
        }

        return {
          assetId,
          status: 'pending',
        }
      } catch (error: any) {
        lastError = error

        // Log detailed error for debugging
        if (error.response) {
          console.error('Upload error details:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          })
        }

        // Handle authentication errors specifically
        if (error.response?.status === 401) {
          const errorMessage = error.response?.data?.errors?.[0]?.message 
            || error.response?.data?.message 
            || 'User not authenticated'
          lastError = { ...error, detailedMessage: `Authentication failed: ${errorMessage}. Please check your cookie in Settings.` }
          break
        }

        // Don't retry on certain errors
        if (error.response?.status === 400 || error.response?.status === 403) {
          const errorMessage = error.response?.data?.errors?.[0]?.message 
            || error.response?.data?.message 
            || error.response?.data?.error 
            || error.message
          lastError = { ...error, detailedMessage: errorMessage }
          break
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    // Extract better error message
    let errorMessage = 'Upload failed'
    
    if (lastError?.response?.data) {
      // Try to get detailed error from response
      const errorData = lastError.response.data
      if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        errorMessage = errorData.errors[0].message || errorData.errors[0].error || errorMessage
      } else if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.isValid === false) {
        // Show the actual error data instead of generic message
        if (errorData.data) {
          errorMessage = JSON.stringify(errorData.data, null, 2)
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else {
          errorMessage = `Request was invalid. Response: ${JSON.stringify(errorData, null, 2)}`
        }
      }
    } else if (lastError?.detailedMessage) {
      errorMessage = lastError.detailedMessage
    } else if (lastError?.message) {
      errorMessage = lastError.message
    }
    
    // Ensure error message is prefixed if not already
    if (!errorMessage.startsWith('Upload failed:')) {
      errorMessage = `Upload failed: ${errorMessage}`
    }

    return {
      assetId: '',
      status: 'declined',
      error: errorMessage,
    }
  }

  async checkAssetStatus(assetId: string, type: 'audio' | 'decal'): Promise<AssetInfo | null> {
    if (!this.config) {
      throw new Error('Configuration not set.')
    }

    // Store function parameters in local variables for catch block access
    // These are needed because TypeScript has issues with parameter access in catch blocks
    const currentAssetId: string = assetId
    const currentType: 'audio' | 'decal' = type

    // Declare status variables at function scope so they're accessible throughout
    let assetDeliveryStatusPublic: number | null = null
    let assetDeliveryStatusAuth: number | null = null

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkAssetStatus) {
      try {
        const result = await (window as any).electronAPI.checkAssetStatus(
          assetId,
          type,
          '', // No API key needed
          this.config.cookie
        )
        
        if (result.success) {
          return result.data
        } else {
          console.warn('IPC check failed, falling back to browser requests:', result.error)
          // Fall through to browser-based requests
        }
      } catch (ipcError: any) {
        console.warn('IPC check error, falling back to browser requests:', ipcError)
        // Fall through to browser-based requests
      }
    }

    try {
      // First, try Asset Delivery API WITHOUT cookie to check PUBLIC accessibility
      // CRITICAL: When logged in, we can access declined assets (owner can see them)
      // We need to check if the asset is PUBLICLY accessible, not just accessible to the owner
      
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
        }

        // If public access returns 404, asset is DECLINED (not publicly available)
        if (assetDeliveryPublicResponse.status === 404) {
          console.log(`Asset ${assetId}: Public Asset Delivery API returned 404 - asset is not publicly accessible = DECLINED`)
        }

        // Also check WITH authentication to see if owner can access it
        if (this.config.cookie) {
          try {
            const assetDeliveryAuthResponse = await axios.get(
              `https://assetdelivery.roblox.com/v2/assetId/${assetId}`,
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
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

      // If public access returns 200, asset is definitely ACCEPTED
      if (assetDeliveryStatusPublic === 200) {
        // Try to get asset name and verify status with Catalog API
        let assetName = `Asset ${assetId}`
        let actualStatus: 'pending' | 'accepted' | 'declined' = 'accepted' // Public access = accepted
          
          // Check catalog API first (faster and more reliable for status)
          try {
            const catalogResponse = await axios.post(
              `https://catalog.roblox.com/v1/catalog/items/details`,
              {
                items: [{ itemType: 'Asset', id: parseInt(assetId) }],
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...(this.config.cookie ? { 'Cookie': `.ROBLOSECURITY=${this.config.cookie}` } : {}),
                },
                validateStatus: (status) => status < 500,
                timeout: 3000, // Reduced timeout for faster checks
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
              
              // Improved acceptance detection with public accessibility check:
              // CRITICAL: Only mark as ACCEPTED if asset is PUBLICLY accessible (not just owner-accessible)
              if (item.id) {
                const createdDate = item.created ? new Date(item.created) : null
                const now = new Date()
                const minutesSinceCreation = createdDate ? (now.getTime() - createdDate.getTime()) / (1000 * 60) : null
                
                // Strong indicators of acceptance:
                const isPubliclyAccessible = assetDeliveryStatusPublic === 200
                const isOwnerOnlyAccessible = assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== 200
                const isNotRestricted = !item.isRestricted && !item.isLimited && !item.isLimitedUnique
                const isAvailableForSale = item.isForSale === true || item.priceStatus === 'OnSale' || item.price !== undefined
                
                // CRITICAL: If owner can access but public cannot, it's NOT accepted
                if (isOwnerOnlyAccessible) {
                  console.log(`Asset ${assetId}: Owner can access but public cannot - checking for decline indicators`)
                  actualStatus = 'pending' // Default to pending, will check library page
                }
                // If public access returns 200, asset is definitely accepted
                else if (isPubliclyAccessible) {
                  console.log(`Asset ${assetId}: Marking as ACCEPTED - Public Asset Delivery API returned 200`)
                  actualStatus = 'accepted'
                  return {
                    assetId,
                    name: assetName,
                    status: actualStatus,
                    createdAt: item.created || new Date().toISOString(),
                    type,
                  }
                }
                // If public access returns 404, asset is declined
                else {
                  const publicStatusNum: number | null = assetDeliveryStatusPublic
                  if (publicStatusNum === 404) {
                    console.log(`Asset ${assetId}: Marking as DECLINED - Public Asset Delivery API returned 404`)
                    actualStatus = 'declined'
                  } else if (isNotRestricted && (isAvailableForSale || item.isForSale !== false)) {
                    // If item is in catalog but not publicly accessible, check more carefully
                    if (minutesSinceCreation && minutesSinceCreation > 5) {
                      if (publicStatusNum === 404) {
                        console.log(`Asset ${assetId}: Item in catalog but not publicly accessible (404) - likely DECLINED`)
                        actualStatus = 'declined'
                      } else {
                        console.log(`Asset ${assetId}: Item in catalog but public access returned ${publicStatusNum} - keeping as PENDING`)
                        actualStatus = 'pending'
                      }
                    } else {
                      console.log(`Asset ${assetId}: Item created ${minutesSinceCreation?.toFixed(1)} minutes ago - keeping as PENDING`)
                      actualStatus = 'pending'
                    }
                  }
                }
              }
            } else if (catalogResponse.status === 200 && (!catalogResponse.data?.data || catalogResponse.data.data.length === 0)) {
              // Item not in catalog - check public accessibility
              const publicStatus = assetDeliveryStatusPublic
              if (publicStatus === 200) {
                console.log(`Asset ${assetId}: Not in catalog but publicly accessible - marking as ACCEPTED`)
                return {
                  assetId,
                  name: assetName,
                  status: 'accepted',
                  createdAt: new Date().toISOString(),
                  type,
                }
              } else if (publicStatus === 404) {
                console.log(`Asset ${assetId}: Not in catalog and not publicly accessible (404) - marking as DECLINED`)
                return {
                  assetId,
                  name: assetName,
                  status: 'declined',
                  createdAt: new Date().toISOString(),
                  type,
                }
              }
            }
            // If item not in catalog or doesn't meet criteria, continue to check library page
          } catch (catalogError) {
            // Catalog API failed, continue to library page check
          }

          // Fallback: Check library page for explicit status indicators (only if catalog didn't confirm acceptance)
          try {
            const nameResponse = await axios.get(
              `https://www.roblox.com/library/${assetId}`,
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  ...(this.config.cookie ? { 'Cookie': `.ROBLOSECURITY=${this.config.cookie}` } : {}),
                },
                validateStatus: (status) => status < 500,
                timeout: 3000, // Reduced timeout
              }
            )
            if (nameResponse.status === 200) {
              const html = nameResponse.data
              const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i)
              if (nameMatch) {
                assetName = nameMatch[1].trim()
              }
              
              // Check for declined/rejected indicators FIRST (before pending)
              // Common patterns for declined assets:
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
              ]
              
              const hasDeclinedIndicator = declinedPatterns.some(pattern => pattern.test(html))
              
              if (hasDeclinedIndicator) {
                actualStatus = 'declined'
                console.log(`Asset ${assetId} detected as DECLINED based on library page content`)
                return {
                  assetId,
                  name: assetName,
                  status: actualStatus,
                  createdAt: new Date().toISOString(),
                  type,
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
                  assetId,
                  name: assetName,
                  status: actualStatus,
                  createdAt: new Date().toISOString(),
                  type,
                }
              }
              
              // Use public accessibility status: if library page exists but public delivery API returns 404, it's declined
              const publicStatusNum: number | null = assetDeliveryStatusPublic
              const authStatusNum: number | null = assetDeliveryStatusAuth
              if (publicStatusNum === 404) {
                console.log(`Asset ${assetId} detected as DECLINED: library page exists but public delivery API returns 404`)
                return {
                  assetId,
                  name: assetName,
                  status: 'declined',
                  createdAt: new Date().toISOString(),
                  type,
                }
              }
              
              // If owner can access but public cannot, it's likely declined
              if (authStatusNum === 200 && publicStatusNum !== null && publicStatusNum !== 200) {
                console.log(`Asset ${assetId}: Owner can access but public cannot - marking as DECLINED`)
                return {
                  assetId,
                  name: assetName,
                  status: 'declined',
                  createdAt: new Date().toISOString(),
                  type,
                }
              }
            }
          } catch (nameError) {
            // Ignore name fetch errors, use default
          }

          // Final status determination based on PUBLIC Asset Delivery API
          // CRITICAL: Use public status, not authenticated status (owner can see declined assets)
          const publicStatusNum: number | null = assetDeliveryStatusPublic
          const authStatusNum: number | null = assetDeliveryStatusAuth
          if (publicStatusNum === 200) {
            console.log(`Asset ${assetId}: Public Asset Delivery API returned 200 - marking as ACCEPTED`)
            actualStatus = 'accepted'
          } else if (publicStatusNum === 404) {
            // Public can't access - if owner can, it's declined (not publicly accessible)
            if (authStatusNum === 200) {
              console.log(`Asset ${assetId}: Owner can access but public cannot (404) - marking as DECLINED`)
              actualStatus = 'declined'
            } else {
              console.log(`Asset ${assetId}: Public Asset Delivery API returned 404 - marking as DECLINED`)
              actualStatus = 'declined'
            }
          } else if (publicStatusNum === 403) {
            console.log(`Asset ${assetId}: Public Asset Delivery API returned 403 - marking as PENDING`)
            actualStatus = 'pending'
          }
          
          return {
            assetId,
            name: assetName,
            status: actualStatus,
            createdAt: new Date().toISOString(),
            type,
          }
        }

        // Handle cases where public check didn't return 200
        // 403 = asset exists but not publicly accessible (pending)
        if (assetDeliveryStatusPublic === 403) {
          console.log(`Asset ${assetId}: Public Asset Delivery API returned 403 - marking as PENDING`)
          return {
            assetId,
            name: `Asset ${assetId}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            type,
          }
        }

        // 404 = asset doesn't exist (declined)
        // If owner can access but public cannot, it's declined
        if (assetDeliveryStatusPublic === 404) {
          if (assetDeliveryStatusAuth === 200) {
            console.log(`Asset ${assetId}: Owner can access but public cannot (404) - marking as DECLINED`)
          } else {
            console.log(`Asset ${assetId}: Public Asset Delivery API returned 404 - marking as DECLINED`)
          }
          return {
            assetId,
            name: `Asset ${assetId}`,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          }
        }
      } catch (assetDeliveryError: any) {
        // If Asset Delivery API fails, fall through to other methods
        console.warn('Asset Delivery API check failed:', assetDeliveryError.response?.status || assetDeliveryError.message)
      }
      // Final fallback: Check library page and use public accessibility status
      try {
        const libraryUrl = `https://www.roblox.com/library/${assetId}`
        const response = await axios.get(libraryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(this.config.cookie ? { 'Cookie': `.ROBLOSECURITY=${this.config.cookie}` } : {}),
          },
          validateStatus: (status) => status < 500,
          timeout: 3000,
        })

        // If we get a 404, the asset doesn't exist
        if (response.status === 404) {
          return {
            assetId,
            name: `Asset ${assetId}`,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          }
        }

        // Try to parse HTML for asset info
        const html = response.data
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i)
        const name = nameMatch ? nameMatch[1].trim() : `Asset ${assetId}`

        // Check for declined/rejected indicators
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
        ]
        const hasDeclinedIndicator = declinedPatterns.some(pattern => pattern.test(html))

        // Use public accessibility status as primary indicator
        if (assetDeliveryStatusPublic !== null && assetDeliveryStatusPublic === 200) {
          return {
            assetId,
            name,
            status: 'accepted',
            createdAt: new Date().toISOString(),
            type,
          }
        } else if ((assetDeliveryStatusPublic !== null && assetDeliveryStatusPublic === 404) || hasDeclinedIndicator) {
          // Public can't access or has decline indicators
          return {
            assetId,
            name,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          }
        } else if (assetDeliveryStatusAuth !== null && assetDeliveryStatusAuth === 200 && assetDeliveryStatusPublic !== null && assetDeliveryStatusPublic !== 200) {
          // Owner can access but public cannot - likely declined
          return {
            assetId,
            name,
            status: 'declined',
            createdAt: new Date().toISOString(),
            type,
          }
        } else {
          // Default to pending if no clear indicator
          return {
            assetId,
            name,
            status: 'pending',
            createdAt: new Date().toISOString(),
            type,
          }
        }
      } catch (htmlError: any) {
        console.error('Error checking library page:', htmlError)
      }

      // Alternative: Try Roblox catalog API
      try {
        const catalogResponse = await axios.post(
          `https://catalog.roblox.com/v1/catalog/items/details`,
          {
            items: [{ itemType: 'Asset', id: parseInt(assetId) }],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.cookie ? { 'Cookie': `.ROBLOSECURITY=${this.config.cookie}` } : {}),
            },
            validateStatus: (status) => status < 500,
          }
        )

        if (catalogResponse.status === 200 && catalogResponse.data?.data?.[0]) {
          const item = catalogResponse.data.data[0]
          // Use public accessibility status - only mark as accepted if publicly accessible
          const status = (assetDeliveryStatusPublic !== null && assetDeliveryStatusPublic === 200) ? 'accepted' : 
                        ((assetDeliveryStatusPublic !== null && assetDeliveryStatusPublic === 404) ? 'declined' : 'pending')
          return {
            assetId,
            name: item.name || `Asset ${assetId}`,
            status,
            createdAt: item.created || new Date().toISOString(),
            type,
          }
        }
      } catch (catalogError: any) {
        console.warn('Catalog API failed:', catalogError.response?.status)
      }

      // Try store page (for assets in the creator store)
      try {
        const storeResponse = await axios.get(
          `https://create.roblox.com/store/asset/${assetId}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              ...(this.config.cookie ? { 'Cookie': `.ROBLOSECURITY=${this.config.cookie}` } : {}),
            },
            validateStatus: (status) => status < 500,
          }
        )

        if (storeResponse.status === 200) {
          // Parse HTML to extract asset name
          const html = storeResponse.data
          const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) 
            || html.match(/<title>([^<]+)<\/title>/i)
            || html.match(/"name":"([^"]+)"/i)
            || html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
          const name = nameMatch ? nameMatch[1].trim().replace(/&quot;/g, '"').replace(/&#39;/g, "'") : `Asset ${assetId}`

          // If we can access the store page, asset exists and is likely accepted
          return {
            assetId,
            name,
            status: 'accepted',
            createdAt: new Date().toISOString(),
            type,
          }
        }
      } catch (storeError: any) {
        console.warn('Store page check failed:', storeError.response?.status)
      }

      // If all methods fail, return null
      return null
    } catch (error: any) {
      console.error('Error checking asset status:', error)
      
      // Provide more detailed error information
      // Variables currentAssetId and currentType are defined at function scope (line 750-751)
      // TypeScript may complain but they are accessible at runtime
      // Use type assertion to work around TypeScript's strict checking
      const catchAssetId: string = (currentAssetId as any)
      const catchType: 'audio' | 'decal' = (currentType as any)
      
      if (error.response) {
        if (error.response.status === 404) {
          return {
            assetId: catchAssetId,
            name: `Asset ${catchAssetId}`,
            status: 'declined' as const,
            createdAt: new Date().toISOString(),
            type: catchType,
          }
        }
        if (error.response.status === 401 || error.response.status === 403) {
          throw new Error('Authentication failed. Please check your cookie.')
        }
      }
      
      return null
    }

  async deleteAsset(assetId: string, _type: 'audio' | 'decal'): Promise<boolean> {
    if (!this.config || !this.config.cookie) {
      throw new Error('Configuration not set. Cookie is required.')
    }

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.deleteAsset) {
      try {
        const result = await (window as any).electronAPI.deleteAsset(
          assetId,
          this.config.cookie
        )
        
        if (result.success) {
          return true
        } else {
          console.warn('IPC delete failed, falling back to browser requests:', result.error)
          // Fall through to browser-based requests
        }
      } catch (ipcError: any) {
        console.warn('IPC delete error, falling back to browser requests:', ipcError)
        // Fall through to browser-based requests
      }
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
              'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
            },
            validateStatus: () => true, // Don't throw on any status
          }
        )
        csrfToken = csrfResponse.headers['x-csrf-token'] || ''
      } catch (csrfError) {
        console.warn('Failed to fetch CSRF token for delete:', csrfError)
      }

      const endpoint = `https://www.roblox.com/asset/delete/${assetId}`

      const headers: any = {
        'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
        'Content-Type': 'application/json',
      }

      if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken
      }

      const response = await axios.delete(endpoint, { 
        headers,
        validateStatus: (status) => status < 500, // Don't throw on 400/403
      })

      // Check if deletion was successful
      if (response.status === 200 || response.status === 204) {
        return true
      }

      // Handle specific error cases
      if (response.status === 403) {
        console.error('Delete failed: Forbidden - may need CSRF token or proper permissions')
        return false
      }

      if (response.status === 404) {
        console.error('Delete failed: Asset not found or already deleted')
        return false
      }

      // Check response data for error messages
      if (response.data) {
        const errorMsg = response.data.errors?.[0]?.message || response.data.message || response.data.error
        if (errorMsg) {
          console.error('Delete failed:', errorMsg)
        }
      }

      return false
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
      } else {
        console.error('Delete failed:', error.message)
      }
      
      return false
    }
  }

  /**
   * Fetch all audio assets from Roblox using authenticated API
   * Uses the official create.roblox.com endpoint with proper pagination
   * Checks both user and group assets if both are configured
   */
  async fetchAllAudioAssets(userId?: string, groupId?: string): Promise<AssetInfo[]> {
    if (!this.config || !this.config.cookie) {
      throw new Error('Configuration not set. Cookie is required.')
    }

    const allAssets: AssetInfo[] = []
    const targetUserId = userId || this.config.userId
    const targetGroupId = groupId || this.config.groupId

    // Use Electron IPC if available (bypasses CORS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.fetchAssets) {
      // Fetch user assets if userId is available
      if (targetUserId) {
        try {
          console.log(`Fetching user audio assets for userId: ${targetUserId}`)
          const userResult = await (window as any).electronAPI.fetchAssets(
            'Audio',
            this.config.cookie,
            targetUserId,
            undefined // No groupId for user assets
          )
          
          if (userResult.success && userResult.data) {
            console.log(`Found ${userResult.data.length} user audio assets`)
            allAssets.push(...userResult.data)
          } else {
            console.warn('Failed to fetch user assets:', userResult.error)
          }
        } catch (userError: any) {
          console.warn('Error fetching user assets:', userError)
        }
      }

      // Fetch group assets if groupId is available
      if (targetGroupId) {
        try {
          console.log(`Fetching group audio assets for groupId: ${targetGroupId}`)
          const groupResult = await (window as any).electronAPI.fetchAssets(
            'Audio',
            this.config.cookie,
            undefined, // No userId for group assets
            targetGroupId
          )
          
          if (groupResult.success && groupResult.data) {
            console.log(`Found ${groupResult.data.length} group audio assets`)
            allAssets.push(...groupResult.data)
          } else {
            console.warn('Failed to fetch group assets:', groupResult.error)
          }
        } catch (groupError: any) {
          console.warn('Error fetching group assets:', groupError)
        }
      }

      // If we got any assets, return them
      if (allAssets.length > 0) {
        // Remove duplicates by assetId
        const uniqueAssets = Array.from(
          new Map(allAssets.map(asset => [asset.assetId, asset])).values()
        )
        return uniqueAssets
      }
    }

    try {
      // Get CSRF token first
      let csrfToken = ''
      try {
        const csrfResponse = await axios.post(
          'https://auth.roblox.com/v2/logout',
          {},
          {
            headers: {
              'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
            },
            validateStatus: () => true,
          }
        )
        csrfToken = csrfResponse.headers['x-csrf-token'] || ''
      } catch (csrfError) {
        console.warn('Failed to fetch CSRF token:', csrfError)
      }

      const targetUserId = userId || this.config.userId
      const targetGroupId = groupId || this.config.groupId

      if (!targetUserId && !targetGroupId) {
        throw new Error('User ID or Group ID is required to fetch assets')
      }

      const allAssets: AssetInfo[] = []
      let nextPageCursor: string | null = null
      let hasMore = true

      while (hasMore) {
        // Build URL with pagination
        // Try different endpoint formats - Roblox API might use different structure
        let url = ''
        if (targetGroupId) {
          url = `https://create.roblox.com/v1/groups/${targetGroupId}/assets?assetType=Audio`
        } else if (targetUserId) {
          url = `https://create.roblox.com/v1/users/${targetUserId}/assets?assetType=Audio`
        } else {
          // Fallback: try the original endpoint format
          url = 'https://create.roblox.com/v1/assets?type=Audio'
        }
        
        if (nextPageCursor) {
          url += url.includes('?') ? `&cursor=${nextPageCursor}` : `?cursor=${nextPageCursor}`
        }
        
        console.log(`Fetching audio assets from: ${url}`)

        const headers: any = {
          'Cookie': `.ROBLOSECURITY=${this.config.cookie.trim()}`,
          'Content-Type': 'application/json',
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
          const assets: RobloxAsset[] = response.data.data || []
          
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
              type: 'audio',
              fileSize: asset.fileSize,
              fileType: asset.fileType,
              groupId: asset.groupId?.toString(),
            })
          }

          // Check for pagination
          nextPageCursor = response.data.nextPageCursor || null
          hasMore = !!nextPageCursor && assets.length > 0
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your cookie.')
        } else {
          console.warn(`Failed to fetch assets: ${response.status}`)
          hasMore = false
        }
      }

      return allAssets
    } catch (error: any) {
      console.error('Error fetching audio assets:', error)
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Authentication failed. Please check your cookie.')
      }
      throw error
    }
  }

  /**
   * Fetch all decal assets from Roblox using authenticated API
   */
  async fetchAllDecalAssets(userId?: string, groupId?: string): Promise<AssetInfo[]> {
    if (!this.config || !this.config.cookie) {
      throw new Error('Configuration not set. Cookie is required.')
    }

    // Similar implementation for decals
    // For now, return empty array as decals might use a different endpoint
    // TODO: Implement decal fetching when endpoint is confirmed
    return []
  }
}

export const robloxAPI = new RobloxAPI()

