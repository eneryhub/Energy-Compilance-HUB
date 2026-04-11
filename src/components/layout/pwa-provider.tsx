// Energy-Compliance Hub — PWA Provider
// Initializes Service Worker, Sync Manager, and auto-update mechanism
// Also acts as the FIRST offline detection point in the component tree.

'use client'

import { useEffect, useState } from 'react'
import { syncManager } from '@/lib/offline/sync-manager'
import { reportNetworkFailure, reportNetworkRecovery } from '@/hooks/use-connection-status'

interface PWAProviderProps {
  children: React.ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // ── LAYER 0: Immediate offline detection (before anything else) ──
    if (!navigator.onLine) {
      reportNetworkFailure()
      console.warn('[PWA] Starting OFFLINE — navigator.onLine = false')
    }

    // ── Backup: navigator.onLine events ──
    const handleOffline = () => {
      reportNetworkFailure()
      console.warn('[PWA] navigator.onLine → false')
    }
    const handleOnline = () => {
      // Don't blindly trust — verify with a real fetch
      console.log('[PWA] navigator.onLine → true, verifying...')
      fetch('/api/subscription/status', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })
        .then(res => {
          if (res.ok || res.status === 401) reportNetworkRecovery()
          else reportNetworkFailure()
        })
        .catch(() => reportNetworkFailure())
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Initialize sync manager (registers SW, sets up listeners)
    syncManager.init()

    // Listen for SW updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Auto-reload when new controller activates
        console.log('[PWA] New controller detected, reloading...')
        window.location.reload()
      })
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      syncManager.destroy()
    }
  }, [])

  return (
    <>
      {children}
      {updateAvailable && (
        <button
          onClick={() => window.location.reload()}
          className="fixed bottom-20 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors"
        >
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Actualizar disponible
        </button>
      )}
    </>
  )
}
