'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Leaf, AlertTriangle, Shield, ClipboardCheck, TrendingUp,
  TrendingDown, Plus, Search, RefreshCw, Loader2, Eye,
  ChevronDown, ChevronUp, FileText, Thermometer, Droplets,
  Wind, BarChart3, FlaskConical, Activity, Clock, User,
  CalendarDays, Camera, Bug, Radio, Volume2, X, Gauge
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'

// ==================== TYPES ====================

interface EnvIncident {
  id: string
  incidentNumber: string
  type: string
  severity: string
  description: string
  status: string
  reportedBy: string | { id?: string; name?: string; email?: string } | null
  location: string | null
  containmentMeasures: string | null
  remediationPlan: string | null
  photos: string[] | null
  createdAt: string
  updatedAt: string | null
}

interface Assessment {
  id: string
  title: string
  type: string
  status: string
  scope: string | null
  findingsCount: number | null
  dueDate: string | null
  createdBy: string | null
  createdAt: string
}

interface Metric {
  id: string
  name: string
  unit: string
  currentValue: number | null
  warningThreshold: number | null
  criticalThreshold: number | null
  trend: 'up' | 'down' | 'stable' | null
  lastReading: string | null
  description: string | null
}

interface EnvStats {
  activeIncidents: number
  criticalIncidents: number
  underInvestigation: number
  remediated: number
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

// ── Incident type badges ──
function incidentTypeConfig(type: string) {
  switch (type) {
    case 'DERRAME':
      return { label: 'Derrame', className: 'bg-red-50 text-red-700 border-red-200', icon: Droplets }
    case 'EMISION':
      return { label: 'Emision', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Wind }
    case 'RESIDUO_PELIGROSO':
      return { label: 'Residuo Peligroso', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: Bug }
    case 'CONTAMINACION':
      return { label: 'Contaminacion', className: 'bg-orange-50 text-orange-700 border-orange-200', icon: FlaskConical }
    case 'RUIDO':
      return { label: 'Ruido', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: Volume2 }
    default:
      return { label: type, className: 'bg-slate-50 text-slate-600 border-slate-200', icon: FileText }
  }
}

// ── Severity badges ──
function severityConfig(level: string) {
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

// ── Incident status badges ──
function incidentStatusConfig(status: string) {
  switch (status) {
    case 'REPORTADO':
      return { label: 'Reportado', className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
    case 'EN_INVESTIGACION':
      return { label: 'En Investigacion', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    case 'CONTENIDO':
      return { label: 'Contenido', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'REMEDIADO':
      return { label: 'Remediado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'CERRADO':
      return { label: 'Cerrado', className: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Assessment status badges ──
function assessmentStatusConfig(status: string) {
  switch (status) {
    case 'BORRADOR':
      return { label: 'Borrador', className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
    case 'EN_REVISION':
      return { label: 'En Revision', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'APROBADO':
      return { label: 'Aprobado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    case 'VENCIDO':
      return { label: 'Vencido', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── Assessment type badges ──
function assessmentTypeConfig(type: string) {
  switch (type) {
    case 'EIA':
      return { label: 'EIA', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'AUDITORIA':
      return { label: 'Auditoria', className: 'bg-purple-50 text-purple-700 border-purple-200' }
    case 'MONITOREO':
      return { label: 'Monitoreo', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
    case 'IMPACTO':
      return { label: 'Impacto Ambiental', className: 'bg-orange-50 text-orange-700 border-orange-200' }
    default:
      return { label: type, className: 'bg-slate-50 text-slate-600 border-slate-200' }
  }
}

// ── Metric threshold color ──
function metricStatus(
  value: number | null,
  warningThreshold: number | null,
  criticalThreshold: number | null
): { color: string; bg: string; label: string; progress: number } {
  if (value === null) return { color: 'text-slate-400', bg: 'bg-slate-100', label: 'Sin datos', progress: 0 }

  const maxRef = criticalThreshold || warningThreshold || 100
  const progress = Math.min(100, Math.max(0, (value / maxRef) * 100))

  if (criticalThreshold !== null && value >= criticalThreshold) {
    return { color: 'text-red-600', bg: 'bg-red-50', label: 'Critico', progress }
  }
  if (warningThreshold !== null && value >= warningThreshold) {
    return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Advertencia', progress }
  }
  return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Normal', progress }
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

export default function EnvironmentDashboard() {
  // ── State ──
  const [stats, setStats] = useState<EnvStats>({
    activeIncidents: 0, criticalIncidents: 0, underInvestigation: 0, remediated: 0,
  })
  const [incidents, setIncidents] = useState<EnvIncident[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])

  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingIncidents, setLoadingIncidents] = useState(true)
  const [loadingAssessments, setLoadingAssessments] = useState(true)
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  const [incidentSearch, setIncidentSearch] = useState('')
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // ── Report Incident Dialog ──
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    type: 'DERRAME', severity: 'MEDIO', description: '', location: '',
    containmentMeasures: '', remediationPlan: '',
  })
  const [incidentSubmitting, setIncidentSubmitting] = useState(false)

  // ── New Assessment Dialog ──
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState({
    title: '', type: 'AUDITORIA', scope: '', dueDate: '',
  })
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false)

  // ── Register Reading Dialog ──
  const [readingDialogOpen, setReadingDialogOpen] = useState(false)
  const [readingForm, setReadingForm] = useState({
    metricId: '', value: '',
  })
  const [readingSubmitting, setReadingSubmitting] = useState(false)

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await apiFetch<EnvStats>('/environment/stats')
      if (data && typeof data === 'object') {
        setStats({
          activeIncidents: typeof data.activeIncidents === 'number' ? data.activeIncidents : 0,
          criticalIncidents: typeof data.criticalIncidents === 'number' ? data.criticalIncidents : 0,
          underInvestigation: typeof data.underInvestigation === 'number' ? data.underInvestigation : 0,
          remediated: typeof data.remediated === 'number' ? data.remediated : 0,
        })
      }
    } catch { setStats({ activeIncidents: 0, criticalIncidents: 0, underInvestigation: 0, remediated: 0 }) }
    finally { setLoadingStats(false) }
  }, [])

  const fetchIncidents = useCallback(async () => {
    setLoadingIncidents(true)
    try {
      const data = await apiFetch<{ incidents?: EnvIncident[] } | EnvIncident[]>('/environment/incidents')
      const arr = Array.isArray(data) ? data : safeArray((data as { incidents?: EnvIncident[] }).incidents)
      setIncidents(arr)
    } catch { setIncidents([]) }
    finally { setLoadingIncidents(false) }
  }, [])

  const fetchAssessments = useCallback(async () => {
    setLoadingAssessments(true)
    try {
      const data = await apiFetch<{ assessments?: Assessment[] } | Assessment[]>('/environment/assessments')
      const arr = Array.isArray(data) ? data : safeArray((data as { assessments?: Assessment[] }).assessments)
      setAssessments(arr)
    } catch { setAssessments([]) }
    finally { setLoadingAssessments(false) }
  }, [])

  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true)
    try {
      const data = await apiFetch<{ metrics?: Metric[] } | Metric[]>('/environment/metrics')
      const arr = Array.isArray(data) ? data : safeArray((data as { metrics?: Metric[] }).metrics)
      setMetrics(arr)
    } catch { setMetrics([]) }
    finally { setLoadingMetrics(false) }
  }, [])

  const refreshAll = useCallback(() => {
    fetchStats()
    fetchIncidents()
    fetchAssessments()
    fetchMetrics()
  }, [fetchStats, fetchIncidents, fetchAssessments, fetchMetrics])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // ── Derived Data ──

  const filteredIncidents = incidents.filter((inc) => {
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false
    if (typeFilter !== 'all' && inc.type !== typeFilter) return false
    if (!incidentSearch.trim()) return true
    const q = incidentSearch.toLowerCase()
    const reportedByName = typeof inc.reportedBy === 'object' && inc.reportedBy !== null
      ? (inc.reportedBy as { name?: string }).name || ''
      : inc.reportedBy || ''
    return inc.description.toLowerCase().includes(q) ||
      inc.incidentNumber.toLowerCase().includes(q) ||
      inc.location?.toLowerCase().includes(q) ||
      reportedByName.toLowerCase().includes(q)
  })

  // ── Actions ──

  const handleReportIncident = async () => {
    if (!incidentForm.description.trim()) return
    setIncidentSubmitting(true)
    try {
      await apiFetch('/environment/incidents', {
        method: 'POST',
        body: JSON.stringify({
          type: incidentForm.type,
          severity: incidentForm.severity,
          description: incidentForm.description.trim(),
          location: incidentForm.location.trim() || null,
          containmentMeasures: incidentForm.containmentMeasures.trim() || null,
          remediationPlan: incidentForm.remediationPlan.trim() || null,
        }),
      })
      setIncidentDialogOpen(false)
      setIncidentForm({
        type: 'DERRAME', severity: 'MEDIO', description: '', location: '',
        containmentMeasures: '', remediationPlan: '',
      })
      await fetchIncidents()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setIncidentSubmitting(false) }
  }

  const handleCreateAssessment = async () => {
    if (!assessmentForm.title.trim()) return
    setAssessmentSubmitting(true)
    try {
      await apiFetch('/environment/assessments', {
        method: 'POST',
        body: JSON.stringify({
          title: assessmentForm.title.trim(),
          type: assessmentForm.type,
          scope: assessmentForm.scope.trim() || null,
          dueDate: assessmentForm.dueDate || null,
        }),
      })
      setAssessmentDialogOpen(false)
      setAssessmentForm({ title: '', type: 'AUDITORIA', scope: '', dueDate: '' })
      await fetchAssessments()
    } catch { /* handled silently */ }
    finally { setAssessmentSubmitting(false) }
  }

  const handleRegisterReading = async () => {
    if (!readingForm.metricId || !readingForm.value.trim()) return
    setReadingSubmitting(true)
    try {
      await apiFetch(`/environment/metrics/${readingForm.metricId}/readings`, {
        method: 'POST',
        body: JSON.stringify({ value: parseFloat(readingForm.value) }),
      })
      setReadingDialogOpen(false)
      setReadingForm({ metricId: '', value: '' })
      await fetchMetrics()
      await fetchStats()
    } catch { /* handled silently */ }
    finally { setReadingSubmitting(false) }
  }

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ═══════ HEADER ═══════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Gestion Ambiental</h2>
              <p className="text-xs text-slate-500">Incidentes, evaluaciones y monitoreo ambiental</p>
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
        <Tabs defaultValue="incidentes" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 rounded-xl p-1 h-auto">
            <TabsTrigger value="incidentes" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Incidentes Ambientales</span>
              <span className="sm:hidden">Incidentes</span>
            </TabsTrigger>
            <TabsTrigger value="evaluaciones" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Evaluaciones</span>
              <span className="sm:hidden">Evaluac.</span>
            </TabsTrigger>
            <TabsTrigger value="metricas" className="rounded-lg gap-1.5 text-sm px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Metricas</span>
              <span className="sm:hidden">Metricas</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: INCIDENTES AMBIENTALES ═══════ */}
          <TabsContent value="incidentes" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingStats ? (<><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>) : (<>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-blue-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.activeIncidents}</p>
                        <p className="text-xs text-slate-500 truncate">Incidentes Activos</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-red-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.criticalIncidents}</p>
                        <p className="text-xs text-slate-500 truncate">Criticos</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-amber-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.underInvestigation}</p>
                        <p className="text-xs text-slate-500 truncate">En Investigacion</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
                  <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-emerald-200 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Leaf className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.remediated}</p>
                        <p className="text-xs text-slate-500 truncate">Remediados</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>)}
            </div>

            {/* Filters + Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar incidentes..."
                    value={incidentSearch}
                    onChange={(e) => setIncidentSearch(e.target.value)}
                    className="pl-9 bg-white border-slate-200 text-slate-800 h-9 text-sm"
                  />
                </div>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-36 bg-white border-slate-200 text-slate-800 h-9 text-sm">
                    <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="BAJO">Bajo</SelectItem>
                    <SelectItem value="MEDIO">Medio</SelectItem>
                    <SelectItem value="ALTO">Alto</SelectItem>
                    <SelectItem value="CRITICO">Critico</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40 bg-white border-slate-200 text-slate-800 h-9 text-sm">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="DERRAME">Derrame</SelectItem>
                    <SelectItem value="EMISION">Emision</SelectItem>
                    <SelectItem value="RESIDUO_PELIGROSO">Residuo Peligroso</SelectItem>
                    <SelectItem value="CONTAMINACION">Contaminacion</SelectItem>
                    <SelectItem value="RUIDO">Ruido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setIncidentDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                Reportar Incidente
              </Button>
            </div>

            {/* Incident Table */}
            {loadingIncidents ? (
              <TableSkeleton />
            ) : filteredIncidents.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Leaf className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    {incidentSearch || severityFilter !== 'all' || typeFilter !== 'all'
                      ? 'Sin resultados de busqueda'
                      : 'Sin incidentes ambientales'}
                  </p>
                  <p className="text-xs mt-1">
                    {incidentSearch || severityFilter !== 'all' || typeFilter !== 'all'
                      ? 'Ajusta los filtros de busqueda'
                      : 'Los incidentes reportados se mostraran aqui'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 hover:bg-transparent">
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-8"></TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">ID</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tipo</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Severidad</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Descripcion</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Estado</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">Reportado por</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIncidents.map((incident, idx) => {
                          const itc = incidentTypeConfig(incident.type)
                          const sc = severityConfig(incident.severity)
                          const isc = incidentStatusConfig(incident.status)
                          const isExpanded = expandedIncidentId === incident.id

                          return (
                            <motion.tr
                              key={incident.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.03 }}
                              className="border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                  onClick={() => setExpandedIncidentId(isExpanded ? null : incident.id)}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="text-sm font-mono font-medium text-slate-700">
                                {incident.incidentNumber || incident.id.substring(0, 8)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1', itc.className)}>
                                  <itc.icon className="w-3 h-3" />
                                  {itc.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sc.className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', sc.dot)} />
                                  {sc.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-slate-700 line-clamp-2 max-w-[200px]">{incident.description}</p>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', isc.className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', isc.dot)} />
                                  {isc.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden xl:table-cell text-sm text-slate-600">
                                {typeof incident.reportedBy === 'object' && incident.reportedBy !== null
                                  ? (incident.reportedBy as { name?: string }).name || '—'
                                  : incident.reportedBy || '—'}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-slate-500">
                                {formatTimestamp(incident.createdAt)}
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Expanded Incident Details */}
                  <AnimatePresence>
                    {expandedIncidentId && (() => {
                      const incident = incidents.find((i) => i.id === expandedIncidentId)
                      if (!incident) return null
                      return (
                        <motion.div
                          key={`expanded-${incident.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-200 p-4 bg-slate-50/50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-slate-900">Detalles del Incidente</h4>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', incidentStatusConfig(incident.status).className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', incidentStatusConfig(incident.status).dot)} />
                                  {incidentStatusConfig(incident.status).label}
                                </Badge>
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', severityConfig(incident.severity).className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', severityConfig(incident.severity).dot)} />
                                  {severityConfig(incident.severity).label}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Descripcion Completa</p>
                                <p className="text-sm text-slate-700">{incident.description}</p>
                              </div>
                              <div className="space-y-3">
                                {incident.location && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Ubicacion</p>
                                    <p className="text-sm text-slate-700">{incident.location}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Reportado por</p>
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-sm text-slate-700">
                                      {typeof incident.reportedBy === 'object' && incident.reportedBy !== null
                                        ? (incident.reportedBy as { name?: string }).name || 'N/D'
                                        : incident.reportedBy || 'N/D'}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fecha</p>
                                  <div className="flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-sm text-slate-700">{formatTimestamp(incident.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Separator className="bg-slate-200" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Medidas de Contencion</p>
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                  {incident.containmentMeasures ? (
                                    <p className="text-sm text-slate-700">{incident.containmentMeasures}</p>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">Sin medidas de contencion registradas</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Plan de Remediacion</p>
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                  {incident.remediationPlan ? (
                                    <p className="text-sm text-slate-700">{incident.remediationPlan}</p>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">Sin plan de remediacion registrado</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {incident.photos && incident.photos.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Fotos</p>
                                <div className="flex gap-2 flex-wrap">
                                  {incident.photos.map((photo, pidx) => (
                                    <div key={pidx} className="h-20 w-20 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                                      <img src={photo} alt={`Foto ${pidx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })()}
                  </AnimatePresence>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════ TAB 2: EVALUACIONES ═══════ */}
          <TabsContent value="evaluaciones" className="space-y-6">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-slate-600">
                  {assessments.length} evaluacion{assessments.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <Button
                onClick={() => setAssessmentDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Nueva Evaluacion
              </Button>
            </div>

            {/* Assessment Cards */}
            {loadingAssessments ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : assessments.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ClipboardCheck className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Sin evaluaciones registradas</p>
                  <p className="text-xs mt-1">Crea tu primera evaluacion ambiental</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssessmentDialogOpen(true)}
                    className="mt-4 gap-2 border-dashed border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Evaluacion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assessments.map((assessment, idx) => {
                  const asc = assessmentStatusConfig(assessment.status)
                  const atc = assessmentTypeConfig(assessment.type)
                  return (
                    <motion.div
                      key={assessment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                    >
                      <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-slate-300 transition-colors h-full">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                                <ClipboardCheck className="w-4 h-4 text-purple-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{assessment.title}</p>
                                <p className="text-[11px] text-slate-400">{formatTimestamp(assessment.createdAt)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', atc.className)}>
                              {atc.label}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', asc.className)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full mr-1', asc.dot)} />
                              {asc.label}
                            </Badge>
                          </div>

                          {assessment.scope && (
                            <p className="text-xs text-slate-500 line-clamp-2">{assessment.scope}</p>
                          )}

                          <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                            <div className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{assessment.findingsCount ?? 0} hallazgo{((assessment.findingsCount ?? 0) !== 1) ? 's' : ''}</span>
                            </div>
                            {assessment.dueDate && (
                              <div className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span>{formatTimestamp(assessment.dueDate)}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ═══════ TAB 3: METRICAS ═══════ */}
          <TabsContent value="metricas" className="space-y-6">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-600" />
                <span className="text-sm text-slate-600">
                  {metrics.length} metrica{metrics.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Button
                onClick={() => setReadingDialogOpen(true)}
                disabled={metrics.length === 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Registrar Lectura
              </Button>
            </div>

            {/* Metric Cards */}
            {loadingMetrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : metrics.length === 0 ? (
              <Card className="bg-white shadow-sm rounded-xl border-slate-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Gauge className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Sin metricas configuradas</p>
                  <p className="text-xs mt-1">Las metricas ambientales se mostraran aqui</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map((metric, idx) => {
                  const ms = metricStatus(metric.currentValue, metric.warningThreshold, metric.criticalThreshold)
                  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Activity
                  const trendColor = metric.trend === 'up' ? 'text-red-500' : metric.trend === 'down' ? 'text-emerald-500' : 'text-slate-400'

                  return (
                    <motion.div
                      key={metric.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                    >
                      <Card className={cn(
                        'shadow-sm rounded-xl border h-full transition-colors',
                        ms.label === 'Critico' ? 'border-red-200' :
                        ms.label === 'Advertencia' ? 'border-amber-200' :
                        'border-slate-200 hover:border-slate-300'
                      )}>
                        <CardContent className="p-4 space-y-3 bg-white rounded-xl">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', ms.bg)}>
                                <Gauge className={cn('w-4 h-4', ms.color)} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{metric.name}</p>
                                {metric.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1">{metric.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', ms.bg.replace('50', '100').replace('bg-', 'text-').replace('100', '600'))}>
                                {ms.label}
                              </Badge>
                              <TrendIcon className={cn('w-4 h-4', trendColor)} />
                            </div>
                          </div>

                          {/* Value Display */}
                          <div className="flex items-baseline gap-1.5">
                            <span className={cn('text-3xl font-bold tabular-nums', ms.color)}>
                              {metric.currentValue !== null ? metric.currentValue.toFixed(1) : '—'}
                            </span>
                            <span className="text-sm text-slate-500">{metric.unit}</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5">
                            <Progress
                              value={ms.progress}
                              className={cn(
                                'h-2 rounded-full',
                                ms.label === 'Critico' ? '[&>div]:bg-red-500' :
                                ms.label === 'Advertencia' ? '[&>div]:bg-amber-500' :
                                '[&>div]:bg-emerald-500'
                              )}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>0</span>
                              {metric.warningThreshold !== null && (
                                <span className="text-amber-500">{metric.warningThreshold}</span>
                              )}
                              {metric.criticalThreshold !== null && (
                                <span className="text-red-500">{metric.criticalThreshold}</span>
                              )}
                            </div>
                          </div>

                          {/* Last reading */}
                          {metric.lastReading && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>Ultima lectura: {formatTimestamp(metric.lastReading)}</span>
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
        </Tabs>

        {/* ═══════ REPORT INCIDENT DIALOG ═══════ */}
        <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Reportar Incidente Ambiental</DialogTitle>
              <DialogDescription className="text-slate-500">
                Registra los detalles del incidente ambiental detectado
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Tipo de Incidente</Label>
                  <Select value={incidentForm.type} onValueChange={(v) => setIncidentForm((p) => ({ ...p, type: v }))}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="DERRAME">Derrame</SelectItem>
                      <SelectItem value="EMISION">Emision</SelectItem>
                      <SelectItem value="RESIDUO_PELIGROSO">Residuo Peligroso</SelectItem>
                      <SelectItem value="CONTAMINACION">Contaminacion</SelectItem>
                      <SelectItem value="RUIDO">Ruido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-700">Severidad</Label>
                  <Select value={incidentForm.severity} onValueChange={(v) => setIncidentForm((p) => ({ ...p, severity: v }))}>
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Ubicacion</Label>
                <Input
                  placeholder="Ej: Planta Norte, Area de Tanques"
                  value={incidentForm.location}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, location: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Descripcion *</Label>
                <Textarea
                  placeholder="Describe el incidente ambientar en detalle..."
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, description: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800 min-h-[100px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Medidas de Contencion</Label>
                <Textarea
                  placeholder="Describe las medidas de contencion adoptadas..."
                  value={incidentForm.containmentMeasures}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, containmentMeasures: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800 min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Plan de Remediacion</Label>
                <Textarea
                  placeholder="Describe el plan de remediacion propuesto..."
                  value={incidentForm.remediationPlan}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, remediationPlan: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800 min-h-[80px] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIncidentDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleReportIncident}
                  disabled={incidentSubmitting || !incidentForm.description.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {incidentSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reportar Incidente
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ NEW ASSESSMENT DIALOG ═══════ */}
        <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Nueva Evaluacion</DialogTitle>
              <DialogDescription className="text-slate-500">
                Crea una nueva evaluacion ambiental
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Titulo *</Label>
                <Input
                  placeholder="Ej: Evaluacion de Impacto Ambiental - Planta Norte"
                  value={assessmentForm.title}
                  onChange={(e) => setAssessmentForm((p) => ({ ...p, title: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Tipo de Evaluacion</Label>
                <Select value={assessmentForm.type} onValueChange={(v) => setAssessmentForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="EIA">Estudio de Impacto Ambiental</SelectItem>
                    <SelectItem value="AUDITORIA">Auditoria Ambiental</SelectItem>
                    <SelectItem value="MONITOREO">Monitoreo Ambiental</SelectItem>
                    <SelectItem value="IMPACTO">Evaluacion de Impacto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Alcance</Label>
                <Textarea
                  placeholder="Describe el alcance de la evaluacion..."
                  value={assessmentForm.scope}
                  onChange={(e) => setAssessmentForm((p) => ({ ...p, scope: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800 min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Fecha Limite</Label>
                <Input
                  type="date"
                  value={assessmentForm.dueDate}
                  onChange={(e) => setAssessmentForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAssessmentDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateAssessment}
                  disabled={assessmentSubmitting || !assessmentForm.title.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {assessmentSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear Evaluacion
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ REGISTER READING DIALOG ═══════ */}
        <Dialog open={readingDialogOpen} onOpenChange={setReadingDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Registrar Lectura</DialogTitle>
              <DialogDescription className="text-slate-500">
                Ingresa una nueva lectura para una metrica ambiental
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Metrica</Label>
                <Select value={readingForm.metricId} onValueChange={(v) => setReadingForm((p) => ({ ...p, metricId: v }))}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                    <SelectValue placeholder="Seleccionar metrica" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {metrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-700">Valor</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ej: 45.5"
                  value={readingForm.value}
                  onChange={(e) => setReadingForm((p) => ({ ...p, value: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReadingDialogOpen(false)} className="border-slate-200 text-slate-700">
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegisterReading}
                  disabled={readingSubmitting || !readingForm.metricId || !readingForm.value.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {readingSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
