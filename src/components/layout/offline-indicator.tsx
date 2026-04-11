// Energy-Compliance Hub — Offline Status Indicator
// Shows connection status: Online / Offline / Syncing
//
// DETECTION STRATEGY (3 layers, bulletproof):
//   1. useSyncExternalStore(navigator.onLine) — synchronous during render, zero delay
//   2. useConnectionStatus hook — periodic probe (detects "fake online" / WiFi without internet)
//   3. SyncManager events — auto-sync on reconnection

'use client'

import { useSyncExternalStore, useState, useEffect, useCallback } from 'react'
import { useConnectionStatus } from '@/hooks/use-connection-status'
import { WifiOff, RefreshCw, ArrowUpFromLine, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { syncManager } from '@/lib/offline/sync-manager'

// ═══════════════════════════════════════════════════════════
// Layer 1: useSyncExternalStore — reads navigator.onLine
// SYNCHRONOUSLY during render. Works on the very first
// paint, no useEffect delay, no chunk race conditions.
// ═══════════════════════════════════════════════════════════

function subscribeToNavigatorOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

// Server always returns true (no navigator on server)
function getServerSnapshot() {
  return true
}

export function OfflineIndicator() {
  // ── Layer 1: Direct navigator.onLine (synchronous, zero delay) ──
  const navigatorOnline = useSyncExternalStore(
    subscribeToNavigatorOnline,
    getOnlineSnapshot,
    getServerSnapshot
  )

  // ── Layer 2: Hook-based probe detection (detects "fake online") ──
  const { status, pendingCount, showSyncNotification, dismissSyncNotification, forceSync } = useConnectionStatus()
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null)

  // ── Layer 3: SyncManager events ──
  useEffect(() => {
    const onComplete = (_event: string, data?: unknown) => {
      setSyncResult(data as { success: number; failed: number })
    }
    syncManager.on('sync-complete', onComplete)
    return () => syncManager.off('sync-complete', onComplete)
  }, [])

  // Auto-dismiss sync result after 5s
  useEffect(() => {
    if (!syncResult) return
    const timer = setTimeout(() => setSyncResult(null), 5000)
    return () => clearTimeout(timer)
  }, [syncResult])

  const handleSyncNow = useCallback(async () => {
    dismissSyncNotification()
    const result = await forceSync()
    setSyncResult(result)
  }, [dismissSyncNotification, forceSync])

  // ═══════════════════════════════════════════════════════
  // Determine effective display state
  // Show offline banner if EITHER navigator says offline
  // OR the hook detected "fake online" (status === 'offline')
  // ═══════════════════════════════════════════════════════
  const isReallyOffline = !navigatorOnline || status === 'offline'
  const isFullyOnline = navigatorOnline && status === 'online' && pendingCount === 0 && !showSyncNotification && !syncResult
  if (isFullyOnline) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none sm:bottom-4 sm:left-auto sm:right-4 sm:w-[420px]">
      {/* ── OFFLINE: Full-width bottom bar (mobile) / Card (desktop) ── */}
      {isReallyOffline && (
        <div className="w-full pointer-events-auto">
          {/* Mobile: full-width bar at bottom */}
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

          {/* Desktop: floating card */}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pendingCount > 0 && (
                    <Badge className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                      {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SYNCING ── */}
      {status === 'syncing' && (
        <div className="w-full pointer-events-auto sm:mt-2">
          {/* Mobile */}
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
          {/* Desktop */}
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

      {/* ── CONNECTION RESTORED + pending items ── */}
      {showSyncNotification && navigatorOnline && (
        <div className="w-full pointer-events-auto sm:mt-2">
          {/* Mobile */}
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
              <Button
                size="sm"
                onClick={handleSyncNow}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-shrink-0 h-8"
              >
                <RefreshCw className="w-3 h-3" />
                Sync
              </Button>
            </div>
          </div>
          {/* Desktop */}
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
              <Button
                size="sm"
                onClick={handleSyncNow}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Sincronizar
              </Button>
              <button
                onClick={dismissSyncNotification}
                className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SYNC RESULT ── */}
      {syncResult && (
        <div className="w-full pointer-events-auto sm:mt-2">
          {/* Mobile */}
          <div className={cn(
            'sm:hidden border-t-2 px-4 py-3',
            syncResult.failed === 0
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-amber-300 bg-amber-50'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white',
                syncResult.failed === 0 ? 'bg-emerald-500' : 'bg-amber-500'
              )}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-bold', syncResult.failed === 0 ? 'text-emerald-800' : 'text-amber-800')}>
                  {syncResult.failed === 0 ? 'Sincronizacion Completa' : 'Sincronizacion Parcial'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {syncResult.success} sincronizado{syncResult.success !== 1 ? 's' : ''}
                  {syncResult.failed > 0 && ` · ${syncResult.failed} fallido${syncResult.failed !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
          {/* Desktop */}
          <div className={cn(
            'hidden sm:block rounded-xl border-2 px-4 py-3 shadow-lg',
            syncResult.failed === 0
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white',
                syncResult.failed === 0 ? 'bg-emerald-500' : 'bg-amber-500'
              )}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-bold', syncResult.failed === 0 ? 'text-emerald-800' : 'text-amber-800')}>
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
  )
}
