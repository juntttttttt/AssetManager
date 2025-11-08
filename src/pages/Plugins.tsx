import { useState, useEffect } from 'react'
import { 
  Package, 
  Plus, 
  Trash2, 
  Power, 
  PowerOff, 
  Settings, 
  Code, 
  Play, 
  Save, 
  X,
  FileCode,
  Zap,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import {
  getPlugins,
  installPlugin,
  uninstallPlugin,
  togglePlugin,
  updatePluginSettings,
  getAutomationScripts,
  createAutomationScript,
  updateAutomationScript,
  deleteAutomationScript,
  runAutomationScript,
  Plugin,
  AutomationScript,
} from '../utils/pluginManager'
import { PluginManifest } from '../types/plugin'

export default function Plugins() {
  const toast = useToast()
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [scripts, setScripts] = useState<AutomationScript[]>([])
  const [activeTab, setActiveTab] = useState<'plugins' | 'scripts'>('plugins')
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null)
  const [editingScript, setEditingScript] = useState<AutomationScript | null>(null)
  const [manifestJson, setManifestJson] = useState('')
  const [scriptName, setScriptName] = useState('')
  const [scriptDescription, setScriptDescription] = useState('')
  const [scriptCode, setScriptCode] = useState('')
  const [scriptTrigger, setScriptTrigger] = useState<'manual' | 'on-upload' | 'on-status-change' | 'scheduled'>('manual')
  const [scriptSchedule, setScriptSchedule] = useState('')

  useEffect(() => {
    loadPlugins()
    loadScripts()
  }, [])

  const loadPlugins = () => {
    setPlugins(getPlugins())
  }

  const loadScripts = () => {
    setScripts(getAutomationScripts())
  }

  const handleInstallPlugin = () => {
    try {
      const manifest: PluginManifest = JSON.parse(manifestJson)
      
      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryPoint) {
        toast.error('Invalid manifest: missing required fields (id, name, version, entryPoint)')
        return
      }

      installPlugin(manifest)
      toast.success(`Plugin "${manifest.name}" installed successfully`)
      setShowInstallModal(false)
      setManifestJson('')
      loadPlugins()
    } catch (error: any) {
      toast.error(`Failed to install plugin: ${error.message}`)
    }
  }

  const handleUninstallPlugin = (pluginId: string) => {
    if (confirm('Are you sure you want to uninstall this plugin?')) {
      uninstallPlugin(pluginId)
      toast.success('Plugin uninstalled')
      loadPlugins()
    }
  }

  const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
    togglePlugin(pluginId, enabled)
    toast.success(`Plugin ${enabled ? 'enabled' : 'disabled'}`)
    loadPlugins()
  }

  const handleEditPluginSettings = (plugin: Plugin) => {
    setEditingPlugin(plugin)
  }

  const handleSavePluginSettings = () => {
    if (editingPlugin) {
      const settings: Record<string, any> = {}
      editingPlugin.manifest.settings?.forEach(setting => {
        const input = document.getElementById(`setting-${editingPlugin.manifest.id}-${setting.key}`) as HTMLInputElement
        if (input) {
          if (setting.type === 'boolean') {
            settings[setting.key] = input.checked
          } else if (setting.type === 'number') {
            settings[setting.key] = parseFloat(input.value) || setting.defaultValue
          } else {
            settings[setting.key] = input.value || setting.defaultValue
          }
        }
      })
      updatePluginSettings(editingPlugin.manifest.id, settings)
      toast.success('Plugin settings saved')
      setEditingPlugin(null)
      loadPlugins()
    }
  }

  const handleCreateScript = () => {
    if (!scriptName || !scriptCode) {
      toast.error('Script name and code are required')
      return
    }

    createAutomationScript({
      name: scriptName,
      description: scriptDescription,
      code: scriptCode,
      enabled: true,
      trigger: scriptTrigger,
      schedule: scriptTrigger === 'scheduled' ? scriptSchedule : undefined,
    })
    toast.success('Automation script created')
    setShowScriptModal(false)
    resetScriptForm()
    loadScripts()
  }

  const handleUpdateScript = () => {
    if (!editingScript || !scriptName || !scriptCode) {
      toast.error('Script name and code are required')
      return
    }

    updateAutomationScript(editingScript.id, {
      name: scriptName,
      description: scriptDescription,
      code: scriptCode,
      trigger: scriptTrigger,
      schedule: scriptTrigger === 'scheduled' ? scriptSchedule : undefined,
    })
    toast.success('Automation script updated')
    setShowScriptModal(false)
    setEditingScript(null)
    resetScriptForm()
    loadScripts()
  }

  const handleDeleteScript = (scriptId: string) => {
    if (confirm('Are you sure you want to delete this script?')) {
      deleteAutomationScript(scriptId)
      toast.success('Script deleted')
      loadScripts()
    }
  }

  const handleRunScript = async (script: AutomationScript) => {
    try {
      await runAutomationScript(script)
      toast.success(`Script "${script.name}" executed successfully`)
      loadScripts()
    } catch (error: any) {
      toast.error(`Script execution failed: ${error.message}`)
    }
  }

  const handleToggleScript = (scriptId: string, enabled: boolean) => {
    updateAutomationScript(scriptId, { enabled })
    toast.success(`Script ${enabled ? 'enabled' : 'disabled'}`)
    loadScripts()
  }

  const resetScriptForm = () => {
    setScriptName('')
    setScriptDescription('')
    setScriptCode('')
    setScriptTrigger('manual')
    setScriptSchedule('')
  }

  const openScriptEditor = (script?: AutomationScript) => {
    if (script) {
      setEditingScript(script)
      setScriptName(script.name)
      setScriptDescription(script.description)
      setScriptCode(script.code)
      setScriptTrigger(script.trigger)
      setScriptSchedule(script.schedule || '')
    } else {
      resetScriptForm()
      setEditingScript(null)
    }
    setShowScriptModal(true)
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Package size={28} />
          Plugins & Automation
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'plugins' && (
            <button
              onClick={() => setShowInstallModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={18} />
              Install Plugin
            </button>
          )}
          {activeTab === 'scripts' && (
            <button
              onClick={() => openScriptEditor()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={18} />
              New Script
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('plugins')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'plugins' ? 'var(--bg-secondary)' : 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            borderBottom: activeTab === 'plugins' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Package size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Plugins ({plugins.length})
        </button>
        <button
          onClick={() => setActiveTab('scripts')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'scripts' ? 'var(--bg-secondary)' : 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            borderBottom: activeTab === 'scripts' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Zap size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Automation Scripts ({scripts.length})
        </button>
      </div>

      {/* Plugins Tab */}
      {activeTab === 'plugins' && (
        <div>
          {plugins.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '48px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '24px' }}>
                No plugins installed
              </p>
              <button
                onClick={() => setShowInstallModal(true)}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Install Your First Plugin
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {plugins.map((plugin) => (
                <div
                  key={plugin.manifest.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {plugin.manifest.name}
                        </h3>
                        <span
                          style={{
                            padding: '2px 8px',
                            background: plugin.enabled ? 'var(--success)' : 'var(--text-muted)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          {plugin.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {plugin.error && (
                          <span
                            style={{
                              padding: '2px 8px',
                              background: 'var(--danger)',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                            }}
                          >
                            Error
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                        {plugin.manifest.description}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>v{plugin.manifest.version}</span>
                        <span>by {plugin.manifest.author}</span>
                        {plugin.manifest.permissions && plugin.manifest.permissions.length > 0 && (
                          <span>Permissions: {plugin.manifest.permissions.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleTogglePlugin(plugin.manifest.id, !plugin.enabled)}
                        style={{
                          padding: '6px 12px',
                          background: plugin.enabled ? 'var(--bg-tertiary)' : 'var(--accent)',
                          color: 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title={plugin.enabled ? 'Disable' : 'Enable'}
                      >
                        {plugin.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      {plugin.manifest.settings && plugin.manifest.settings.length > 0 && (
                        <button
                          onClick={() => handleEditPluginSettings(plugin)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          title="Settings"
                        >
                          <Settings size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleUninstallPlugin(plugin.manifest.id)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Uninstall"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {plugin.error && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'rgba(255, 0, 0, 0.1)',
                        border: '1px solid var(--danger)',
                        borderRadius: '6px',
                        color: 'var(--danger)',
                        fontSize: '12px',
                      }}
                    >
                      {plugin.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scripts Tab */}
      {activeTab === 'scripts' && (
        <div>
          {scripts.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '48px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <Zap size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '24px' }}>
                No automation scripts created
              </p>
              <button
                onClick={() => openScriptEditor()}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Create Your First Script
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {scripts.map((script) => (
                <div
                  key={script.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {script.name}
                        </h3>
                        <span
                          style={{
                            padding: '2px 8px',
                            background: script.enabled ? 'var(--success)' : 'var(--text-muted)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          {script.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          {script.trigger}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                        {script.description}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>Runs: {script.runCount}</span>
                        {script.lastRun && (
                          <span>Last run: {new Date(script.lastRun).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {script.trigger === 'manual' && (
                        <button
                          onClick={() => handleRunScript(script)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          title="Run"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleScript(script.id, !script.enabled)}
                        style={{
                          padding: '6px 12px',
                          background: script.enabled ? 'var(--bg-tertiary)' : 'var(--accent)',
                          color: 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title={script.enabled ? 'Disable' : 'Enable'}
                      >
                        {script.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={() => openScriptEditor(script)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Edit"
                      >
                        <Code size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteScript(script.id)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Install Plugin Modal */}
      {showInstallModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowInstallModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Install Plugin</h2>
              <button
                onClick={() => setShowInstallModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Plugin Manifest (JSON)
              </label>
              <textarea
                value={manifestJson}
                onChange={(e) => setManifestJson(e.target.value)}
                placeholder='{"id": "my-plugin", "name": "My Plugin", "version": "1.0.0", "description": "...", "author": "...", "entryPoint": "..."}'
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowInstallModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleInstallPlugin}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Editor Modal */}
      {showScriptModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowScriptModal(false)
            setEditingScript(null)
            resetScriptForm()
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
                {editingScript ? 'Edit Script' : 'New Automation Script'}
              </h2>
              <button
                onClick={() => {
                  setShowScriptModal(false)
                  setEditingScript(null)
                  resetScriptForm()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="My Automation Script"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={scriptDescription}
                  onChange={(e) => setScriptDescription(e.target.value)}
                  placeholder="What does this script do?"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  Trigger
                </label>
                <select
                  value={scriptTrigger}
                  onChange={(e) => setScriptTrigger(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="manual">Manual</option>
                  <option value="on-upload">On Upload</option>
                  <option value="on-status-change">On Status Change</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              {scriptTrigger === 'scheduled' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                    Schedule (Cron Expression)
                  </label>
                  <input
                    type="text"
                    value={scriptSchedule}
                    onChange={(e) => setScriptSchedule(e.target.value)}
                    placeholder="0 0 * * * (daily at midnight)"
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  Code (JavaScript) *
                </label>
                <textarea
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                  placeholder="// Your automation code here&#10;context.console.log('Hello from automation!');"
                  style={{
                    width: '100%',
                    minHeight: '300px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical',
                  }}
                />
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Info size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  The script has access to a <code>context</code> object with methods like <code>context.console.log()</code>, <code>context.getAssets()</code>, etc.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowScriptModal(false)
                  setEditingScript(null)
                  resetScriptForm()
                }}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={editingScript ? handleUpdateScript : handleCreateScript}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                <Save size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {editingScript ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Settings Modal */}
      {editingPlugin && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditingPlugin(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              width: '90%',
              maxWidth: '500px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Plugin Settings</h2>
              <button
                onClick={() => setEditingPlugin(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {editingPlugin.manifest.settings?.map((setting) => (
                <div key={setting.key}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                    {setting.label}
                    {setting.description && (
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {setting.description}
                      </span>
                    )}
                  </label>
                  {setting.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      id={`setting-${editingPlugin.manifest.id}-${setting.key}`}
                      defaultChecked={editingPlugin.settings[setting.key] ?? setting.defaultValue}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  ) : setting.type === 'select' ? (
                    <select
                      id={`setting-${editingPlugin.manifest.id}-${setting.key}`}
                      defaultValue={editingPlugin.settings[setting.key] ?? setting.defaultValue}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      {setting.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={setting.type === 'number' ? 'number' : 'text'}
                      id={`setting-${editingPlugin.manifest.id}-${setting.key}`}
                      defaultValue={editingPlugin.settings[setting.key] ?? setting.defaultValue}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setEditingPlugin(null)}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePluginSettings}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

