// Content detection for inappropriate uploads
export interface ContentFlag {
  flagged: boolean
  reason?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Inappropriate keywords and patterns
const INAPPROPRIATE_KEYWORDS = [
  // Explicit content
  'cp', 'child', 'loli', 'shota', 'pedo', 'pedophile',
  // Violence/gore
  'gore', 'blood', 'violence', 'kill', 'death', 'murder', 'torture',
  // Other inappropriate
  'nsfw', 'porn', 'xxx', 'sex', 'nude', 'naked',
]

// Suspicious patterns
const SUSPICIOUS_PATTERNS = [
  /^[a-z]{1,3}\d{4,}/i, // Short name with many numbers (common in inappropriate content)
  /.*(cp|gore|nsfw).*/i, // Contains inappropriate keywords
]

export function detectInappropriateContent(fileName: string, fileType: 'audio' | 'decal'): ContentFlag {
  const lowerFileName = fileName.toLowerCase()
  
  // Check for explicit keywords
  for (const keyword of INAPPROPRIATE_KEYWORDS) {
    if (lowerFileName.includes(keyword)) {
      return {
        flagged: true,
        reason: `Contains inappropriate keyword: "${keyword}"`,
        severity: keyword === 'cp' || keyword === 'child' || keyword === 'loli' || keyword === 'shota' || keyword === 'pedo' || keyword === 'pedophile'
          ? 'critical'
          : keyword === 'gore' || keyword === 'violence'
          ? 'high'
          : 'medium',
      }
    }
  }
  
  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(fileName)) {
      return {
        flagged: true,
        reason: 'Matches suspicious naming pattern',
        severity: 'low',
      }
    }
  }
  
  // For decals, be more strict (images are more likely to be inappropriate)
  if (fileType === 'decal') {
    // Check for very short names with numbers (common pattern)
    if (fileName.length < 5 && /\d/.test(fileName)) {
      return {
        flagged: true,
        reason: 'Suspicious short filename pattern',
        severity: 'low',
      }
    }
  }
  
  return {
    flagged: false,
    severity: 'low',
  }
}

// Get severity color
export function getSeverityColor(severity: ContentFlag['severity']): string {
  switch (severity) {
    case 'critical':
      return 'var(--danger)'
    case 'high':
      return '#ff6b35'
    case 'medium':
      return '#ffa500'
    case 'low':
      return '#ffd700'
    default:
      return 'var(--text-muted)'
  }
}

