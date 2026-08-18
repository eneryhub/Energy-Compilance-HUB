'use client'

// ═══════════════════════════════════════════════════════════════
// SentinelAvatar — Proactive AI Monitoring Avatar
// Fixed bottom-right avatar that polls sentinel status,
// displays a pulsing status badge and an auto-dismissing
// speech bubble when risks are detected.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, AlertTriangle, X, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, getToken } from '@/lib/api'

// ── Types ──

interface SentinelFinding {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  findings: {
    criticalSensors: Array<{
      id: string
      name: string
      type: string
      value: number
      unit: string
      thresholdCritical: number
    }>
    expiringDocuments: Array<{
      id: string
      title: string
      documentType: string
      expiryDate: string
      holderName: string | null
    }>
    activeEmergencies: Array<{
      id: string
      tipo: string
      descripcion: string | null
      createdAt: string
      userName: string
    }>
    stalePermits: Array<{
      id: string
      permitNumber: string
      riskType: string
      technicianName: string
      createdAt: string
    }>
  }
  aiMessage: string | null
  totalRisks: number
}

// ── Constants ──

const POLL_INTERVAL_MS = 30_000
const AUTO_DISMISS_MS = 15_000
const SENTINEL_ENDPOINT = '/ai/sentinel'

const STATUS_COLORS = {
  NORMAL: '#22c55e',
  WARNING: '#eab308',
  CRITICAL: '#ef4444',
} as const

const DEFAULT_MESSAGES = {
  criticalSensors:
    '⚠️ Sensor(es) en nivel crítico detectados. Revisar telemetría SCADA inmediatamente.',
  activeEmergencies:
    '🚨 Alerta(s) de emergencia activa(s). Se requiere atención inmediata.',
  expiringDocuments:
    '📋 Documento(s) HSE próximo(s) a vencer. Programar renovación.',
  stalePermits:
    '🕐 Permiso(s) pendiente(s) por más de 2 horas. Requiere seguimiento.',
} as const

// ── Online / Offline subscription for useSyncExternalStore ──

function subscribeToOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getServerOnlineSnapshot() {
  return true // SSR fallback — always "online"
}

// ── Helpers ──

function buildDefaultMessage(findings: SentinelFinding['findings']): string {
  const parts: string[] = []

  if (findings.activeEmergencies.length > 0) {
    parts.push(DEFAULT_MESSAGES.activeEmergencies)
  }
  if (findings.criticalSensors.length > 0) {
    parts.push(DEFAULT_MESSAGES.criticalSensors)
  }
  if (findings.expiringDocuments.length > 0) {
    parts.push(DEFAULT_MESSAGES.expiringDocuments)
  }
  if (findings.stalePermits.length > 0) {
    parts.push(DEFAULT_MESSAGES.stalePermits)
  }

  return parts.join('\n\n')
}

/** Sort findings by severity so the most urgent message appears first. */
function resolveMessage(data: SentinelFinding): string {
  if (data.aiMessage) return data.aiMessage
  return buildDefaultMessage(data.findings)
}

// ── Component ──

export default function SentinelAvatar() {
  const isOnline = useSyncExternalStore(
    subscribeToOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  )

  const [sentinelData, setSentinelData] = useState<SentinelFinding | null>(null)
  const [showBubble, setShowBubble] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleWasClosedRef = useRef(false)

  // ── Fetch sentinel data ──
  const fetchSentinel = useCallback(async () => {
    if (!getToken()) return
    if (typeof document !== 'undefined' && document.hidden) return

    try {
      const data = await apiFetch<SentinelFinding>(SENTINEL_ENDPOINT)
      setSentinelData(data)
      bubbleWasClosedRef.current = false
    } catch (err) {
      // Silent fail — the avatar simply won't show risks if the endpoint errors
      console.warn('[SentinelAvatar] Poll error:', err)
    }
  }, [])

  // ── Show bubble when findings exist and not manually closed ──
  useEffect(() => {
    const shouldShow =
      sentinelData &&
      sentinelData.status !== 'NORMAL' &&
      sentinelData.totalRisks > 0 &&
      !bubbleWasClosedRef.current

    if (shouldShow) {
      // Auto-dismiss timer
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      autoDismissRef.current = setTimeout(() => {
        setShowBubble(false)
      }, AUTO_DISMISS_MS)
    }

    // Use micro-task to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      setShowBubble(!!shouldShow)
    })

    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [sentinelData])

  // ── Polling loop ──
  useEffect(() => {
    if (!isOnline) return

    // Immediate first fetch (via micro-task to satisfy lint)
    const initTimer = setTimeout(() => {
      fetchSentinel()
    }, 0)

    intervalRef.current = setInterval(() => {
      fetchSentinel()
    }, POLL_INTERVAL_MS)

    return () => {
      clearTimeout(initTimer)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isOnline, fetchSentinel])

  // ── Visibility change — pause / resume polling ──
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        // Tab became visible — fetch immediately
        fetchSentinel()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchSentinel])

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Handlers ──
  const handleCloseBubble = useCallback(() => {
    setShowBubble(false)
    bubbleWasClosedRef.current = true
  }, [])

  // ── Derived state ──
  const status = sentinelData?.status ?? 'NORMAL'
  const totalRisks = sentinelData?.totalRisks ?? 0
  const statusColor = STATUS_COLORS[status]
  const isWarningOrCritical = status === 'WARNING' || status === 'CRITICAL'
  const isCritical = status === 'CRITICAL'
  const message = sentinelData ? resolveMessage(sentinelData) : ''

  // ── Don't render if user is not authenticated ──
  if (typeof window !== 'undefined' && !getToken()) return null

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* ── Speech Bubble ── */}
        <AnimatePresence>
          {showBubble && message && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative w-72 max-w-xs bg-white rounded-2xl shadow-xl border border-slate-200 p-4"
            >
              {/* Close button */}
              <button
                onClick={handleCloseBubble}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-2 mb-2 pr-6">
                <div
                  className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center',
                    isCritical
                      ? 'bg-red-100'
                      : 'bg-amber-100',
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'w-3.5 h-3.5',
                      isCritical ? 'text-red-600' : 'text-amber-600',
                    )}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sentinel-AI
                </span>
                {/* Risk count badge */}
                {totalRisks > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white',
                      isCritical ? 'bg-red-500' : 'bg-amber-500',
                    )}
                  >
                    {totalRisks}
                  </span>
                )}
              </div>

              {/* Message */}
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Avatar Button ── */}
        <div className="relative group">
          {/* Critical red glow */}
          {isCritical && (
            <span
              className="absolute inset-0 rounded-full animate-pulse"
              style={{
                boxShadow: `0 0 18px 6px ${STATUS_COLORS.CRITICAL}66`,
              }}
            />
          )}

          {/* Hover tooltip */}
          {isHovered && (
            <div
              className={cn(
                'absolute bottom-full right-0 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium text-white whitespace-nowrap pointer-events-none',
                'bg-slate-800 shadow-lg',
              )}
            >
              Sentinel-AI
              {/* Tooltip arrow */}
              <span className="absolute top-full right-4 w-2 h-2 bg-slate-800 rotate-45 -mt-1" />
            </div>
          )}

          <button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              'relative w-14 h-14 rounded-full border-2 shadow-lg overflow-hidden transition-all duration-300',
              'border-slate-200 hover:border-slate-300 hover:shadow-xl',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400',
            )}
            aria-label="Sentinel-AI Monitor"
          >
            {/* Avatar image */}
            <img
              src="/sentinel-avatar.png"
              alt="Sentinel-AI"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />

            {/* Status badge (dot on top-right) */}
            <span
              className={cn(
                'absolute top-0.5 right-0.5 block rounded-full',
                'w-3.5 h-3.5',
                'border-2 border-white',
              )}
              style={{ backgroundColor: statusColor }}
            >
              {/* Pulse ring for WARNING / CRITICAL */}
              {isWarningOrCritical && (
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-75"
                  style={{ backgroundColor: statusColor }}
                />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ── Sentinel ring-pulse keyframes ── */}
      <style jsx global>{`
        @keyframes sentinel-ring-pulse {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}
