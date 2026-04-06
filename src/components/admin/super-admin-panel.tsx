'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Crown,
  Building2,
  Users,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Search,
  TrendingUp,
  FileText,
  FolderOpen,
  Activity,
  MapPin,
  Key,
  MessageCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  UserCheck,
  Zap,
  Pause,
  Play,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Radio,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'

// ============ Types ============

interface CompanyCounts {
  users: number
  permits: number
  documents: number
  sensors: number
  workLocations: number
  apiKeys: number
  supportMessages: number
}

interface AdminCompany {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  subscriptionPlan: string
  subscriptionStatus: string
  subscriptionExpiresAt: string | null
  trialEndsAt: string | null
  maxUsers: number
  maxPermitsPerMonth: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  stripeCustomerId: string | null
  _count: Partial<CompanyCounts>
  permitStats?: { total: number; pending: number; approved: number; rejected: number; cancelled: number }
  documentStats?: { total: number; expired: number }
  sensorStats?: { total: number; active: number; critical: number }
  lastActivity?: string | null
  invoiceTotal?: number
}

interface AdminAuditLog {
  id: string
  action: string
  entityType: string
  details: string | null
  createdAt: string
  user: { name: string } | null
}

interface DashboardData {
  overview: {
    totalCompanies: number
    totalUsers: number
    totalPermits: number
    totalDocuments: number
    totalSensors: number
    totalLocations: number
    totalApiKeys: number
  }
  byPlan: { starter: number; business: number; enterprise: number }
  byStatus: { [key: string]: number }
  permitsByStatus: { [key: string]: number }
  documentsExpired: number
  sensorsCritical: number
  totalRevenue: number
  companiesThisMonth: number
  permitsToday: number
  recentActivity: AdminAuditLog[]
}

interface CompanyDetail {
  company: AdminCompany
  users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }>
  auditLogs: AdminAuditLog[]
  recentPermits: Array<{ id: string; permitNumber: string; status: string; riskType: string; createdAt: string }>
  unreadSupport: number
}

// ============ Helpers ============

function getStatusBadge(status: string) {
  switch (status) {
    case 'TRIAL': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'PAST_DUE': return 'bg-red-100 text-red-700 border-red-200'
    case 'CANCELLED': return 'bg-slate-100 text-slate-500 border-slate-200'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = { TRIAL: 'Prueba', ACTIVE: 'Activo', PAST_DUE: 'Vencido', CANCELLED: 'Cancelado' }
  return map[status] || status
}

function getPlanBadge(plan: string) {
  switch (plan) {
    case 'enterprise': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'business': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'starter': return 'bg-slate-100 text-slate-600 border-slate-200'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'LOGIN': return <Clock className="w-3.5 h-3.5 text-blue-500" />
    case 'CREATE': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'APPROVE': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'REJECT': return <XCircle className="w-3.5 h-3.5 text-red-500" />
    case 'UPDATE': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
    case 'DELETE': return <XCircle className="w-3.5 h-3.5 text-red-500" />
    default: return <Eye className="w-3.5 h-3.5 text-slate-400" />
  }
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days}d`
  return formatDate(dateStr)
}

// ============ Animation ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ============ Main Component ============

export default function SuperAdminPanel() {
  // Data
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')

  // Company detail dialog
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edit company dialog
  const [editCompany, setEditCompany] = useState<AdminCompany | null>(null)
  const [editForm, setEditForm] = useState({ subscriptionPlan: '', subscriptionStatus: '', isActive: true, maxUsers: 0, maxPermitsPerMonth: 0, subscriptionExpiresAt: '' })
  const [saving, setSaving] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState('overview')

  // ============ Fetch data ============

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesRes, dashboardRes] = await Promise.all([
        apiFetch<{ companies: AdminCompany[] }>('/admin/companies'),
        apiFetch<DashboardData>('/admin/dashboard'),
      ])
      setCompanies(companiesRes.companies)
      setDashboard(dashboardRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ============ Company detail ============

  const openCompanyDetail = async (company: AdminCompany) => {
    setSelectedCompany(null)
    setLoadingDetail(true)
    try {
      const res = await apiFetch<CompanyDetail>(`/admin/company/${company.id}`)
      setSelectedCompany(res)
    } catch {
      setError('Error al cargar detalle de empresa')
    } finally {
      setLoadingDetail(false)
    }
  }

  // ============ Edit company ============

  const openEditDialog = (company: AdminCompany) => {
    setEditCompany(company)
    setEditForm({
      subscriptionPlan: company.subscriptionPlan,
      subscriptionStatus: company.subscriptionStatus,
      isActive: company.isActive,
      maxUsers: company.maxUsers,
      maxPermitsPerMonth: company.maxPermitsPerMonth,
      subscriptionExpiresAt: company.subscriptionExpiresAt ? company.subscriptionExpiresAt.slice(0, 10) : '',
    })
  }

  const handleSaveCompany = async () => {
    if (!editCompany) return
    setSaving(true)
    try {
      await apiFetch(`/admin/company/${editCompany.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      setEditCompany(null)
      fetchAll()
    } catch (err: any) {
      alert(err.message || 'Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  // ============ Computed values ============

  const filteredCompanies = useMemo(() => {
    let result = [...companies]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || '').includes(q)
      )
    }

    if (filterPlan !== 'all') {
      result = result.filter((c) => c.subscriptionPlan === filterPlan)
    }

    if (filterStatus !== 'all') {
      result = result.filter((c) => c.subscriptionStatus === filterStatus)
    }

    switch (sortBy) {
      case 'newest': result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break
      case 'oldest': result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'users': result.sort((a, b) => b._count.users - a._count.users); break
      case 'permits': result.sort((a, b) => b._count.permits - a._count.permits); break
      case 'revenue': result.sort((a, b) => b.invoiceTotal - a.invoiceTotal); break
    }

    return result
  }, [companies, searchQuery, filterPlan, filterStatus, sortBy])

  // ============ Render ============

  if (loading && !companies.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Centro de Mando</h2>
            <p className="text-xs text-slate-500">Administraci\u00f3n global de la plataforma</p>
          </div>
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <Crown className="w-3 h-3 mr-1" />SUPER_ADMIN
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            Visi\u00f3n General
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5" />
            Empresas ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs">
            <Radio className="w-3.5 h-3.5" />
            Actividad
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: OVERVIEW ===== */}
        <TabsContent value="overview" className="space-y-5">
          {dashboard && (
            <>
              {/* KPI Row */}
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <motion.div variants={cardVariants}>
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{dashboard.overview.totalCompanies}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Empresas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboard.overview.totalUsers)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Usuarios</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboard.overview.totalPermits)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Permisos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">${formatNumber(dashboard.totalRevenue)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ingresos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Second Row */}
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Documentos', value: dashboard.overview.totalDocuments, icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-100' },
                  { label: 'Sensores', value: dashboard.overview.totalSensors, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-100' },
                  { label: 'Ubicaciones', value: dashboard.overview.totalLocations, icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-100' },
                  { label: 'API Keys', value: dashboard.overview.totalApiKeys, icon: Key, color: 'text-slate-600', bg: 'bg-slate-100' },
                  { label: 'Nuevos (mes)', value: dashboard.companiesThisMonth, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                ].map((item) => (
                  <motion.div key={item.label} variants={cardVariants}>
                    <Card className="border-slate-200">
                      <CardContent className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-800">{formatNumber(item.value)}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wide">{item.label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {/* Alert banners */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {dashboard.sensorsCritical > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <Zap className="w-5 h-5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">{dashboard.sensorsCritical} sensores en cr\u00edtico</p>
                        <p className="text-[10px] text-red-600">Requieren atenci\u00f3n inmediata</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {dashboard.documentsExpired > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">{dashboard.documentsExpired} documentos expirados</p>
                        <p className="text-[10px] text-amber-600">En toda la plataforma</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-slate-200">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{dashboard.permitsToday} permisos hoy</p>
                      <p className="text-[10px] text-slate-500">Actividad del d\u00eda</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Plan Distribution + Permits Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Distribuci\u00f3n por Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { plan: 'Enterprise', count: dashboard.byPlan.enterprise, color: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
                      { plan: 'Business', count: dashboard.byPlan.business, color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
                      { plan: 'Starter', count: dashboard.byPlan.starter, color: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
                    ].map((item) => {
                      const pct = dashboard.overview.totalCompanies > 0 ? (item.count / dashboard.overview.totalCompanies) * 100 : 0
                      return (
                        <div key={item.plan}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${item.badge}`}>{item.plan}</Badge>
                              <span className="text-xs font-semibold text-slate-700">{item.count}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Distribuci\u00f3n de Suscripciones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { status: 'Activo', count: dashboard.byStatus.ACTIVE || 0, color: 'bg-emerald-500' },
                      { status: 'Prueba', count: dashboard.byStatus.TRIAL || 0, color: 'bg-amber-500' },
                      { status: 'Vencido', count: dashboard.byStatus.PAST_DUE || 0, color: 'bg-red-500' },
                      { status: 'Cancelado', count: dashboard.byStatus.CANCELLED || 0, color: 'bg-slate-400' },
                    ].map((item) => {
                      const pct = dashboard.overview.totalCompanies > 0 ? (item.count / dashboard.overview.totalCompanies) * 100 : 0
                      return (
                        <div key={item.status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-700">{item.status}</span>
                            <span className="text-xs font-semibold text-slate-700">{item.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== TAB: COMPANIES ===== */}
        <TabsContent value="companies" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, email, tel\u00e9fono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="ACTIVE">Activo</SelectItem>
                <SelectItem value="TRIAL">Prueba</SelectItem>
                <SelectItem value="PAST_DUE">Vencido</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">M\u00e1s reciente</SelectItem>
                <SelectItem value="oldest">M\u00e1s antiguo</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="users">Usuarios</SelectItem>
                <SelectItem value="permits">Permisos</SelectItem>
                <SelectItem value="revenue">Ingresos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-500">
            Mostrando {filteredCompanies.length} de {companies.length} empresas
          </p>

          {/* Companies Table */}
          <Card className="border-slate-200">
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">{error}</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {searchQuery || filterPlan !== 'all' || filterStatus !== 'all' ? 'No se encontraron empresas con esos filtros.' : 'No hay empresas registradas.'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[65vh]">
                  {/* Table Header */}
                  <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Empresa</div>
                    <div className="col-span-1">Plan</div>
                    <div className="col-span-1">Estado</div>
                    <div className="col-span-1 text-center">Usuarios</div>
                    <div className="col-span-1 text-center">Permisos</div>
                    <div className="col-span-1 text-center">Sensores</div>
                    <div className="col-span-1 text-center">Docs</div>
                    <div className="col-span-1 text-center">Ingresos</div>
                    <div className="col-span-2 text-right">Acciones</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-slate-100">
                    {filteredCompanies.map((company) => {
                      const hasAlert = (company.sensorStats?.critical ?? 0) > 0 || (company.documentStats?.expired ?? 0) > 0 || !company.isActive
                      return (
                        <div
                          key={company.id}
                          className={`grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors items-center ${!company.isActive ? 'opacity-60' : ''}`}
                        >
                          {/* Name */}
                          <div className="col-span-3 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openCompanyDetail(company)}
                                className="text-sm font-medium text-slate-800 hover:text-emerald-700 truncate text-left transition-colors"
                                title="Ver detalle"
                              >
                                {company.name}
                              </button>
                              {!company.isActive && (
                                <Badge className="bg-red-100 text-red-600 border-0 text-[8px] px-1 shrink-0">Suspendida</Badge>
                              )}
                              {hasAlert && company.isActive && (
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Alerta activa" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{company.email}</p>
                          </div>

                          {/* Plan */}
                          <div className="col-span-1">
                            <Badge className={`${getPlanBadge(company.subscriptionPlan)} text-[10px] px-1.5 py-0`} variant="outline">
                              {company.subscriptionPlan === 'enterprise' && <Crown className="w-2.5 h-2.5 mr-0.5" />}
                              {company.subscriptionPlan.charAt(0).toUpperCase() + company.subscriptionPlan.slice(1)}
                            </Badge>
                          </div>

                          {/* Status */}
                          <div className="col-span-1">
                            <Badge className={`${getStatusBadge(company.subscriptionStatus)} text-[10px] px-1.5 py-0`} variant="outline">
                              {getStatusLabel(company.subscriptionStatus)}
                            </Badge>
                          </div>

                          {/* Users */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-700">{company._count?.users ?? 0}</span>
                            </div>
                          </div>

                          {/* Permits */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-700">{company._count?.permits ?? 0}</span>
                              {(company.permitStats?.pending ?? 0) > 0 && (
                                <span className="text-[8px] text-amber-600">({company.permitStats?.pending})</span>
                              )}
                            </div>
                          </div>

                          {/* Sensors */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Activity className="w-3 h-3 text-slate-400" />
                              <span className={`text-xs ${(company.sensorStats?.critical ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                                {company.sensorStats?.active ?? 0}
                              </span>
                              {(company.sensorStats?.critical ?? 0) > 0 && (
                                <span className="text-[8px] text-red-500">!</span>
                              )}
                            </div>
                          </div>

                          {/* Documents */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <FolderOpen className="w-3 h-3 text-slate-400" />
                              <span className={`text-xs ${(company.documentStats?.expired ?? 0) > 0 ? 'text-amber-600 font-semibold' : 'text-slate-700'}`}>
                                {company._count?.documents ?? 0}
                              </span>
                            </div>
                          </div>

                          {/* Revenue */}
                          <div className="col-span-1 text-center">
                            <span className="text-xs text-slate-700 font-medium">${(company.invoiceTotal ?? 0).toFixed(0)}</span>
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCompanyDetail(company)}
                              className="h-7 text-[10px] text-slate-500 hover:text-slate-700 gap-0.5"
                            >
                              <Eye className="w-3 h-3" />
                              Detalle
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(company)}
                              className="h-7 text-[10px] text-slate-500 hover:text-emerald-700 gap-0.5"
                            >
                              <Activity className="w-3 h-3" />
                              Gestionar
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: ACTIVITY ===== */}
        <TabsContent value="activity" className="space-y-4">
          {dashboard && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Actividad Reciente de la Plataforma</CardTitle>
                <CardDescription>\u00daltimos 20 eventos de auditor\u00eda de todas las empresas</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-1">
                    {dashboard.recentActivity.map((log, idx) => (
                      <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-700">{log.action}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-white">{log.entityType}</Badge>
                            {log.user && (
                              <span className="text-[10px] text-slate-400">por {log.user.name}</span>
                            )}
                          </div>
                          {log.details && (
                            <p className="text-[10px] text-slate-400 truncate max-w-md">
                              {log.details.length > 120 ? log.details.slice(0, 120) + '...' : log.details}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(log.createdAt)}</span>
                      </div>
                    ))}
                    {dashboard.recentActivity.length === 0 && (
                      <p className="text-sm text-slate-400 py-8 text-center">No hay actividad registrada a\u00fan.</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== DIALOG: Company Detail ===== */}
      <Dialog open={!!selectedCompany || loadingDetail} onOpenChange={(open) => { if (!open) setSelectedCompany(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              {loadingDetail ? 'Cargando...' : selectedCompany?.company.name}
            </DialogTitle>
            <DialogDescription>Detalle completo de la empresa</DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : selectedCompany ? (
            <ScrollArea className="max-h-[65vh] pr-1">
              <div className="space-y-4">
                {/* Company info */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Email" value={selectedCompany.company.email} />
                  <InfoItem label="Tel\u00e9fono" value={selectedCompany.company.phone || '—'} />
                  <InfoItem label="Direcci\u00f3n" value={selectedCompany.company.address || '—'} />
                  <InfoItem label="Creada" value={formatDate(selectedCompany.company.createdAt)} />
                  <InfoItem label="Plan" value={selectedCompany.company.subscriptionPlan}>
                    <Badge className={`${getPlanBadge(selectedCompany.company.subscriptionPlan)} ml-1`} variant="outline">
                      {selectedCompany.company.subscriptionPlan.charAt(0).toUpperCase() + selectedCompany.company.subscriptionPlan.slice(1)}
                    </Badge>
                  </InfoItem>
                  <InfoItem label="Estado" value="">
                    <Badge className={`${getStatusBadge(selectedCompany.company.subscriptionStatus)}`} variant="outline">
                      {getStatusLabel(selectedCompany.company.subscriptionStatus)}
                    </Badge>
                    {!selectedCompany.company.isActive && (
                      <Badge className="bg-red-100 text-red-600 border-0 text-[9px] ml-1">Suspendida</Badge>
                    )}
                  </InfoItem>
                  <InfoItem label="Expira" value={formatDate(selectedCompany.company.subscriptionExpiresAt)} />
                  <InfoItem label="\u00daltima actividad" value={timeAgo(selectedCompany.company.lastActivity ?? null)} />
                  <InfoItem label="Max Usuarios" value={`${selectedCompany.company._count?.users ?? 0} / ${selectedCompany.company.maxUsers}`} />
                  <InfoItem label="Max Permisos/Mes" value={`${selectedCompany.company._count?.permits ?? 0} / ${selectedCompany.company.maxPermitsPerMonth}`} />
                  <InfoItem label="Ingresos totales" value={`$${(selectedCompany.company.invoiceTotal ?? 0).toFixed(2)}`} />
                  <InfoItem label="Stripe" value={selectedCompany.company.stripeCustomerId ? 'Vinculado' : 'Demo'} />
                </div>

                <Separator />

                {/* Quick stats */}
                <div className="grid grid-cols-4 gap-2">
                  <MiniStat label="Sensores" value={selectedCompany.company.sensorStats?.active ?? 0} sub={`${selectedCompany.company.sensorStats?.critical ?? 0} cr\u00edticos`} alert={(selectedCompany.company.sensorStats?.critical ?? 0) > 0} />
                  <MiniStat label="Locaciones" value={selectedCompany.company._count?.workLocations ?? 0} />
                  <MiniStat label="API Keys" value={selectedCompany.company._count?.apiKeys ?? 0} />
                  <MiniStat label="Soporte" value={selectedCompany.unreadSupport} sub="no le\u00eddos" alert={selectedCompany.unreadSupport > 0} />
                </div>

                <Separator />

                {/* Users */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Usuarios ({selectedCompany.users.length})
                  </h4>
                  <div className="space-y-1">
                    {selectedCompany.users.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-slate-50">
                        <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{u.name}</span>
                        <Badge className="text-[9px] px-1.5 py-0 bg-slate-200 text-slate-600 border-0">{u.role}</Badge>
                        {!u.isActive && <Badge className="text-[9px] px-1 py-0 bg-red-100 text-red-600 border-0">Inactivo</Badge>}
                        <span className="text-[9px] text-slate-400">{timeAgo(u.lastLoginAt)}</span>
                      </div>
                    ))}
                    {selectedCompany.users.length === 0 && <p className="text-xs text-slate-400 py-2">Sin usuarios</p>}
                  </div>
                </div>

                <Separator />

                {/* Recent permits */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Permisos recientes
                  </h4>
                  <div className="space-y-1">
                    {selectedCompany.recentPermits.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-slate-50">
                        <span className="text-xs font-mono text-slate-600">{p.permitNumber}</span>
                        <Badge className={`text-[9px] px-1 py-0 border-0 ${
                          p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          p.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{p.status}</Badge>
                        <Badge className="text-[9px] px-1 py-0 bg-slate-200 text-slate-600 border-0">{p.riskType}</Badge>
                        <span className="text-[9px] text-slate-400 ml-auto">{formatDateTime(p.createdAt)}</span>
                      </div>
                    ))}
                    {selectedCompany.recentPermits.length === 0 && <p className="text-xs text-slate-400 py-2">Sin permisos</p>}
                  </div>
                </div>

                {/* Recent audit */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Logs recientes
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedCompany.auditLogs.slice(0, 15).map((log) => (
                      <div key={log.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 text-[10px]">
                        {getActionIcon(log.action)}
                        <span className="font-medium text-slate-700">{log.action}</span>
                        <Badge className="text-[8px] px-1 py-0 bg-white border">{log.entityType}</Badge>
                        {log.user && <span className="text-slate-400">por {log.user.name}</span>}
                        <span className="text-slate-400 ml-auto">{timeAgo(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}

          {!loadingDetail && selectedCompany && (
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">Cerrar</Button>
              </DialogClose>
              <Button size="sm" onClick={() => { setSelectedCompany(null); openEditDialog(selectedCompany.company) }} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Gestionar Plan
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: Edit/Manage Company ===== */}
      <Dialog open={!!editCompany} onOpenChange={(open) => { if (!open) setEditCompany(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Gestionar: {editCompany?.name}
            </DialogTitle>
            <DialogDescription>Modifica el plan, estado y l\u00edmites de la empresa</DialogDescription>
          </DialogHeader>

          {editCompany && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-slate-500">Empresa: <span className="font-semibold text-slate-700">{editCompany.name}</span></p>
                <p className="text-xs text-slate-500">Email: <span className="text-slate-700">{editCompany.email}</span></p>
                <p className="text-xs text-slate-500">Plan actual: <Badge className={`${getPlanBadge(editCompany.subscriptionPlan)} text-[9px] px-1 py-0`} variant="outline">{editCompany.subscriptionPlan}</Badge></p>
              </div>

              {/* Plan */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Plan de suscripci\u00f3n</label>
                <Select value={editForm.subscriptionPlan} onValueChange={(v) => setEditForm((f) => ({ ...f, subscriptionPlan: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter — $149/mes</SelectItem>
                    <SelectItem value="business">Business — $499/mes</SelectItem>
                    <SelectItem value="enterprise">Enterprise — Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Estado de suscripci\u00f3n</label>
                <Select value={editForm.subscriptionStatus} onValueChange={(v) => setEditForm((f) => ({ ...f, subscriptionStatus: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Prueba (Trial)</SelectItem>
                    <SelectItem value="ACTIVE">Activo</SelectItem>
                    <SelectItem value="PAST_DUE">Vencido (Past Due)</SelectItem>
                    <SelectItem value="CANCELLED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-xs font-medium text-slate-700">Empresa activa</p>
                  <p className="text-[10px] text-slate-500">Si se desactiva, el acceso se bloquea</p>
                </div>
                <Button
                  variant={editForm.isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`gap-1.5 h-8 ${editForm.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-600'}`}
                >
                  {editForm.isActive ? <><Play className="w-3 h-3" /> Activa</> : <><Pause className="w-3 h-3" /> Suspendida</>}
                </Button>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">M\u00e1x. usuarios</label>
                  <Input
                    type="number"
                    value={editForm.maxUsers}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxUsers: parseInt(e.target.value) || 0 }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">M\u00e1x. permisos/mes</label>
                  <Input
                    type="number"
                    value={editForm.maxPermitsPerMonth}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxPermitsPerMonth: parseInt(e.target.value) || 0 }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Fecha de expiraci\u00f3n</label>
                <Input
                  type="date"
                  value={editForm.subscriptionExpiresAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, subscriptionExpiresAt: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={saving}>Cancelar</Button>
            </DialogClose>
            <Button size="sm" onClick={handleSaveCompany} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><CheckCircle className="w-3.5 h-3.5" /> Guardar Cambios</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Sub-components ============

function InfoItem({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-slate-800 mt-0.5">{value}{children}</p>
    </div>
  )
}

function MiniStat({ label, value, sub, alert }: { label: string; value: number; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${alert ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
      <p className={`text-lg font-bold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[9px] text-slate-500">{label}</p>
      {sub && <p className={`text-[8px] ${alert ? 'text-red-500' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}
