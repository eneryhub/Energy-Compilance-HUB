'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
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
  Activity,
  BarChart3,
  FileWarning,
  Settings,
  Ban,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { apiFetch } from '@/lib/api'

// ============ Types ============

interface AdminCompany {
  id: string
  name: string
  email: string
  subscriptionPlan: string
  subscriptionStatus: string
  createdAt: string
  maxUsers: number
  maxPermitsPerMonth: number
  isActive: boolean
  _count: { users: number; permits: number }
}

interface AdminAuditLog {
  id: string
  action: string
  entityType: string
  details: string | null
  createdAt: string
  user: { name: string } | null
}

interface DashboardStats {
  totalCompanies: number
  activeCompanies: number
  trialCompanies: number
  pastDueCompanies: number
  totalUsers: number
  totalPermits: number
  planDistribution: Record<string, number>
  recentActivity: AdminAuditLog[]
}

// ============ Helpers ============

function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback
  return String(val)
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function capitalizePlan(plan: string): string {
  const p = safeStr(plan, 'starter')
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function formatStatus(status: string): string {
  return safeStr(status, 'UNKNOWN').replace(/_/g, ' ')
}

function getStatusBadge(status: string) {
  switch (safeStr(status)) {
    case 'TRIAL':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'PAST_DUE':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-500 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getPlanBadge(plan: string) {
  switch (safeStr(plan)) {
    case 'enterprise':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'business':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'starter':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getActionIcon(action: string) {
  switch (safeStr(action)) {
    case 'LOGIN': return <Clock className="w-3.5 h-3.5 text-blue-500" />
    case 'CREATE': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'APPROVE': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'REJECT': return <XCircle className="w-3.5 h-3.5 text-red-500" />
    case 'UPDATE': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
    case 'DELETE': return <XCircle className="w-3.5 h-3.5 text-red-500" />
    default: return <Eye className="w-3.5 h-3.5 text-slate-400" />
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

// ============ Animation variants ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}

// ============ Tab type ============

type AdminTab = 'overview' | 'companies' | 'activity'

// ============ Main Component ============

export default function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  // Companies state
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')

  // Dialog state
  const [activatingCompany, setActivatingCompany] = useState<AdminCompany | null>(null)
  const [activating, setActivating] = useState(false)
  const [managingCompany, setManagingCompany] = useState<AdminCompany | null>(null)
  const [managing, setManaging] = useState(false)

  // Expanded row state
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    setCompaniesError(null)
    try {
      const res = await apiFetch<{ companies: AdminCompany[] }>('/admin/companies')
      if (Array.isArray(res?.companies)) {
        setCompanies(res.companies)
      } else {
        setCompanies([])
      }
    } catch (err: any) {
      setCompaniesError(err?.message || 'Error al cargar empresas')
      setCompanies([])
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await apiFetch<DashboardStats>('/admin/dashboard')
      if (res && typeof res === 'object') {
        setDashboardStats(res)
      }
    } catch {
      // Dashboard stats are non-critical, build from companies data instead
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
    fetchDashboardStats()
  }, [fetchCompanies, fetchDashboardStats])

  // Fetch audit logs for expanded company
  const fetchAuditLogs = useCallback(async (companyId: string) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null)
      setAuditLogs([])
      return
    }
    setExpandedCompanyId(companyId)
    setLoadingLogs(true)
    try {
      const res = await apiFetch<{ logs: AdminAuditLog[] }>(`/admin/audit-logs?companyId=${companyId}`)
      if (Array.isArray(res?.logs)) {
        setAuditLogs(res.logs)
      } else {
        setAuditLogs([])
      }
    } catch {
      setAuditLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [expandedCompanyId])

  // Activate enterprise
  const handleActivateEnterprise = async () => {
    if (!activatingCompany) return
    setActivating(true)
    try {
      await apiFetch('/admin/activate-enterprise', {
        method: 'POST',
        body: JSON.stringify({ companyId: activatingCompany.id }),
      })
      setActivatingCompany(null)
      fetchCompanies()
      fetchDashboardStats()
    } catch (err: any) {
      alert(err?.message || 'Error al activar plan Enterprise')
    } finally {
      setActivating(false)
    }
  }

  // Manage company (update plan/status)
  const handleManageCompany = async (updates: { plan?: string; status?: string; maxUsers?: number; maxPermits?: number }) => {
    if (!managingCompany) return
    setManaging(true)
    try {
      await apiFetch(`/admin/company/${managingCompany.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      setManagingCompany(null)
      fetchCompanies()
      fetchDashboardStats()
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar empresa')
    } finally {
      setManaging(false)
    }
  }

  // ============ Computed stats (fallback if dashboard API fails) ============

  const stats = useMemo(() => {
    if (dashboardStats) return dashboardStats

    const totalCompanies = companies.length
    const activeCompanies = companies.filter((c) => c.subscriptionStatus === 'ACTIVE').length
    const trialCompanies = companies.filter((c) => c.subscriptionStatus === 'TRIAL').length
    const pastDueCompanies = companies.filter((c) => c.subscriptionStatus === 'PAST_DUE').length
    const totalUsers = companies.reduce((sum, c) => sum + safeNum(c._count?.users), 0)
    const totalPermits = companies.reduce((sum, c) => sum + safeNum(c._count?.permits), 0)
    const planDistribution: Record<string, number> = {}
    companies.forEach((c) => {
      const plan = safeStr(c.subscriptionPlan, 'starter')
      planDistribution[plan] = (planDistribution[plan] || 0) + 1
    })

    return {
      totalCompanies,
      activeCompanies,
      trialCompanies,
      pastDueCompanies,
      totalUsers,
      totalPermits,
      planDistribution,
      recentActivity: [],
    }
  }, [dashboardStats, companies])

  // Filter & sort companies
  const filteredCompanies = useMemo(() => {
    let result = [...companies]

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          safeStr(c.name).toLowerCase().includes(q) ||
          safeStr(c.email).toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.subscriptionStatus === statusFilter)
    }

    // Plan filter
    if (planFilter !== 'all') {
      result = result.filter((c) => c.subscriptionPlan === planFilter)
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'name':
        result.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)))
        break
      case 'users':
        result.sort((a, b) => safeNum(b._count?.users) - safeNum(a._count?.users))
        break
      case 'permits':
        result.sort((a, b) => safeNum(b._count?.permits) - safeNum(a._count?.permits))
        break
    }

    return result
  }, [companies, searchQuery, statusFilter, planFilter, sortBy])

  // ============ Render ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Centro de Mando — Super Admin
          </h2>
          <p className="text-xs text-slate-500">
            Administraci\u00f3n global de la plataforma
          </p>
        </div>
        <Badge className="bg-red-100 text-red-700 border-red-200 ml-2">
          <Crown className="w-3 h-3 mr-1" />
          SUPER_ADMIN
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {([
          { key: 'overview', label: 'Resumen', icon: BarChart3 },
          { key: 'companies', label: 'Empresas', icon: Building2 },
          { key: 'activity', label: 'Actividad', icon: Activity },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW TAB ============ */}
      {activeTab === 'overview' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={cardVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">
                        {loadingStats ? '—' : stats.totalCompanies}
                      </p>
                      <p className="text-xs text-slate-500">Total empresas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">
                        {loadingStats ? '—' : stats.activeCompanies}
                      </p>
                      <p className="text-xs text-slate-500">Activas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {loadingStats ? '—' : stats.totalUsers}
                      </p>
                      <p className="text-xs text-slate-500">Total usuarios</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-violet-600">
                        {loadingStats ? '—' : stats.totalPermits}
                      </p>
                      <p className="text-xs text-slate-500">Total permisos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Plan Distribution + Trial/PastDue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Distribution */}
            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    Distribuci\u00f3n por Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {(['enterprise', 'business', 'starter'] as const).map((plan) => {
                      const count = stats.planDistribution?.[plan] ?? 0
                      const total = Math.max(stats.totalCompanies, 1)
                      const pct = Math.round((count / total) * 100)
                      const colors: Record<string, string> = {
                        enterprise: 'bg-purple-500',
                        business: 'bg-blue-500',
                        starter: 'bg-slate-400',
                      }
                      return (
                        <div key={plan} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">
                              {plan === 'enterprise' && <Crown className="w-3 h-3 inline mr-1 text-purple-500" />}
                              {capitalizePlan(plan)}
                            </span>
                            <span className="text-slate-500">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors[plan] || 'bg-slate-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Status Summary */}
            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    Estado de Suscripciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {[
                      { status: 'ACTIVE', label: 'Activas', color: 'text-emerald-600', bg: 'bg-emerald-500', icon: CheckCircle },
                      { status: 'TRIAL', label: 'En Trial', color: 'text-amber-600', bg: 'bg-amber-500', icon: Clock },
                      { status: 'PAST_DUE', label: 'Vencidas', color: 'text-red-600', bg: 'bg-red-500', icon: AlertTriangle },
                      { status: 'CANCELLED', label: 'Canceladas', color: 'text-slate-400', bg: 'bg-slate-300', icon: XCircle },
                    ].map(({ status, label, color, bg, icon: Icon }) => {
                      const count = status === 'ACTIVE' ? stats.activeCompanies
                        : status === 'TRIAL' ? stats.trialCompanies
                        : status === 'PAST_DUE' ? stats.pastDueCompanies
                        : companies.filter((c) => c.subscriptionStatus === status).length
                      const total = Math.max(stats.totalCompanies, 1)
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${bg} bg-opacity-10 flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{label}</span>
                              <span className={color}>{count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${bg}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div variants={cardVariants}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" />
                  Acciones R\u00e1pidas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('companies')}
                    className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  >
                    <Building2 className="w-5 h-5 text-slate-500" />
                    Gestionar Empresas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('activity')}
                    className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  >
                    <Activity className="w-5 h-5 text-slate-500" />
                    Ver Actividad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { fetchCompanies(); fetchDashboardStats() }}
                    className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  >
                    <RefreshCw className="w-5 h-5 text-slate-500" />
                    Actualizar Datos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('companies')}
                    className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                  >
                    <FileWarning className="w-5 h-5 text-slate-500" />
                    Alertas Cr\u00edticas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ============ COMPANIES TAB ============ */}
      {activeTab === 'companies' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* Filters */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-32 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ACTIVE">Activos</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="PAST_DUE">Vencidos</SelectItem>
                      <SelectItem value="CANCELLED">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="h-9 w-32 text-xs">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 w-36 text-xs">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Más recientes</SelectItem>
                      <SelectItem value="oldest">Más antiguos</SelectItem>
                      <SelectItem value="name">Nombre A-Z</SelectItem>
                      <SelectItem value="users">Más usuarios</SelectItem>
                      <SelectItem value="permits">Más permisos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Companies Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Empresas Registradas
                  {!loadingCompanies && (
                    <span className="text-xs font-normal text-slate-400 ml-2">
                      {filteredCompanies.length} de {companies.length}
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCompanies ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : companiesError ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-3">{companiesError}</p>
                  <Button variant="outline" size="sm" onClick={fetchCompanies} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reintentar
                  </Button>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {searchQuery || statusFilter !== 'all' || planFilter !== 'all'
                      ? 'No se encontraron empresas con esos filtros.'
                      : 'No hay empresas registradas.'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  {/* Table Header */}
                  <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Nombre</div>
                    <div className="col-span-2">Plan</div>
                    <div className="col-span-2">Estado</div>
                    <div className="col-span-1 text-center">Usuarios</div>
                    <div className="col-span-1 text-center">Permisos</div>
                    <div className="col-span-1">Creada</div>
                    <div className="col-span-2 text-right">Acciones</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-slate-100">
                    {filteredCompanies.map((company) => (
                      <div key={company.id}>
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-50 transition-colors items-center">
                          {/* Name */}
                          <div className="col-span-3 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {safeStr(company.name, 'Sin nombre')}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{safeStr(company.email)}</p>
                          </div>

                          {/* Plan */}
                          <div className="col-span-2">
                            <Badge className={getPlanBadge(company.subscriptionPlan)} variant="outline">
                              {company.subscriptionPlan === 'enterprise' && <Crown className="w-3 h-3 mr-1" />}
                              {capitalizePlan(company.subscriptionPlan)}
                            </Badge>
                          </div>

                          {/* Status */}
                          <div className="col-span-2">
                            <Badge className={getStatusBadge(company.subscriptionStatus)} variant="outline">
                              {company.subscriptionStatus === 'ACTIVE' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {company.subscriptionStatus === 'PAST_DUE' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {company.subscriptionStatus === 'CANCELLED' && <Ban className="w-3 h-3 mr-1" />}
                              {formatStatus(company.subscriptionStatus)}
                            </Badge>
                          </div>

                          {/* Users */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm text-slate-700">
                                {safeNum(company._count?.users)}
                              </span>
                            </div>
                          </div>

                          {/* Permits */}
                          <div className="col-span-1 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm text-slate-700">
                                {safeNum(company._count?.permits)}
                              </span>
                            </div>
                          </div>

                          {/* Created */}
                          <div className="col-span-1">
                            <p className="text-xs text-slate-500">
                              {formatDate(company.createdAt)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchAuditLogs(company.id)}
                              className="h-7 text-xs text-slate-500 hover:text-slate-700 gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Logs
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManagingCompany(company)}
                              className="h-7 text-xs text-slate-500 hover:text-slate-700 gap-1"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </Button>
                            {company.subscriptionPlan !== 'enterprise' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivatingCompany(company)}
                                className="h-7 text-xs text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 gap-1"
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Audit Logs */}
                        {expandedCompanyId === company.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-50 border-t border-slate-200 px-4 py-3"
                          >
                            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              \u00daltimos logs de auditor\u00eda — {safeStr(company.name)}
                            </p>
                            {loadingLogs ? (
                              <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                  <Skeleton key={i} className="h-8 w-full rounded" />
                                ))}
                              </div>
                            ) : auditLogs.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                No hay registros de auditor\u00eda para esta empresa.
                              </p>
                            ) : (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {auditLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-white transition-colors"
                                  >
                                    {getActionIcon(log.action)}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-700">
                                          {safeStr(log.action)}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                          {safeStr(log.entityType)}
                                        </Badge>
                                        {log.user?.name && (
                                          <span className="text-[10px] text-slate-400">
                                            por {safeStr(log.user.name)}
                                          </span>
                                        )}
                                      </div>
                                      {log.details && (
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {safeStr(log.details).length > 100
                                            ? safeStr(log.details).slice(0, 100) + '...'
                                            : safeStr(log.details)}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                                      {formatDateTime(log.createdAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============ ACTIVITY TAB ============ */}
      {activeTab === 'activity' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Actividad Reciente de la Plataforma
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchDashboardStats} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : !stats.recentActivity || stats.recentActivity.length === 0 ? (
                <div className="p-8 text-center">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    No hay actividad reciente. Los logs se mostrar\u00e1n aqu\u00ed.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-1">
                    {stats.recentActivity.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {getActionIcon(log.action)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-700">
                              {safeStr(log.action)}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {safeStr(log.entityType)}
                            </Badge>
                            {log.user?.name && (
                              <span className="text-[10px] text-slate-400">
                                por {safeStr(log.user.name)}
                              </span>
                            )}
                          </div>
                          {log.details && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {safeStr(log.details).length > 120
                                ? safeStr(log.details).slice(0, 120) + '...'
                                : safeStr(log.details)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Enterprise Activation Dialog */}
      <Dialog
        open={!!activatingCompany}
        onOpenChange={(open) => {
          if (!open) setActivatingCompany(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              Activar Plan Enterprise
            </DialogTitle>
            <DialogDescription>
              Esta acci\u00f3n otorgar\u00e1 acceso completo y sin l\u00edmites a la empresa.
            </DialogDescription>
          </DialogHeader>

          {activatingCompany && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">
                    {safeStr(activatingCompany.name)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{safeStr(activatingCompany.email)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getPlanBadge(activatingCompany.subscriptionPlan)} variant="outline">
                    {capitalizePlan(activatingCompany.subscriptionPlan)}
                  </Badge>
                  <span className="text-xs text-slate-400">&rarr;</span>
                  <Badge className={getPlanBadge('enterprise')} variant="outline">
                    <Crown className="w-3 h-3 mr-1" />
                    Enterprise
                  </Badge>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Se otorgar\u00e1n 999,999 usuarios y permisos ilimitados por 1 a\u00f1o. Esta acci\u00f3n quedar\u00e1 registrada en el log de auditor\u00eda.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={activating}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={handleActivateEnterprise}
              disabled={activating}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {activating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activando...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Confirmar Activaci\u00f3n
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Company Dialog */}
      <Dialog
        open={!!managingCompany}
        onOpenChange={(open) => {
          if (!open) setManagingCompany(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" />
              Gestionar Empresa
            </DialogTitle>
            <DialogDescription>
              Modificar plan, estado y l\u00edmites de la empresa.
            </DialogDescription>
          </DialogHeader>

          {managingCompany && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">
                    {safeStr(managingCompany.name)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{safeStr(managingCompany.email)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Plan</label>
                  <Select
                    defaultValue={managingCompany.subscriptionPlan}
                    onValueChange={(val) =>
                      handleManageCompany({ plan: val })
                    }
                    disabled={managing}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Estado</label>
                  <Select
                    defaultValue={managingCompany.subscriptionStatus}
                    onValueChange={(val) =>
                      handleManageCompany({ status: val })
                    }
                    disabled={managing}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="PAST_DUE">Vencido</SelectItem>
                      <SelectItem value="CANCELLED">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Los cambios se aplicar\u00e1n inmediatamente. El usuario deber\u00e1 cerrar sesi\u00f3n y volver a entrar para ver los cambios.
                </p>
              </div>

              {managing && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Aplicando cambios...
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={managing}>
                Cerrar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
