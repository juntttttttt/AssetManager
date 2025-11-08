import { ReactNode } from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Upload, Music, Image, Shield, Crown, Settings, BarChart3, History, GitCompare, Clock, Activity } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  useKeyboardShortcuts()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export const navigationItems = [
  { path: '/', label: 'Upload', icon: Upload },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/audios', label: 'Audios', icon: Music },
  { path: '/decals', label: 'Decals', icon: Image },
  { path: '/moderation', label: 'Moderation', icon: Shield },
  { path: '/history', label: 'History', icon: History },
  { path: '/compare', label: 'Compare', icon: GitCompare },
  { path: '/scheduled', label: 'Scheduled', icon: Clock },
  { path: '/performance', label: 'Performance', icon: Activity },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/owner', label: 'Owner', icon: Crown },
]

