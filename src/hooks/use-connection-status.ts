'use client'

import { useState, useEffect, useCallback } from 'react'

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
    const handleOnline = () => {
      // Check if there are pending items to sync
      const stored = localStorage.getItem('ech-pending-sync')
      const count = stored ? JSON.parse(stored).length : 0

      if (count > 0) {
        setShowSyncNotification(true)
        setPendingCount(count)
      }

      setStatus('online')
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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
      const stored = localStorage.getItem('ech-pending-sync')
      const pending = stored ? JSON.parse(stored) : []

      if (pending.length === 0) {
        setStatus('online')
        setIsSyncing(false)
        return { success: 0, failed: 0 }
      }

      let success = 0
      let failed = 0

      // Process each pending operation
      for (const item of pending) {
        try {
          const response = await fetch(item.url, {
            method: item.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...item.headers,
            },
            body: JSON.stringify(item.body),
          })

          if (response.ok) {
            success++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }

      // Clear processed items
      const remaining = pending.slice(success)
      localStorage.setItem('ech-pending-sync', JSON.stringify(remaining))
      setPendingCount(remaining.length)

      setStatus('online')
      setIsSyncing(false)
      setShowSyncNotification(false)

      return { success, failed }
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
