'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radar,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Lock,
  CreditCard,
  MapPin,
  Bell,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ExternalLink,
  Volume2,
  VolumeX,
  RefreshCw,
  Info,
  AlertOctagon,
  Server,
  Clock,
  Zap,
  Heart,
  BookOpen,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

// ============ Types ============

interface GOCAlert {
  id: string
  companyId: string
  companyName?: string
  type: string
  severity: string
  title: string
  message: string
  metadata: string | null
  isAcknowledged: boolean
  isEnterprise?: boolean
  errorCode?: string
  relatedEntityId?: string | null
  relatedEntityType?: string | null
  createdAt: string
}

interface KnowledgeEntry {
  id: string
  errorCode: string
  category: string
  title: string
  rootCause: string
  appliedSolution: string
  severity: string
  referenceUrl: string | null
  timesUsed: number
}

interface SystemHealth {
  healthStatus: string
  totalErrors24h: number
  topErrors: Array<{ action: string; count: number; affectedCompanies: number }>
  globalIncidents: Array<{ action: string; affectedCompanies: number; companyNames: string[] }>
  alerts24h: { total: number; critical: number; unacknowledged: number; byType: Record<string, number> }
  lastChecked: string
}

type AlertTypeFilter = 'ALL' | 'SENSOR' | 'GEOFENCE' | 'SYSTEM' | 'SECURITY' | 'SUBSCRIPTION'
type SeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

// ============ Helpers ============

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500 text-white border-red-500'
    case 'HIGH': return 'bg-orange-500 text-white border-orange-500'
    case 'MEDIUM': return 'bg-amber-500 text-white border-amber-500'
    case 'LOW': return 'bg-slate-500 text-white border-slate-500'
    default: return 'bg-slate-500 text-white border-slate-500'
  }
}

function getSeverityBg(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'border-red-500/40 bg-red-950/20'
    case 'HIGH': return 'border-orange-500/30 bg-orange-950/10'
    case 'MEDIUM': return 'border-amber-500/20 bg-amber-950/10'
    case 'LOW': return 'border-slate-500/20 bg-slate-800/30'
    default: return 'border-slate-700/30 bg-slate-800/30'
  }
}

function getAlertTypeIcon(type: string) {
  switch (type) {
    case 'SENSOR_CRITICAL': return Activity
    case 'GEOFENCE_BREACH': return MapPin
    case 'SYSTEM_ERROR': return Server
    case 'SECURITY_BREACH': return ShieldAlert
    case 'SUBSCRIPTION_ALERT': return CreditCard
    default: return AlertTriangle
  }
}

function getAlertTypeLabel(type: string) {
  switch (type) {
    case 'SENSOR_CRITICAL': return 'Sensor'
    case 'GEOFENCE_BREACH': return 'Geofence'
    case 'SYSTEM_ERROR': return 'Sistema'
    case 'SECURITY_BREACH': return 'Seguridad'
    case 'SUBSCRIPTION_ALERT': return 'Suscripción'
    default: return type
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatRelativeTime(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d`
}

function getHealthColor(status: string) {
  switch (status) {
    case 'HEALTHY': return 'text-emerald-400'
    case 'DEGRADED': return 'text-amber-400'
    case 'CRITICAL': return 'text-red-400'
    default: return 'text-slate-400'
  }
}

function getHealthIcon(status: string) {
  switch (status) {
    case 'HEALTHY': return CheckCircle2
    case 'DEGRADED': return AlertTriangle
    case 'CRITICAL': return XCircle
    default: return Info
  }
}

// ============ Sound ============

function playCriticalBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.value = 0.3
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.stop(ctx.currentTime + 0.2)
  } catch {
    // Audio not supported
  }
}

// ============ Component ============

export default function GlobalOperationsCenter() {
  // State
  const [alerts, setAlerts] = useState<GOCAlert[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Stats
  const [stats, setStats] = useState({ total: 0, unacknowledged: 0, critical: 0 })

  // Knowledge dialog
  const [knowledgeDialog, setKnowledgeDialog] = useState<KnowledgeEntry | null>(null)
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeNotFound, setKnowledgeNotFound] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<GOCAlert | null>(null)

  // System health
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  // Refs
  const alertsEndRef = useRef<HTMLDivElement>(null)
  const newAlertIdsRef = useRef<Set<string>>(new Set())
  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const alertsPollingRef = useRef<NodeJS.Timeout | null>(null)

  // ============ Clock ============
  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }))
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // ============ HTTP Polling for Alerts (production-safe, no Socket.IO needed) ============
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch<{ alerts: GOCAlert[]; total: number; unacknowledged: number }>('/admin/goc/alerts?limit=100')
      const newAlerts = res.alerts || []
      setAlerts(newAlerts)
      setLoading(false)
      setStats({
        total: res.total ?? newAlerts.length,
        unacknowledged: res.unacknowledged ?? newAlerts.filter((a) => !a.isAcknowledged).length,
        critical: newAlerts.filter((a) => a.severity === 'CRITICAL').length,
      })
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    alertsPollingRef.current = setInterval(fetchAlerts, 10000)
    return () => {
      if (alertsPollingRef.current) clearInterval(alertsPollingRef.current)
    }
  }, [fetchAlerts])

  // ============ Filtered alerts ============
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (typeFilter !== 'ALL') {
        const typeMap: Record<string, string> = {
          SENSOR: 'SENSOR_CRITICAL',
          GEOFENCE: 'GEOFENCE_BREACH',
          SYSTEM: 'SYSTEM_ERROR',
          SECURITY: 'SECURITY_BREACH',
          SUBSCRIPTION: 'SUBSCRIPTION_ALERT',
        }
        if (alert.type !== typeMap[typeFilter]) return false
      }
      if (severityFilter !== 'ALL' && alert.severity !== severityFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (alert.companyName || '').toLowerCase().includes(q) || alert.title.toLowerCase().includes(q)
      }
      return true
    })
  }, [alerts, typeFilter, severityFilter, searchQuery])

  // ============ Scroll to bottom on new alerts ============
  useEffect(() => {
    alertsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [alerts.length])

  // ============ API: Acknowledge Alert ============
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    setAcknowledging(alertId)
    try {
      await apiFetch('/admin/goc/alerts', {
        method: 'POST',
        body: JSON.stringify({ alertId }),
      })
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isAcknowledged: true } : a))
      )
      setStats((prev) => ({
        ...prev,
        unacknowledged: Math.max(0, prev.unacknowledged - 1),
      }))
    } catch {
      // Acknowledge failed silently
    } finally {
      setAcknowledging(null)
    }
  }, [])

  // ============ API: Fetch Knowledge Base ============
  const fetchKnowledge = useCallback(async (alert: GOCAlert) => {
    setSelectedAlert(alert)
    setKnowledgeLoading(true)
    setKnowledgeNotFound(false)
    setKnowledgeDialog(null)

    if (!alert.errorCode) {
      // No errorCode — show info message instead of doing nothing
      setKnowledgeLoading(false)
      setKnowledgeNotFound(true)
      return
    }

    try {
      const data = await apiFetch<{ entries: KnowledgeEntry[]; total: number }>(`/admin/goc/knowledge?code=${encodeURIComponent(alert.errorCode)}`)
      if (data.entries && data.entries.length > 0) {
        setKnowledgeDialog(data.entries[0])
      } else {
        setKnowledgeNotFound(true)
      }
    } catch {
      setKnowledgeNotFound(true)
    } finally {
      setKnowledgeLoading(false)
    }
  }, [])

  // ============ API: System Health ============
  const fetchSystemHealth = useCallback(async () => {
    try {
      const data = await apiFetch<SystemHealth>('/admin/system-health')
      setSystemHealth(data)
      setHealthLoading(false)
    } catch {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSystemHealth()
    healthIntervalRef.current = setInterval(fetchSystemHealth, 30000)
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current)
    }
  }, [fetchSystemHealth])

  // ============ Reset new alert animation tracker ============
  useEffect(() => {
    const timer = setInterval(() => {
      if (newAlertIdsRef.current.size > 0) {
        newAlertIdsRef.current.clear()
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  // ============ Type filter buttons ============
  const typeFilters: { value: AlertTypeFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'SENSOR', label: 'Sensor' },
    { value: 'GEOFENCE', label: 'Geofence' },
    { value: 'SYSTEM', label: 'Sistema' },
    { value: 'SECURITY', label: 'Seguridad' },
    { value: 'SUBSCRIPTION', label: 'Suscripción' },
  ]

  // ============ Severity filter buttons ============
  const severityFilters: { value: SeverityFilter; label: string; color: string }[] = [
    { value: 'ALL', label: 'Todos', color: 'bg-slate-600' },
    { value: 'CRITICAL', label: 'Crítico', color: 'bg-red-600' },
    { value: 'HIGH', label: 'Alto', color: 'bg-orange-600' },
    { value: 'MEDIUM', label: 'Medio', color: 'bg-amber-600' },
    { value: 'LOW', label: 'Bajo', color: 'bg-slate-500' },
  ]

  return (
    <div className="space-y-4">
      {/* ===== A. HEADER BAR ===== */}
      <div className="rounded-xl bg-slate-900 border border-slate-700/50 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title + Connection */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Radar className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Global Operations Center</h1>
              <p className="text-xs text-slate-500">Vista de Dios &mdash; Monitoreo en Tiempo Real</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Polling</span>
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-300 font-semibold">{stats.total}</span>
              <span className="text-xs text-slate-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-orange-300 font-semibold">{stats.unacknowledged}</span>
              <span className="text-xs text-orange-500">Sin ACK</span>
            </div>
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border',
              stats.critical > 0
                ? 'bg-red-500/15 border-red-500/40 animate-pulse'
                : 'bg-slate-800 border-slate-700'
            )}>
              <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-300 font-semibold">{stats.critical}</span>
              <span className="text-xs text-red-400">Críticos</span>
            </div>
          </div>

          {/* Clock + Sound */}
          <div className="flex items-center gap-3 lg:ml-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-mono text-slate-300">{currentTime}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'rounded-lg border',
                soundEnabled
                  ? 'bg-slate-800 border-emerald-500/40 text-emerald-400 hover:bg-slate-700'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
              )}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== C. FILTER BAR ===== */}
      <div className="rounded-xl bg-slate-900 border border-slate-700/50 p-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Type filters */}
          <div className="flex flex-wrap gap-1.5">
            {typeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  typeFilter === f.value
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750 hover:text-slate-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="hidden md:block h-6 bg-slate-700" />

          {/* Severity filters */}
          <div className="flex flex-wrap gap-1.5">
            {severityFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setSeverityFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                  severityFilter === f.value
                    ? 'bg-slate-700 text-white border border-slate-500'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-750 hover:text-slate-400'
                )}
              >
                {f.value !== 'ALL' && (
                  <span className={cn('w-2 h-2 rounded-full', f.color)} />
                )}
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative md:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              placeholder="Buscar empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full md:w-48 bg-slate-800 border-slate-700 text-slate-300 text-xs placeholder:text-slate-500 focus:ring-emerald-500/40 focus:border-emerald-500/40"
            />
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ===== B. LIVE ALERT FEED ===== */}
        <div className="xl:col-span-2">
          <Card className="bg-slate-900 border-slate-700/50 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold text-slate-200">
                    Feed de Alertas en Vivo
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                    {filteredAlerts.length} resultado{filteredAlerts.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { fetchAlerts(); fetchSystemHealth() }}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refrescar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-800/50">
                      <Skeleton className="w-8 h-8 rounded-lg bg-slate-700" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4 bg-slate-700" />
                        <Skeleton className="h-3 w-1/2 bg-slate-700" />
                        <Skeleton className="h-3 w-1/3 bg-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/40" />
                  <p className="text-sm text-slate-500">Sin alertas para los filtros seleccionados</p>
                  <p className="text-xs text-slate-600 mt-1">Ajusta los filtros para ver más resultados</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="p-3 space-y-2">
                    <AnimatePresence initial={false}>
                      {filteredAlerts.map((alert) => {
                        const TypeIcon = getAlertTypeIcon(alert.type)
                        const isNew = newAlertIdsRef.current.has(alert.id)

                        return (
                          <motion.div
                            key={alert.id}
                            initial={isNew ? { opacity: 0, x: 40 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className={cn(
                              'group relative rounded-lg border p-3 transition-colors cursor-pointer',
                              getSeverityBg(alert.severity),
                              alert.isAcknowledged && 'opacity-60',
                              alert.isEnterprise && !alert.isAcknowledged && 'animate-pulse border-red-500',
                              'hover:brightness-125'
                            )}
                            onClick={() => fetchKnowledge(alert)}
                          >
                            {/* Enterprise indicator */}
                            {alert.isEnterprise && (
                              <div className="absolute top-2 right-2">
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px] px-1.5 py-0">
                                  <Lock className="w-2.5 h-2.5 mr-0.5" />
                                  Enterprise
                                </Badge>
                              </div>
                            )}

                            <div className="flex gap-3">
                              {/* Type Icon */}
                              <div className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                                alert.severity === 'CRITICAL' ? 'bg-red-500/20' :
                                alert.severity === 'HIGH' ? 'bg-orange-500/20' :
                                alert.severity === 'MEDIUM' ? 'bg-amber-500/20' :
                                'bg-slate-700/50'
                              )}>
                                <TypeIcon className={cn(
                                  'w-4 h-4',
                                  alert.severity === 'CRITICAL' ? 'text-red-400' :
                                  alert.severity === 'HIGH' ? 'text-orange-400' :
                                  alert.severity === 'MEDIUM' ? 'text-amber-400' :
                                  'text-slate-400'
                                )} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 flex-wrap">
                                  <Badge className={cn('text-[10px] px-1.5 py-0', getSeverityColor(alert.severity))}>
                                    {alert.severity}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-400">
                                    {getAlertTypeLabel(alert.type)}
                                  </Badge>
                                  {alert.isAcknowledged && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                                      <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                      ACK
                                    </Badge>
                                  )}
                                  {alert.errorCode && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/40 text-cyan-400">
                                      <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                                      {alert.errorCode}
                                    </Badge>
                                  )}
                                </div>

                                {alert.companyName && (
                                  <p className="text-xs text-slate-400 mt-1.5 font-medium truncate">
                                    {alert.companyName}
                                  </p>
                                )}

                                <p className={cn(
                                  'text-sm mt-1 leading-snug',
                                  alert.severity === 'CRITICAL' ? 'text-red-300 font-semibold' :
                                  alert.severity === 'HIGH' ? 'text-orange-300 font-medium' :
                                  'text-slate-300'
                                )}>
                                  {alert.title}
                                </p>

                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {alert.message}
                                </p>

                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatTime(alert.createdAt)}
                                  </span>
                                  <span className="text-[10px] text-slate-600">
                                    &middot; {formatRelativeTime(alert.createdAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                {!alert.isAcknowledged && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      acknowledgeAlert(alert.id)
                                    }}
                                    disabled={acknowledging === alert.id}
                                    className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs h-7 px-2"
                                  >
                                    {acknowledging === alert.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3" />
                                    )}
                                  </Button>
                                )}
                                {alert.errorCode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      fetchKnowledge(alert)
                                    }}
                                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-xs h-7 px-2"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                    <div ref={alertsEndRef} />
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== D. KNOWLEDGE CONNECTOR + E. SYSTEM HEALTH ===== */}
        <div className="space-y-4">
          {/* Knowledge Connector */}
          <Card className="bg-slate-900 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <CardTitle className="text-sm font-semibold text-slate-200">
                  Conector de Conocimiento
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {knowledgeLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-4 w-2/3 bg-slate-700" />
                  <Skeleton className="h-3 w-full bg-slate-700" />
                  <Skeleton className="h-3 w-4/5 bg-slate-700" />
                  <Skeleton className="h-3 w-full bg-slate-700" />
                </div>
              ) : knowledgeDialog ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-[10px]', getSeverityColor(knowledgeDialog.severity))}>
                      {knowledgeDialog.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      {knowledgeDialog.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-400 ml-auto">
                      {knowledgeDialog.errorCode}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">{knowledgeDialog.title}</h3>

                  <Separator className="bg-slate-700" />

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">
                      Causa Raíz
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">{knowledgeDialog.rootCause}</p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                      Solución Aplicada
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {knowledgeDialog.appliedSolution}
                    </p>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Usado {knowledgeDialog.timesUsed} vez(es)
                    </span>
                    {knowledgeDialog.referenceUrl && (
                      <a
                        href={knowledgeDialog.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        Referencia <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ) : knowledgeNotFound ? (
                <div className="p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
                    <Info className="w-5 h-5 text-slate-500" />
                  </div>
                  {selectedAlert?.errorCode ? (
                    <>
                      <p className="text-xs text-slate-400 font-medium">Sin solución registrada</p>
                      <p className="text-[10px] text-slate-600">
                        No existe entrada para el código <span className="text-cyan-400 font-mono">{selectedAlert.errorCode}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400 font-medium">Sin diagnóstico disponible</p>
                      <p className="text-[10px] text-slate-600">
                        Esta alerta ({selectedAlert?.type}) no tiene código de error asociado. Solo las alertas de tipo Sistema, Seguridad, Sensor, Geofence y Suscripción tienen diagnóstico.
                      </p>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs border-slate-600 text-slate-400 hover:bg-slate-800"
                  >
                    Crear Solución
                  </Button>
                </div>
              ) : (
                <div className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6 text-cyan-500/40" />
                  </div>
                  <p className="text-xs text-slate-500">Haz clic en una alerta con código de error</p>
                  <p className="text-[10px] text-slate-600">para ver la solución de la base de conocimiento</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Health */}
          <Card className="bg-slate-900 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-semibold text-slate-200">
                  Salud del Sistema
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchSystemHealth}
                  className="ml-auto h-7 w-7 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', healthLoading && 'animate-spin')} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {healthLoading && !systemHealth ? (
                <div className="space-y-3 p-2">
                  <Skeleton className="h-8 w-full bg-slate-700 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 bg-slate-700" />
                  <Skeleton className="h-16 w-full bg-slate-700 rounded-lg" />
                </div>
              ) : systemHealth ? (
                <div className="space-y-3">
                  {/* Health Status */}
                  <div className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border',
                    systemHealth.healthStatus === 'HEALTHY'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : systemHealth.healthStatus === 'DEGRADED'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  )}>
                    {(() => {
                      const HIcon = getHealthIcon(systemHealth.healthStatus)
                      return <HIcon className={cn('w-5 h-5', getHealthColor(systemHealth.healthStatus))} />
                    })()}
                    <div className="flex-1">
                      <p className={cn('text-sm font-semibold', getHealthColor(systemHealth.healthStatus))}>
                        {systemHealth.healthStatus === 'HEALTHY' ? 'Saludable' :
                         systemHealth.healthStatus === 'DEGRADED' ? 'Degradado' : 'Crítico'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Actualizado: {formatTime(systemHealth.lastChecked)}
                      </p>
                    </div>
                  </div>

                  {/* Error Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Errores 24h</p>
                      <p className={cn(
                        'text-lg font-bold',
                        systemHealth.totalErrors24h > 0 ? 'text-red-400' : 'text-emerald-400'
                      )}>
                        {systemHealth.totalErrors24h}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Sin ACK</p>
                      <p className={cn(
                        'text-lg font-bold',
                        (systemHealth.alerts24h?.unacknowledged ?? 0) > 0 ? 'text-orange-400' : 'text-emerald-400'
                      )}>
                        {systemHealth.alerts24h?.unacknowledged ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Top Errors */}
                  {systemHealth.topErrors.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                        Errores Principales
                      </p>
                      <div className="space-y-1.5">
                        {systemHealth.topErrors.slice(0, 4).map((err, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                            <span className="text-[11px] text-slate-300 truncate flex-1 mr-2">
                              {err.action}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 px-1.5 py-0">
                                {err.affectedCompanies} empresa{err.affectedCompanies !== 1 ? 's' : ''}
                              </Badge>
                              <span className="text-[10px] text-red-400 font-mono font-semibold">
                                {err.count}x
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Global Incidents */}
                  {systemHealth.globalIncidents.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-2">
                        Incidentes Globales
                      </p>
                      <div className="space-y-1.5">
                        {systemHealth.globalIncidents.map((incident, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20"
                          >
                            <div className="flex items-start gap-2">
                              <AlertOctagon className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-red-300 font-medium">{incident.action}</p>
                                <p className="text-[10px] text-red-400/70 mt-0.5">{incident.companyNames?.join(', ') || incident.action}</p>
                                <p className="text-[10px] text-red-400/50 mt-0.5">
                                  {incident.affectedCompanies} empresa{incident.affectedCompanies !== 1 ? 's' : ''} afectada{incident.affectedCompanies !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alerts by Type Summary */}
                  {systemHealth.alerts24h?.byType && Object.keys(systemHealth.alerts24h.byType).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                        Alertas por Tipo
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(systemHealth.alerts24h.byType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                            <span className="text-[10px] text-slate-400">{getAlertTypeLabel(type)}</span>
                            <span className="text-xs text-slate-300 font-semibold">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Server className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p className="text-xs text-slate-600">No se pudo obtener la salud del sistema</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== KNOWLEDGE DIALOG (Expanded View) ===== */}
      <Dialog open={!!knowledgeDialog || knowledgeLoading} onOpenChange={(open) => {
        if (!open) {
          setKnowledgeDialog(null)
          setSelectedAlert(null)
          setKnowledgeNotFound(false)
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              Solución de Conocimiento
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              {selectedAlert?.errorCode
                ? `Referencia: ${selectedAlert.errorCode} — ${selectedAlert.title}`
                : 'Buscando solución...'}
            </DialogDescription>
          </DialogHeader>

          {knowledgeLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-3/4 bg-slate-700" />
              <Skeleton className="h-4 w-full bg-slate-700" />
              <Skeleton className="h-4 w-5/6 bg-slate-700" />
              <Separator className="bg-slate-700" />
              <Skeleton className="h-4 w-full bg-slate-700" />
              <Skeleton className="h-4 w-4/5 bg-slate-700" />
              <Skeleton className="h-4 w-full bg-slate-700" />
            </div>
          ) : knowledgeDialog ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-xs', getSeverityColor(knowledgeDialog.severity))}>
                  {knowledgeDialog.severity}
                </Badge>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                  {knowledgeDialog.category}
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-slate-100">{knowledgeDialog.title}</h3>

              <Separator className="bg-slate-700" />

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-red-400 font-semibold flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Causa Raíz
                </p>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-3">
                  {knowledgeDialog.rootCause}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Solución Aplicada
                </p>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-3 whitespace-pre-wrap">
                  {knowledgeDialog.appliedSolution}
                </p>
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Usado {knowledgeDialog.timesUsed} vez(es)
                </span>
                {knowledgeDialog.referenceUrl && (
                  <a
                    href={knowledgeDialog.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-xs"
                  >
                    Referencia externa <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : knowledgeNotFound ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
                <X className="w-7 h-7 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Sin solución registrada</p>
                <p className="text-xs text-slate-600 mt-1">
                  No existe una entrada de conocimiento para{' '}
                  <code className="text-cyan-400/60 bg-slate-800 px-1 py-0.5 rounded text-[10px]">
                    {selectedAlert?.errorCode}
                  </code>
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-2 border-slate-600 text-slate-400 hover:bg-slate-800"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Crear Entrada de Conocimiento
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
