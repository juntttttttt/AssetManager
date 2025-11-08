export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateAudioFile(file: File): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check file size (Roblox limit is typically 10MB for audio, but some accounts can upload larger)
  // Allow up to 50MB with a warning, as some accounts have higher limits
  const maxSize = 50 * 1024 * 1024 // 50MB
  const recommendedSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds 50MB limit`)
  } else if (file.size > recommendedSize) {
    warnings.push(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds recommended 10MB. Upload may fail if your account doesn't have access to larger file sizes.`)
  }

  // Check file type
  const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/mp4']
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|ogg|wav|m4a)$/i)) {
    warnings.push('File type may not be supported. Recommended: MP3, OGG, WAV')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validateDecalFile(file: File): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check file size (Roblox limit is typically 20MB for images)
  const maxSize = 20 * 1024 * 1024 // 20MB
  if (file.size > maxSize) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds 20MB limit`)
  }

  // Check file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']
  if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg|gif|bmp)$/i)) {
    errors.push('Invalid file type. Supported: PNG, JPG, JPEG, GIF, BMP')
  }

  // Check dimensions (optional - would need to load image)
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        resolve(hashHex)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

