import { useEffect, useRef } from 'react'
import { robloxAPI } from '../services/robloxApi'
import { useToast } from '../contexts/ToastContext'
import { showNotification, checkNotificationPermission } from '../utils/notifications'
import { emitAssetStatusChanged } from './usePluginHooks'

interface Asset {
  assetId: string
  type: 'audio' | 'decal'
  status: 'pending' | 'accepted' | 'declined'
  name?: string
}

export function useAutoRefresh(assets: Asset[], onUpdate: (updatedAssets: Asset[]) => void, enabled: boolean = true) {
  const toast = useToast()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousStatusesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    // Initialize previous statuses
    assets.forEach((asset) => {
      previousStatusesRef.current.set(asset.assetId, asset.status)
    })
  }, [])

  useEffect(() => {
    if (!enabled || assets.length === 0) {
      return
    }

    const checkStatuses = async () => {
      const pendingAssets = assets.filter((a) => a.status === 'pending')
      if (pendingAssets.length === 0) {
        return
      }

      const updatedAssets: Asset[] = []
      let hasChanges = false

      for (const asset of pendingAssets) {
        try {
          const info = await robloxAPI.checkAssetStatus(asset.assetId, asset.type)
          if (info) {
            const previousStatus = previousStatusesRef.current.get(asset.assetId)
            if (previousStatus !== info.status) {
              hasChanges = true
              updatedAssets.push({
                ...asset,
                status: info.status,
                name: info.name,
              })
              previousStatusesRef.current.set(asset.assetId, info.status)
              
              // Emit plugin event for status change
              emitAssetStatusChanged(asset.assetId, asset.type, previousStatus || 'pending', info.status)

              // Show notification for status change
              if (info.status === 'accepted') {
                toast.success(`${asset.name || 'Asset'} has been accepted!`)
                if (checkNotificationPermission() === 'granted') {
                  showNotification('Asset Accepted', {
                    body: `${asset.name || 'Asset'} (${asset.assetId}) has been accepted`,
                    tag: `asset-${asset.assetId}`,
                  })
                }
              } else if (info.status === 'declined') {
                toast.warning(`${asset.name || 'Asset'} has been declined`)
                if (checkNotificationPermission() === 'granted') {
                  showNotification('Asset Declined', {
                    body: `${asset.name || 'Asset'} (${asset.assetId}) has been declined`,
                    tag: `asset-${asset.assetId}`,
                  })
                }
              }
            }
          }
        } catch (error) {
          // Silently fail - don't spam errors
        }
      }

      if (hasChanges && updatedAssets.length > 0) {
        // Update the assets in localStorage
        updatedAssets.forEach((updated) => {
          if (updated.type === 'audio') {
            const audios = JSON.parse(localStorage.getItem('uploadedAudios') || '[]')
            const index = audios.findIndex((a: any) => a.assetId === updated.assetId)
            if (index !== -1) {
              audios[index].status = updated.status
              localStorage.setItem('uploadedAudios', JSON.stringify(audios))
            }
          } else {
            const decals = JSON.parse(localStorage.getItem('uploadedDecals') || '[]')
            const index = decals.findIndex((d: any) => d.assetId === updated.assetId)
            if (index !== -1) {
              decals[index].status = updated.status
              localStorage.setItem('uploadedDecals', JSON.stringify(decals))
            }
          }
        })

        // Trigger update callback
        onUpdate(updatedAssets)
      }
    }

    // Check immediately, then every 10 seconds for faster updates
    checkStatuses()
    intervalRef.current = setInterval(checkStatuses, 10000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [assets, enabled, onUpdate, toast])
}

