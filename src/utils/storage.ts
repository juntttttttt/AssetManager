export function getUploadedAudios(): any[] {
  try {
    const stored = localStorage.getItem('uploadedAudios')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading audios:', error)
    return []
  }
}

export function getUploadedDecals(): any[] {
  try {
    const stored = localStorage.getItem('uploadedDecals')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading decals:', error)
    return []
  }
}

