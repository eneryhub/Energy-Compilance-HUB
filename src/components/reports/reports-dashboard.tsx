'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch, getToken } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, LineChart, Line, ComposedChart,
  ReferenceLine,
} from 'recharts'
import {
  FileText, Download, FileSpreadsheet, FileDown, ShieldCheck,
  AlertTriangle, FileWarning, Activity, Calendar, Filter,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Cpu, MapPin, BarChart2, Zap, RefreshCw, Clock,
} from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, subDays,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

// ══════════════════════════════════════════════════════════════
//  TYPES (mirrors route.ts)
// ══════════════════════════════════════════════════════════════

interface ExecutiveKPIs {
  uptimePercent: number
  totalCriticalAlerts: number
  operationalEfficiency: number
  approvalRateDelta: number
  previousApprovalRate: number
  currentApprovalRate: number
  riskScore: number
  locations: string[]
  sensorTypes: string[]
}

interface ReportSummary {
  totalPermits: number
  approvedPermits: number
  rejectedPermits: number
  pendingPermits: number
  safetyIndex: number
  documentsActive: number
  documentsExpired: number
  documentsCriticalExpired: number
  sensorsWithAlerts: number
  periodLabel: string
}

interface ReportPermit {
  id: string
  permitNumber: string
  riskType: string
  status: string
  technicianName: string
  supervisorName: string
  workLocation: string
  workDescription: string
  createdAt: string
  approvedAt?: string | null
  rejectedAt?: string | null
}

interface ReportDocument {
  id: string
  title: string
  documentType: string
  category: string
  criticality: string
  status: string
  issueDate?: string | null
  expiryDate?: string | null
  holderName?: string | null
}

interface SensorAlert {
  id: string
  sensorName: string
  sensorType: string
  value: number
  unit: string
  status: string
  timestamp: string
  thresholdWarning: number
  thresholdCritical: number
}

interface ReportCharts {
  permitsByStatus: { APPROVED: number; REJECTED: number; PENDING: number; CANCELLED: number }
  permitsByRisk: Record<string, number>
  documentsByCategory: Record<string, number>
  monthlyTrend: Array<{ month: string; permits: number; approved: number; movingAvg?: number }>
  sensorTrend: Array<{ date: string; criticalCount: number; warningCount: number; avgValue?: number }>
}

interface ReportData {
  summary: ReportSummary
  permits: ReportPermit[]
  documents: ReportDocument[]
  sensorAlerts: SensorAlert[]
  charts: ReportCharts
  kpis: ExecutiveKPIs
  generatedAt: string
  generatedBy: string
  periodFrom: string
  periodTo: string
}

// ══════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ══════════════════════════════════════════════════════════════

const NAVY  = '#0B1F3A'
const AMBER = '#E8A000'

const PALETTE = {
  approved:  '#16a34a',
  rejected:  '#dc2626',
  pending:   '#d97706',
  cancelled: '#6b7280',
  warning:   '#f59e0b',
  critical:  '#ef4444',
  navy:      NAVY,
  amber:     AMBER,
  teal:      '#0d9488',
  violet:    '#7c3aed',
}

const PIE_COLORS = [PALETTE.approved, PALETTE.teal, PALETTE.pending, PALETTE.rejected, PALETTE.violet, '#6366f1', '#ec4899']

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprobado', REJECTED: 'Rechazado', PENDING: 'Pendiente',
  CANCELLED: 'Cancelado', ACTIVE: 'Activo', EXPIRED: 'Expirado',
  REVOKED: 'Revocado', PENDING_RENEWAL: 'Renovación',
  WARNING: 'Advertencia', CRITICO: 'Crítico', NORMAL: 'Normal',
}

const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL: 'Personal', EQUIPOS: 'Equipos', LEGAL: 'Legal', AMBIENTAL: 'Ambiental',
}

const RISK_LABELS: Record<string, string> = {
  ALTURA: 'Altura', ELECTRICO: 'Eléctrico', CONFINADO: 'Confinado', CALIENTE: 'Caliente',
}

// ══════════════════════════════════════════════════════════════
//  DATE PRESETS
// ══════════════════════════════════════════════════════════════

type DatePreset =
  | 'today' | 'last_7' | 'this_month' | 'last_30' | 'last_month'
  | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',        label: 'Hoy'           },
  { value: 'last_7',      label: 'Últimos 7d'    },
  { value: 'this_month',  label: 'Este mes'       },
  { value: 'last_30',     label: 'Últimos 30d'   },
  { value: 'last_month',  label: 'Mes anterior'  },
  { value: 'this_quarter',label: 'Este trimestre' },
  { value: 'last_quarter',label: 'Trim. anterior' },
  { value: 'this_year',   label: 'Este año'       },
  { value: 'custom',      label: 'Personalizado'  },
]

function applyPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')
  switch (preset) {
    case 'today':         return { from: fmt(now),                     to: fmt(now) }
    case 'last_7':        return { from: fmt(subDays(now,7)),           to: fmt(now) }
    case 'this_month':    return { from: fmt(startOfMonth(now)),        to: fmt(endOfMonth(now)) }
    case 'last_30':       return { from: fmt(subDays(now,30)),          to: fmt(now) }
    case 'last_month':    return { from: fmt(startOfMonth(subMonths(now,1))), to: fmt(endOfMonth(subMonths(now,1))) }
    case 'this_quarter':  return { from: fmt(startOfQuarter(now)),      to: fmt(endOfQuarter(now)) }
    case 'last_quarter':  return { from: fmt(startOfQuarter(subQuarters(now,1))), to: fmt(endOfQuarter(subQuarters(now,1))) }
    case 'this_year':     return { from: fmt(startOfYear(now)),         to: fmt(endOfYear(now)) }
    default:              return { from: fmt(startOfMonth(now)),        to: fmt(endOfMonth(now)) }
  }
}

// ══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

// ── Executive KPI Card ────────────────────────────────────────
interface KPICardProps {
  label:    string
  value:    string
  sub?:     string
  icon:     React.ReactNode
  trend?:   number        // positive = good, negative = bad
  accent:   string
  loading?: boolean
}

function KPICard({ label, value, sub, icon, trend, accent, loading }: KPICardProps) {
  if (loading) return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-28 mb-3" />
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
  return (
    <Card
      className="border-0 shadow-sm overflow-hidden relative"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">{label}</p>
            <p className="text-3xl font-black tracking-tight text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {trend >= 0 ? '+' : ''}{trend}pp vs periodo ant.
              </div>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent + '18' }}>
            <div style={{ color: accent }}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Recharts tooltip style ────────────────────────────────────
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.12)',
    fontSize: '12px',
  },
}

// ── Section header for tables ─────────────────────────────────
function SectionHeader({
  title, count, icon, expanded, onToggle,
}: { title: string; count: number; icon: React.ReactNode; expanded: boolean; onToggle: () => void }) {
  return (
    <CardHeader
      className="cursor-pointer py-3 px-5 hover:bg-slate-50 transition-colors rounded-t-xl"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="text-xs font-bold">{count}</Badge>
        </CardTitle>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
    </CardHeader>
  )
}

// ══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function ReportsDashboard() {
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  // Filters
  const [datePreset,  setDatePreset]  = useState<DatePreset>('this_month')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [riskType,    setRiskType]    = useState('all')
  const [status,      setStatus]      = useState('all')
  const [location,    setLocation]    = useState('all')
  const [sensorType,  setSensorType]  = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('permits')

  const toggleSection = (s: string) => setExpandedSection(p => p === s ? null : s)

  // Apply preset
  const applyPreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const { from, to } = applyPresetDates(preset)
      setDateFrom(from)
      setDateTo(to)
    }
  }, [])

  useEffect(() => { applyPreset('this_month') }, [applyPreset])

  // Load report
  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ReportData>('/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom,
          dateTo,
          preset: datePreset !== 'custom' ? datePreset : undefined,
          riskType:   riskType   !== 'all' ? riskType   : undefined,
          status:     status     !== 'all' ? status     : undefined,
          location:   location   !== 'all' ? location   : undefined,
          sensorType: sensorType !== 'all' ? sensorType : undefined,
          format: 'json',
        }),
      })
      setReportData(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, datePreset, riskType, status, location, sensorType])

  useEffect(() => { loadReport() }, [loadReport])

  // Export
  const handleExport = useCallback(async (fmt: 'pdf' | 'xlsx') => {
    setExporting(fmt)
    try {
      const token = getToken()
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dateFrom, dateTo,
          riskType:   riskType   !== 'all' ? riskType   : undefined,
          status:     status     !== 'all' ? status     : undefined,
          location:   location   !== 'all' ? location   : undefined,
          sensorType: sensorType !== 'all' ? sensorType : undefined,
          format: fmt,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Error de exportación' }))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `reporte-gerencial-${reportData?.summary.periodLabel || 'hse'}.${fmt}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(null)
    }
  }, [dateFrom, dateTo, riskType, status, location, sensorType, reportData])

  // ── Chart data ──────────────────────────────────────────────
  const statusChartData = useMemo(() => reportData ? [
    { name: 'Aprobados',  value: reportData.charts.permitsByStatus.APPROVED,  fill: PALETTE.approved  },
    { name: 'Rechazados', value: reportData.charts.permitsByStatus.REJECTED,  fill: PALETTE.rejected  },
    { name: 'Pendientes', value: reportData.charts.permitsByStatus.PENDING,   fill: PALETTE.pending   },
    { name: 'Cancelados', value: reportData.charts.permitsByStatus.CANCELLED, fill: PALETTE.cancelled },
  ] : [], [reportData])

  const riskChartData = useMemo(() => reportData
    ? Object.entries(reportData.charts.permitsByRisk).map(([key, value], i) => ({
        name: RISK_LABELS[key] || key, value, fill: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : [], [reportData])

  const categoryChartData = useMemo(() => reportData
    ? Object.entries(reportData.charts.documentsByCategory).map(([key, value]) => ({
        name: CATEGORY_LABELS[key] || key, value,
      }))
    : [], [reportData])

  // ── Helpers ─────────────────────────────────────────────────
  const safetyColor = (n: number) => n>=80 ? 'text-emerald-600' : n>=50 ? 'text-amber-500' : 'text-red-500'
  const safetyBg    = (n: number) => n>=80 ? 'bg-emerald-50 border-emerald-200' : n>=50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const activeFilters = [riskType, status, location, sensorType].filter(v => v !== 'all').length

  // Dynamic locations/sensorTypes from API response
  const locationOptions = reportData?.kpis.locations || []
  const sensorTypeOptions = reportData?.kpis.sensorTypes || []

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">

      {/* ── TOP FILTER BAR ───────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">

            {/* Row 1: Title + Export buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5" style={{ color: NAVY }} />
                  Reporte Gerencial HSE
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {reportData && !loading
                    ? `Periodo: ${reportData.summary.periodLabel}  ·  Generado: ${format(parseISO(reportData.generatedAt), "dd/MM/yyyy HH:mm")}`
                    : 'Configure los filtros y genere su reporte'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm" variant="outline"
                  onClick={loadReport} disabled={loading}
                  className="border-slate-200 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExport('xlsx')}
                  disabled={loading || exporting !== null}
                  className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  {exporting==='xlsx'
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <FileSpreadsheet className="w-3.5 h-3.5" />
                  }
                  Excel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExport('pdf')}
                  disabled={loading || exporting !== null}
                  className="gap-1.5 text-white"
                  style={{ backgroundColor: NAVY }}
                >
                  {exporting==='pdf'
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <FileDown className="w-3.5 h-3.5" />
                  }
                  PDF
                </Button>
              </div>
            </div>

            {/* Row 2: Date presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {DATE_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => applyPreset(value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    datePreset === value
                      ? 'text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={datePreset === value ? { backgroundColor: NAVY } : undefined}
                >
                  {label}
                </button>
              ))}

              {/* Advanced filters toggle */}
              <button
                onClick={() => setFiltersOpen(p => !p)}
                className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  filtersOpen || activeFilters > 0
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3 h-3" />
                Filtros avanzados
                {activeFilters > 0 && (
                  <span className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: AMBER }}>
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>

            {/* Custom date range */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Desde</span>
                <input
                  type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <span className="text-xs text-slate-400">hasta</span>
                <input
                  type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            )}

            {/* Advanced filters panel */}
            {filtersOpen && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                {/* Risk type */}
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">Tipo de Riesgo</label>
                  <Select value={riskType} onValueChange={setRiskType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los riesgos</SelectItem>
                      <SelectItem value="ALTURA">Altura</SelectItem>
                      <SelectItem value="ELECTRICO">Eléctrico</SelectItem>
                      <SelectItem value="CONFINADO">Confinado</SelectItem>
                      <SelectItem value="CALIENTE">Caliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">Estado Permiso</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="APPROVED">Aprobados</SelectItem>
                      <SelectItem value="REJECTED">Rechazados</SelectItem>
                      <SelectItem value="PENDING">Pendientes</SelectItem>
                      <SelectItem value="CANCELLED">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">
                    <MapPin className="w-2.5 h-2.5 inline mr-0.5" />Ubicación
                  </label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las ubicaciones</SelectItem>
                      {locationOptions.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sensor type */}
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">
                    <Cpu className="w-2.5 h-2.5 inline mr-0.5" />Tipo de Sensor
                  </label>
                  <Select value={sensorType} onValueChange={setSensorType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los sensores</SelectItem>
                      {sensorTypeOptions.map(st => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reset */}
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setRiskType('all'); setStatus('all'); setLocation('all'); setSensorType('all') }}
                    className="col-span-2 lg:col-span-4 text-xs text-slate-400 hover:text-slate-600 underline text-left"
                  >
                    Limpiar filtros avanzados
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── EXECUTIVE KPI WIDGETS ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Uptime Operacional"
          value={reportData ? `${reportData.kpis.uptimePercent}%` : '—'}
          sub="horas sin alertas críticas"
          icon={<Clock className="w-5 h-5" />}
          accent={PALETTE.approved}
          loading={loading && !reportData}
        />
        <KPICard
          label="Alertas Críticas"
          value={reportData ? reportData.kpis.totalCriticalAlerts.toString() : '—'}
          sub="en el periodo seleccionado"
          icon={<Zap className="w-5 h-5" />}
          accent={PALETTE.critical}
          loading={loading && !reportData}
        />
        <KPICard
          label="Eficiencia Operativa"
          value={reportData ? `${reportData.kpis.operationalEfficiency}%` : '—'}
          sub="promedio por ubicación"
          icon={<Activity className="w-5 h-5" />}
          accent={PALETTE.navy}
          loading={loading && !reportData}
        />
        <KPICard
          label="Tasa de Aprobación"
          value={reportData ? `${reportData.kpis.currentApprovalRate}%` : '—'}
          sub={reportData ? `Periodo anterior: ${reportData.kpis.previousApprovalRate}%` : undefined}
          icon={<ShieldCheck className="w-5 h-5" />}
          trend={reportData?.kpis.approvalRateDelta}
          accent={PALETTE.amber}
          loading={loading && !reportData}
        />
      </div>

      {/* ── SECONDARY KPIs ───────────────────────────────────── */}
      {reportData && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Permisos', value: reportData.summary.totalPermits, sub: `${reportData.summary.approvedPermits} aprobados`, color: PALETTE.navy },
            { label: 'Índice Seguridad', value: `${reportData.summary.safetyIndex}%`, sub: reportData.summary.safetyIndex>=80?'Excelente':reportData.summary.safetyIndex>=50?'Regular':'Crítico', color: reportData.summary.safetyIndex>=80?PALETTE.approved:reportData.summary.safetyIndex>=50?PALETTE.pending:PALETTE.rejected },
            { label: 'Docs. Expirados', value: reportData.summary.documentsExpired, sub: `${reportData.summary.documentsCriticalExpired} críticos`, color: reportData.summary.documentsCriticalExpired>0?PALETTE.rejected:PALETTE.cancelled },
            { label: 'Sensores en Alerta', value: reportData.summary.sensorsWithAlerts, sub: `${reportData.sensorAlerts.length} lecturas`, color: reportData.summary.sensorsWithAlerts>0?PALETTE.warning:PALETTE.approved },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-xs p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{label}</p>
              <p className="text-2xl font-black mt-1" style={{ color }}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── EXECUTIVE NARRATIVE ──────────────────────────────── */}
      {reportData && !loading && (
        <div className={`rounded-xl border p-4 ${safetyBg(reportData.summary.safetyIndex)}`}>
          <p className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-1.5">Análisis Ejecutivo Automático</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Durante el periodo <strong>{reportData.summary.periodLabel}</strong> se procesaron{' '}
            <strong>{reportData.summary.totalPermits} permisos</strong> con un índice de seguridad del{' '}
            <strong className={safetyColor(reportData.summary.safetyIndex)}>{reportData.summary.safetyIndex}%</strong>
            {reportData.kpis.approvalRateDelta !== 0 && (
              <span> ({reportData.kpis.approvalRateDelta>=0?'+':''}{reportData.kpis.approvalRateDelta}pp vs periodo anterior)</span>
            )}.{' '}
            El uptime operacional fue del <strong>{reportData.kpis.uptimePercent}%</strong> con{' '}
            <strong className={reportData.kpis.totalCriticalAlerts>0?'text-red-600':''}>{reportData.kpis.totalCriticalAlerts} alertas críticas</strong> de sensores.
            {reportData.summary.documentsCriticalExpired > 0 && (
              <span className="text-red-600 font-semibold">
                {' '}⚠ {reportData.summary.documentsCriticalExpired} documentos de criticidad alta requieren atención inmediata.
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── CHARTS + TABLES ──────────────────────────────────── */}
      {reportData && (
        <Tabs defaultValue="charts" className="w-full">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="charts"   className="rounded-lg text-xs font-semibold">Gráficos y Tendencias</TabsTrigger>
            <TabsTrigger value="sensors"  className="rounded-lg text-xs font-semibold">Monitoreo Sensores</TabsTrigger>
            <TabsTrigger value="data"     className="rounded-lg text-xs font-semibold">Datos Tabulares</TabsTrigger>
          </TabsList>

          {/* ── TAB: CHARTS ──────────────────────────────────── */}
          <TabsContent value="charts" className="mt-4 space-y-5">

            {/* Trend with moving average — FULL WIDTH */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800">Tendencia de Permisos + Promedio Móvil (3 meses)</CardTitle>
                    <CardDescription className="text-xs">Área = total emitidos · Línea verde = aprobados · Línea punteada = promedio móvil</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={reportData.charts.monthlyTrend} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={28}
                        formatter={v => <span className="text-xs text-slate-600">
                          {v==='permits'?'Total emitidos':v==='approved'?'Aprobados':'Promedio móvil 3m'}
                        </span>}
                      />
                      <Area
                        type="monotone" dataKey="permits" name="permits"
                        stroke={NAVY} fill={NAVY + '18'} strokeWidth={2}
                      />
                      <Line
                        type="monotone" dataKey="approved" name="approved"
                        stroke={PALETTE.approved} strokeWidth={2.5} dot={false}
                      />
                      <Line
                        type="monotone" dataKey="movingAvg" name="movingAvg"
                        stroke={PALETTE.amber} strokeWidth={2}
                        strokeDasharray="6 3" dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Row: Status bar + Risk donut */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 px-5">
                  <CardTitle className="text-sm font-bold text-slate-800">Distribución por Estado</CardTitle>
                </CardHeader>
                <CardContent className="px-2">
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Bar dataKey="value" name="Permisos" radius={[6,6,0,0]} maxBarSize={52}>
                          {statusChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 px-5">
                  <CardTitle className="text-sm font-bold text-slate-800">Permisos por Tipo de Riesgo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskChartData} cx="50%" cy="45%"
                          innerRadius={58} outerRadius={96}
                          paddingAngle={3} dataKey="value" nameKey="name"
                        >
                          {riskChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Legend
                          verticalAlign="bottom" iconType="circle"
                          formatter={v => <span className="text-xs text-slate-600">{v}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents by category */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-5">
                <CardTitle className="text-sm font-bold text-slate-800">Documentos HSE por Categoría</CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 24, left: 72, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={68} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="value" name="Documentos" radius={[0,6,6,0]} maxBarSize={28}>
                        {categoryChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: SENSOR MONITORING ───────────────────────── */}
          <TabsContent value="sensors" className="mt-4 space-y-5">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-5">
                <CardTitle className="text-sm font-bold text-slate-800">Alertas de Sensores por Día</CardTitle>
                <CardDescription className="text-xs">
                  Barra roja = alertas críticas · Barra naranja = advertencias · Línea = umbral crítico de referencia (5)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={reportData.charts.sensorTrend}
                      margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }}
                        tickLine={false} axisLine={false}
                        interval={Math.floor(reportData.charts.sensorTrend.length / 10)}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend
                        verticalAlign="top" align="right" height={28}
                        formatter={v => <span className="text-xs text-slate-600">
                          {v==='criticalCount'?'Críticas':v==='warningCount'?'Advertencias':''}
                        </span>}
                      />
                      {/* Visual threshold marker at y=5 */}
                      <ReferenceLine y={5} stroke={PALETTE.critical} strokeDasharray="4 3" strokeWidth={1.5}
                        label={{ value: 'Umbral crítico', position: 'insideTopRight', fontSize: 9, fill: PALETTE.critical }} />
                      <Bar dataKey="criticalCount" name="criticalCount" stackId="a" fill={PALETTE.critical + 'cc'} radius={[3,3,0,0]} maxBarSize={14} />
                      <Bar dataKey="warningCount"  name="warningCount"  stackId="a" fill={PALETTE.warning + 'cc'} radius={[3,3,0,0]} maxBarSize={14} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sensor alerts table */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <SectionHeader
                title="Lecturas con Alerta"
                count={reportData.sensorAlerts.length}
                icon={<Activity className="w-4 h-4 text-amber-500" />}
                expanded={expandedSection === 'sensors'}
                onToggle={() => toggleSection('sensors')}
              />
              {expandedSection === 'sensors' && (
                <CardContent className="pt-0 px-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          {['Sensor','Tipo','Valor','Estado','Adv.','Crít.','Fecha'].map(h => (
                            <TableHead key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.sensorAlerts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-400 py-8 text-sm">
                              Sin alertas de sensores en el periodo
                            </TableCell>
                          </TableRow>
                        ) : reportData.sensorAlerts.map(a => (
                          <TableRow key={a.id} className="hover:bg-slate-50">
                            <TableCell className="text-xs font-medium">{a.sensorName}</TableCell>
                            <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{a.sensorType}</Badge></TableCell>
                            <TableCell className="text-xs font-mono font-bold">{a.value} {a.unit}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${a.status==='CRITICO'?'bg-red-100 text-red-700 border-red-200':'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                {STATUS_LABEL[a.status] || a.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-400 font-mono">{a.thresholdWarning} {a.unit}</TableCell>
                            <TableCell className="text-xs text-slate-400 font-mono">{a.thresholdCritical} {a.unit}</TableCell>
                            <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                              {format(parseISO(a.timestamp), 'dd/MM/yy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* ── TAB: DATA ────────────────────────────────────── */}
          <TabsContent value="data" className="mt-4 space-y-4">

            {/* Permits */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <SectionHeader
                title="Permisos de Trabajo"
                count={reportData.permits.length}
                icon={<FileText className="w-4 h-4 text-emerald-600" />}
                expanded={expandedSection === 'permits'}
                onToggle={() => toggleSection('permits')}
              />
              {expandedSection === 'permits' && (
                <CardContent className="pt-0 px-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          {['Número','Riesgo','Estado','Técnico','Supervisor','Ubicación','Fecha'].map(h => (
                            <TableHead key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.permits.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-400 py-8 text-sm">
                              No se encontraron permisos en este periodo
                            </TableCell>
                          </TableRow>
                        ) : reportData.permits.map(p => (
                          <TableRow key={p.id} className="hover:bg-slate-50">
                            <TableCell className="text-xs font-mono font-semibold">{p.permitNumber}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{RISK_LABELS[p.riskType]||p.riskType}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${
                                p.status==='APPROVED'?'bg-emerald-100 text-emerald-700':
                                p.status==='REJECTED'?'bg-red-100 text-red-700':
                                p.status==='PENDING'?'bg-amber-100 text-amber-700':
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {STATUS_LABEL[p.status]||p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{p.technicianName}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{p.supervisorName}</TableCell>
                            <TableCell className="text-xs hidden lg:table-cell truncate max-w-[140px]">{p.workLocation}</TableCell>
                            <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                              {format(parseISO(p.createdAt), 'dd/MM/yy')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Documents */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <SectionHeader
                title="Documentos HSE"
                count={reportData.documents.length}
                icon={<FileWarning className="w-4 h-4 text-amber-500" />}
                expanded={expandedSection === 'documents'}
                onToggle={() => toggleSection('documents')}
              />
              {expandedSection === 'documents' && (
                <CardContent className="pt-0 px-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          {['Título','Categoría','Criticidad','Estado','Titular','Vencimiento'].map(h => (
                            <TableHead key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.documents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-400 py-8 text-sm">
                              No se encontraron documentos
                            </TableCell>
                          </TableRow>
                        ) : reportData.documents.map(d => (
                          <TableRow key={d.id} className="hover:bg-slate-50">
                            <TableCell className="text-xs font-medium truncate max-w-[180px]">{d.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[d.category]||d.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${d.criticality==='CRITICAL'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
                                {d.criticality==='CRITICAL'?'Crítico':d.criticality==='LOW'?'Bajo':'Normal'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${d.status==='ACTIVE'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                                {STATUS_LABEL[d.status]||d.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{d.holderName||'—'}</TableCell>
                            <TableCell className="text-xs text-slate-400 whitespace-nowrap hidden lg:table-cell">
                              {d.expiryDate ? format(parseISO(d.expiryDate), 'dd/MM/yyyy') : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Footer */}
      {reportData && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pb-2">
            <span>Generado: {format(parseISO(reportData.generatedAt), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}</span>
            <span>·</span>
            <span>Por: {reportData.generatedBy}</span>
            <span>·</span>
            <span>Periodo: {reportData.summary.periodLabel}</span>
            <span>·</span>
            <span>{reportData.permits.length} permisos · {reportData.documents.length} docs · {reportData.sensorAlerts.length} alertas</span>
          </div>
        </>
      )}
    </div>
  )
}
