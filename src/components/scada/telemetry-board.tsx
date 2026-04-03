'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Thermometer,
  Cloud,
  Zap,
  Plus,
  Trash2,
  Loader2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  Settings,
  TrendingUp,
  Clock,
  MapPin,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import { apiFetch, getToken } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────

interface TelemetryPoint {
  sensorId: string
  sensorName: string
  type: string
  value: number
  unit: string
  status: 'NORMAL' | 'WARNING' | 'CRITICO'
  thresholdCritical: number
  thresholdWarning: number
  isSimulated: boolean
  timestamp: string
}

interface SiteSafety {
  isSafe: boolean
  criticalSensors: Array<{
    id: string
    name: string
    type: string
    value: number
    unit: string
    threshold: number
  }>
  warningSensors: Array<{
    id: string
    name: string
    type: string
    value: number
    unit: string
  }>
}

interface SensorConfig {
  id: string
  name: string
  type: string
  unit: string
  thresholdCritical: number
  thresholdWarning: number
  isSimulated: boolean
  isActive: boolean
  locationId?: string | null
  location?: { id: string; name: string } | null
}

interface TelemetryResponse {
  points: TelemetryPoint[]
  siteSafety: SiteSafety
  demoMode: boolean
  timestamp: string
}

interface HistoryPoint {
  value: number
  status: string
  timestamp: string
}

const SENSOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PRESION: Gauge,
  TEMPERATURA: Thermometer,
  GAS: Cloud,
  VOLTAJE: Zap,
}

const SENSOR_COLORS: Record<string, { normal: string; warning: string; critical: string; bg: string }> = {
  PRESION: { normal: '#10b981', warning: '#f59e0b', critical: '#ef4444', bg: 'from-emerald-500/10 to-emerald-500/5' },
  TEMPERATURA: { normal: '#10b981', warning: '#f59e0b', critical: '#ef4444', bg: 'from-orange-500/10 to-orange-500/5' },
  GAS: { normal: '#10b981', warning: '#f59e0b', critical: '#ef4444', bg: 'from-yellow-500/10 to-yellow-500/5' },
  VOLTAJE: { normal: '#10b981', warning: '#f59e0b', critical: '#ef4444', bg: 'from-cyan-500/10 to-cyan-500/5' },
}

// ── Component ──────────────────────────────────────────────

export default function TelemetryBoard() {
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null)
  const [sensors, setSensors] = useState<SensorConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(true)
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingSensor, setAddingSensor] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // New sensor form
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('PRESION')
  const [newLocation, setNewLocation] = useState('')

  // ── Load initial data ──────────────────────────────────

  const loadSensors = useCallback(async () => {
    try {
      const data = await apiFetch<SensorConfig[]>('/sensors')
      setSensors(data)
    } catch {
      // ignore
    }
  }, [])

  const loadLocations = useCallback(async () => {
    try {
      const data = await apiFetch<{ locations?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>>('/locations')
      // /api/locations returns { locations: [...], pagination } not a plain array
      if (Array.isArray(data)) {
        setLocations(data)
      } else if (data && typeof data === 'object' && Array.isArray(data.locations)) {
        setLocations(data.locations)
      } else {
        setLocations([])
      }
    } catch {
      setLocations([])
    }
  }, [])

  const loadTelemetry = useCallback(async () => {
    try {
      const data = await apiFetch<TelemetryResponse>('/sensors/telemetry')
      setTelemetry(data)
      setDemoMode(data.demoMode)
      setLastUpdate(new Date().toLocaleTimeString('es'))
    } catch {
      // If telemetry fails (e.g. Prisma not regenerated), show empty state
      setTelemetry({ points: [], siteSafety: { isSafe: true, criticalSensors: [], warningSensors: [] }, demoMode: true, timestamp: new Date().toISOString() })
      setLastUpdate(new Date().toLocaleTimeString('es'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSensors()
    loadLocations()
  }, [loadSensors, loadLocations])

  // ── Polling (every 3 seconds) ──────────────────────────

  useEffect(() => {
    loadTelemetry()

    pollRef.current = setInterval(() => {
      loadTelemetry()
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadTelemetry])

  // ── Load history when sensor selected ──────────────────

  useEffect(() => {
    if (!selectedSensor) {
      setHistory([])
      return
    }

    const loadHistory = async () => {
      try {
        const data = await apiFetch<HistoryPoint[]>(`/sensors/${selectedSensor}/readings?limit=60`)
        setHistory(data)
      } catch {
        setHistory([])
      }
    }

    loadHistory()
    const interval = setInterval(loadHistory, 5000)
    return () => clearInterval(interval)
  }, [selectedSensor])

  // ── Toggle simulation ──────────────────────────────────

  const toggleSimulation = useCallback(async (enabled: boolean) => {
    try {
      await apiFetch('/sensors/simulation', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      })
      setDemoMode(enabled)
    } catch {
      // keep previous state
    }
  }, [])

  // ── Add sensor ─────────────────────────────────────────

  const handleAddSensor = async () => {
    if (!newName.trim()) return
    setAddingSensor(true)
    try {
      await apiFetch('/sensors', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          locationId: newLocation || null,
        }),
      })
      setShowAddDialog(false)
      setNewName('')
      setNewType('PRESION')
      setNewLocation('')
      loadSensors()
      loadTelemetry()
    } catch (err: any) {
      alert(err.message || 'Error al crear sensor')
    } finally {
      setAddingSensor(false)
    }
  }

  // ── Delete sensor ──────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este sensor y todas sus lecturas?')) return
    setDeletingId(id)
    try {
      await apiFetch(`/sensors/${id}`, { method: 'DELETE' })
      loadSensors()
      loadTelemetry()
      if (selectedSensor === id) setSelectedSensor(null)
    } catch (err: any) {
      alert(err.message || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render Helpers ─────────────────────────────────────

  const getLedColor = (status: string) => {
    switch (status) {
      case 'CRITICO': return 'bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]'
      case 'WARNING': return 'bg-amber-500 shadow-[0_0_6px_1px_rgba(245,158,11,0.5)]'
      default: return 'bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.5)]'
    }
  }

  const getGaugeColor = (value: number, critical: number, warning: number) => {
    const pct = Math.min((value / critical) * 100, 100)
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return '#10b981'
  }

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getSensorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PRESION: 'Presión',
      TEMPERATURA: 'Temperatura',
      GAS: 'Gas (LEL)',
      VOLTAJE: 'Voltaje',
    }
    return labels[type] || type
  }

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">SCADA — Telemetría en Tiempo Real</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Última actualización: {lastUpdate || '—'}
              {demoMode && (
                <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                  <Radio className="w-3 h-3 mr-1" />
                  SIMULACIÓN
                </Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Simulation Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200">
            {demoMode ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-400" />
            )}
            <Label htmlFor="demo-toggle" className="text-xs text-slate-600 cursor-pointer">
              Modo Demo
            </Label>
            <Switch
              id="demo-toggle"
              checked={demoMode}
              onCheckedChange={toggleSimulation}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>

          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            Sensor
          </Button>
        </div>
      </div>

      {/* ── Site Safety Banner ──────────────────────────── */}
      <AnimatePresence mode="wait">
        {telemetry && !telemetry.siteSafety.isSafe && (
          <motion.div
            key="unsafe"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border-2 border-red-400 bg-gradient-to-r from-red-900 to-red-950 p-4 text-white"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/30">
                <ShieldAlert className="w-6 h-6 text-red-300 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  ALERTA SCADA — SITIO NO SEGURO
                </h3>
                <p className="text-sm text-red-200 mt-1">
                  Se han detectado sensores en estado CRÍTICO. Las operaciones de firma están BLOQUEADAS.
                </p>
                <div className="mt-3 space-y-2">
                  {telemetry.siteSafety.criticalSensors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="font-medium text-red-100">{s.name}</span>
                        <span className="text-red-300 text-xs">({s.type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-red-100">{s.value} {s.unit}</span>
                        <Badge className="bg-red-600 text-white text-[10px]">Límite: {s.threshold} {s.unit}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {telemetry && telemetry.siteSafety.isSafe && (
          <motion.div
            key="safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 text-white"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-slate-300">
              Todos los sensores operativos — Sitio SEGURO
            </span>
            {telemetry.siteSafety.warningSensors.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                {telemetry.siteSafety.warningSensors.length} advertencia(s)
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sensor Grid ─────────────────────────────────── */}
      {!telemetry || telemetry.points.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-16 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No hay sensores configurados</p>
            <p className="text-xs text-slate-400 mt-1">Agregue un sensor para comenzar el monitoreo</p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="mt-4 bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Agregar Sensor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {telemetry.points.map((point, index) => {
            const Icon = SENSOR_ICONS[point.type] || Gauge
            const colors = SENSOR_COLORS[point.type] || SENSOR_COLORS.PRESION
            const gaugeColor = getGaugeColor(point.value, point.thresholdCritical, point.thresholdWarning)
            const pct = Math.min((point.value / point.thresholdCritical) * 100, 115)
            const isSelected = selectedSensor === point.sensorId

            return (
              <motion.div
                key={point.sensorId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    'cursor-pointer transition-all border-2 overflow-hidden',
                    isSelected
                      ? 'border-slate-900 shadow-lg'
                      : point.status === 'CRITICO'
                        ? 'border-red-300 shadow-red-100'
                        : point.status === 'WARNING'
                          ? 'border-amber-300'
                          : 'border-slate-200 hover:border-slate-300',
                    point.status === 'CRITICO' && 'bg-red-50/30'
                  )}
                  onClick={() => setSelectedSensor(isSelected ? null : point.sensorId)}
                >
                  {/* Status bar */}
                  <div className={cn(
                    'h-1',
                    point.status === 'CRITICO' ? 'bg-red-500' :
                    point.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                  )} />

                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'p-2 rounded-lg',
                          point.status === 'CRITICO' ? 'bg-red-100' :
                          point.status === 'WARNING' ? 'bg-amber-100' : 'bg-slate-100'
                        )}>
                          <Icon className={cn(
                            'w-4 h-4',
                            point.status === 'CRITICO' ? 'text-red-600' :
                            point.status === 'WARNING' ? 'text-amber-600' : 'text-slate-600'
                          )} />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-slate-800 leading-tight">
                            {point.sensorName}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {getSensorTypeLabel(point.type)}
                            {point.isSimulated && ' • SIM'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* LED Indicator */}
                        <div className={cn(
                          'w-3 h-3 rounded-full transition-all duration-500',
                          getLedColor(point.status)
                        )} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Main Value */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono tracking-tight" style={{ color: gaugeColor }}>
                        {point.value.toFixed(1)}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">{point.unit}</span>
                    </div>

                    {/* Gauge bar */}
                    <div className="space-y-1">
                      <div className="relative h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ backgroundColor: gaugeColor }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                        {/* Warning zone */}
                        <div
                          className="absolute inset-y-0 right-0 bg-amber-200/50"
                          style={{ width: `${((point.thresholdCritical - point.thresholdWarning) / point.thresholdCritical) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>0</span>
                        <span className="text-amber-500 font-medium">Warn: {point.thresholdWarning}</span>
                        <span className="text-red-500 font-medium">Crit: {point.thresholdCritical}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <Badge className={cn(
                        'text-[10px] border font-semibold',
                        point.status === 'CRITICO' ? 'bg-red-100 text-red-700 border-red-200' :
                        point.status === 'WARNING' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-emerald-100 text-emerald-700 border-emerald-200'
                      )}>
                        {point.status === 'CRITICO' ? '⚠ CRÍTICO' :
                         point.status === 'WARNING' ? '⚡ ADVERTENCIA' : '● NORMAL'}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        {formatTime(point.timestamp)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Expanded Chart View ─────────────────────────── */}
      {selectedSensor && (
            <Card className="border-slate-900 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-700" />
                    <CardTitle className="text-sm font-semibold text-slate-800">
                      Tendencia — {telemetry?.points.find(p => p.sensorId === selectedSensor)?.sensorName || 'Sensor'}
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSensor(null)} className="text-xs text-slate-500">
                    Cerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando datos históricos...
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(v) => new Date(v).toLocaleTimeString('es', { minute: '2-digit', second: '2-digit' })}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          domain={['auto', 'auto']}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#e2e8f0',
                          }}
                          labelFormatter={(v) => new Date(v).toLocaleTimeString('es')}
                          formatter={(value: number, _name: string, props: any) => [
                            `${value.toFixed(1)} ${telemetry?.points.find(p => p.sensorId === selectedSensor)?.unit || ''}`,
                            props.payload.status === 'CRITICO' ? 'CRÍTICO' :
                            props.payload.status === 'WARNING' ? 'ADVERTENCIA' : 'Normal'
                          ]}
                        />
                        {telemetry?.points.find(p => p.sensorId === selectedSensor) && (
                          <ReferenceLine
                            y={telemetry.points.find(p => p.sensorId === selectedSensor)!.thresholdCritical}
                            stroke="#ef4444"
                            strokeDasharray="6 3"
                            strokeWidth={1.5}
                            label={{ value: 'CRÍTICO', position: 'right', fontSize: 9, fill: '#ef4444' }}
                          />
                        )}
                        {telemetry?.points.find(p => p.sensorId === selectedSensor) && (
                          <ReferenceLine
                            y={telemetry.points.find(p => p.sensorId === selectedSensor)!.thresholdWarning}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={1}
                            label={{ value: 'WARN', position: 'right', fontSize: 9, fill: '#f59e0b' }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#valueGradient)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
      )}

      {/* ── Sensor Management List ──────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            Configuración de Sensores
            <Badge className="text-[10px] bg-slate-100 text-slate-600 ml-auto">{sensors.length} sensor(es)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-72">
            {sensors.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No hay sensores configurados
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sensors.map((sensor) => (
                  <div key={sensor.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        !sensor.isActive ? 'bg-slate-300' :
                        telemetry?.points.find(p => p.sensorId === sensor.id)?.status === 'CRITICO' ? 'bg-red-500' :
                        telemetry?.points.find(p => p.sensorId === sensor.id)?.status === 'WARNING' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{sensor.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {getSensorTypeLabel(sensor.type)} • {sensor.unit}
                          {sensor.isSimulated && ' • Simulado'}
                          {!sensor.isActive && ' • Inactivo'}
                          {sensor.location && (
                            <span className="ml-1 flex items-center gap-0.5 inline">
                              <MapPin className="w-2.5 h-2.5" />
                              {sensor.location.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] bg-slate-100 text-slate-500">
                        Crít: {sensor.thresholdCritical} {sensor.unit}
                      </Badge>
                      {deletingId === sensor.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDelete(sensor.id) }}
                          className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Add Sensor Dialog ───────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Agregar Sensor
            </DialogTitle>
            <DialogDescription>
              Configure un nuevo sensor de monitoreo para la ubicación de trabajo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Nombre del Sensor</Label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Presión Línea Principal A"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Tipo de Sensor</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESION">Presión (psi)</SelectItem>
                  <SelectItem value="TEMPERATURA">Temperatura (°C)</SelectItem>
                  <SelectItem value="GAS">Gas LEL (%LEL)</SelectItem>
                  <SelectItem value="VOLTAJE">Voltaje (V)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Ubicación (Opcional)</Label>
              <Select value={newLocation} onValueChange={setNewLocation}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin ubicación asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin ubicación</SelectItem>
                  {Array.isArray(locations) && locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAddSensor}
                disabled={!newName.trim() || addingSensor}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {addingSensor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear Sensor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
