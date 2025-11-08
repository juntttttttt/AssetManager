import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'light'
export type ThemeVariant = 'default' | 'darker' | 'amoled' | 'blue-dark' | 'green-dark' | 'warmer-dark' | 'cooler-dark' | 'lighter' | 'warm' | 'cool' | 'blue-light' | 'green-light' | 'spectrum' | 'neon' | 'sunset' | 'ocean' | 'forest' | 'purple-dream' | 'cyberpunk' | 'aurora'

export type ColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'pink' | 'cyan' | 'yellow' | 'magenta' | 'gradient-ocean' | 'gradient-sunset' | 'gradient-neon' | 'gradient-pastel-green' | 'gradient-pastel-peach' | 'gradient-pastel-purple' | 'gradient-pastel-yellow' | 'gradient-pastel-pink' | 'gradient-pastel-blue' | 'gradient-pastel-cream' | 'gradient-vibrant-orange' | 'gradient-vibrant-blue' | 'gradient-vibrant-green' | 'gradient-vibrant-red' | 'gradient-vibrant-brown' | 'gradient-vibrant-blue-green' | 'gradient-vibrant-purple' | 'gradient-teal-purple' | 'gradient-pink-orange' | 'gradient-blue-green-dark' | 'custom'

interface ThemeContextType {
  theme: Theme
  themeVariant: ThemeVariant
  colorScheme: ColorScheme
  accentColor: string
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setThemeVariant: (variant: ThemeVariant) => void
  setColorScheme: (scheme: ColorScheme) => void
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const COLOR_SCHEMES: Record<ColorScheme, { accent: string; accentHover: string; gradient?: string }> = {
  default: { accent: '#5865f2', accentHover: '#4752c4' },
  blue: { accent: '#3b82f6', accentHover: '#2563eb' },
  green: { accent: '#10b981', accentHover: '#059669' },
  purple: { accent: '#8b5cf6', accentHover: '#7c3aed' },
  red: { accent: '#ef4444', accentHover: '#dc2626' },
  orange: { accent: '#f97316', accentHover: '#ea580c' },
  pink: { accent: '#ec4899', accentHover: '#db2777' },
  cyan: { accent: '#06b6d4', accentHover: '#0891b2' },
  yellow: { accent: '#eab308', accentHover: '#ca8a04' },
  magenta: { accent: '#d946ef', accentHover: '#c026d3' },
  'gradient-ocean': { accent: '#00bfff', accentHover: '#0099cc', gradient: 'linear-gradient(135deg, #00bfff, #0066cc, #003366)' },
  'gradient-sunset': { accent: '#ff6b6b', accentHover: '#ee5a6f', gradient: 'linear-gradient(135deg, #ff6b6b, #ffa500, #ff8c00, #ff6347)' },
  'gradient-neon': { accent: '#00ff88', accentHover: '#00cc6a', gradient: 'linear-gradient(135deg, #00ff88, #00d4ff, #ff00ff, #ff0080)' },
  'gradient-pastel-green': { accent: '#a8e6cf', accentHover: '#8dd3c0', gradient: 'linear-gradient(135deg, #a8e6cf, #88d8c0, #7fd3b3)' },
  'gradient-pastel-peach': { accent: '#ffd3b6', accentHover: '#ffc8a2', gradient: 'linear-gradient(135deg, #ffd3b6, #ffc5a1, #ffb88c)' },
  'gradient-pastel-purple': { accent: '#c7ceea', accentHover: '#b8c0e0', gradient: 'linear-gradient(135deg, #c7ceea, #b8c0e0, #a9b3d6)' },
  'gradient-pastel-yellow': { accent: '#ffeaa7', accentHover: '#ffe194', gradient: 'linear-gradient(135deg, #ffeaa7, #ffd93d, #fdcb6e)' },
  'gradient-pastel-pink': { accent: '#ffd9e3', accentHover: '#ffc8d8', gradient: 'linear-gradient(135deg, #ffd9e3, #ffc8d8, #ffb7cd)' },
  'gradient-pastel-blue': { accent: '#d4e4f7', accentHover: '#c4d9f0', gradient: 'linear-gradient(135deg, #d4e4f7, #c4d9f0, #b4cee9)' },
  'gradient-pastel-cream': { accent: '#fff8e1', accentHover: '#fff3c4', gradient: 'linear-gradient(135deg, #fff8e1, #fff3c4, #ffecb3)' },
  'gradient-vibrant-orange': { accent: '#ff6b35', accentHover: '#ff5722', gradient: 'linear-gradient(135deg, #ff6b35, #f7931e, #ff9800)' },
  'gradient-vibrant-blue': { accent: '#667eea', accentHover: '#5568d3', gradient: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)' },
  'gradient-vibrant-green': { accent: '#11998e', accentHover: '#0d7a70', gradient: 'linear-gradient(135deg, #11998e, #38ef7d, #56ab2f)' },
  'gradient-vibrant-red': { accent: '#eb3349', accentHover: '#d32f2f', gradient: 'linear-gradient(135deg, #eb3349, #f45c43, #c0392b)' },
  'gradient-vibrant-brown': { accent: '#8b4513', accentHover: '#6b3410', gradient: 'linear-gradient(135deg, #8b4513, #a0522d, #654321)' },
  'gradient-vibrant-blue-green': { accent: '#1e3c72', accentHover: '#152a54', gradient: 'linear-gradient(135deg, #1e3c72, #2a5298, #1e88e5)' },
  'gradient-vibrant-purple': { accent: '#6a11cb', accentHover: '#4a0d91', gradient: 'linear-gradient(135deg, #6a11cb, #2575fc, #8b00ff)' },
  'gradient-teal-purple': { accent: '#00c9ff', accentHover: '#00a8cc', gradient: 'linear-gradient(135deg, #00c9ff, #92fe9d, #8b5cf6)' },
  'gradient-pink-orange': { accent: '#ff6b9d', accentHover: '#ff4d7a', gradient: 'linear-gradient(135deg, #ff6b9d, #c471ed, #f64f59)' },
  'gradient-blue-green-dark': { accent: '#0f4c75', accentHover: '#0a3450', gradient: 'linear-gradient(135deg, #0f4c75, #3282b8, #bbe1fa)' },
  custom: { accent: '#5865f2', accentHover: '#4752c4' }, // Will be overridden by accentColor
}

// Theme color variants for dark and light themes
const THEME_VARIANTS: Record<ThemeVariant, {
  dark: { bgPrimary: string; bgSecondary: string; bgTertiary: string; bgHover: string; textPrimary: string; textSecondary: string; textMuted: string; border: string }
  light: { bgPrimary: string; bgSecondary: string; bgTertiary: string; bgHover: string; textPrimary: string; textSecondary: string; textMuted: string; border: string }
}> = {
  default: {
    dark: { bgPrimary: '#1e1f22', bgSecondary: '#2b2d31', bgTertiary: '#313338', bgHover: '#35373c', textPrimary: '#f2f3f5', textSecondary: '#b9bbbe', textMuted: '#72767d', border: '#3f4147' },
    light: { bgPrimary: '#ffffff', bgSecondary: '#f2f3f5', bgTertiary: '#e3e5e8', bgHover: '#d4d7dc', textPrimary: '#060607', textSecondary: '#4e5058', textMuted: '#747f8d', border: '#d4d7dc' },
  },
  darker: {
    dark: { bgPrimary: '#0f0f10', bgSecondary: '#1a1b1e', bgTertiary: '#232428', bgHover: '#2a2c30', textPrimary: '#f2f3f5', textSecondary: '#b9bbbe', textMuted: '#72767d', border: '#2f3136' },
    light: { bgPrimary: '#ffffff', bgSecondary: '#f8f9fa', bgTertiary: '#e9ecef', bgHover: '#dee2e6', textPrimary: '#000000', textSecondary: '#495057', textMuted: '#6c757d', border: '#ced4da' },
  },
  amoled: {
    dark: { bgPrimary: '#000000', bgSecondary: '#0a0a0a', bgTertiary: '#141414', bgHover: '#1a1a1a', textPrimary: '#ffffff', textSecondary: '#d0d0d0', textMuted: '#888888', border: '#222222' },
    light: { bgPrimary: '#ffffff', bgSecondary: '#f5f5f5', bgTertiary: '#eeeeee', bgHover: '#e0e0e0', textPrimary: '#000000', textSecondary: '#333333', textMuted: '#666666', border: '#cccccc' },
  },
  'blue-dark': {
    dark: { bgPrimary: '#1a1d2e', bgSecondary: '#252a3d', bgTertiary: '#2d3449', bgHover: '#353b52', textPrimary: '#e8eaf6', textSecondary: '#c5cae9', textMuted: '#9fa8da', border: '#3f4a66' },
    light: { bgPrimary: '#f0f4ff', bgSecondary: '#e3ebff', bgTertiary: '#d6e2ff', bgHover: '#c9d9ff', textPrimary: '#0d1b2a', textSecondary: '#1b263b', textMuted: '#415a77', border: '#b8c8ff' },
  },
  'green-dark': {
    dark: { bgPrimary: '#1a2e1a', bgSecondary: '#253d25', bgTertiary: '#2d492d', bgHover: '#355235', textPrimary: '#e8f5e9', textSecondary: '#c8e6c9', textMuted: '#a5d6a7', border: '#3f5f3f' },
    light: { bgPrimary: '#f1f8f4', bgSecondary: '#e8f5ed', bgTertiary: '#dff2e6', bgHover: '#d6efdf', textPrimary: '#1b3e1b', textSecondary: '#2d4e2d', textMuted: '#4a6a4a', border: '#cde8d8' },
  },
  'warmer-dark': {
    dark: { bgPrimary: '#1f1c1a', bgSecondary: '#2d2824', bgTertiary: '#36312c', bgHover: '#3f3933', textPrimary: '#f5f3f0', textSecondary: '#d4c9c0', textMuted: '#a89d94', border: '#4a433c' },
    light: { bgPrimary: '#fffaf5', bgSecondary: '#f5ede3', bgTertiary: '#ebe0d1', bgHover: '#e1d3bf', textPrimary: '#2d1f0f', textSecondary: '#4a3320', textMuted: '#6b4e2e', border: '#d7c4a8' },
  },
  'cooler-dark': {
    dark: { bgPrimary: '#1a1d22', bgSecondary: '#252a31', bgTertiary: '#2d3438', bgHover: '#353d42', textPrimary: '#f0f2f5', textSecondary: '#c8d0d8', textMuted: '#9aa5b0', border: '#3f4a52' },
    light: { bgPrimary: '#f8f9fa', bgSecondary: '#e9ecef', bgTertiary: '#dee2e6', bgHover: '#d1d5db', textPrimary: '#0a0d12', textSecondary: '#1a1f26', textMuted: '#2d3438', border: '#c4c9d0' },
  },
  lighter: {
    dark: { bgPrimary: '#2b2d31', bgSecondary: '#36393f', bgTertiary: '#40444b', bgHover: '#484c54', textPrimary: '#ffffff', textSecondary: '#dcddde', textMuted: '#a3a6aa', border: '#4f545c' },
    light: { bgPrimary: '#fafbfc', bgSecondary: '#f0f1f3', bgTertiary: '#e6e8eb', bgHover: '#dcdde0', textPrimary: '#2e3338', textSecondary: '#5e6770', textMuted: '#747f8d', border: '#c7ccd1' },
  },
  warm: {
    dark: { bgPrimary: '#1e1b18', bgSecondary: '#2a2622', bgTertiary: '#33302b', bgHover: '#3c3933', textPrimary: '#f5f2ed', textSecondary: '#d4ccc0', textMuted: '#a89d8f', border: '#4a4339' },
    light: { bgPrimary: '#fffef9', bgSecondary: '#f5f0e8', bgTertiary: '#ebe2d6', bgHover: '#e1d4c4', textPrimary: '#2d2418', textSecondary: '#4a3d2d', textMuted: '#6b5842', border: '#d7c4a8' },
  },
  cool: {
    dark: { bgPrimary: '#1a1d22', bgSecondary: '#252a31', bgTertiary: '#2d3438', bgHover: '#353d42', textPrimary: '#f0f2f5', textSecondary: '#c8d0d8', textMuted: '#9aa5b0', border: '#3f4a52' },
    light: { bgPrimary: '#f8fafb', bgSecondary: '#eef2f5', bgTertiary: '#e4e9ed', bgHover: '#dae0e5', textPrimary: '#0d1b2a', textSecondary: '#1b263b', textMuted: '#415a77', border: '#cbd5e0' },
  },
  'blue-light': {
    dark: { bgPrimary: '#1a1d2e', bgSecondary: '#252a3d', bgTertiary: '#2d3449', bgHover: '#353b52', textPrimary: '#e8eaf6', textSecondary: '#c5cae9', textMuted: '#9fa8da', border: '#3f4a66' },
    light: { bgPrimary: '#f0f4ff', bgSecondary: '#e3ebff', bgTertiary: '#d6e2ff', bgHover: '#c9d9ff', textPrimary: '#0d1b2a', textSecondary: '#1b263b', textMuted: '#415a77', border: '#b8c8ff' },
  },
  'green-light': {
    dark: { bgPrimary: '#1a2e1a', bgSecondary: '#253d25', bgTertiary: '#2d492d', bgHover: '#355235', textPrimary: '#e8f5e9', textSecondary: '#c8e6c9', textMuted: '#a5d6a7', border: '#3f5f3f' },
    light: { bgPrimary: '#f1f8f4', bgSecondary: '#e8f5ed', bgTertiary: '#dff2e6', bgHover: '#d6efdf', textPrimary: '#1b3e1b', textSecondary: '#2d4e2d', textMuted: '#4a6a4a', border: '#cde8d8' },
  },
  spectrum: {
    dark: { bgPrimary: '#1a0f1f', bgSecondary: '#2a1a2f', bgTertiary: '#3a2a3f', bgHover: '#4a3a4f', textPrimary: '#ffeb3b', textSecondary: '#ff9800', textMuted: '#ff5722', border: '#9c27b0' },
    light: { bgPrimary: '#fff5f5', bgSecondary: '#ffe5e5', bgTertiary: '#ffd5d5', bgHover: '#ffc5c5', textPrimary: '#d32f2f', textSecondary: '#f57c00', textMuted: '#fbc02d', border: '#7b1fa2' },
  },
  neon: {
    dark: { bgPrimary: '#0a0a0f', bgSecondary: '#1a1a2e', bgTertiary: '#2a2a3d', bgHover: '#3a3a4d', textPrimary: '#00ff88', textSecondary: '#00d4ff', textMuted: '#ff00ff', border: '#00ff41' },
    light: { bgPrimary: '#f0fff4', bgSecondary: '#e0ffe8', bgTertiary: '#d0ffdc', bgHover: '#c0ffd0', textPrimary: '#00a855', textSecondary: '#00b8d4', textMuted: '#c51162', border: '#00e676' },
  },
  sunset: {
    dark: { bgPrimary: '#1a0f0a', bgSecondary: '#2a1f14', bgTertiary: '#3a2f1e', bgHover: '#4a3f28', textPrimary: '#ffb74d', textSecondary: '#ff8a65', textMuted: '#ff7043', border: '#ff6f00' },
    light: { bgPrimary: '#fff8f0', bgSecondary: '#fff0e0', bgTertiary: '#ffe8d0', bgHover: '#ffe0c0', textPrimary: '#e65100', textSecondary: '#f57c00', textMuted: '#ff6f00', border: '#ff9800' },
  },
  ocean: {
    dark: { bgPrimary: '#0a1a2a', bgSecondary: '#1a2a3a', bgTertiary: '#2a3a4a', bgHover: '#3a4a5a', textPrimary: '#4fc3f7', textSecondary: '#29b6f6', textMuted: '#03a9f4', border: '#0288d1' },
    light: { bgPrimary: '#e0f2f1', bgSecondary: '#b2dfdb', bgTertiary: '#80cbc4', bgHover: '#4db6ac', textPrimary: '#00695c', textSecondary: '#00897b', textMuted: '#009688', border: '#00acc1' },
  },
  forest: {
    dark: { bgPrimary: '#0a1a0a', bgSecondary: '#1a2a1a', bgTertiary: '#2a3a2a', bgHover: '#3a4a3a', textPrimary: '#81c784', textSecondary: '#66bb6a', textMuted: '#4caf50', border: '#388e3c' },
    light: { bgPrimary: '#e8f5e9', bgSecondary: '#c8e6c9', bgTertiary: '#a5d6a7', bgHover: '#81c784', textPrimary: '#1b5e20', textSecondary: '#2e7d32', textMuted: '#388e3c', border: '#43a047' },
  },
  'purple-dream': {
    dark: { bgPrimary: '#1a0f2a', bgSecondary: '#2a1f3a', bgTertiary: '#3a2f4a', bgHover: '#4a3f5a', textPrimary: '#ba68c8', textSecondary: '#ab47bc', textMuted: '#9c27b0', border: '#8e24aa' },
    light: { bgPrimary: '#f3e5f5', bgSecondary: '#e1bee7', bgTertiary: '#ce93d8', bgHover: '#ba68c8', textPrimary: '#4a148c', textSecondary: '#6a1b9a', textMuted: '#7b1fa2', border: '#8e24aa' },
  },
  cyberpunk: {
    dark: { bgPrimary: '#0a0a1a', bgSecondary: '#1a1a2a', bgTertiary: '#2a2a3a', bgHover: '#3a3a4a', textPrimary: '#ff00ff', textSecondary: '#00ffff', textMuted: '#ffff00', border: '#ff0080' },
    light: { bgPrimary: '#fff0ff', bgSecondary: '#ffe0ff', bgTertiary: '#ffd0ff', bgHover: '#ffc0ff', textPrimary: '#c51162', textSecondary: '#00acc1', textMuted: '#fbc02d', border: '#e91e63' },
  },
  aurora: {
    dark: { bgPrimary: '#0a1a1f', bgSecondary: '#1a2a2f', bgTertiary: '#2a3a3f', bgHover: '#3a4a4f', textPrimary: '#4dd0e1', textSecondary: '#26c6da', textMuted: '#00bcd4', border: '#00acc1' },
    light: { bgPrimary: '#e0f7fa', bgSecondary: '#b2ebf2', bgTertiary: '#80deea', bgHover: '#4dd0e1', textPrimary: '#006064', textSecondary: '#00838f', textMuted: '#0097a7', border: '#00acc1' },
  },
}

// Helper to calculate hover color from base color
function calculateHoverColor(color: string): string {
  // Convert hex to RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Darken by 15%
  const darken = (val: number) => Math.max(0, Math.floor(val * 0.85))
  
  const newR = darken(r).toString(16).padStart(2, '0')
  const newG = darken(g).toString(16).padStart(2, '0')
  const newB = darken(b).toString(16).padStart(2, '0')
  
  return `#${newR}${newG}${newB}`
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    return saved || 'dark'
  })

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem('colorScheme') as ColorScheme | string
    // Migrate old 'gradient-rainbow' to 'gradient-spectrum'
    if (saved === 'gradient-rainbow') {
      localStorage.setItem('colorScheme', 'gradient-spectrum')
      return 'gradient-spectrum'
    }
    // Validate that the saved scheme exists in COLOR_SCHEMES
    if (saved && saved in COLOR_SCHEMES) {
      return saved as ColorScheme
    }
    return 'default'
  })

  const [accentColor, setAccentColorState] = useState<string>(() => {
    const saved = localStorage.getItem('accentColor')
    // Ensure colorScheme exists in COLOR_SCHEMES before accessing
    const scheme = COLOR_SCHEMES[colorScheme]
    if (!scheme) {
      // Fallback if scheme is invalid
      return saved || COLOR_SCHEMES.default.accent
    }
    return saved || scheme.accent
  })

  const [themeVariant, setThemeVariantState] = useState<ThemeVariant>(() => {
    const saved = localStorage.getItem('themeVariant') as ThemeVariant | string
    // Migrate old 'rainbow' to 'spectrum'
    if (saved === 'rainbow') {
      localStorage.setItem('themeVariant', 'spectrum')
      return 'spectrum'
    }
    // Validate that the saved variant exists in THEME_VARIANTS
    if (saved && saved in THEME_VARIANTS) {
      return saved as ThemeVariant
    }
    return 'default'
  })

  const updateThemeColors = () => {
    const root = document.documentElement
    const variant = THEME_VARIANTS[themeVariant]
    // Fallback to default if variant doesn't exist
    if (!variant) {
      const defaultVariant = THEME_VARIANTS.default
      const colors = theme === 'dark' ? defaultVariant.dark : defaultVariant.light
      root.style.setProperty('--bg-primary', colors.bgPrimary)
      root.style.setProperty('--bg-secondary', colors.bgSecondary)
      root.style.setProperty('--bg-tertiary', colors.bgTertiary)
      root.style.setProperty('--bg-hover', colors.bgHover)
      root.style.setProperty('--text-primary', colors.textPrimary)
      root.style.setProperty('--text-secondary', colors.textSecondary)
      root.style.setProperty('--text-muted', colors.textMuted)
      root.style.setProperty('--border', colors.border)
      return
    }
    const colors = theme === 'dark' ? variant.dark : variant.light
    
    root.style.setProperty('--bg-primary', colors.bgPrimary)
    root.style.setProperty('--bg-secondary', colors.bgSecondary)
    root.style.setProperty('--bg-tertiary', colors.bgTertiary)
    root.style.setProperty('--bg-hover', colors.bgHover)
    root.style.setProperty('--text-primary', colors.textPrimary)
    root.style.setProperty('--text-secondary', colors.textSecondary)
    root.style.setProperty('--text-muted', colors.textMuted)
    root.style.setProperty('--border', colors.border)
  }

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    updateThemeColors()
  }, [theme, themeVariant])

  useEffect(() => {
    localStorage.setItem('themeVariant', themeVariant)
    updateThemeColors()
  }, [themeVariant])

  useEffect(() => {
    localStorage.setItem('colorScheme', colorScheme)
    if (colorScheme !== 'custom') {
      const scheme = COLOR_SCHEMES[colorScheme]
      if (scheme) {
        setAccentColorState(scheme.accent)
        localStorage.setItem('accentColor', scheme.accent)
      }
    }
  }, [colorScheme])

  useEffect(() => {
    localStorage.setItem('accentColor', accentColor)
    updateCSSVariables()
  }, [accentColor, colorScheme])

  const updateCSSVariables = () => {
    const root = document.documentElement
    const scheme = COLOR_SCHEMES[colorScheme]
    // Fallback to default if scheme doesn't exist
    if (!scheme) {
      const defaultScheme = COLOR_SCHEMES.default
      root.style.setProperty('--accent', accentColor || defaultScheme.accent)
      root.style.setProperty('--accent-hover', calculateHoverColor(accentColor || defaultScheme.accent))
      root.style.setProperty('--accent-gradient', accentColor || defaultScheme.accent)
      root.removeAttribute('data-gradient-accent')
      return
    }
    
    const hoverColor = colorScheme === 'custom' 
      ? calculateHoverColor(accentColor)
      : scheme.accentHover
    
    // Check if it's a gradient scheme
    const isGradient = colorScheme.startsWith('gradient-')
    
    if (isGradient && scheme.gradient) {
      // For gradients, create animated versions with looping colors
      let animatedGradient = scheme.gradient
      let gradientSize = '400% 400%'
      let animationDuration = '5s'
      
      // Map gradient schemes to their animated versions with looping colors
      const gradientConfigs: Record<string, { gradient: string; size: string; duration: string }> = {
        'gradient-ocean': { gradient: 'linear-gradient(135deg, #00bfff, #0066cc, #003366, #00bfff)', size: '300% 300%', duration: '4s' },
        'gradient-sunset': { gradient: 'linear-gradient(135deg, #ff6b6b, #ffa500, #ff8c00, #ff6347, #ff6b6b)', size: '300% 300%', duration: '4s' },
        'gradient-neon': { gradient: 'linear-gradient(135deg, #00ff88, #00d4ff, #ff00ff, #ff0080, #00ff88)', size: '400% 400%', duration: '3s' },
        'gradient-pastel-green': { gradient: 'linear-gradient(135deg, #a8e6cf, #88d8c0, #7fd3b3, #a8e6cf)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-peach': { gradient: 'linear-gradient(135deg, #ffd3b6, #ffc5a1, #ffb88c, #ffd3b6)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-purple': { gradient: 'linear-gradient(135deg, #c7ceea, #b8c0e0, #a9b3d6, #c7ceea)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-yellow': { gradient: 'linear-gradient(135deg, #ffeaa7, #ffd93d, #fdcb6e, #ffeaa7)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-pink': { gradient: 'linear-gradient(135deg, #ffd9e3, #ffc8d8, #ffb7cd, #ffd9e3)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-blue': { gradient: 'linear-gradient(135deg, #d4e4f7, #c4d9f0, #b4cee9, #d4e4f7)', size: '300% 300%', duration: '4s' },
        'gradient-pastel-cream': { gradient: 'linear-gradient(135deg, #fff8e1, #fff3c4, #ffecb3, #fff8e1)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-orange': { gradient: 'linear-gradient(135deg, #ff6b35, #f7931e, #ff9800, #ff6b35)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-blue': { gradient: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #667eea)', size: '400% 400%', duration: '5s' },
        'gradient-vibrant-green': { gradient: 'linear-gradient(135deg, #11998e, #38ef7d, #56ab2f, #11998e)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-red': { gradient: 'linear-gradient(135deg, #eb3349, #f45c43, #c0392b, #eb3349)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-brown': { gradient: 'linear-gradient(135deg, #8b4513, #a0522d, #654321, #8b4513)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-blue-green': { gradient: 'linear-gradient(135deg, #1e3c72, #2a5298, #1e88e5, #1e3c72)', size: '300% 300%', duration: '4s' },
        'gradient-vibrant-purple': { gradient: 'linear-gradient(135deg, #6a11cb, #2575fc, #8b00ff, #6a11cb)', size: '400% 400%', duration: '5s' },
        'gradient-teal-purple': { gradient: 'linear-gradient(135deg, #00c9ff, #92fe9d, #8b5cf6, #00c9ff)', size: '400% 400%', duration: '5s' },
        'gradient-pink-orange': { gradient: 'linear-gradient(135deg, #ff6b9d, #c471ed, #f64f59, #ff6b9d)', size: '400% 400%', duration: '5s' },
        'gradient-blue-green-dark': { gradient: 'linear-gradient(135deg, #0f4c75, #3282b8, #bbe1fa, #0f4c75)', size: '300% 300%', duration: '4s' },
      }
      
      const config = gradientConfigs[colorScheme]
      if (config) {
        animatedGradient = config.gradient
        gradientSize = config.size
        animationDuration = config.duration
      }
      
      // Keep accent as a solid color for non-button elements, but buttons will use gradient
      root.style.setProperty('--accent', scheme.accent)
      root.style.setProperty('--accent-hover', scheme.accentHover)
      root.style.setProperty('--accent-gradient', animatedGradient)
      root.style.setProperty('--accent-gradient-size', gradientSize)
      root.style.setProperty('--accent-gradient-duration', animationDuration)
      root.setAttribute('data-gradient-accent', 'true')
      
      // Inject dynamic CSS to apply animated gradients to all buttons with accent
      const styleId = 'gradient-accent-style'
      let styleEl = document.getElementById(styleId) as HTMLStyleElement
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = styleId
        document.head.appendChild(styleEl)
      }
      
      // Create comprehensive selectors to catch all variations
      styleEl.textContent = `
        /* Target buttons with accent background in various formats */
        :root[data-gradient-accent="true"] button[style*="var(--accent)"],
        :root[data-gradient-accent="true"] button[style*="background: var(--accent)"],
        :root[data-gradient-accent="true"] button[style*="background:var(--accent)"],
        :root[data-gradient-accent="true"] [style*="background: var(--accent)"],
        :root[data-gradient-accent="true"] [style*="background:var(--accent)"] {
          background: ${animatedGradient} !important;
          background-size: ${gradientSize} !important;
          animation: gradient-rotate ${animationDuration} ease infinite !important;
          color: white !important;
          position: relative;
        }
        
        /* Hover effect for gradient buttons */
        :root[data-gradient-accent="true"] button[style*="var(--accent)"]:hover,
        :root[data-gradient-accent="true"] button[style*="background: var(--accent)"]:hover,
        :root[data-gradient-accent="true"] button[style*="background:var(--accent)"]:hover {
          filter: brightness(0.9);
        }
        
        /* Override hover handlers that set background */
        :root[data-gradient-accent="true"] button[style*="var(--accent)"]:hover::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.1);
          border-radius: inherit;
          pointer-events: none;
        }
      `
    } else {
      root.style.setProperty('--accent', accentColor)
      root.style.setProperty('--accent-hover', hoverColor)
      root.style.setProperty('--accent-gradient', accentColor)
      root.removeAttribute('data-gradient-accent')
      
      // Remove gradient style if it exists
      const styleEl = document.getElementById('gradient-accent-style')
      if (styleEl) {
        styleEl.remove()
      }
    }
  }

  // Initialize CSS variables on mount
  useEffect(() => {
    updateCSSVariables()
    updateThemeColors()
  }, [])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme)
    if (scheme !== 'custom') {
      const colors = COLOR_SCHEMES[scheme]
      if (colors) {
        setAccentColorState(colors.accent)
      }
    }
  }

  const setAccentColor = (color: string) => {
    setAccentColorState(color)
    setColorSchemeState('custom')
  }

  const setThemeVariant = (variant: ThemeVariant) => {
    setThemeVariantState(variant)
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      themeVariant,
      colorScheme, 
      accentColor, 
      toggleTheme, 
      setTheme, 
      setThemeVariant,
      setColorScheme, 
      setAccentColor 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

