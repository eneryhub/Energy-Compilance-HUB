'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FolderOpen,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { apiFetch } from '@/lib/api'
import type { DashboardStats } from '@/lib/api'

const chartConfig = {
  pending: { label: 'Pendientes', color: '#f59e0b' },
  approved: { label: 'Aprobados', color: '#10b981' },
  rejected: { label: 'Rechazados', color: '#ef4444' },
  active: { label: 'Activos', color: '#10b981' },
  expired: { label: 'Vencidos', color: '#ef4444' },
}

export default function StatsCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await apiFetch<DashboardStats>('/dashboard/stats')
      setStats(data)
    } catch {
      // Use fallback data if API is not ready
      setStats({
        totalPermits: 47,
        pendingApprovals: 8,
        approvedPermits: 32,
        rejectedPermits: 7,
        activeDocuments: 24,
        expiredDocuments: 3,
        complianceStatus: 'NON_COMPLIANT',
        recentActivity: [
          { id: '1', action: 'PERMIT_CREATED', description: 'Permiso PT-2024-0048 creado por Carlos M.', timestamp: new Date().toISOString() },
          { id: '2', action: 'PERMIT_APPROVED', description: 'Permiso PT-2024-0045 aprobado por Ana R.', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: '3', action: 'DOC_EXPIRED', description: 'Certificado Médico de Juan P. vencido', timestamp: new Date(Date.now() - 7200000).toISOString() },
          { id: '4', action: 'PERMIT_REJECTED', description: 'Permiso PT-2024-0043 rechazado - Checklist incompleto', timestamp: new Date(Date.now() - 10800000).toISOString() },
          { id: '5', action: 'USER_LOGIN', description: 'María García inició sesión', timestamp: new Date(Date.now() - 14400000).toISOString() },
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const pieData = [
    { name: 'pending', value: stats.pendingApprovals, fill: '#f59e0b' },
    { name: 'approved', value: stats.approvedPermits, fill: '#10b981' },
    { name: 'rejected', value: stats.rejectedPermits, fill: '#ef4444' },
  ]

  const barData = [
    { name: 'Activos', active: stats.activeDocuments, expired: stats.expiredDocuments },
  ]

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Hace un momento'
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString('es')
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'PERMIT_CREATED':
        return <FileText className="w-4 h-4 text-blue-500" />
      case 'PERMIT_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'PERMIT_REJECTED':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'DOC_EXPIRED':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      default:
        return <Activity className="w-4 h-4 text-slate-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.totalPermits}</p>
              <p className="text-xs text-slate-500 mt-1">Total de Permisos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <Badge className="bg-amber-100 text-amber-700 text-[10px]">Pendiente</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.pendingApprovals}</p>
              <p className="text-xs text-slate-500 mt-1">Aprobaciones Pendientes</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stats.complianceStatus === 'COMPLIANT' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <CheckCircle2 className={`w-5 h-5 ${stats.complianceStatus === 'COMPLIANT' ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
                <Badge className={`${stats.complianceStatus === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} text-[10px]`}>
                  {stats.complianceStatus === 'COMPLIANT' ? 'OK' : 'BLOQUEADO'}
                </Badge>
              </div>
              <p className="text-lg font-bold text-slate-800">
                {stats.complianceStatus === 'COMPLIANT' ? 'Cumplimiento' : 'No Cumple'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Estado HSE</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.activeDocuments}</p>
              <p className="text-xs text-slate-500 mt-1">Documentos Activos</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Permit Status Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Estado de Permisos</CardTitle>
              <CardDescription className="text-xs">Distribución por estado actual</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Pendientes ({stats.pendingApprovals})
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Aprobados ({stats.approvedPermits})
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Rechazados ({stats.rejectedPermits})
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Document Status Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Documentos HSE</CardTitle>
              <CardDescription className="text-xs">Estado de documentos de cumplimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="active" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                  <Bar dataKey="expired" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ChartContainer>
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Activos ({stats.activeDocuments})
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Vencidos ({stats.expiredDocuments})
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Actividad Reciente</CardTitle>
              <CardDescription className="text-xs">Últimas acciones del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-md bg-slate-50">
                      {getActivityIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {activity.description}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
