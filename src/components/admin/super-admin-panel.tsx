'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { apiFetch } from '@/lib/api'

// ============ Types ============

interface AdminCompany {
  id: string
  name: string
  email: string
  subscriptionPlan: string
  subscriptionStatus: string
  createdAt: string
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

// ============ Helpers ============

function getStatusBadge(status: string) {
  switch (status) {
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
  switch (plan) {
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

// ============ Main Component ============

export default function SuperAdminPanel() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [activatingCompany, setActivatingCompany] = useState<AdminCompany | null>(null)
  const [activating, setActivating] = useState(false)

  // Expanded row state
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ companies: AdminCompany[] }>('/admin/companies')
      setCompanies(res.companies)
    } catch (err: any) {
      setError(err.message || 'Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

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
      setAuditLogs(res.logs)
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
    } catch (err: any) {
      alert(err.message || 'Error al activar plan Enterprise')
    } finally {
      setActivating(false)
    }
  }

  // Computed stats
  const totalCompanies = companies.length
  const activeCompanies = companies.filter((c) => c.subscriptionStatus === 'ACTIVE').length
  const trialCompanies = companies.filter((c) => c.subscriptionStatus === 'TRIAL').length
  const pastDueCompanies = companies.filter((c) => c.subscriptionStatus === 'PAST_DUE').length

  // Filter companies by search
  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      {/* Stats Row */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{loading ? '—' : totalCompanies}</p>
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
                  <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : activeCompanies}</p>
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
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{loading ? '—' : trialCompanies}</p>
                  <p className="text-xs text-slate-500">Trial</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{loading ? '—' : pastDueCompanies}</p>
                  <p className="text-xs text-slate-500">Past Due</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Companies Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold text-slate-800">
              Empresas Registradas
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No se encontraron empresas con ese filtro.' : 'No hay empresas registradas.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              {/* Table Header */}
              <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-3">Nombre</div>
                <div className="col-span-2">Plan</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-1 text-center">Usuarios</div>
                <div className="col-span-2">Creada</div>
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
                          {company.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{company.email}</p>
                      </div>

                      {/* Plan */}
                      <div className="col-span-2">
                        <Badge className={getPlanBadge(company.subscriptionPlan)} variant="outline">
                          {company.subscriptionPlan === 'enterprise' && <Crown className="w-3 h-3 mr-1" />}
                          {company.subscriptionPlan.charAt(0).toUpperCase() + company.subscriptionPlan.slice(1)}
                        </Badge>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <Badge className={getStatusBadge(company.subscriptionStatus)} variant="outline">
                          {company.subscriptionStatus === 'ACTIVE' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {company.subscriptionStatus === 'PAST_DUE' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {company.subscriptionStatus === 'CANCELLED' && <XCircle className="w-3 h-3 mr-1" />}
                          {company.subscriptionStatus.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Users */}
                      <div className="col-span-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">{company._count.users}</span>
                        </div>
                      </div>

                      {/* Created */}
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">
                          {new Date(company.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchAuditLogs(company.id)}
                          className="h-7 text-xs text-slate-500 hover:text-slate-700 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Logs
                        </Button>
                        {company.subscriptionPlan !== 'enterprise' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivatingCompany(company)}
                            className="h-7 text-xs text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 gap-1"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            Activar Enterprise
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
                          \u00daltimos logs de auditor\u00eda — {company.name}
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
                                      {log.action}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                      {log.entityType}
                                    </Badge>
                                    {log.user && (
                                      <span className="text-[10px] text-slate-400">
                                        por {log.user.name}
                                      </span>
                                    )}
                                  </div>
                                  {log.details && (
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {log.details.length > 100
                                        ? log.details.slice(0, 100) + '...'
                                        : log.details}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                  {new Date(log.createdAt).toLocaleString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
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
                    {activatingCompany.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{activatingCompany.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getPlanBadge(activatingCompany.subscriptionPlan)} variant="outline">
                    {activatingCompany.subscriptionPlan.charAt(0).toUpperCase() + activatingCompany.subscriptionPlan.slice(1)}
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
    </div>
  )
}
