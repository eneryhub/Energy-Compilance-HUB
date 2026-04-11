// Energy-Compliance Hub — PWA Provider
// Initializes Service Worker, Sync Manager, and auto-update mechanism.
// Also renders the CRITICAL offline banner directly — this is the ONE
// component that is guaranteed to execute (proven by logs), so the
// banner MUST live here, not in a separate imported component.

'use client'

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { syncManager } from '@/lib/offline/sync-manager'
import { reportNetworkFailure, reportNetworkRecovery } from '@/hooks/use-connection-status'
import { WifiOff, RefreshCw, ArrowUpFromLine, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── External store for navigator.onLine (synchronous read during render) ──
function subscribeToNetworkStatus(callback: () => void) {
  const onOnline = () => callback()
  const onOffline = () => callback()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

function getNetworkOfflineSnapshot() {
  return typeof navigator !== 'undefined' ? !navigator.onLine : true
}

function getServerOfflineSnapshot() {
  return true // Assume offline on server (safe default)
}

interface PWAProviderProps {
  children: React.ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  // ── Offline state: useSyncExternalStore reads navigator.onLine SYNCHRONOUSLY ──
  // This guarantees the banner shows on the very first paint when offline,
  // immune to chunk loading order, useEffect timing, and race conditions.
  const networkOffline = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkOfflineSnapshot,
    getServerOfflineSnapshot,
  )
  // forceOffline handles "fake online" (WiFi without internet) detected by
  // the fetch interceptor in use-connection-status.ts
  const [forceOffline, setForceOffline] = useState(false)
  const isOffline = networkOffline || forceOffline
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // ── Layer 0: Log current state (useSyncExternalStore handles the render) ──
    if (!navigator.onLine) {
      reportNetworkFailure()
      console.warn('[PWA] Starting OFFLINE — navigator.onLine = false')
    } else {
      // Verify with real fetch (detect "fake online" / WiFi without internet)
      fetch('/api/subscription/status', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })
        .then(res => {
          if (res.ok || res.status === 401) {
            setForceOffline(false)
            reportNetworkRecovery()
          } else {
            setForceOffline(true)
            reportNetworkFailure()
          }
        })
        .catch(() => {
          setForceOffline(true)
          reportNetworkFailure()
        })
    }

    // ── Verify on 'online' event (detect fake-online WiFi) ──
    const handleOnline = () => {
      console.log('[PWA] navigator.onLine → true, verifying...')
      fetch('/api/subscription/status', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })
        .then(res => {
          if (res.ok || res.status === 401) {
            setForceOffline(false)
            reportNetworkRecovery()
            countPending().then(count => setPendingCount(count))
          } else {
            setForceOffline(true)
            reportNetworkFailure()
          }
        })
        .catch(() => {
          setForceOffline(true)
          reportNetworkFailure()
        })
    }
    // Note: No need for 'offline' listener — useSyncExternalStore handles it
    window.addEventListener('online', handleOnline)

    // ── SyncManager events ──
    const onSyncComplete = (_event: string, data?: unknown) => {
      const result = data as { success: number; failed: number }
      setSyncResult(result)
      setIsSyncing(false)
      setForceOffline(false)
      setPendingCount(0)
    }
    syncManager.on('sync-start', () => setIsSyncing(true))
    syncManager.on('sync-complete', onSyncComplete)
    syncManager.on('sync-error', () => { setIsSyncing(false); setForceOffline(true) })

    // Initialize sync manager (registers SW, sets up listeners)
    syncManager.init()

    // Listen for SW updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New controller detected, reloading...')
        window.location.reload()
      })
    }

    // Count initial pending items
    countPending().then(count => setPendingCount(count))

    return () => {
      window.removeEventListener('online', handleOnline)
      syncManager.off('sync-start', () => setIsSyncing(true))
      syncManager.off('sync-complete', onSyncComplete)
      syncManager.destroy()
    }
  }, [])

  // Auto-dismiss sync result after 3s
  useEffect(() => {
    if (!syncResult) return
    const timer = setTimeout(() => setSyncResult(null), 3000)
    return () => clearTimeout(timer)
  }, [syncResult])

  const countPending = async (): Promise<number> => {
    let total = 0
    try {
      const stored = localStorage.getItem('ech-pending-sync')
      total += stored ? JSON.parse(stored).length : 0
    } catch { /* ignore */ }
    try {
      const { offlineDB } = await import('@/lib/offline/offline-queue')
      total += await offlineDB.getQueueCount()
    } catch { /* ignore */ }
    return total
  }

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await syncManager.syncAll()
      setSyncResult(result)
      setPendingCount(0)
    } catch {
      // keep current state
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Only show banner when truly offline, actively syncing, or just got a sync result
  // pendingCount alone does NOT trigger the banner (prevents false positives from stuck items)
  const shouldShowBanner = !!(isOffline || isSyncing || syncResult)

  return (
    <>
      {children}

      {/* ═══════════════════════════════════════════════════════════════
          OFFLINE / SYNC BANNER — Rendered directly in PWAProvider
          This is the ONLY component guaranteed to execute on mount. 
          ═══════════════════════════════════════════════════════════════ */}
      {shouldShowBanner && (
        <div
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999999 }}
          className="flex flex-col items-center pointer-events-none sm:bottom-4 sm:left-auto sm:right-4 sm:w-[420px]"
        >
          {/* ── OFFLINE BANNER ── */}
          {isOffline && !isSyncing && (
            <div className="w-full pointer-events-auto">
              {/* Mobile */}
              <div className="sm:hidden">
                <div className="w-full border-t-2 border-amber-400 bg-amber-50 px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                      <WifiOff className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-800">Modo Offline Activo</p>
                      <p className="text-[11px] text-amber-600 leading-tight mt-0.5">
                        Sus cambios se guardan localmente y se sincronizaran al recuperar conexion.
                      </p>
                    </div>
                    {pendingCount > 0 && (
                      <Badge className="bg-amber-200 text-amber-800 text-[10px] font-bold flex-shrink-0 px-2 py-0.5">
                        {pendingCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden sm:block">
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <WifiOff className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-800">Modo Offline Activo</p>
                      <p className="text-xs text-amber-600 truncate">
                        Los cambios se guardaran localmente y se sincronizaran automaticamente
                      </p>
                    </div>
                    {pendingCount > 0 && (
                      <Badge className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                        {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SYNCING ── */}
          {isSyncing && (
            <div className="w-full pointer-events-auto sm:mt-2">
              <div className="sm:hidden border-t-2 border-blue-300 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-800">Sincronizando...</p>
                    <p className="text-[11px] text-blue-600">Enviando datos pendientes al servidor</p>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-800">Sincronizando...</p>
                    <p className="text-xs text-blue-600">Enviando datos pendientes al servidor</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CONNECTION RESTORED ── */}
          {!isOffline && !isSyncing && pendingCount > 0 && (
            <div className="w-full pointer-events-auto sm:mt-2">
              <div className="sm:hidden border-t-2 border-emerald-300 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ArrowUpFromLine className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800">Conexion Restaurada</p>
                    <p className="text-[11px] text-emerald-600">
                      {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} por sincronizar
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSyncNow} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-shrink-0 h-8">
                    <RefreshCw className="w-3 h-3" /> Sync
                  </Button>
                </div>
              </div>
              <div className="hidden sm:block rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ArrowUpFromLine className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800">Conexion Restaurada</p>
                    <p className="text-xs text-emerald-600 truncate">
                      {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} por sincronizar
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSyncNow} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-shrink-0">
                    <RefreshCw className="w-3 h-3" /> Sincronizar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── SYNC RESULT ── */}
          {syncResult && !isOffline && (
            <div className="w-full pointer-events-auto sm:mt-2">
              <div className={`sm:hidden border-t-2 px-4 py-3 ${syncResult.failed === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white ${syncResult.failed === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${syncResult.failed === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {syncResult.failed === 0 ? 'Sincronizacion Completa' : 'Sincronizacion Parcial'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {syncResult.success} sincronizado{syncResult.success !== 1 ? 's' : ''}
                      {syncResult.failed > 0 && ` · ${syncResult.failed} fallido${syncResult.failed !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`hidden sm:block rounded-xl border-2 px-4 py-3 shadow-lg ${syncResult.failed === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${syncResult.failed === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${syncResult.failed === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {syncResult.failed === 0 ? 'Sincronizacion Completa' : 'Sincronizacion Parcial'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {syncResult.success} elemento{syncResult.success !== 1 ? 's' : ''} sincronizado{syncResult.success !== 1 ? 's' : ''}
                      {syncResult.failed > 0 && ` · ${syncResult.failed} fallido${syncResult.failed !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UPDATE AVAILABLE ── */}
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
