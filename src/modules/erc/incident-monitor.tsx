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
  alertsByType: Record<string, number>
  recentAlerts: EmergencyAlert[]
  recentReports: HSEReport[]
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

// ============ Alert type config ============

const ALERT_TYPE_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string; bg: string }> = {
  PANICO: { icon: Siren, label: 'Pánico', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  INCENDIO: { icon: Zap, label: 'Incendio', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  DERRAME: { icon: Droplets, label: 'Derrame', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  CAIDA: { icon: PersonStanding, label: 'Caída', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  ELECTRICO: { icon: CircleDot, label: 'Eléctrico', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  OTRO: { icon: HelpCircle, label: 'Otro', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  ALTA: { label: 'Alta', className: 'bg-red-100 text-red-700 border-red-300' },
  MEDIA: { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  BAJA: { label: 'Baja', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVA: { label: 'Activa', className: 'bg-red-100 text-red-700 border-red-300' },
  ATENDIDA: { label: 'Atendida', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  DESCARTADA: { label: 'Descartada', className: 'bg-slate-100 text-slate-600 border-slate-300' },
}

const CATEGORIA_LABELS: Record<string, string> = {
  CONDICION_INSEGURA: 'Condición Insegura',
  ACTO_INSEGURO: 'Acto Inseguro',
  CASI_ACCIDENTE: 'Casi Accidente',
  ACCIDENTE: 'Accidente',
  INCIDENTE_AMBIENTAL: 'Incidente Ambiental',
  OTRO: 'Otro',
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
  const [activeTab, setActiveTab] = useState('alertas')

  // Filter state
  const [alertEstadoFilter, setAlertEstadoFilter] = useState<string>('TODOS')
  const [alertPrioridadFilter, setAlertPrioridadFilter] = useState<string>('TODOS')

  // Derived data
  const activeAlerts = alerts.filter((a) => a.estado === 'ACTIVA')

  const filteredAlerts = alerts.filter((a) => {
    if (alertEstadoFilter !== 'TODOS' && a.estado !== alertEstadoFilter) return false
    if (alertPrioridadFilter !== 'TODOS' && a.prioridad !== alertPrioridadFilter) return false
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

      // Optimistic update
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? updated : a))
      )

      // Broadcast status change via WebSocket
      socketRef.current?.emit('alert-updated', {
        companyId,
        alert: updated,
      })

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

  // ============ Effects ============

  // Initial data load + polling every 15s
  useEffect(() => {
    fetchData()
    pollingRef.current = setInterval(fetchData, 15_000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchData])

  // WebSocket connection
  useEffect(() => {
    const socket = io('/?XTransformPort=3004', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10_000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      // Join the company room for real-time alerts
      socket.emit('join-company', { companyId })
    })

    // New emergency alert from another user
    socket.on('emergency-alert', (data: { alert: EmergencyAlert }) => {
      const newAlert = data.alert
      setAlerts((prev) => {
        // Avoid duplicates
        if (prev.some((a) => a.id === newAlert.id)) return prev
        return [newAlert, ...prev]
      })

      // Update stats
      setStats((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          activeAlerts: prev.activeAlerts + 1,
          totalAlerts: prev.totalAlerts + 1,
        }
      })

      toast({
        title: '⚠️ Nueva Alerta de Emergencia',
        description: `${getAlertTypeConfig(newAlert.tipo).label} — ${newAlert.user?.name || 'Usuario'}`,
        variant: 'destructive',
      })
    })

    // Alert status changed by another user
    socket.on('alert-status-changed', (data: { alert: EmergencyAlert }) => {
      const changedAlert = data.alert
      setAlerts((prev) =>
        prev.map((a) => (a.id === changedAlert.id ? changedAlert : a))
      )
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [companyId, toast])

  // ============ Render helpers ============

  const renderAlertTypeIcon = (tipo: string) => {
    const config = getAlertTypeConfig(tipo)
    const IconComponent = config.icon
    return (
      <div className={`p-2 rounded-lg ${config.bg} border`}>
        <IconComponent className={`h-4 w-4 ${config.color}`} />
      </div>
    )
  }

  // ============ Loading state ============

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Active alerts banner skeleton */}
        <Skeleton className="h-12 w-full rounded-lg" />
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-8 w-14 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Tabs skeleton */}
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-10 w-64 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
      {/* ── Section 1: Active Alerts Banner ── */}
      <AnimatePresence>
        {activeAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="animate-pulse rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-600 to-red-500 p-4 text-white shadow-lg shadow-red-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <Siren className="h-6 w-6 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">
                  EMERGENCIA ACTIVA — {activeAlerts.length} alerta{activeAlerts.length !== 1 ? 's' : ''} sin atender
                </h2>
                <p className="text-red-100 text-sm">
                  Se requiere atención inmediata del personal de emergencia
                </p>
              </div>
            </div>

            {/* Active alert cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeAlerts.map((alert) => {
                const typeConfig = getAlertTypeConfig(alert.tipo)
                const priorityConfig = PRIORITY_CONFIG[alert.prioridad] || PRIORITY_CONFIG.MEDIA

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-white/20">
                        <typeConfig.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{typeConfig.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-medium">
                            {priorityConfig.label}
                          </span>
                        </div>
                        <p className="text-white/90 text-xs font-medium truncate">
                          {alert.user?.name || 'Usuario desconocido'}
                        </p>
                        <p className="text-white/60 text-[11px] flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(alert.createdAt)}
                        </p>
                      </div>
                    </div>

                    {isAdminOrSupervisor && (
                      <div className="flex gap-2 mt-2 ml-9">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0 flex-1"
                          disabled={updatingId === alert.id}
                          onClick={() => updateAlertStatus(alert.id, 'ATENDIDA')}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Atender
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10 flex-1"
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

      {/* ── Section 2: Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </div>
                {stats && stats.activeAlerts > 0 && (
                  <span className="flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {stats?.activeAlerts ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Alertas Activas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-slate-50">
                  <Activity className="h-5 w-5 text-slate-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {stats?.totalAlerts ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Alertas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                {stats && stats.openReports > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">
                    Pendiente
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {stats?.openReports ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Reportes Abiertos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-slate-50">
                  <FileText className="h-5 w-5 text-slate-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {stats?.totalReports ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Reportes Totales</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Section 3: Tabs — Alertas | Reportes HSE ── */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 pb-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
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

              {/* ── Tab: Alertas ── */}
              <TabsContent value="alertas">
                {/* Filters */}
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
                </div>

                {/* Alerts list */}
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay alertas que coincidan con los filtros</p>
                  </div>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
                    {filteredAlerts.map((alert) => {
                      const typeConfig = getAlertTypeConfig(alert.tipo)
                      const estadoConfig = ESTADO_CONFIG[alert.estado] || ESTADO_CONFIG.ACTIVA
                      const priorityConfig = PRIORITY_CONFIG[alert.prioridad] || PRIORITY_CONFIG.MEDIA

                      return (
                        <motion.div
                          key={alert.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                            alert.estado === 'ACTIVA' ? 'border-red-200 bg-red-50/30' : 'border-border'
                          }`}
                        >
                          {/* Type icon */}
                          <div className="flex-shrink-0">
                            {renderAlertTypeIcon(alert.tipo)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-slate-800">
                                {typeConfig.label}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}
                              >
                                {estadoConfig.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${priorityConfig.className}`}
                              >
                                {priorityConfig.label}
                              </Badge>
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
                            </div>
                            {alert.descripcion && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {alert.descripcion}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          {alert.estado === 'ACTIVA' && isAdminOrSupervisor && (
                            <div className="flex gap-1.5 flex-shrink-0">
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
                          )}

                          {alert.estado !== 'ACTIVA' && alert.attendedByName && (
                            <div className="flex-shrink-0 text-right">
                              <p className="text-[10px] text-slate-400">
                                Atendida por
                              </p>
                              <p className="text-xs text-slate-600 font-medium">
                                {alert.attendedByName}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── Tab: Reportes HSE ── */}
              <TabsContent value="reportes">
                {reports.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay reportes HSE registrados</p>
                  </div>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
                    {reports.map((report) => {
                      const estadoConfig = ESTADO_CONFIG[report.estado] || {
                        label: report.estado,
                        className: 'bg-slate-100 text-slate-600 border-slate-300',
                      }
                      const priorityConfig = PRIORITY_CONFIG[report.prioridad] || PRIORITY_CONFIG.MEDIA

                      return (
                        <motion.div
                          key={report.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                        >
                          {/* Icon */}
                          <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <Eye className="h-4 w-4 text-amber-600" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">
                                {CATEGORIA_LABELS[report.categoria] || report.categoria}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${estadoConfig.className}`}
                              >
                                {estadoConfig.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${priorityConfig.className}`}
                              >
                                {priorityConfig.label}
                              </Badge>
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

                          {/* Photo indicator */}
                          {report.fotoUrl && (
                            <div className="flex-shrink-0">
                              <Eye className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
