// Energy-Compliance Hub — PWA Provider
// Initializes Service Worker, Sync Manager, and auto-update mechanism

'use client'

import { useEffect, useState } from 'react'
import { syncManager } from '@/lib/offline/sync-manager'

interface PWAProviderProps {
  children: React.ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
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
