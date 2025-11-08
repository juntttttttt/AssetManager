export interface UploadPreset {
  id: string
  name: string
  uploadType: 'audio' | 'decal'
  defaultName?: string
  namePattern?: string // Pattern like "Asset_{index}" or "{type}_{date}"
  tags?: string[]
  description?: string
  category?: string
  notes?: string
  createdAt: string
  updatedAt?: string
  usageCount?: number
}

const PRESETS_KEY = 'uploadPresets'

export function getPresets(): UploadPreset[] {
  const stored = localStorage.getItem(PRESETS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function savePreset(preset: Omit<UploadPreset, 'id' | 'createdAt'>): UploadPreset {
  const presets = getPresets()
  const newPreset: UploadPreset = {
    ...preset,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
  presets.push(newPreset)
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  return newPreset
}

export function deletePreset(id: string): void {
  const presets = getPresets()
  const filtered = presets.filter((p) => p.id !== id)
  localStorage.setItem(PRESETS_KEY, JSON.stringify(filtered))
}

export function updatePreset(id: string, updates: Partial<UploadPreset>): void {
  const presets = getPresets()
  const index = presets.findIndex((p) => p.id === id)
  if (index !== -1) {
    presets[index] = { ...presets[index], ...updates }
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  }
}

