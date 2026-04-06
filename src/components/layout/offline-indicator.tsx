// Energy-Compliance Hub — Offline Status Indicator
// Shows connection status: Online / Offline / Syncing

'use client'

import { useConnectionStatus, type ConnectionStatus } from '@/hooks/use-connection-status'
import { Wifi, WifiOff, RefreshCw, ArrowUpFromLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { syncManager } from '@/lib/offline/sync-manager'

const statusConfig: Record<ConnectionStatus, {
  icon: typeof Wifi
  label: string
  description: string
  color: string
  bg: string
  border: string
  animate?: boolean
}> = {
  online: {
    icon: Wifi,
    label: 'En Linea',
    description: 'Conexion estable',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  offline: {
    icon: WifiOff,
    label: 'Modo Offline Activo',
    description: 'Los cambios se sincronizaran al recuperar señal',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    animate: true,
  },
  syncing: {
    icon: RefreshCw,
    label: 'Sincronizando...',
    description: 'Enviando datos pendientes',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    animate: true,
  },
}

export function OfflineIndicator() {
  const { status, pendingCount, showSyncNotification, dismissSyncNotification, forceSync } = useConnectionStatus()
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null)

  const config = statusConfig[status]
  const Icon = config.icon

  // Listen for sync completion events (callback in event listener, not sync setState)
  useEffect(() => {
    const onComplete = (_event: string, data?: unknown) => {
      setSyncResult(data as { success: number; failed: number })
    }
    syncManager.on('sync-complete', onComplete)
    return () => syncManager.off('sync-complete', onComplete)
  }, [])

  // Auto-dismiss sync result
  useEffect(() => {
    if (!syncResult) return
    const timer = setTimeout(() => setSyncResult(null), 4000)
    return () => clearTimeout(timer)
  }, [syncResult])

  const handleSyncNow = useCallback(async () => {
    dismissSyncNotification()
    const result = await forceSync()
    setSyncResult(result)
  }, [dismissSyncNotification, forceSync])

  // Only show when offline, syncing, has sync notification, or sync result
  if (status === 'online' && pendingCount === 0 && !showSyncNotification && !syncResult) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-center gap-2 pointer-events-none sm:left-auto sm:right-4 sm:w-96">
      {/* Offline / Syncing main indicator */}
      {status !== 'online' && (
        <div
          className={cn(
            'w-full pointer-events-auto rounded-xl border-2 px-4 py-3 shadow-lg transition-all',
            config.bg,
            config.border,
            config.animate && 'animate-pulse'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('flex-shrink-0', config.animate && 'animate-spin')}>
              <Icon className={cn('w-5 h-5', config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
              <p className="text-xs text-slate-500 truncate">{config.description}</p>
            </div>
            {status === 'offline' && pendingCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] flex-shrink-0">
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Sync notification when coming back online */}
      {showSyncNotification && status === 'online' && (
        <div className="w-full pointer-events-auto rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <ArrowUpFromLine className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-700">Conexion Restaurada</p>
              <p className="text-xs text-slate-500 truncate">
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
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={cn(
          'w-full pointer-events-auto rounded-xl border-2 px-4 py-3 shadow-lg transition-opacity',
          syncResult.failed === 0
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
              syncResult.failed === 0 ? 'bg-emerald-500' : 'bg-amber-500'
            )}>
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', syncResult.failed === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                Sincronizacion Completa
              </p>
              <p className="text-xs text-slate-500">
                {syncResult.success} elemento{syncResult.success !== 1 ? 's' : ''} sincronizado{syncResult.success !== 1 ? 's' : ''}
                {syncResult.failed > 0 && ` · ${syncResult.failed} fallido${syncResult.failed !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
