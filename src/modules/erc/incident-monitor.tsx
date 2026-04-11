'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  Siren,
  ShieldAlert,
  Clock,
  User,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  Activity,
  Zap,
  Droplets,
  PersonStanding,
  CircleDot,
  HelpCircle,
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  AlertOctagon,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'

// ============ Types ============

interface IncidentMonitorProps {
  companyId: string
  userRole: string
  userId: string
  userName: string
}

interface AlertUser {
  id: string
  name: string
  email: string
}

interface EmergencyAlert {
  id: string
  companyId: string
  userId: string
  tipo: string
  estado: string
  prioridad: string
  ubicacion: string | null
  descripcion: string | null
  photoUrl: string | null
  attendedById: string | null
  attendedByName: string | null
  attendedAt: string | null
  createdAt: string
  updatedAt: string | null
  user?: AlertUser
}

interface HSEReport {
  id: string
  companyId: string
  userId: string
  descripcion: string
  fotoUrl: string | null
  categoria: string
  estado: string
  prioridad: string
  ubicacion: string | null
  createdAt: string
  updatedAt: string | null
  user?: AlertUser
}

interface ErcStats {
  activeAlerts: number
  totalAlerts: number
  totalReports: number
  openReports: number
  resolvedReports: number
  criticalOpenReports: number
  alertsByType: Record<string, number>
  reportsByCategoria: Record<string, number>
  reportsByEstado: Record<string, number>
  recentAlerts: EmergencyAlert[]
  recentReports: HSEReport[]
  alertsLast7Days: number
  reportsLast7Days: number
  reportsLast30Days: number
  avgResolutionHours: number | null
  resolutionRate: number
}

// ============ Helpers ============

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHour < 24) return `hace ${diffHour}h`
  if (diffDay < 7) return `hace ${diffDay}d`
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseLocation(ubicacion: string | null): { lat: number; lng: number } | null {
  if (!ubicacion) return null
  try {
    const parsed = typeof ubicacion === 'string' ? JSON.parse(ubicacion) : ubicacion
    if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng }
    }
  } catch { /* ignore */ }
  return null
}

// ============ Alert type config ============

const ALERT_TYPE_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string; bg: string; bgLight: string }> = {
  PANICO: { icon: Siren, label: 'Pánico', color: 'text-red-600', bg: 'bg-red-50 border-red-200', bgLight: 'bg-red-50' },
  INCENDIO: { icon: Zap, label: 'Incendio', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', bgLight: 'bg-orange-50' },
  DERRAME: { icon: Droplets, label: 'Derrame', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', bgLight: 'bg-yellow-50' },
  CAIDA: { icon: PersonStanding, label: 'Caída', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', bgLight: 'bg-purple-50' },
  ELECTRICO: { icon: CircleDot, label: 'Eléctrico', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', bgLight: 'bg-sky-50' },
  MEDICA: { icon: ShieldAlert, label: 'Médica', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200', bgLight: 'bg-pink-50' },
  OTRO: { icon: HelpCircle, label: 'Otro', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', bgLight: 'bg-slate-50' },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  ALTA: { label: 'Alta', className: 'bg-red-100 text-red-700 border-red-300', dotColor: 'bg-red-500' },
  MEDIA: { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-300', dotColor: 'bg-amber-500' },
  BAJA: { label: 'Baja', className: 'bg-emerald-100 text-emerald-700 border-emerald-300', dotColor: 'bg-emerald-500' },
}

const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  ACTIVA: { label: 'Activa', className: 'bg-red-100 text-red-700 border-red-300', icon: Siren },
  ATENDIDA: { label: 'Atendida', className: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CheckCircle },
  DESCARTADA: { label: 'Descartada', className: 'bg-slate-100 text-slate-500 border-slate-300', icon: XCircle },
  ABIERTO: { label: 'Abierto', className: 'bg-amber-100 text-amber-700 border-amber-300', icon: AlertTriangle },
  EN_REVISION: { label: 'En Revisión', className: 'bg-sky-100 text-sky-700 border-sky-300', icon: Eye },
  RESUELTO: { label: 'Resuelto', className: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CheckCircle },
}

const CATEGORIA_LABELS: Record<string, string> = {
  CONDICION_INSEGURA: 'Condición Insegura',
  ACTO_INSEGURO: 'Acto Inseguro',
  CUASI_ACCIDENTE: 'Cuasi Accidente',
  INCIDENTE_AMBIENTAL: 'Incidente Ambiental',
  MEJORA: 'Mejora',
  OTRO: 'Otro',
}

const CATEGORIA_ICONS: Record<string, typeof AlertTriangle> = {
  CONDICION_INSEGURA: AlertOctagon,
  ACTO_INSEGURO: PersonStanding,
  CUASI_ACCIDENTE: AlertTriangle,
  INCIDENTE_AMBIENTAL: Droplets,
  MEJORA: TrendingUp,
  OTRO: HelpCircle,
}

function getAlertTypeConfig(tipo: string) {
  return ALERT_TYPE_CONFIG[tipo] || ALERT_TYPE_CONFIG.OTRO
}

// ============ Component ============

export default function IncidentMonitor({
  companyId,
  userRole,
  userId,
  userName,
}: IncidentMonitorProps) {
  const { toast } = useToast()
  const socketRef = useRef<Socket | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Data state
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([])
  const [reports, setReports] = useState<HSEReport[]>([])
  const [stats, setStats] = useState<ErcStats | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Detail modal state
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null)
  const [selectedReport, setSelectedReport] = useState<HSEReport | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  // Filter state
  const [alertEstadoFilter, setAlertEstadoFilter] = useState<string>('TODOS')
  const [alertPrioridadFilter, setAlertPrioridadFilter] = useState<string>('TODOS')
  const [reportEstadoFilter, setReportEstadoFilter] = useState<string>('TODOS')
  const [reportCategoriaFilter, setReportCategoriaFilter] = useState<string>('TODOS')

  // Derived data
  const activeAlerts = alerts.filter((a) => a.estado === 'ACTIVA')

  const filteredAlerts = alerts.filter((a) => {
    if (alertEstadoFilter !== 'TODOS' && a.estado !== alertEstadoFilter) return false
    if (alertPrioridadFilter !== 'TODOS' && a.prioridad !== alertPrioridadFilter) return false
    return true
  })

  const filteredReports = reports.filter((r) => {
    if (reportEstadoFilter !== 'TODOS' && r.estado !== reportEstadoFilter) return false
    if (reportCategoriaFilter !== 'TODOS' && r.categoria !== reportCategoriaFilter) return false
    return true
  })

  const isAdminOrSupervisor = ['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(userRole)

  // ============ Data fetching ============

  const fetchData = useCallback(async () => {
    try {
      const [alertsData, reportsData, statsData] = await Promise.all([
        apiFetch<EmergencyAlert[]>('/erc/alerts'),
        apiFetch<HSEReport[]>('/erc/reports'),
        apiFetch<ErcStats>('/erc/stats'),
      ])
      setAlerts(alertsData)
      setReports(reportsData)
      setStats(statsData)
    } catch {
      // Silent fail — data will remain as-is or empty
    } finally {
      setLoading(false)
    }
  }, [])

  // ============ Alert actions ============

  const updateAlertStatus = async (alertId: string, estado: string) => {
    if (updatingId) return
    setUpdatingId(alertId)
    try {
      const updated = await apiFetch<EmergencyAlert>(`/erc/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado,
          attendedById: userId,
          attendedByName: userName,
        }),
      })

      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))

      socketRef.current?.emit('alert-updated', { companyId, alert: updated })

      toast({
        title: estado === 'ATENDIDA' ? 'Alerta atendida' : 'Alerta descartada',
        description: `La alerta ha sido marcada como ${estado === 'ATENDIDA' ? 'atendida' : 'descartada'}.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo actualizar la alerta',
        variant: 'destructive',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  // ============ Report actions ============

  const updateReportStatus = async (reportId: string, estado: string) => {
    if (updatingId) return
    setUpdatingId(reportId)
    try {
      const updated = await apiFetch<HSEReport>(`/erc/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      })

      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)))

      toast({
        title: 'Estado actualizado',
        description: `Reporte marcado como ${ESTADO_CONFIG[estado]?.label || estado}.`,
      })

      // Refresh stats
      fetchData()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo actualizar el reporte',
        variant: 'destructive',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  // ============ Effects ============

  useEffect(() => {
    fetchData()
    pollingRef.current = setInterval(fetchData, 15_000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchData])

  // WebSocket connection (graceful degradation)
  useEffect(() => {
    let connected = false

    try {
      const socket = io('/?XTransformPort=3004', {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 5000,
        timeout: 5_000,
      })

      socketRef.current = socket

      socket.on('connect_error', () => {
        connected = false
      })

      socket.on('connect', () => {
        connected = true
        socket.emit('join-company', { companyId })
      })

      socket.on('emergency-alert', (data: { alert: EmergencyAlert }) => {
        const newAlert = data.alert
        setAlerts((prev) => {
          if (prev.some((a) => a.id === newAlert.id)) return prev
          return [newAlert, ...prev]
        })

        setStats((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            activeAlerts: prev.activeAlerts + 1,
            totalAlerts: prev.totalAlerts + 1,
            alertsLast7Days: prev.alertsLast7Days + 1,
          }
        })

        toast({
          title: 'Nueva Alerta de Emergencia',
          description: `${getAlertTypeConfig(newAlert.tipo).label} — ${newAlert.user?.name || 'Usuario'}`,
          variant: 'destructive',
        })
      })

      socket.on('alert-status-changed', (data: { alert: EmergencyAlert }) => {
        setAlerts((prev) =>
          prev.map((a) => (a.id === data.alert.id ? data.alert : a))
        )
      })

      return () => {
        socket.disconnect()
        socketRef.current = null
      }
    } catch {
      // WebSocket not available — polling is the fallback
    }
  }, [companyId, toast])

  // ============ Image preview handler ============

  const openImagePreview = (url: string) => {
    setImagePreviewUrl(url)
  }

  // ============ Loading state ============

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-8 w-14 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-10 w-64 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ Main render ============

  return (
    <div className="space-y-6">
      {/* ── Active Alerts Banner ── */}
      <AnimatePresence>
        {activeAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-600 via-red-500 to-red-600 p-4 text-white shadow-lg shadow-red-200/50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <Siren className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold tracking-tight">
                  EMERGENCIA ACTIVA — {activeAlerts.length} alerta{activeAlerts.length !== 1 ? 's' : ''}
                </h2>
                <p className="text-red-100 text-sm">
                  Se requiere atención inmediata del personal de emergencia
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeAlerts.map((alert) => {
                const typeConfig = getAlertTypeConfig(alert.tipo)
                const priorityConfig = PRIORITY_CONFIG[alert.prioridad] || PRIORITY_CONFIG.MEDIA
                const TipoIcon = typeConfig.icon

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-white/20 shrink-0">
                        <TipoIcon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{typeConfig.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                            {priorityConfig.label}
                          </span>
                        </div>
                        <p className="text-white/90 text-xs font-medium truncate">
                          {alert.user?.name || 'Usuario desconocido'}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-white/60 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(alert.createdAt)}
                          </span>
                          {alert.ubicacion && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              GPS
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdminOrSupervisor && (
                      <div className="flex gap-2 mt-3 ml-10">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-500/80 hover:bg-emerald-500 text-white border-0 flex-1 transition-colors"
                          disabled={updatingId === alert.id}
                          onClick={() => updateAlertStatus(alert.id, 'ATENDIDA')}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Atender
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0 flex-1 transition-colors"
                          disabled={updatingId === alert.id}
                          onClick={() => updateAlertStatus(alert.id, 'DESCARTADA')}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Descartar
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Cards Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-red-50">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                </div>
                {stats && stats.activeAlerts > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats?.activeAlerts ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Alertas Activas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="shadow-sm border-l-4 border-l-slate-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-slate-50">
                  <Activity className="h-4 w-4 text-slate-600" />
                </div>
                {stats && stats.alertsLast7Days > 0 && (
                  <span className="text-[10px] text-slate-400">+{stats.alertsLast7Days} 7d</span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats?.totalAlerts ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total Alertas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                {stats && stats.openReports > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0 px-1.5">
                    {stats.openReports} pendiente{stats.openReports !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats?.openReports ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Reportes Abiertos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex items-center gap-0.5 text-xs">
                  {(stats?.resolutionRate ?? 0) >= 50 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className={(stats?.resolutionRate ?? 0) >= 50 ? 'text-emerald-600' : 'text-amber-600'}>{stats?.resolutionRate ?? 0}%</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats?.resolvedReports ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Resueltos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-sm border-l-4 border-l-sky-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-sky-50">
                  <Timer className="h-4 w-4 text-sky-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {stats?.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Tiempo Prom. Resolución</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Secondary Metrics Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Alerts by Type */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              Alertas por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              {Object.entries(ALERT_TYPE_CONFIG).map(([tipo, config]) => {
                const count = stats?.alertsByType[tipo] ?? 0
                const maxCount = Math.max(...Object.values(stats?.alertsByType ?? {}), 1)
                const pct = Math.round((count / maxCount) * 100)

                return (
                  <div key={tipo} className="flex items-center gap-2.5">
                    <config.icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-600 font-medium">{config.label}</span>
                        <span className="text-xs font-bold text-slate-800">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="h-full rounded-full bg-gradient-to-r from-slate-400 to-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Reports by Category */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Reportes por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              {Object.entries(CATEGORIA_LABELS).map(([cat, label]) => {
                const count = stats?.reportsByCategoria[cat] ?? 0
                const maxCount = Math.max(...Object.values(stats?.reportsByCategoria ?? {}), 1)
                const pct = Math.round((count / maxCount) * 100)
                const CatIcon = CATEGORIA_ICONS[cat] || HelpCircle

                return (
                  <div key={cat} className="flex items-center gap-2.5">
                    <CatIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-600 font-medium truncate mr-2">{label}</span>
                        <span className="text-xs font-bold text-slate-800 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              Resumen de Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-red-100">
                    <Siren className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <span className="text-xs text-slate-600">Alertas 7 días</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{stats?.alertsLast7Days ?? 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-amber-100">
                    <FileText className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-xs text-slate-600">Reportes 7 días</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{stats?.reportsLast7Days ?? 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-sky-100">
                    <BarChart3 className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <span className="text-xs text-slate-600">Reportes 30 días</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{stats?.reportsLast30Days ?? 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-red-200">
                    <AlertOctagon className="h-3.5 w-3.5 text-red-700" />
                  </div>
                  <span className="text-xs text-slate-700 font-medium">Críticos Abiertos</span>
                </div>
                <span className="text-sm font-bold text-red-700">{stats?.criticalOpenReports ?? 0}</span>
              </div>

              {/* Resolution Rate Visual */}
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-700 font-medium">Tasa de Resolución</span>
                  <span className="text-sm font-bold text-emerald-700">{stats?.resolutionRate ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats?.resolutionRate ?? 0}%` }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ── */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 pb-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview" className="gap-1.5">
                  <Activity className="h-4 w-4" />
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="alertas" className="gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Alertas
                  {activeAlerts.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {activeAlerts.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reportes" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  Reportes HSE
                  {stats && stats.openReports > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {stats.openReports}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Resumen (combined recent) ── */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Alerts */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Siren className="h-4 w-4 text-red-500" />
                        Últimas Alertas
                      </h3>
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7" onClick={() => setActiveTab('alertas')}>
                        Ver todas <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {(stats?.recentAlerts ?? []).length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Sin alertas registradas</p>
                        </div>
                      ) : (
                        (stats?.recentAlerts ?? []).map((alert) => {
                          const typeConfig = getAlertTypeConfig(alert.tipo)
                          const estadoConfig = ESTADO_CONFIG[alert.estado] || ESTADO_CONFIG.ACTIVA
                          const TipoIcon = typeConfig.icon
                          const EstadoIcon = estadoConfig.icon

                          return (
                            <button
                              key={alert.id}
                              onClick={() => setSelectedAlert(alert)}
                              className="w-full flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 text-left"
                            >
                              <div className="flex-shrink-0 p-2 rounded-lg border bg-white shadow-sm">
                                <TipoIcon className={`h-4 w-4 ${typeConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-medium text-slate-800">{typeConfig.label}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}>
                                    <EstadoIcon className="h-2.5 w-2.5 mr-0.5" />
                                    {estadoConfig.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {alert.user?.name || 'N/A'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(alert.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Recent Reports */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-500" />
                        Últimos Reportes HSE
                      </h3>
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-7" onClick={() => setActiveTab('reportes')}>
                        Ver todos <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {(stats?.recentReports ?? []).length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Sin reportes registrados</p>
                        </div>
                      ) : (
                        (stats?.recentReports ?? []).map((report) => {
                          const estadoConfig = ESTADO_CONFIG[report.estado] || {
                            label: report.estado,
                            className: 'bg-slate-100 text-slate-600 border-slate-300',
                            icon: HelpCircle,
                          }
                          const EstadoIcon = estadoConfig.icon

                          return (
                            <button
                              key={report.id}
                              onClick={() => setSelectedReport(report)}
                              className="w-full flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 text-left"
                            >
                              <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg border bg-amber-50 border-amber-200">
                                <MessageSquare className="h-4 w-4 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-sm font-medium text-slate-800">
                                    {CATEGORIA_LABELS[report.categoria] || report.categoria}
                                  </span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}>
                                    <EstadoIcon className="h-2.5 w-2.5 mr-0.5" />
                                    {estadoConfig.label}
                                  </Badge>
                                  {report.fotoUrl && (
                                    <Camera className="h-3 w-3 text-slate-400" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2">{report.descripcion}</p>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {report.user?.name || 'N/A'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(report.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <Eye className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Tab: Alertas ── */}
              <TabsContent value="alertas">
                <div className="flex flex-wrap gap-3 mb-4">
                  <Select value={alertEstadoFilter} onValueChange={setAlertEstadoFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los estados</SelectItem>
                      <SelectItem value="ACTIVA">Activa</SelectItem>
                      <SelectItem value="ATENDIDA">Atendida</SelectItem>
                      <SelectItem value="DESCARTADA">Descartada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={alertPrioridadFilter} onValueChange={setAlertPrioridadFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todas</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="MEDIA">Media</SelectItem>
                      <SelectItem value="BAJA">Baja</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-slate-400 self-center ml-auto">
                    {filteredAlerts.length} alerta{filteredAlerts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay alertas que coincidan con los filtros</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2 pr-2">
                      {filteredAlerts.map((alert) => {
                        const typeConfig = getAlertTypeConfig(alert.tipo)
                        const estadoConfig = ESTADO_CONFIG[alert.estado] || ESTADO_CONFIG.ACTIVA
                        const priorityConfig = PRIORITY_CONFIG[alert.prioridad] || PRIORITY_CONFIG.MEDIA
                        const TipoIcon = typeConfig.icon
                        const EstadoIcon = estadoConfig.icon

                        return (
                          <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                              alert.estado === 'ACTIVA' ? 'border-red-200 bg-red-50/30' : 'border-border'
                            }`}
                            onClick={() => setSelectedAlert(alert)}
                          >
                            <div className="flex-shrink-0 p-2 rounded-lg border bg-white shadow-sm">
                              <TipoIcon className={`h-4 w-4 ${typeConfig.color}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-slate-800">
                                  {typeConfig.label}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}>
                                  <EstadoIcon className="h-2.5 w-2.5 mr-0.5" />
                                  {estadoConfig.label}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig.className}`}>
                                  {priorityConfig.label}
                                </Badge>
                                {alert.photoUrl && <Camera className="h-3 w-3 text-slate-400" />}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {alert.user?.name || 'N/A'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(alert.createdAt)}
                                </span>
                                {alert.ubicacion && (
                                  <span className="flex items-center gap-1 text-emerald-600">
                                    <MapPin className="h-3 w-3" />
                                    GPS
                                  </span>
                                )}
                              </div>
                              {alert.descripcion && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">
                                  {alert.descripcion}
                                </p>
                              )}
                            </div>

                            {alert.estado === 'ACTIVA' && isAdminOrSupervisor ? (
                              <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1"
                                  disabled={updatingId === alert.id}
                                  onClick={() => updateAlertStatus(alert.id, 'ATENDIDA')}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  <span className="hidden sm:inline">Atender</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-slate-300 text-slate-600 hover:bg-slate-50 gap-1"
                                  disabled={updatingId === alert.id}
                                  onClick={() => updateAlertStatus(alert.id, 'DESCARTADA')}
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span className="hidden sm:inline">Descartar</span>
                                </Button>
                              </div>
                            ) : alert.attendedByName ? (
                              <div className="flex-shrink-0 text-right">
                                <p className="text-[10px] text-slate-400">Atendida por</p>
                                <p className="text-xs text-slate-600 font-medium">{alert.attendedByName}</p>
                              </div>
                            ) : (
                              <Eye className="h-4 w-4 text-slate-300 flex-shrink-0" />
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* ── Tab: Reportes HSE ── */}
              <TabsContent value="reportes">
                <div className="flex flex-wrap gap-3 mb-4">
                  <Select value={reportEstadoFilter} onValueChange={setReportEstadoFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los estados</SelectItem>
                      <SelectItem value="ABIERTO">Abierto</SelectItem>
                      <SelectItem value="EN_REVISION">En Revisión</SelectItem>
                      <SelectItem value="RESUELTO">Resuelto</SelectItem>
                      <SelectItem value="DESCARTADO">Descartado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={reportCategoriaFilter} onValueChange={setReportCategoriaFilter}>
                    <SelectTrigger className="w-[170px] h-8 text-xs">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todas las categorías</SelectItem>
                      {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-slate-400 self-center ml-auto">
                    {filteredReports.length} reporte{filteredReports.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {filteredReports.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay reportes que coincidan con los filtros</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2 pr-2">
                      {filteredReports.map((report) => {
                        const estadoConfig = ESTADO_CONFIG[report.estado] || {
                          label: report.estado,
                          className: 'bg-slate-100 text-slate-600 border-slate-300',
                          icon: HelpCircle,
                        }
                        const priorityConfig = PRIORITY_CONFIG[report.prioridad] || PRIORITY_CONFIG.MEDIA
                        const EstadoIcon = estadoConfig.icon

                        return (
                          <motion.div
                            key={report.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => setSelectedReport(report)}
                          >
                            <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg border bg-amber-50 border-amber-200">
                              <MessageSquare className="h-4 w-4 text-amber-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-medium text-slate-800">
                                  {CATEGORIA_LABELS[report.categoria] || report.categoria}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}>
                                  <EstadoIcon className="h-2.5 w-2.5 mr-0.5" />
                                  {estadoConfig.label}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig.className}`}>
                                  {priorityConfig.label}
                                </Badge>
                                {report.fotoUrl && (
                                  <Camera className="h-3 w-3 text-emerald-500" />
                                )}
                                {report.ubicacion && (
                                  <MapPin className="h-3 w-3 text-emerald-500" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 mb-1">
                                {report.descripcion}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {report.user?.name || 'N/A'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(report.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                              {isAdminOrSupervisor && report.estado === 'ABIERTO' && (
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 border-sky-300 text-sky-700 hover:bg-sky-50 gap-0.5"
                                    disabled={updatingId === report.id}
                                    onClick={() => updateReportStatus(report.id, 'EN_REVISION')}
                                  >
                                    <Eye className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Revisar</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-0.5"
                                    disabled={updatingId === report.id}
                                    onClick={() => updateReportStatus(report.id, 'RESUELTO')}
                                  >
                                    <CheckCircle className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Resolver</span>
                                  </Button>
                                </div>
                              )}
                              <Eye className="h-4 w-4 text-slate-300" />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Alert Detail Modal ═══ */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => { if (!open) setSelectedAlert(null) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          {selectedAlert && (() => {
            const typeConfig = getAlertTypeConfig(selectedAlert.tipo)
            const estadoConfig = ESTADO_CONFIG[selectedAlert.estado] || ESTADO_CONFIG.ACTIVA
            const priorityConfig = PRIORITY_CONFIG[selectedAlert.prioridad] || PRIORITY_CONFIG.MEDIA
            const TipoIcon = typeConfig.icon
            const location = parseLocation(selectedAlert.ubicacion)

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${typeConfig.bgLight}`}>
                      <TipoIcon className={`h-6 w-6 ${typeConfig.color}`} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">
                        Alerta: {typeConfig.label}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        ID: {selectedAlert.id.slice(0, 8)}...
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-4 py-2">
                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={`${estadoConfig.className} text-xs px-2.5 py-1`}>
                        {estadoConfig.label}
                      </Badge>
                      <Badge variant="outline" className={`${priorityConfig.className} text-xs px-2.5 py-1`}>
                        {priorityConfig.label}
                      </Badge>
                    </div>

                    {/* Reporter info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{selectedAlert.user?.name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{selectedAlert.user?.email || ''}</p>
                      </div>
                    </div>

                    {/* Description */}
                    {selectedAlert.descripcion && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción</h4>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selectedAlert.descripcion}</p>
                      </div>
                    )}

                    {/* Photo */}
                    {selectedAlert.photoUrl && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto Evidencia</h4>
                        <div className="rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={selectedAlert.photoUrl}
                            alt="Evidencia"
                            className="w-full h-auto object-cover max-h-64 cursor-pointer"
                            onClick={() => openImagePreview(selectedAlert.photoUrl!)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {location && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ubicación GPS</h4>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                          <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-sm text-slate-700 font-mono">
                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Timeline</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="text-slate-600">Creada:</span>
                          <span className="text-slate-800 font-medium">{formatDateTime(selectedAlert.createdAt)}</span>
                        </div>
                        {selectedAlert.attendedAt && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-slate-600">Atendida:</span>
                            <span className="text-slate-800 font-medium">{formatDateTime(selectedAlert.attendedAt)}</span>
                          </div>
                        )}
                        {selectedAlert.attendedByName && (
                          <div className="flex items-center gap-2 text-xs pl-4">
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="text-slate-500">Por: {selectedAlert.attendedByName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                {selectedAlert.estado === 'ACTIVA' && isAdminOrSupervisor && (
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      disabled={updatingId === selectedAlert.id}
                      onClick={() => {
                        updateAlertStatus(selectedAlert.id, 'ATENDIDA')
                        setSelectedAlert(null)
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Marcar como Atendida
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50 gap-2"
                      disabled={updatingId === selectedAlert.id}
                      onClick={() => {
                        updateAlertStatus(selectedAlert.id, 'DESCARTADA')
                        setSelectedAlert(null)
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Descartar
                    </Button>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ Report Detail Modal ═══ */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          {selectedReport && (() => {
            const estadoConfig = ESTADO_CONFIG[selectedReport.estado] || {
              label: selectedReport.estado,
              className: 'bg-slate-100 text-slate-600 border-slate-300',
              icon: HelpCircle,
            }
            const priorityConfig = PRIORITY_CONFIG[selectedReport.prioridad] || PRIORITY_CONFIG.MEDIA
            const CatIcon = CATEGORIA_ICONS[selectedReport.categoria] || HelpCircle
            const location = parseLocation(selectedReport.ubicacion)

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <CatIcon className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">
                        {CATEGORIA_LABELS[selectedReport.categoria] || selectedReport.categoria}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        Reporte HSE — ID: {selectedReport.id.slice(0, 8)}...
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-4 py-2">
                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={`${estadoConfig.className} text-xs px-2.5 py-1`}>
                        {estadoConfig.label}
                      </Badge>
                      <Badge variant="outline" className={`${priorityConfig.className} text-xs px-2.5 py-1`}>
                        {priorityConfig.label}
                      </Badge>
                    </div>

                    {/* Reporter info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{selectedReport.user?.name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{selectedReport.user?.email || ''}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción del Hallazgo</h4>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">
                        {selectedReport.descripcion}
                      </p>
                    </div>

                    {/* Photo */}
                    {selectedReport.fotoUrl && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto Evidencia</h4>
                        <div className="rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={selectedReport.fotoUrl}
                            alt="Evidencia del reporte"
                            className="w-full h-auto object-cover max-h-64 cursor-pointer"
                            onClick={() => openImagePreview(selectedReport.fotoUrl!)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {location && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ubicación GPS</h4>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                          <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-sm text-slate-700 font-mono">
                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Timeline</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-slate-600">Creado:</span>
                          <span className="text-slate-800 font-medium">{formatDateTime(selectedReport.createdAt)}</span>
                        </div>
                        {selectedReport.updatedAt && selectedReport.estado !== 'ABIERTO' && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-2 h-2 rounded-full ${
                              selectedReport.estado === 'RESUELTO' ? 'bg-emerald-500' : 'bg-sky-500'
                            } shrink-0`} />
                            <span className="text-slate-600">Actualizado:</span>
                            <span className="text-slate-800 font-medium">{formatDateTime(selectedReport.updatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                {isAdminOrSupervisor && (
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    {(selectedReport.estado === 'ABIERTO' || selectedReport.estado === 'EN_REVISION') && (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        disabled={updatingId === selectedReport.id}
                        onClick={() => {
                          updateReportStatus(selectedReport.id, 'RESUELTO')
                          setSelectedReport(null)
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Marcar Resuelto
                      </Button>
                    )}
                    {selectedReport.estado === 'ABIERTO' && (
                      <Button
                        variant="outline"
                        className="flex-1 border-sky-300 text-sky-700 hover:bg-sky-50 gap-2"
                        disabled={updatingId === selectedReport.id}
                        onClick={() => {
                          updateReportStatus(selectedReport.id, 'EN_REVISION')
                          setSelectedReport(null)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        En Revisión
                      </Button>
                    )}
                    {selectedReport.estado !== 'DESCARTADO' && selectedReport.estado !== 'RESUELTO' && (
                      <Button
                        variant="outline"
                        className="border-slate-300 text-slate-600 hover:bg-slate-50 gap-2"
                        disabled={updatingId === selectedReport.id}
                        onClick={() => {
                          updateReportStatus(selectedReport.id, 'DESCARTADO')
                          setSelectedReport(null)
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Descartar
                      </Button>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ Image Preview Modal ═══ */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => { if (!open) setImagePreviewUrl(null) }}>
        <DialogContent className="max-w-2xl p-2 bg-black/95 border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista previa de imagen</DialogTitle>
            <DialogDescription>Foto evidencia ampliada</DialogDescription>
          </DialogHeader>
          {imagePreviewUrl && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <img
                src={imagePreviewUrl}
                alt="Evidencia ampliada"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
