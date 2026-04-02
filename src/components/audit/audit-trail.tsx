'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Search, Filter, Activity, Users, FileText, CheckCircle2, XCircle,
  Clock, ChevronLeft, ChevronRight,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

interface AuditLog {
  id: string
  companyId: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: { id: string; name: string; email: string; role: string } | null
}

interface AuditSummary {
  totalLogs: number
  todayLogs: number
  uniqueUsers: number
  permitsCreated: number
  permitsApproved: number
  permitsRejected: number
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  LOGIN: { label: 'Login', color: 'bg-blue-100 text-blue-700' },
  LOGOUT: { label: 'Logout', color: 'bg-slate-100 text-slate-600' },
  CREATE: { label: 'Creación', color: 'bg-emerald-100 text-emerald-700' },
  UPDATE: { label: 'Actualización', color: 'bg-amber-100 text-amber-700' },
  DELETE: { label: 'Eliminación', color: 'bg-red-100 text-red-700' },
  APPROVE: { label: 'Aprobación', color: 'bg-emerald-100 text-emerald-700' },
  REJECT: { label: 'Rechazo', color: 'bg-red-100 text-red-700' },
  VIEW: { label: 'Visualización', color: 'bg-slate-100 text-slate-600' },
}

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  USER: { label: 'Usuario', color: 'bg-blue-100 text-blue-700' },
  PERMIT: { label: 'Permiso', color: 'bg-emerald-100 text-emerald-700' },
  DOCUMENT: { label: 'Documento HSE', color: 'bg-amber-100 text-amber-700' },
  COMPANY: { label: 'Empresa', color: 'bg-purple-100 text-purple-700' },
  SIGNATURE: { label: 'Firma', color: 'bg-rose-100 text-rose-700' },
  WORK_LOCATION: { label: 'Ubicación', color: 'bg-cyan-100 text-cyan-700' },
  RISK_TYPE: { label: 'Tipo Riesgo', color: 'bg-orange-100 text-orange-700' },
  CHECKLIST_ITEM: { label: 'Checklist', color: 'bg-teal-100 text-teal-700' },
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 25

  useEffect(() => {
    loadAuditLogs()
  }, [entityFilter, actionFilter, dateFrom, dateTo, page])

  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })
      if (entityFilter !== 'ALL') params.set('entityType', entityFilter)
      if (actionFilter !== 'ALL') params.set('action', actionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const data = await apiFetch<{
        logs: AuditLog[]
        summary: AuditSummary
        pagination: { total: number; totalPages: number }
      }>(`/audit?${params.toString()}`)

      setLogs(data.logs || [])
      setSummary(data.summary || null)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch {
      setLogs([])
      setSummary({
        totalLogs: 0,
        todayLogs: 0,
        uniqueUsers: 0,
        permitsCreated: 0,
        permitsApproved: 0,
        permitsRejected: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const filtered = logs.filter((log) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (log.user?.name?.toLowerCase().includes(q)) ||
      log.action.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      (log.details?.toLowerCase().includes(q))
    )
  })

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Hace un momento'
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <User className="w-4 h-4 text-blue-500" />
      case 'CREATE': return <FileText className="w-4 h-4 text-emerald-500" />
      case 'APPROVE': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'REJECT': return <XCircle className="w-4 h-4 text-red-500" />
      case 'DELETE': return <XCircle className="w-4 h-4 text-red-400" />
      case 'UPDATE': return <Activity className="w-4 h-4 text-amber-500" />
      default: return <Activity className="w-4 h-4 text-slate-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Total Eventos', value: summary.totalLogs, icon: Activity, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Hoy', value: summary.todayLogs, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Usuarios Activos', value: summary.uniqueUsers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Permisos Creados', value: summary.permitsCreated, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Permisos Aprobados', value: summary.permitsApproved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Permisos Rechazados', value: summary.permitsRejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="shadow-sm border-slate-200">
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <div className={cn('p-1.5 rounded-md', stat.bg)}>
                      <Icon className={cn('w-4 h-4', stat.color)} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                      <p className="text-[10px] text-slate-500">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5" />
              Filtros
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por usuario, acción, detalle..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Entidad</p>
                <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="PERMIT">Permiso</SelectItem>
                    <SelectItem value="DOCUMENT">Documento HSE</SelectItem>
                    <SelectItem value="USER">Usuario</SelectItem>
                    <SelectItem value="SIGNATURE">Firma</SelectItem>
                    <SelectItem value="WORK_LOCATION">Ubicación</SelectItem>
                    <SelectItem value="RISK_TYPE">Tipo Riesgo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Acción</p>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="CREATE">Creación</SelectItem>
                    <SelectItem value="APPROVE">Aprobación</SelectItem>
                    <SelectItem value="REJECT">Rechazo</SelectItem>
                    <SelectItem value="LOGIN">Login</SelectItem>
                    <SelectItem value="UPDATE">Actualización</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Desde</p>
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Hasta</p>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-8 text-xs" />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-600 w-10"></TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Usuario</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Acción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Entidad</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden lg:table-cell">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="text-center py-3 text-xs text-slate-400">Cargando...</TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-slate-400">
                    No se encontraron registros de auditoría
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action]
                  const entityCfg = ENTITY_CONFIG[log.entityType]
                  let detailStr = ''
                  if (log.details) {
                    try { detailStr = JSON.stringify(JSON.parse(log.details), null, 0).substring(0, 80) } catch { detailStr = log.details.substring(0, 80) }
                  }
                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="p-2">{getActionIcon(log.action)}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatTime(log.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {log.user?.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{log.user?.name || 'Sistema'}</p>
                            <p className="text-[10px] text-slate-400">{log.user?.role || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px] border', actionCfg?.color || 'bg-slate-100 text-slate-600')}>
                          {actionCfg?.label || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className={cn('text-[10px] border', entityCfg?.color || 'bg-slate-100 text-slate-600')}>
                          {entityCfg?.label || log.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-[10px] text-slate-500 truncate max-w-[200px] font-mono">{detailStr || '—'}</p>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              if (p > totalPages) return null
              return (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(p)}>
                  {p}
                </Button>
              )
            })}
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
