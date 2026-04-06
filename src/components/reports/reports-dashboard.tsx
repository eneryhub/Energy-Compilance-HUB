'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, getToken } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Activity,
  Calendar,
  Filter,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns'
import { es } from 'date-fns/locale'

// ============ Types ============

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
  monthlyTrend: Array<{ month: string; permits: number; approved: number }>
}

interface ReportData {
  summary: ReportSummary
  permits: ReportPermit[]
  documents: ReportDocument[]
  sensorAlerts: SensorAlert[]
  charts: ReportCharts
}

// ============ Constants ============

const RISK_COLORS: Record<string, string> = {
  APPROVED: '#059669',
  REJECTED: '#dc2626',
  PENDING: '#d97706',
  CANCELLED: '#6b7280',
}

const PIE_COLORS = ['#059669', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#6366f1', '#ec4899']

const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL: 'Personal',
  EQUIPOS: 'Equipos',
  LEGAL: 'Legal',
  AMBIENTAL: 'Ambiental',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  APPROVED: 'default',
  REJECTED: 'destructive',
  PENDING: 'secondary',
  CANCELLED: 'outline',
  ACTIVE: 'default',
  EXPIRED: 'destructive',
  REVOKED: 'destructive',
  PENDING_RENEWAL: 'secondary',
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelado',
  ACTIVE: 'Activo',
  EXPIRED: 'Expirado',
  REVOKED: 'Revocado',
  PENDING_RENEWAL: 'Renovación',
  WARNING: 'Advertencia',
  CRITICO: 'Crítico',
  NORMAL: 'Normal',
}

// ============ Preset Buttons ============

type DatePreset = 'this_month' | 'last_30' | 'this_year' | 'custom'

// ============ Component ============

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [riskType, setRiskType] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('permits')

  // Apply preset
  const applyPreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    const now = new Date()
    switch (preset) {
      case 'this_month':
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
        break
      case 'last_30':
        setDateFrom(format(subDays(now, 30), 'yyyy-MM-dd'))
        setDateTo(format(now, 'yyyy-MM-dd'))
        break
      case 'this_year':
        setDateFrom(format(startOfYear(now), 'yyyy-MM-dd'))
        setDateTo(format(endOfYear(now), 'yyyy-MM-dd'))
        break
      case 'custom':
        break
    }
  }, [])

  // Initialize dates
  useEffect(() => {
    applyPreset('this_month')
  }, [applyPreset])

  // Load report data
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
          riskType: riskType !== 'all' ? riskType : undefined,
          status: status !== 'all' ? status : undefined,
          format: 'json',
        }),
      })
      setReportData(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, riskType, status])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  // Export handler
  const handleExport = useCallback(async (format: 'pdf' | 'xlsx') => {
    setExporting(format)
    try {
      const token = getToken()
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          riskType: riskType !== 'all' ? riskType : undefined,
          status: status !== 'all' ? status : undefined,
          format,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error de exportación' }))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'pdf'
        ? `reporte-${reportData?.summary.periodLabel || 'general'}.pdf`
        : `reporte-${reportData?.summary.periodLabel || 'general'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(null)
    }
  }, [dateFrom, dateTo, riskType, status, reportData])

  // Chart data transformations
  const statusChartData = reportData ? [
    { name: 'Aprobados', value: reportData.charts.permitsByStatus.APPROVED, fill: RISK_COLORS.APPROVED },
    { name: 'Rechazados', value: reportData.charts.permitsByStatus.REJECTED, fill: RISK_COLORS.REJECTED },
    { name: 'Pendientes', value: reportData.charts.permitsByStatus.PENDING, fill: RISK_COLORS.PENDING },
    { name: 'Cancelados', value: reportData.charts.permitsByStatus.CANCELLED, fill: RISK_COLORS.CANCELLED },
  ] : []

  const riskChartData = reportData ? Object.entries(reportData.charts.permitsByRisk).map(([key, value], i) => ({
    name: key,
    value,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })) : []

  const categoryChartData = reportData ? Object.entries(reportData.charts.documentsByCategory).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] || key,
    value,
  })) : []

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  // Safety index color
  const safetyColor = (index: number) => {
    if (index >= 80) return 'text-emerald-600'
    if (index >= 50) return 'text-amber-500'
    return 'text-red-500'
  }
  const safetyBg = (index: number) => {
    if (index >= 80) return 'bg-emerald-50 border-emerald-200'
    if (index >= 50) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  // ============ Render ============

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Reportes de Cumplimiento
              </CardTitle>
              <CardDescription>
                {reportData && !loading
                  ? `Periodo: ${reportData.summary.periodLabel}`
                  : 'Configure los filtros y genere su reporte'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={loading || exporting !== null}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                {exporting === 'pdf' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                Exportar PDF
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('xlsx')}
                disabled={loading || exporting !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {exporting === 'xlsx' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Preset Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              {([
                ['this_month', 'Este mes'],
                ['last_30', 'Ultimos 30 dias'],
                ['this_year', 'Este anio'],
                ['custom', 'Personalizado'],
              ] as const).map(([preset, label]) => (
                <Button
                  key={preset}
                  variant={datePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className={datePreset === preset
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Date Range */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400 text-sm">a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Risk Type */}
            <Select value={riskType} onValueChange={setRiskType}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Tipo de riesgo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los riesgos</SelectItem>
                <SelectItem value="ALTURA">Altura</SelectItem>
                <SelectItem value="ELECTRICO">Electrico</SelectItem>
                <SelectItem value="CONFINADO">Confinado</SelectItem>
                <SelectItem value="CALIENTE">Caliente</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="APPROVED">Aprobados</SelectItem>
                <SelectItem value="REJECTED">Rechazados</SelectItem>
                <SelectItem value="PENDING">Pendientes</SelectItem>
                <SelectItem value="CANCELLED">Cancelados</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              size="sm"
              variant="outline"
              onClick={loadReport}
              disabled={loading}
              className="border-slate-200"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-slate-200">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="border-slate-200">
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Report Content */}
      {reportData && (
        <>
          {/* Executive Summary Text */}
          <Card className={`border ${safetyBg(reportData.summary.safetyIndex)} ${loading ? 'opacity-50' : ''}`}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-700">
                Este mes se procesaron{' '}
                <span className="font-bold text-slate-900">{reportData.summary.totalPermits} permisos</span>{' '}
                con un indice de seguridad del{' '}
                <span className={`font-bold ${safetyColor(reportData.summary.safetyIndex)}`}>
                  {reportData.summary.safetyIndex}%
                </span>
                . Se encontraron{' '}
                <span className="font-bold text-slate-900">{reportData.summary.documentsExpired} documentos expirados</span>{' '}
                y{' '}
                <span className="font-bold text-slate-900">{reportData.summary.sensorsWithAlerts} sensores con alertas</span>.
                {reportData.summary.documentsCriticalExpired > 0 && (
                  <span className="text-red-600 font-semibold">
                    {' '}&#8226; {reportData.summary.documentsCriticalExpired} documentos criticos expirados requieren atencion inmediata.
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Permits */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Permisos</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{reportData.summary.totalPermits}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {reportData.summary.approvedPermits} aprobados / {reportData.summary.rejectedPermits} rechazados
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Safety Index */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Indice de Seguridad</p>
                    <p className={`text-3xl font-bold mt-1 ${safetyColor(reportData.summary.safetyIndex)}`}>
                      {reportData.summary.safetyIndex}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {reportData.summary.safetyIndex >= 80 ? 'Excelente' : reportData.summary.safetyIndex >= 50 ? 'Regular' : 'Requiere atencion'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                    <ShieldCheck className={`w-6 h-6 ${safetyColor(reportData.summary.safetyIndex)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Expired */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Documentos Expirados</p>
                    <p className={`text-3xl font-bold mt-1 ${reportData.summary.documentsCriticalExpired > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                      {reportData.summary.documentsExpired}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {reportData.summary.documentsCriticalExpired} criticos
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <FileWarning className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sensor Alerts */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Alertas de Sensores</p>
                    <p className={`text-3xl font-bold mt-1 ${reportData.summary.sensorsWithAlerts > 0 ? 'text-amber-500' : 'text-slate-900'}`}>
                      {reportData.summary.sensorsWithAlerts}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {reportData.sensorAlerts.length} lecturas con alerta
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <Tabs defaultValue="charts" className="w-full">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="charts">Graficos</TabsTrigger>
              <TabsTrigger value="data">Datos Tabulares</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="mt-4 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Permits by Status - Bar Chart */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Permisos por Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Bar dataKey="value" name="Cantidad" radius={[6, 6, 0, 0]}>
                            {statusChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Permits by Risk - Pie Chart */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Permisos por Tipo de Riesgo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {riskChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Trend - Area Chart */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Tendencia Mensual de Permisos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={reportData.charts.monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(value) => (
                              <span className="text-xs text-slate-600">
                                {value === 'permits' ? 'Total' : 'Aprobados'}
                              </span>
                            )}
                          />
                          <Area
                            type="monotone"
                            dataKey="permits"
                            stroke="#64748b"
                            fill="#e2e8f0"
                            strokeWidth={2}
                            name="permits"
                          />
                          <Area
                            type="monotone"
                            dataKey="approved"
                            stroke="#059669"
                            fill="#d1fae5"
                            strokeWidth={2}
                            name="approved"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents by Category - Bar Chart */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Documentos por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={55} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Bar dataKey="value" name="Documentos" radius={[0, 6, 6, 0]}>
                            {categoryChartData.map((_, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-4 space-y-4">
              {/* Permits Table */}
              <Card className="border-slate-200">
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() => toggleSection('permits')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Permisos ({reportData.permits.length})
                    </CardTitle>
                    {expandedSection === 'permits' ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </CardHeader>
                {expandedSection === 'permits' && (
                  <CardContent className="pt-0">
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-semibold text-slate-500">Numero</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Riesgo</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Tecnico</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden md:table-cell">Supervisor</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden lg:table-cell">Ubicacion</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.permits.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                                No se encontraron permisos en este periodo
                              </TableCell>
                            </TableRow>
                          ) : (
                            reportData.permits.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs font-mono">{p.permitNumber}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-xs border-slate-300">
                                    {p.riskType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant={STATUS_VARIANT[p.status] || 'secondary'}>
                                    {STATUS_LABEL[p.status] || p.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{p.technicianName}</TableCell>
                                <TableCell className="text-xs hidden md:table-cell">{p.supervisorName}</TableCell>
                                <TableCell className="text-xs hidden lg:table-cell truncate max-w-[150px]">{p.workLocation}</TableCell>
                                <TableCell className="text-xs text-slate-500">
                                  {format(parseISO(p.createdAt), 'dd/MM/yy')}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Documents Table */}
              <Card className="border-slate-200">
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() => toggleSection('documents')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-500" />
                      Documentos HSE ({reportData.documents.length})
                    </CardTitle>
                    {expandedSection === 'documents' ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </CardHeader>
                {expandedSection === 'documents' && (
                  <CardContent className="pt-0">
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-semibold text-slate-500">Titulo</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Categoria</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Criticidad</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden md:table-cell">Titular</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden lg:table-cell">Vencimiento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.documents.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                                No se encontraron documentos
                              </TableCell>
                            </TableRow>
                          ) : (
                            reportData.documents.map((d) => (
                              <TableRow key={d.id}>
                                <TableCell className="text-xs font-medium truncate max-w-[200px]">{d.title}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-xs border-slate-300">
                                    {CATEGORY_LABELS[d.category] || d.category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant={d.criticality === 'CRITICAL' ? 'destructive' : 'secondary'}>
                                    {d.criticality === 'CRITICAL' ? 'Critico' : d.criticality === 'LOW' ? 'Bajo' : 'Normal'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant={STATUS_VARIANT[d.status] || 'secondary'}>
                                    {STATUS_LABEL[d.status] || d.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell">{d.holderName || '-'}</TableCell>
                                <TableCell className="text-xs hidden lg:table-cell text-slate-500">
                                  {d.expiryDate ? format(parseISO(d.expiryDate), 'dd/MM/yyyy') : '-'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Sensor Alerts Table */}
              <Card className="border-slate-200">
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() => toggleSection('sensors')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-500" />
                      Alertas de Sensores ({reportData.sensorAlerts.length})
                    </CardTitle>
                    {expandedSection === 'sensors' ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </CardHeader>
                {expandedSection === 'sensors' && (
                  <CardContent className="pt-0">
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-semibold text-slate-500">Sensor</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Valor</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden md:table-cell">Umbral Adv.</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden md:table-cell">Umbral Crit.</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.sensorAlerts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                                No se encontraron alertas de sensores
                              </TableCell>
                            </TableRow>
                          ) : (
                            reportData.sensorAlerts.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs font-medium">{a.sensorName}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-xs border-slate-300">
                                    {a.sensorType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono font-medium">
                                  {a.value} {a.unit}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant={a.status === 'CRITICO' ? 'destructive' : 'secondary'}>
                                    {STATUS_LABEL[a.status] || a.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell text-slate-500">
                                  {a.thresholdWarning} {a.unit}
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell text-slate-500">
                                  {a.thresholdCritical} {a.unit}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500">
                                  {format(parseISO(a.timestamp), 'dd/MM/yy HH:mm')}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Stats Footer */}
          <Separator />
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>Reporte generado: {format(new Date(), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}</span>
            <span className="hidden sm:inline">&#8226;</span>
            <span>Periodo: {reportData.summary.periodLabel}</span>
            <span className="hidden sm:inline">&#8226;</span>
            <span>{reportData.permits.length} permisos / {reportData.documents.length} documentos / {reportData.sensorAlerts.length} alertas</span>
          </div>
        </>
      )}
    </div>
  )
}
