'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, MapPin, AlertTriangle, Route, Users, Clock, Shield,
  Plus, Search, RefreshCw, Loader2, ChevronRight, Fuel,
  Activity, Eye, PlayCircle, Navigation, Wrench, FileText,
  TrendingUp, Phone, CalendarDays, Gauge, CircleDot, X, PlusCircle, CheckCircle2, XCircle

} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip'

// ==================== TYPES ====================

interface Trip {
  id: string
  tripNumber: string
  origin: string
  destination: string
  driverName: string | null
  vehiclePlate: string | null
  status: string
  startTime: string | null
  estimatedArrival: string | null
}

interface Vehicle {
  id: string
  plate: string
  type: string
  brand: string | null
  model: string | null
  year: number | null
  status: string
  currentDriverName: string | null
  mileage: number | null
}

interface Driver {
  id: string
  name: string
  licenseType: string
  licenseExpiry: string | null
  status: string
  fatigueScore: number | null
  phone: string | null
  totalTrips: number | null
}

interface TransportRoute {
  id: string
  name: string
  origin: string
  destination: string
  distanceKm: number | null
  durationMinutes: number | null
  riskLevel: string
  activeTrips: number | null
}

interface DriverAlert {
  id: string
  driverName: string | null
  eventType: string
  riskLevel: string
  description: string
  timestamp: string
  location: string | null
}

interface TransportStats {
  activeTrips: number
  availableVehicles: number
  drivingAlerts: number
  routeIncidents: number
}

// ==================== HELPERS ====================

function safeArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : []
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

function daysUntilExpiry(iso: string | null): number | null {
  if (!iso) return null
  try {
    const expiry = new Date(iso)
    const now = new Date()
    const diff = expiry.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  } catch { return null }
}

// ── Trip status badges ──
function tripStatusConfig(status: string) {
  switch (status) {
    case 'PLANIFICADO':
      return { label: 'Planificado', className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
    case 'EN_INSPECCION':
      return { label: 'En Inspeccion', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'AUTORIZADO':
      return { label: 'Autorizado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'EN_TRANSITO':
      return { label: 'En Transito', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    case 'COMPLETADO':
      return { label: 'Completado', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' }
    case 'BLOQUEADO':
      return { label: 'Bloqueado', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    case 'CANCELADO':
      return { label: 'Cancelado', className: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Vehicle type badges ──
function vehicleTypeConfig(type: string) {
  switch (type) {
    case 'TRACTOR':
      return { label: 'Tractor', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'CAMION':
      return { label: 'Camion', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'CAMIONETA':
      return { label: 'Camioneta', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'TANQUE':
      return { label: 'Tanque', className: 'bg-purple-50 text-purple-700 border-purple-200' }
    case 'PLATAFORMA':
      return { label: 'Plataforma', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
    default:
      return { label: type, className: 'bg-slate-50 text-slate-600 border-slate-200' }
  }
}

// ── Vehicle status badges ──
function vehicleStatusConfig(status: string) {
  switch (status) {
    case 'DISPONIBLE':
      return { label: 'Disponible', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'EN_USO':
      return { label: 'En Uso', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    case 'MANTENIMIENTO':
      return { label: 'Mantenimiento', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'FUERA_DE_SERVICIO':
      return { label: 'Fuera de Servicio', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Driver status badges ──
function driverStatusConfig(status: string) {
  switch (status) {
    case 'ACTIVO':
      return { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'SUSPENDIDO':
      return { label: 'Suspendido', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    case 'VENCIDO':
      return { label: 'Vencido', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'INACTIVO':
      return { label: 'Inactivo', className: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── License type badges ──
function licenseTypeConfig(type: string) {
  switch (type) {
    case 'A':
      return { label: 'Categoria A', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'B':
      return { label: 'Categoria B', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'C':
      return { label: 'Categoria C', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'D':
      return { label: 'Categoria D', className: 'bg-purple-50 text-purple-700 border-purple-200' }
    case 'E':
      return { label: 'Categoria E', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
    default:
      return { label: type, className: 'bg-slate-50 text-slate-600 border-slate-200' }
  }
}

// ── Route risk level badges ──
function routeRiskConfig(level: string) {
  switch (level) {
    case 'BAJO':
      return { label: 'Bajo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'MEDIO':
      return { label: 'Medio', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'ALTO':
      return { label: 'Alto', className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' }
    case 'CRITICO':
      return { label: 'Critico', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    default:
      return { label: level, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Alert risk level badges ──
function alertRiskConfig(level: string) {
  switch (level) {
    case 'BAJO':
      return { label: 'Bajo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'MEDIO':
      return { label: 'Medio', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'ALTO':
      return { label: 'Alto', className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' }
    case 'CRITICO':
      return { label: 'Critico', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    default:
      return { label: level, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Fatigue score color ──
function fatigueColor(score: number | null): { color: string; bg: string; label: string } {
  if (score === null) return { color: 'text-slate-400', bg: 'bg-slate-100', label: 'N/D' }
  if (score <= 25) return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Optimo' }
  if (score <= 50) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Moderado' }
  if (score <= 75) return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Alto' }
  return { color: 'text-red-600', bg: 'bg-red-50', label: 'Critico' }
}

// ==================== SKELETON LOADERS ====================

function KpiSkeleton() {
  return (
    <Card className="bg-white shadow-sm rounded-xl border-slate-200">
      <CardContent className="p-4 flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg bg-slate-100" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-16 bg-slate-100" />
          <Skeleton className="h-3 w-24 bg-slate-100" />
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <Card className="bg-white shadow-sm rounded-xl border-slate-200">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-32 bg-slate-100" />
        <Skeleton className="h-4 w-48 bg-slate-100" />
        <Skeleton className="h-4 w-36 bg-slate-100" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 bg-slate-100 rounded-full" />
          <Skeleton className="h-6 w-16 bg-slate-100 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== MAIN COMPONENT ====================

export default function TransportDashboard() {
  // ── State ──
  const [stats, setStats] = useState<TransportStats>({
    activeTrips: 0, availableVehicles: 0, drivingAlerts: 0, routeIncidents: 0,
  })
  const [trips, setTrips] = useState<Trip[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [alerts, setAlerts] = useState<DriverAlert[]>([])

  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  const [vehicleSearch, setVehicleSearch] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [routeSearch, setRouteSearch] = useState('')

  const [simulating, setSimulating] = useState(false)
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null)

  // ── Vehicle Dialog ──
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    plate: '', type: 'CAMION', brand: '', model: '', year: '',
  })
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false)

  // ── Driver Dialog ──
  const [driverDialogOpen, setDriverDialogOpen] = useState(false)
  const [driverForm, setDriverForm] = useState({
    name: '', licenseType: 'C', licenseExpiry: '', phone: '',
  })
  const [driverSubmitting, setDriverSubmitting] = useState(false)

  // ── Route Dialog ──
  const [routeDialogOpen, setRouteDialogOpen] = useState(false)
  const [routeForm, setRouteForm] = useState({
    name: '', origin: '', destination: '', distanceKm: '', estimatedDurationMin: '', riskLevel: 'MEDIO',
  })
  const [routeSubmitting, setRouteSubmitting] = useState(false)

  // ── Trip Dialog ──
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [tripStep, setTripStep] = useState(1)
  const [tripForm, setTripForm] = useState({
    vehicleId: '', driverId: '', routeId: '', notes: '',
  })
  const [tripSubmitting, setTripSubmitting] = useState(false)
  const [tripValidation, setTripValidation] = useState<{
    authorized: boolean
    checks: { check: string; passed: boolean; message: string }[]
    blockingReason?: string
  } | null>(null)
  const [tripChecklist, setTripChecklist] = useState<Record<string, boolean>>({
    luces: false,
    neumaticos: false,
    combustible: false,
    cinturon: false,
    extintor: false,
    emergencia: false,
    documentacion: false,
    gps: false,
  })

  const preDepartureItems = [
    { key: 'luces', label: 'Luces exteriores funcionando' },
    { key: 'neumaticos', label: 'Neumaticos en buen estado' },
    { key: 'combustible', label: 'Nivel de combustible adecuado' },
    { key: 'cinturon', label: 'Cinturon de seguridad disponible' },
    { key: 'extintor', label: 'Extintor vigente' },
    { key: 'emergencia', label: 'Kit de emergencia completo' },
    { key: 'documentacion', label: 'Documentacion del vehiculo al dia' },
    { key: 'gps', label: 'GPS/DMS activo' },
  ]

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await apiFetch<TransportStats>('/transport/stats')
      if (data && typeof data === 'object') {
        setStats({
          activeTrips: typeof data.activeTrips === 'number' ? data.activeTrips : 0,
          availableVehicles: typeof data.availableVehicles === 'number' ? data.availableVehicles : 0,
          drivingAlerts: typeof data.drivingAlerts === 'number' ? data.drivingAlerts : 0,
          routeIncidents: typeof data.routeIncidents === 'number' ? data.routeIncidents : 0,
        })
      }
    } catch { setStats({ activeTrips: 0, availableVehicles: 0, drivingAlerts: 0, routeIncidents: 0 }) }
    finally { setLoadingStats(false) }
  }, [])

  const fetchTrips = useCallback(async () => {
    setLoadingTrips(true)
    try {
      const data = await apiFetch<{ trips?: Trip[] } | Trip[]>('/transport/trips')
      const arr = Array.isArray(data) ? data : safeArray((data as { trips?: Trip[] }).trips)
      setTrips(arr)
    } catch { setTrips([]) }
    finally { setLoadingTrips(false) }
  }, [])

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true)
    try {
      const data = await apiFetch<{ vehicles?: Vehicle[] } | Vehicle[]>('/transport/vehicles')
      const arr = Array.isArray(data) ? data : safeArray((data as { vehicles?: Vehicle[] }).vehicles)
      setVehicles(arr)
    } catch { setVehicles([]) }
    finally { setLoadingVehicles(false) }
  }, [])

  const fetchDrivers = useCallback(async () => {
    setLoadingDrivers(true)
    try {
      const data = await apiFetch<{ drivers?: Driver[] } | Driver[]>('/transport/drivers')
      const arr = Array.isArray(data) ? data : safeArray((data as { drivers?: Driver[] }).drivers)
      setDrivers(arr)
    } catch { setDrivers([]) }
    finally { setLoadingDrivers(false) }
  }, [])

  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true)
    try {
      const data = await apiFetch<{ routes?: TransportRoute[] } | TransportRoute[]>('/transport/routes')
      const arr = Array.isArray(data) ? data : safeArray((data as { routes?: TransportRoute[] }).routes)
      setRoutes(arr)
    } catch { setRoutes([]) }
    finally { setLoadingRoutes(false) }
  }, [])

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true)
    try {
      const data = await apiFetch<{ alerts?: DriverAlert[] } | DriverAlert[]>('/transport/alerts?limit=10')
      const arr = Array.isArray(data) ? data : safeArray((data as { alerts?: DriverAlert[] }).alerts)
      setAlerts(arr)
    } catch { setAlerts([]) }
    finally { setLoadingAlerts(false) }
  }, [])

  const refreshAll = useCallback(() => {
    fetchStats()
    fetchTrips()
    fetchVehicles()
    fetchDrivers()
    fetchRoutes()
    fetchAlerts()
  }, [fetchStats, fetchTrips, fetchVehicles, fetchDrivers, fetchRoutes, fetchAlerts])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // ── Derived Data ──

  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch.trim()) return true
    const q = vehicleSearch.toLowerCase()
    return v.plate.toLowerCase().includes(q) ||
      v.brand?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q)
  })

  const filteredDrivers = drivers.filter((d) => {
    if (!driverSearch.trim()) return true
    return d.name.toLowerCase().includes(driverSearch.toLowerCase())
  })

  const filteredRoutes = routes.filter((r) => {
    if (!routeSearch.trim()) return true
    const q = routeSearch.toLowerCase()
    return r.name.toLowerCase().includes(q) ||
      r.origin.toLowerCase().includes(q) ||
      r.destination.toLowerCase().includes(q)
  })

  // ── Actions ──

  const handleSimulateTrip = async () => {
    if (simulating) return
    setSimulating(true)
    try {
      await apiFetch('/transport/trips', {
        method: 'POST',
        body: JSON.stringify({
          demo: true,
          origin: 'Planta Central',
          destination: 'Deposito Norte',
          vehiclePlate: 'AA 123 BB',
          driverName: 'Chofer Demo',
        }),
      })
      await fetchTrips()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setSimulating(false) }
  }

  const handleRegisterVehicle = async () => {
    if (!vehicleForm.plate.trim() || !vehicleForm.brand.trim()) return
    setVehicleSubmitting(true)
    try {
      await apiFetch('/transport/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          plate: vehicleForm.plate.trim().toUpperCase(),
          type: vehicleForm.type,
          brand: vehicleForm.brand.trim(),
          model: vehicleForm.model.trim() || null,
          year: vehicleForm.year.trim() ? parseInt(vehicleForm.year, 10) : null,
        }),
      })
      setVehicleDialogOpen(false)
      setVehicleForm({ plate: '', type: 'CAMION', brand: '', model: '', year: '' })
      await fetchVehicles()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setVehicleSubmitting(false) }
  }

  const handleRegisterDriver = async () => {
    if (!driverForm.name.trim() || !driverForm.licenseExpiry) return
    setDriverSubmitting(true)
    try {
      await apiFetch('/transport/drivers', {
        method: 'POST',
        body: JSON.stringify({
          name: driverForm.name.trim(),
          licenseType: driverForm.licenseType,
          licenseExpiry: driverForm.licenseExpiry,
          phone: driverForm.phone.trim() || null,
        }),
      })
      setDriverDialogOpen(false)
      setDriverForm({ name: '', licenseType: 'C', licenseExpiry: '', phone: '' })
      await fetchDrivers()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setDriverSubmitting(false) }
  }

  const handleRegisterRoute = async () => {
    if (!routeForm.name.trim() || !routeForm.origin.trim() || !routeForm.destination.trim()) return
    setRouteSubmitting(true)
    try {
      await apiFetch('/transport/routes', {
        method: 'POST',
        body: JSON.stringify({
          name: routeForm.name.trim(),
          origin: routeForm.origin.trim(),
          destination: routeForm.destination.trim(),
          distanceKm: routeForm.distanceKm.trim() ? parseFloat(routeForm.distanceKm) : 0,
          estimatedDurationMin: routeForm.estimatedDurationMin.trim() ? parseInt(routeForm.estimatedDurationMin, 10) : 60,
          riskLevel: routeForm.riskLevel,
        }),
      })
      setRouteDialogOpen(false)
      setRouteForm({ name: '', origin: '', destination: '', distanceKm: '', estimatedDurationMin: '', riskLevel: 'MEDIO' })
      await fetchRoutes()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setRouteSubmitting(false) }
  }

  const handleOpenTripDialog = () => {
    setTripStep(1)
    setTripForm({ vehicleId: '', driverId: '', routeId: '', notes: '' })
    setTripValidation(null)
    setTripChecklist({
      luces: false, neumaticos: false, combustible: false, cinturon: false,
      extintor: false, emergencia: false, documentacion: false, gps: false,
    })
    setTripDialogOpen(true)
  }

  const handleCloseTripDialog = () => {
    setTripDialogOpen(false)
    setTripStep(1)
    setTripValidation(null)
  }

  const handleSubmitTrip = async () => {
    if (!tripForm.vehicleId || !tripForm.driverId || !tripForm.routeId) return
    setTripSubmitting(true)
    try {
      const result = await apiFetch<{
        trip: unknown
        validation: { authorized: boolean; checks: { check: string; passed: boolean; message: string }[]; blockingReason?: string }
        status: string
      }>('/transport/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: tripForm.vehicleId,
          driverId: tripForm.driverId,
          routeId: tripForm.routeId,
          startDate: new Date().toISOString(),
          notes: tripForm.notes.trim() || null,
        }),
      })
      if (result && 'validation' in result) {
        setTripValidation(result.validation)
        setTripStep(5)
      } else {
        setTripDialogOpen(false)
        await fetchTrips()
        await fetchStats()
      }
    } catch { /* handled silently */ }
    finally { setTripSubmitting(false) }
  }

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ═══════ HEADER ═══════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Gestion de Transporte</h2>
              <p className="text-xs text-slate-500">Monitoreo de flota, choferes y rutas en tiempo real</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-emerald-600" onClick={refreshAll}>
                <RefreshCw className={cn('w-4 h-4', loadingStats && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualizar datos</TooltipContent>
          </Tooltip>
        </div>

        {/* ═══════ TABS ═══════ */}
        <Tabs defaultValue="operaciones" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 rounded-xl p-1 h-auto">
            <TabsTrigger value="operaciones" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Panel de Operaciones</span>
              <span className="sm:hidden">Operaciones</span>
            </TabsTrigger>
            <TabsTrigger value="vehiculos" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Vehiculos</span>
              <span className="sm:hidden">Flota</span>
            </TabsTrigger>
            <TabsTrigger value="choferes" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Choferes</span>
              <span className="sm:hidden">Choferes</span>
            </TabsTrigger>
            <TabsTrigger value="rutas" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Route className="w-4 h-4" />
              <span className="hidden sm:inline">Rutas</span>
              <span className="sm:hidden">Rutas</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: PANEL DE OPERACIONES ═══════ */}
          <TabsContent value="operaciones" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingStats ? (<><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>) : (<>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-blue-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.activeTrips}</p>
                        <p className="text-xs text-slate-500 truncate">Viajes Activos</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-emerald-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.availableVehicles}</p>
                        <p className="text-xs text-slate-500 truncate">Vehiculos Disponibles</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-amber-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.drivingAlerts}</p>
                        <p className="text-xs text-slate-500 truncate">Alertas de Conduccion</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-red-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.routeIncidents}</p>
                        <p className="text-xs text-slate-500 truncate">Incidentes en Ruta</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Active Trips Table */}
              <div className="xl:col-span-2">
                <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Route className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-base text-slate-900">Viajes Activos</CardTitle>
                        {!loadingTrips && (
                          <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">
                            {trips.length} viaje{trips.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            onClick={handleOpenTripDialog}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Nuevo Viaje
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Crear un nuevo viaje con validacion de riesgo</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {loadingTrips ? (
                      <TableSkeleton />
                    ) : trips.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Route className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm font-medium">Sin viajes activos</p>
                        <p className="text-xs mt-1">Los viajes activos se mostraran aqui</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto -mx-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-200 hover:bg-transparent">
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Viaje</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Origen</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Destino</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Chofer</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Vehiculo</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Estado</TableHead>
                              <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Hora Inicio</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trips.map((trip, idx) => {
                              const tsc = tripStatusConfig(trip.status)
                              return (
                                <motion.tr
                                  key={trip.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                                  className="border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                  <TableCell className="text-sm font-medium text-slate-800">{trip.tripNumber || trip.id.substring(0, 8)}</TableCell>
                                  <TableCell className="text-sm text-slate-600">{trip.origin}</TableCell>
                                  <TableCell className="text-sm text-slate-600 hidden md:table-cell">
                                    <div className="flex items-center gap-1">
                                      <ChevronRight className="w-3 h-3 text-slate-400" />
                                      {trip.destination}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-600 hidden lg:table-cell">{trip.driverName || '—'}</TableCell>
                                  <TableCell className="text-sm text-slate-600 hidden lg:table-cell font-mono text-xs">{trip.vehiclePlate || '—'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', tsc.className)}>
                                      <span className={cn('h-1.5 w-1.5 rounded-full mr-1', tsc.dot)} />
                                      {tsc.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-500 hidden sm:table-cell">{formatTimestamp(trip.startTime)}</TableCell>
                                </motion.tr>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Live Driver Alerts Feed */}
              <div>
                <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-amber-600" />
                      <CardTitle className="text-base text-slate-900">Alertas de Conduccion</CardTitle>
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {loadingAlerts ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full bg-slate-100 rounded-lg" />
                        ))}
                      </div>
                    ) : alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Shield className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs font-medium">Sin alertas recientes</p>
                        <p className="text-[11px] mt-1">Las alertas IA se mostraran aqui</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {alerts.map((alert, idx) => {
                          const arc = alertRiskConfig(alert.riskLevel)
                          return (
                            <motion.div
                              key={alert.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.05 }}
                              className={cn(
                                'rounded-lg border p-3 transition-colors',
                                alert.riskLevel === 'CRITICO' ? 'border-red-200 bg-red-50/50' :
                                alert.riskLevel === 'ALTO' ? 'border-orange-200 bg-orange-50/50' :
                                alert.riskLevel === 'MEDIO' ? 'border-amber-200 bg-amber-50/30' :
                                'border-slate-200 bg-slate-50/50'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', arc.dot)} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-800">{alert.eventType}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{alert.description}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[10px] text-slate-400">{alert.driverName || 'N/D'}</span>
                                      {alert.location && (
                                        <>
                                          <span className="text-[10px] text-slate-300">·</span>
                                          <span className="text-[10px] text-slate-400">{alert.location}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', arc.className)}>
                                    {arc.label}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400">{formatTimestamp(alert.timestamp)}</span>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══════ TAB 2: VEHICULOS ═══════ */}
          <TabsContent value="vehiculos" className="space-y-6">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por patente, marca o modelo..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-slate-800 h-9 text-sm"
                />
              </div>
              <Button
                onClick={() => setVehicleDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Registrar Vehiculo
              </Button>
            </div>

            {/* Vehicle Grid */}
            {loadingVehicles ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Truck className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    {vehicleSearch ? 'Sin resultados de busqueda' : 'Sin vehiculos registrados'}
                  </p>
                  <p className="text-xs mt-1">
                    {vehicleSearch ? 'Intenta con otros terminos' : 'Registra tu primer vehiculo para comenzar'}
                  </p>
                  {!vehicleSearch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVehicleDialogOpen(true)}
                      className="mt-4 gap-2 border-dashed border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Vehiculo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVehicles.map((vehicle, idx) => {
                  const vtc = vehicleTypeConfig(vehicle.type)
                  const vsc = vehicleStatusConfig(vehicle.status)
                  return (
                    <motion.div
                      key={vehicle.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                    >
                      <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-slate-300 transition-colors h-full">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                                <Truck className="w-5 h-5 text-slate-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900 font-mono">{vehicle.plate}</p>
                                <p className="text-xs text-slate-500">
                                  {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Sin datos'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', vtc.className)}>
                              {vtc.label}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', vsc.className)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full mr-1', vsc.dot)} />
                              {vsc.label}
                            </Badge>
                          </div>
                          {vehicle.currentDriverName && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{vehicle.currentDriverName}</span>
                            </div>
                          )}
                          {vehicle.mileage !== null && vehicle.mileage !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Gauge className="w-3.5 h-3.5" />
                              <span>{vehicle.mileage.toLocaleString('es-AR')} km</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ═══════ TAB 3: CHOFERES ═══════ */}
          <TabsContent value="choferes" className="space-y-6">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-slate-800 h-9 text-sm"
                />
              </div>
              <Button
                onClick={() => setDriverDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Registrar Chofer
              </Button>
            </div>

            {/* Driver List */}
            {loadingDrivers ? (
              <TableSkeleton />
            ) : filteredDrivers.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    {driverSearch ? 'Sin resultados de busqueda' : 'Sin choferes registrados'}
                  </p>
                  <p className="text-xs mt-1">
                    {driverSearch ? 'Intenta con otros terminos' : 'Registra tu primer chofer para comenzar'}
                  </p>
                  {!driverSearch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDriverDialogOpen(true)}
                      className="mt-4 gap-2 border-dashed border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Chofer
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 hover:bg-transparent">
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Nombre</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Licencia</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Vencimiento</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Estado</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Fatiga</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">Viajes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDrivers.map((driver, idx) => {
                          const dsc = driverStatusConfig(driver.status)
                          const ltc = licenseTypeConfig(driver.licenseType)
                          const days = daysUntilExpiry(driver.licenseExpiry)
                          const fc = fatigueColor(driver.fatigueScore)
                          const expiryWarning = days !== null && days < 30 && days > 0
                          const isExpired = days !== null && days <= 0

                          return (
                            <motion.tr
                              key={driver.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.03 }}
                              className="border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <span className="text-xs font-medium text-slate-600">
                                      {(driver.name || '??').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">{driver.name}</p>
                                    {driver.phone && (
                                      <p className="text-[10px] text-slate-400">{driver.phone}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', ltc.className)}>
                                  {ltc.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex flex-col">
                                  <span className={cn(
                                    'text-sm',
                                    isExpired ? 'text-red-600 font-medium' :
                                    expiryWarning ? 'text-amber-600 font-medium' : 'text-slate-600'
                                  )}>
                                    {formatTimestamp(driver.licenseExpiry)}
                                  </span>
                                  {expiryWarning && !isExpired && (
                                    <span className="text-[10px] text-amber-500">Vence en {days} dias</span>
                                  )}
                                  {isExpired && (
                                    <span className="text-[10px] text-red-500">Vencida</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', dsc.className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', dsc.dot)} />
                                  {dsc.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <div className="flex items-center gap-2">
                                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', fc.bg)}>
                                    <Gauge className={cn('w-4 h-4', fc.color)} />
                                  </div>
                                  <div>
                                    <span className={cn('text-xs font-medium', fc.color)}>
                                      {driver.fatigueScore !== null ? `${driver.fatigueScore}%` : 'N/D'}
                                    </span>
                                    <p className="text-[10px] text-slate-400">{fc.label}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden xl:table-cell text-sm text-slate-600">
                                {driver.totalTrips ?? '—'}
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════ TAB 4: RUTAS ═══════ */}
          <TabsContent value="rutas" className="space-y-6">
            {/* Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre, origen o destino..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-slate-800 h-9 text-sm"
                />
              </div>
              <Button
                onClick={() => setRouteDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Crear Ruta
              </Button>
            </div>

            {/* Route Cards */}
            {loadingRoutes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : filteredRoutes.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Route className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    {routeSearch ? 'Sin resultados de busqueda' : 'Sin rutas configuradas'}
                  </p>
                  <p className="text-xs mt-1">
                    {routeSearch ? 'Intenta con otros terminos' : 'Las rutas configuradas se mostraran aqui'}
                  </p>
                  {!routeSearch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRouteDialogOpen(true)}
                      className="mt-4 gap-2 border-dashed border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Crear Ruta
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoutes.map((route, idx) => {
                  const rrc = routeRiskConfig(route.riskLevel)
                  return (
                    <motion.div
                      key={route.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                    >
                      <Card className={cn(
                        'shadow-sm rounded-xl border h-full transition-colors',
                        route.riskLevel === 'CRITICO' ? 'border-red-200 hover:border-red-300' :
                        route.riskLevel === 'ALTO' ? 'border-orange-200 hover:border-orange-300' :
                        'border-slate-200 hover:border-slate-300'
                      )}>
                        <CardContent className="p-4 space-y-3 bg-white rounded-xl">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'h-9 w-9 rounded-lg flex items-center justify-center',
                                route.riskLevel === 'CRITICO' ? 'bg-red-50' :
                                route.riskLevel === 'ALTO' ? 'bg-orange-50' :
                                route.riskLevel === 'MEDIO' ? 'bg-amber-50' : 'bg-emerald-50'
                              )}>
                                <Route className={cn(
                                  'w-4 h-4',
                                  route.riskLevel === 'CRITICO' ? 'text-red-600' :
                                  route.riskLevel === 'ALTO' ? 'text-orange-600' :
                                  route.riskLevel === 'MEDIO' ? 'text-amber-600' : 'text-emerald-600'
                                )} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{route.name}</p>
                              </div>
                            </div>
                          </div>

                          {/* Origin → Destination */}
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex flex-col items-center gap-0.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              <div className="w-px h-5 bg-slate-200" />
                              <MapPin className="w-3.5 h-3.5 text-red-500" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-slate-700">{route.origin}</span>
                              <span className="text-xs text-slate-700">{route.destination}</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {route.distanceKm !== null && (
                              <div className="flex items-center gap-1">
                                <Navigation className="w-3.5 h-3.5 text-slate-400" />
                                <span>{route.distanceKm} km</span>
                              </div>
                            )}
                            {route.durationMinutes !== null && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{route.durationMinutes} min</span>
                              </div>
                            )}
                            {route.activeTrips !== null && route.activeTrips > 0 && (
                              <div className="flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-blue-400" />
                                <span>{route.activeTrips} activo{route.activeTrips !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>

                          {/* Risk badge */}
                          <div className="flex items-center justify-between pt-1">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', rrc.className)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full mr-1', rrc.dot)} />
                              Riesgo: {rrc.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ═══════ REGISTER VEHICLE DIALOG ═══════ */}
        <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Registrar Vehiculo</DialogTitle>
              <DialogDescription className="text-slate-500">
                Completa los datos del nuevo vehiculo de la flota
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Patente *</Label>
                <Input
                  placeholder="Ej: AA 123 BB"
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, plate: e.target.value.toUpperCase() }))}
                  className="bg-white border-slate-200 text-slate-800 font-mono uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Tipo de Vehiculo</Label>
                <Select value={vehicleForm.type} onValueChange={(v) => setVehicleForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="TRACTOR">Tractor</SelectItem>
                    <SelectItem value="CAMION">Camion</SelectItem>
                    <SelectItem value="CAMIONETA">Camioneta</SelectItem>
                    <SelectItem value="TANQUE">Tanque</SelectItem>
                    <SelectItem value="PLATAFORMA">Plataforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Marca *</Label>
                  <Input
                    placeholder="Ej: Volvo"
                    value={vehicleForm.brand}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, brand: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Modelo</Label>
                  <Input
                    placeholder="Ej: FH16"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Anio</Label>
                <Input
                  placeholder="Ej: 2024"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, year: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                  className="bg-white border-slate-200 text-slate-800"
                  type="text"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setVehicleDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegisterVehicle}
                  disabled={vehicleSubmitting || !vehicleForm.plate.trim() || !vehicleForm.brand.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {vehicleSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ REGISTER DRIVER DIALOG ═══════ */}
        <Dialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Registrar Chofer</DialogTitle>
              <DialogDescription className="text-slate-500">
                Completa los datos del nuevo chofer
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Nombre Completo *</Label>
                <Input
                  placeholder="Ej: Juan Perez"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm((p) => ({ ...p, name: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Tipo de Licencia</Label>
                  <Select value={driverForm.licenseType} onValueChange={(v) => setDriverForm((p) => ({ ...p, licenseType: v }))}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="A">Categoria A</SelectItem>
                      <SelectItem value="B">Categoria B</SelectItem>
                      <SelectItem value="C">Categoria C</SelectItem>
                      <SelectItem value="D">Categoria D</SelectItem>
                      <SelectItem value="E">Categoria E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Vencimiento *</Label>
                  <Input
                    type="date"
                    value={driverForm.licenseExpiry}
                    onChange={(e) => setDriverForm((p) => ({ ...p, licenseExpiry: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Telefono</Label>
                <Input
                  placeholder="Ej: +54 11 1234-5678"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm((p) => ({ ...p, phone: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDriverDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegisterDriver}
                  disabled={driverSubmitting || !driverForm.name.trim() || !driverForm.licenseExpiry}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {driverSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ REGISTER ROUTE DIALOG ═══════ */}
        <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Crear Ruta</DialogTitle>
              <DialogDescription className="text-slate-500">
                Configura los datos de la nueva ruta de transporte
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Nombre de la Ruta *</Label>
                <Input
                  placeholder="Ej: Planta Central - Deposito Norte"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm((p) => ({ ...p, name: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Origen *</Label>
                  <Input
                    placeholder="Ej: Planta Central"
                    value={routeForm.origin}
                    onChange={(e) => setRouteForm((p) => ({ ...p, origin: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Destino *</Label>
                  <Input
                    placeholder="Ej: Deposito Norte"
                    value={routeForm.destination}
                    onChange={(e) => setRouteForm((p) => ({ ...p, destination: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Distancia (km)</Label>
                  <Input
                    placeholder="Ej: 150"
                    type="number"
                    value={routeForm.distanceKm}
                    onChange={(e) => setRouteForm((p) => ({ ...p, distanceKm: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Duracion Estimada (min)</Label>
                  <Input
                    placeholder="Ej: 180"
                    type="number"
                    value={routeForm.estimatedDurationMin}
                    onChange={(e) => setRouteForm((p) => ({ ...p, estimatedDurationMin: e.target.value }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Nivel de Riesgo</Label>
                <Select value={routeForm.riskLevel} onValueChange={(v) => setRouteForm((p) => ({ ...p, riskLevel: v }))}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="BAJO">Bajo</SelectItem>
                    <SelectItem value="MEDIO">Medio</SelectItem>
                    <SelectItem value="ALTO">Alto</SelectItem>
                    <SelectItem value="CRITICO">Critico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRouteDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegisterRoute}
                  disabled={routeSubmitting || !routeForm.name.trim() || !routeForm.origin.trim() || !routeForm.destination.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {routeSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear Ruta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ TRIP CREATION DIALOG ═══════ */}
        <Dialog open={tripDialogOpen} onOpenChange={handleCloseTripDialog}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Nuevo Viaje</DialogTitle>
              <DialogDescription className="text-slate-500">
                Crea un viaje con validacion de seguridad pre-salida
              </DialogDescription>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center gap-2 pt-1 pb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                    s === tripStep ? 'bg-emerald-600 text-white' :
                    s < tripStep ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-400'
                  )}>
                    {s}
                  </div>
                  {s < 5 && (
                    <div className={cn(
                      'h-0.5 w-6 rounded transition-colors',
                      s < tripStep ? 'bg-emerald-300' : 'bg-slate-200'
                    )} />
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              {/* Step 1: Select Vehicle */}
              {tripStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-slate-800">Paso 1: Seleccionar Vehiculo</Label>
                  </div>
                  <Select value={tripForm.vehicleId} onValueChange={(v) => setTripForm((p) => ({ ...p, vehicleId: v }))}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                      <SelectValue placeholder="Seleccionar vehiculo disponible..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 max-h-60">
                      {vehicles
                        .filter((v) => v.status === 'DISPONIBLE')
                        .map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            <span className="font-mono">{v.plate}</span> — {v.brand} {v.model} <span className="text-slate-400">({v.type})</span>
                          </SelectItem>
                        ))}
                      {vehicles.filter((v) => v.status === 'DISPONIBLE').length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No hay vehiculos disponibles</div>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setTripStep(2)}
                      disabled={!tripForm.vehicleId}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Select Driver */}
              {tripStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-slate-800">Paso 2: Seleccionar Chofer</Label>
                  </div>
                  <Select value={tripForm.driverId} onValueChange={(v) => setTripForm((p) => ({ ...p, driverId: v }))}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                      <SelectValue placeholder="Seleccionar chofer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 max-h-60">
                      {drivers
                        .filter((d) => d.status === 'ACTIVO')
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} <span className="text-slate-400">(Lic. {d.licenseType})</span>
                          </SelectItem>
                        ))}
                      {drivers.filter((d) => d.status === 'ACTIVO').length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No hay choferes activos</div>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setTripStep(1)} className="border-slate-200 text-slate-700 text-sm">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Atras
                    </Button>
                    <Button
                      onClick={() => setTripStep(3)}
                      disabled={!tripForm.driverId}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Select Route */}
              {tripStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-slate-800">Paso 3: Seleccionar Ruta</Label>
                  </div>
                  <Select value={tripForm.routeId} onValueChange={(v) => setTripForm((p) => ({ ...p, routeId: v }))}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                      <SelectValue placeholder="Seleccionar ruta..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 max-h-60">
                      {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} — {r.origin} → {r.destination}
                            {r.distanceKm && <span className="text-slate-400"> ({r.distanceKm}km)</span>}
                          </SelectItem>
                      ))}
                      {routes.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No hay rutas configuradas</div>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Notas (opcional)</Label>
                    <Textarea
                      placeholder="Observaciones adicionales del viaje..."
                      value={tripForm.notes}
                      onChange={(e) => setTripForm((p) => ({ ...p, notes: e.target.value }))}
                      className="bg-white border-slate-200 text-slate-800 text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setTripStep(2)} className="border-slate-200 text-slate-700 text-sm">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Atras
                    </Button>
                    <Button
                      onClick={() => setTripStep(4)}
                      disabled={!tripForm.routeId}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Pre-departure checklist */}
              {tripStep === 4 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-slate-800">Paso 4: Checklist Pre-Salida</Label>
                  </div>
                  <p className="text-xs text-slate-500">Verifica todos los items antes de crear el viaje</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {preDepartureItems.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          checked={tripChecklist[item.key]}
                          onCheckedChange={(checked) =>
                            setTripChecklist((prev) => ({ ...prev, [item.key]: checked === true }))
                          }
                          className="border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <span className={cn(
                          'text-sm',
                          tripChecklist[item.key] ? 'text-slate-800' : 'text-slate-600'
                        )}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setTripStep(3)} className="border-slate-200 text-slate-700 text-sm">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Atras
                    </Button>
                    <Button
                      onClick={handleSubmitTrip}
                      disabled={tripSubmitting}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      {tripSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {tripSubmitting ? 'Validando...' : 'Validar y Crear Viaje'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 5: Validation Results */}
              {tripStep === 5 && tripValidation && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-slate-800">Resultado de Validacion</Label>
                  </div>

                  {/* Overall status */}
                  {tripValidation.authorized ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Viaje autorizado</p>
                        <p className="text-xs text-emerald-600">El viaje ha sido creado como PLANIFICADO</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Viaje bloqueado</p>
                        <p className="text-xs text-red-600">{tripValidation.blockingReason || 'Validacion de riesgo fallida'}</p>
                      </div>
                    </div>
                  )}

                  {/* Individual checks */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {tripValidation.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5',
                          check.passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
                        )}
                      >
                        {check.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className={cn(
                          'text-xs',
                          check.passed ? 'text-emerald-700' : 'text-red-700'
                        )}>
                          {check.message}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setTripDialogOpen(false)
                        setTripStep(1)
                        setTripValidation(null)
                        fetchTrips()
                        fetchStats()
                      }}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Cerrar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
