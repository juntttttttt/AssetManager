import React from 'react'

export type LayoutPreset = 'compact' | 'spacious' | 'grid' | 'list' | 'card' | 'table'

export interface LayoutPresetConfig {
  preset: LayoutPreset
  gridColumns?: string
  gap?: string
  padding?: string
  cardMinWidth?: string
  showThumbnails?: boolean
  showDetails?: boolean
  density?: 'compact' | 'comfortable' | 'spacious'
}

const defaultPresets: Record<LayoutPreset, LayoutPresetConfig> = {
  compact: {
    preset: 'compact',
    gridColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '12px',
    padding: '12px',
    cardMinWidth: '250px',
    showThumbnails: true,
    showDetails: false,
    density: 'compact',
  },
  spacious: {
    preset: 'spacious',
    gridColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '24px',
    padding: '24px',
    cardMinWidth: '400px',
    showThumbnails: true,
    showDetails: true,
    density: 'spacious',
  },
  grid: {
    preset: 'grid',
    gridColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
    padding: '16px',
    cardMinWidth: '300px',
    showThumbnails: true,
    showDetails: true,
    density: 'comfortable',
  },
  list: {
    preset: 'list',
    gridColumns: '1fr',
    gap: '8px',
    padding: '12px',
    cardMinWidth: '100%',
    showThumbnails: false,
    showDetails: true,
    density: 'compact',
  },
  card: {
    preset: 'card',
    gridColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
    padding: '20px',
    cardMinWidth: '350px',
    showThumbnails: true,
    showDetails: true,
    density: 'comfortable',
  },
  table: {
    preset: 'table',
    gridColumns: '1fr',
    gap: '0px',
    padding: '8px',
    cardMinWidth: '100%',
    showThumbnails: false,
    showDetails: true,
    density: 'compact',
  },
}

export function getLayoutPreset(preset: LayoutPreset = 'grid'): LayoutPresetConfig {
  const saved = localStorage.getItem('layoutPreset')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.preset && defaultPresets[parsed.preset as LayoutPreset]) {
        return { ...defaultPresets[parsed.preset as LayoutPreset], ...parsed }
      }
    } catch (e) {
      console.error('Failed to parse saved layout preset:', e)
    }
  }
  return defaultPresets[preset]
}

export function saveLayoutPreset(config: LayoutPresetConfig): void {
  localStorage.setItem('layoutPreset', JSON.stringify(config))
}

export function setLayoutPreset(preset: LayoutPreset): void {
  saveLayoutPreset(defaultPresets[preset])
}

export function getCurrentLayoutPreset(): LayoutPreset {
  const saved = localStorage.getItem('layoutPreset')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.preset && defaultPresets[parsed.preset as LayoutPreset]) {
        return parsed.preset
      }
    } catch (e) {
      console.error('Failed to parse saved layout preset:', e)
    }
  }
  return 'grid'
}

export function getPresetStyles(preset: LayoutPresetConfig): React.CSSProperties & { display: string; gridTemplateColumns?: string; gap: string; flexDirection?: string } {
  const isListOrTable = preset.preset === 'list' || preset.preset === 'table'
  
  if (isListOrTable) {
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: preset.gap || '8px',
    }
  }
  
  return {
    display: 'grid',
    gridTemplateColumns: preset.gridColumns || 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: preset.gap || '16px',
  }
}

export function getCardStyles(preset: LayoutPresetConfig): React.CSSProperties & { padding?: string; minWidth?: string; display?: string; gridTemplateColumns?: string; gap?: string; alignItems?: string; borderBottom?: string; flexDirection?: string } {
  const isListOrTable = preset.preset === 'list' || preset.preset === 'table'
  
  if (preset.preset === 'table') {
    return {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto auto auto auto',
      gap: '12px',
      padding: preset.padding || '12px',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
    }
  }
  
  if (preset.preset === 'list') {
    return {
      display: 'flex',
      flexDirection: 'row',
      gap: '16px',
      padding: preset.padding || '12px',
      alignItems: 'center',
    }
  }
  
  return {
    padding: preset.padding || '16px',
    minWidth: preset.cardMinWidth || '300px',
  }
}

