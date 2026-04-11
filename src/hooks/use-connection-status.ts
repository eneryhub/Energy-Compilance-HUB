'use client'

import { useState, useEffect, useCallback } from 'react'
import { offlineDB } from '@/lib/offline/offline-queue'

export type ConnectionStatus = 'online' | 'offline' | 'syncing'

interface ConnectionStatusReturn {
  status: ConnectionStatus
  pendingCount: number
  showSyncNotification: boolean
  dismissSyncNotification: () => void
  forceSync: () => Promise<{ success: number; failed: number }>
}

export function useConnectionStatus(): ConnectionStatusReturn {
  const getInitialStatus = (): ConnectionStatus => {
    if (typeof navigator === 'undefined') return 'online'
    return navigator.onLine ? 'online' : 'offline'
  }

  const [status, setStatus] = useState<ConnectionStatus>(getInitialStatus)
  const [pendingCount, setPendingCount] = useState(0)
  const [showSyncNotification, setShowSyncNotification] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Track online/offline status
  useEffect(() => {
    const countPending = async () => {
      // Count both localStorage and IndexedDB queues
      let total = 0
      try {
        const stored = localStorage.getItem('ech-pending-sync')
        total += stored ? JSON.parse(stored).length : 0
      } catch { /* ignore */ }
      try {
        total += await offlineDB.getQueueCount()
      } catch { /* ignore */ }
      return total
    }

    const handleOnline = async () => {
      const count = await countPending()

      if (count > 0) {
        setShowSyncNotification(true)
        setPendingCount(count)
      }

      setStatus('online')
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    // Also poll IndexedDB count periodically (for items queued while offline)
    const pollInterval = setInterval(async () => {
      if (!navigator.onLine) {
        const count = await countPending()
        setPendingCount(count)
      }
    }, 2000)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(pollInterval)
    }
  }, [])

  const dismissSyncNotification = useCallback(() => {
    setShowSyncNotification(false)
  }, [])

  const forceSync = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (isSyncing) return { success: 0, failed: 0 }

    setIsSyncing(true)
    setStatus('syncing')

    try {
      // Use syncManager which now drains both localStorage and IndexedDB
      const { syncManager } = await import('@/lib/offline/sync-manager')
      const result = await syncManager.syncAll()

      setPendingCount(0)
      setStatus('online')
      setIsSyncing(false)
      setShowSyncNotification(false)

      return result
    } catch {
      setStatus('online')
      setIsSyncing(false)
      return { success: 0, failed: 0 }
    }
  }, [isSyncing])

  return {
    status,
    pendingCount,
    showSyncNotification,
    dismissSyncNotification,
    forceSync,
  }
}
