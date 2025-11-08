import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { usePluginHooks } from './hooks/usePluginHooks'
import Upload from './pages/Upload'
import Moderation from './pages/Moderation'
import Owner from './pages/Owner'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import AssetComparison from './pages/AssetComparison'
import ScheduledUploads from './pages/ScheduledUploads'
import Performance from './pages/Performance'
import BlockedAccess from './components/BlockedAccess'

function AppRoutes() {
  usePluginHooks()
  
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
                <Route path="/" element={<Upload />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/audios" element={<BlockedAccess />} />
                <Route path="/decals" element={<BlockedAccess />} />
                <Route path="/moderation" element={<Moderation />} />
                <Route path="/history" element={<History />} />
                <Route path="/compare" element={<AssetComparison />} />
                <Route path="/scheduled" element={<ScheduledUploads />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/settings" element={<Settings />} />
              <Route path="/owner" element={<Owner />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}

export default App

