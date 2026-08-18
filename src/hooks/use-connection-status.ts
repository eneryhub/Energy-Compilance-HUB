'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { offlineDB } from '@/lib/offline/offline-queue'

export type ConnectionStatus = 'online' | 'offline' | 'syncing'

interface ConnectionStatusReturn {
  status: ConnectionStatus
  pendingCount: number
  showSyncNotification: boolean
  dismissSyncNotification: () => void
  forceSync: () => Promise<{ success: number; failed: number }>
}

// ── Probe configuration ──
const PROBE_INTERVAL_MS = 5000       // Probe every 5 seconds
const PROBE_TIMEOUT_MS = 3000        // Abort probe after 3 seconds
const PROBE_URL = '/api/subscription/status' // Lightweight pass-through endpoint in SW

// ── Global singleton state (shared across all hook instances) ──
let globalOnline = true
const globalListeners = new Set<(online: boolean) => void>()

/** Report a network failure from anywhere in the app */
export function reportNetworkFailure() {
  if (globalOnline) {
    globalOnline = false
    console.warn('[ConnectionStatus] Network failure reported — going OFFLINE')
    globalListeners.forEach(fn => fn(false))
  }
}

/** Report that network is back (called by probe) */
export function reportNetworkRecovery() {
  if (!globalOnline) {
    globalOnline = true
    console.log('[ConnectionStatus] Network recovered — going ONLINE')
    globalListeners.forEach(fn => fn(true))
  }
}

// ── Global fetch error interceptor ──
// Detects ANY failed fetch and instantly reports offline
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  window.fetch = async function patchedFetch(input, init) {
    try {
      const response = await originalFetch.call(this, input, init)
      // If we get a response but it's a synthetic 503 from the Service Worker,
      // treat it as a connectivity issue
      if (response.status === 503) {
        // Check if it looks like an offline response from our SW
        const clone = response.clone()
        try {
          const text = await clone.text()
          if (text.includes('"offline"')) {
            reportNetworkFailure()
          }
        } catch { /* ignore */ }
      }
      return response
    } catch (err) {
      // Any fetch error (net::ERR_INTERNET_DISCONNECTED, timeout, etc.)
      // is a strong signal that we're offline
      reportNetworkFailure()
      throw err
    }
  }
}

export function useConnectionStatus(): ConnectionStatusReturn {
  const [status, setStatus] = useState<ConnectionStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [showSyncNotification, setShowSyncNotification] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const isSyncingRef = useRef(false)
  const probeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Count pending items in both queues ──
  const countPending = useCallback(async (): Promise<number> => {
    let total = 0
    try {
      const stored = localStorage.getItem('ech-pending-sync')
      total += stored ? JSON.parse(stored).length : 0
    } catch { /* ignore */ }
    try {
      total += await offlineDB.getQueueCount()
    } catch { /* ignore */ }
    return total
  }, [])

  // ── Handle global online/offline transitions ──
  useEffect(() => {
    const handleGlobalChange = (online: boolean) => {
      if (online) {
        setStatus('online')
        // Check for pending items
        countPending().then(count => {
          if (count > 0) {
            setShowSyncNotification(true)
            setPendingCount(count)
          }
        })
      } else {
        setStatus('offline')
        // Immediately count pending items
        countPending().then(count => setPendingCount(count))
      }
    }

    globalListeners.add(handleGlobalChange)
    return () => { globalListeners.delete(handleGlobalChange) }
  }, [countPending])

  // ── Immediate initial check: if already offline on mount, report it now ──
  useEffect(() => {
    if (!navigator.onLine) {
      reportNetworkFailure()
    }
  }, [])

  // ── Connectivity probe: periodic check to detect fake-online ──
  useEffect(() => {
    let stopped = false

    const probe = async () => {
      if (stopped || !globalOnline) return // Don't probe if already known offline

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

        const response = await fetch(PROBE_URL, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        })

        clearTimeout(timeout)

        if (response.ok || response.status === 401) {
          // Server is reachable
          if (!globalOnline) {
            reportNetworkRecovery()
          }
        }
      } catch {
        // Probe failed — we should already be offline from the fetch interceptor
        // but if not, report it now
        if (globalOnline) {
          reportNetworkFailure()
        }
      }
    }

    // Start probing immediately (800ms delay to let page hydrate)
    const startTimer = setTimeout(() => {
      if (stopped) return
      probe()
      probeTimerRef.current = setInterval(probe, PROBE_INTERVAL_MS)
    }, 800)

    return () => {
      stopped = true
      clearTimeout(startTimer)
      if (probeTimerRef.current) clearInterval(probeTimerRef.current)
    }
  }, [])

  // ── Also poll pending count when offline ──
  useEffect(() => {
    if (status !== 'offline') return

    pendingTimerRef.current = setInterval(async () => {
      const count = await countPending()
      setPendingCount(count)
    }, 2000)

    return () => {
      if (pendingTimerRef.current) clearInterval(pendingTimerRef.current)
    }
  }, [status, countPending])

  // ── navigator.onLine events (instant for real disconnect/connect) ──
  useEffect(() => {
    const handleOffline = () => {
      // navigator says offline — definitely offline
      reportNetworkFailure()
    }

    const handleOnline = () => {
      // navigator says online — but verify with a probe
      // Don't immediately report online; the fetch interceptor or probe will confirm
      // Reset the global state optimistically — the probe will verify
      if (!globalOnline) {
        globalOnline = true
        setStatus('online')
        console.log('[ConnectionStatus] navigator.onLine → true, verifying...')
        // Run an immediate probe
        fetch(PROBE_URL, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
          .then(res => {
            if (res.ok || res.status === 401) {
              reportNetworkRecovery()
            } else {
              reportNetworkFailure()
            }
          })
          .catch(() => {
            reportNetworkFailure()
          })
      }
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
    if (isSyncingRef.current) return { success: 0, failed: 0 }

    isSyncingRef.current = true
    setIsSyncing(true)
    setStatus('syncing')

    try {
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
    } finally {
      isSyncingRef.current = false
    }
  }, [])

  return {
    status,
    pendingCount,
    showSyncNotification,
    dismissSyncNotification,
    forceSync,
  }
}

