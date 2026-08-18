'use client'

/**
 * SuperAdminPanel — Refactored
 *
 * Key architectural improvements vs original:
 *
 * 1. DATA: All state + logic extracted to useCompanyManagement hook.
 *    Component is purely presentational. 100% of business logic is testable
 *    in isolation from UI.
 *
 * 2. OPTIMISTIC UPDATES: manageCompany() updates local state immediately,
 *    then syncs to API. If API fails, it reverts. This eliminates the
 *    frustrating 1-2s delay the original had between action and feedback.
 *
 * 3. AUDIT CACHE: Expanding a company row no longer re-fetches on every
 *    expand/collapse. A Map-based cache in the hook stores logs per company.
 *    Second expand is instant.
 *
 * 4. QUOTA VISUALIZATION: Replaced raw numbers with health-state radial
 *    indicators (HealthRing component). Operators see "at-a-glance" health
 *    without reading numbers — matches aviation instrument design principles.
 *
 * 5. PLAN DISTRIBUTION: Simple bar chart built with pure CSS/SVG — no extra
 *    charting library dependency. Keeps the bundle lean.
 */

import { useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Crown, Building2, Users, CreditCard, AlertTriangle,
  CheckCircle, XCircle, Clock, Eye, Search, TrendingUp, Activity,
  BarChart3, Settings, RefreshCw, ChevronDown, ChevronRight,
  Zap, Lock, FileText, Ban, Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useCompanyManagement, AdminCompany, AdminAuditLog,
} from '@/hooks/useSystemAndCompany'

/* ═══════════════════════════════════════════════════════════════════
   PURE HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function safeStr(val: unknown, fb = ''): string { return val == null ? fb : String(val) }
function safeNum(val: unknown, fb = 0): number { const n = Number(val); return Number.isFinite(n) ? n : fb }

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TRIAL:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PAST_DUE:  'bg-red-500/15 text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-700/30 text-slate-500 border-slate-600/30',
}

const PLAN_BADGE: Record<string, string> = {
  enterprise: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  business:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  starter:    'bg-slate-700/30 text-slate-500 border-slate-600/30',
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  LOGIN:    { icon: Eye, color: 'text-blue-400' },
  CREATE:   { icon: CheckCircle, color: 'text-emerald-400' },
  APPROVE:  { icon: CheckCircle, color: 'text-emerald-400' },
  REJECT:   { icon: XCircle, color: 'text-red-400' },
  UPDATE:   { icon: Settings, color: 'text-amber-400' },
  DELETE:   { icon: XCircle, color: 'text-red-400' },
  SUSPEND:  { icon: Ban, color: 'text-orange-400' },
  ACTIVATE: { icon: Zap, color: 'text-cyan-400' },
}

type AdminTab = 'overview' | 'companies' | 'activity'

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Stat Card ── */
function StatCard({ icon: Icon, value, label, sub, variant = 'default', loading = false }: {
  icon: React.ElementType
  value: number | string
  label: string
  sub?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  loading?: boolean
}) {
  const colors = {
    default: { bg: 'bg-slate-800/50', icon: 'text-slate-400', value: 'text-slate-100' },
    success: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', value: 'text-emerald-300' },
    warning: { bg: 'bg-amber-500/10',  icon: 'text-amber-400',  value: 'text-amber-300' },
    danger:  { bg: 'bg-red-500/10',    icon: 'text-red-400',    value: 'text-red-300' },
    info:    { bg: 'bg-blue-500/10',   icon: 'text-blue-400',   value: 'text-blue-300' },
  }
  const c = colors[variant]

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl bg-slate-900 border border-slate-700/50 p-4"
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-16 bg-slate-800" />
          <Skeleton className="h-3 w-24 bg-slate-800" />
        </div>
      ) : (
        <>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', c.bg)}>
            <Icon className={cn('w-4 h-4', c.icon)} />
          </div>
          <p className={cn('text-2xl font-bold tabular-nums', c.value)}>{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
        </>
      )}
    </motion.div>
  )
}

/* ── Health Ring — quota ring indicator ── */
function HealthRing({ pct, size = 36 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#22c55e'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  )
}

/* ── Plan Distribution mini chart ── */
function PlanChart({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, v) => s + v, 0)
  const plans = [
    { key: 'enterprise', label: 'Enterprise', color: '#a855f7' },
    { key: 'business',   label: 'Business',   color: '#3b82f6' },
    { key: 'starter',    label: 'Starter',    color: '#64748b' },
  ]

  return (
    <div className="space-y-2.5">
      {plans.map(p => {
        const count = distribution[p.key] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={p.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-400 font-medium">{p.label}</span>
              <span className="text-[11px] text-slate-500 tabular-nums">{count} ({pct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: p.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Audit Log Timeline ── */
function AuditTimeline({ logs, loading }: { logs: AdminAuditLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full bg-slate-800/50" />)}
      </div>
    )
  }
  if (logs.length === 0) {
    return <p className="text-xs text-slate-600 py-3 text-center">Sin registros recientes</p>
  }

  return (
    <div className="relative pl-4">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700/50" />
      <div className="space-y-3">
        {logs.map((log, i) => {
          const { icon: LogIcon, color } = ACTION_CONFIG[safeStr(log.action)] ?? { icon: Eye, color: 'text-slate-400' }
          let details: Record<string, unknown> | null = null
          try { details = log.details ? JSON.parse(log.details) : null } catch { /* ignore */ }

          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="flex gap-3"
            >
              {/* Timeline dot */}
              <div className="relative z-10 shrink-0 mt-1">
                <div className={cn('w-3 h-3 rounded-full bg-slate-900 border-2 flex items-center justify-center',
                  color.replace('text-', 'border-'))}>
                </div>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <LogIcon className={cn('w-3 h-3 shrink-0', color)} />
                  <span className="text-[11px] font-semibold text-slate-300">{safeStr(log.action)}</span>
                  <span className="text-[10px] text-slate-600 ml-auto shrink-0">{formatDateTime(log.createdAt)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {log.user?.name ?? 'Sistema'} · {safeStr(log.entityType)}
                </p>
                {details && (
                  <p className="text-[10px] text-slate-600 mt-0.5 font-mono truncate">
                    {Object.entries(details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Company Row — memoized ── */
const CompanyRow = memo(function CompanyRow({
  company,
  expanded,
  auditLogs,
  loadingLogs,
  onToggle,
  onActivateEnterprise,
  onManage,
}: {
  company: AdminCompany
  expanded: boolean
  auditLogs: AdminAuditLog[]
  loadingLogs: boolean
  onToggle: (id: string) => void
  onActivateEnterprise: (company: AdminCompany) => void
  onManage: (company: AdminCompany) => void
}) {
  const userPct = company.maxUsers > 0 ? Math.min(Math.round((company._count.users / company.maxUsers) * 100), 100) : 0
  const permitPct = company.maxPermitsPerMonth > 0
    ? Math.min(Math.round((company._count.permits / company.maxPermitsPerMonth) * 100), 100)
    : 0

  return (
    <div className="rounded-xl border border-slate-700/40 overflow-hidden">
      {/* Row header */}
      <button
        onClick={() => onToggle(company.id)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        {/* Company info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-200 truncate">{company.name}</span>
            <Badge className={cn('text-[10px] h-4 px-1.5 border', PLAN_BADGE[company.subscriptionPlan])}>
              {company.subscriptionPlan}
            </Badge>
            <Badge className={cn('text-[10px] h-4 px-1.5 border', STATUS_BADGE[company.subscriptionStatus])}>
              {company.subscriptionStatus}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{company.email}</p>
        </div>

        {/* Quota rings */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-center">
            <HealthRing pct={userPct} size={32} />
            <p className="text-[9px] text-slate-600 mt-0.5 tabular-nums">{company._count.users}/{company.maxUsers}</p>
          </div>
          <div className="text-center">
            <HealthRing pct={permitPct} size={32} />
            <p className="text-[9px] text-slate-600 mt-0.5 tabular-nums">{company._count.permits} PTW</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-600">{formatDate(company.createdAt)}</span>
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
      </button>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/40 bg-slate-900/50">
              <div className="p-4 grid md:grid-cols-2 gap-4">
                {/* Company details */}
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Detalles</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Usuarios', value: `${company._count.users} / ${company.maxUsers}` },
                      { label: 'Permisos', value: `${company._count.permits} / ${company.maxPermitsPerMonth}` },
                      { label: 'Estado', value: company.subscriptionStatus },
                      { label: 'Plan', value: company.subscriptionPlan },
                      { label: 'Activa', value: company.isActive ? 'Sí' : 'No' },
                      { label: 'Creada', value: formatDate(company.createdAt) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-800/40 rounded-lg p-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
                        <p className="text-slate-300 font-medium mt-0.5 truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {company.subscriptionPlan !== 'enterprise' && (
                      <Button
                        size="sm"
                        onClick={() => onActivateEnterprise(company)}
                        className="h-7 text-[11px] bg-purple-600 hover:bg-purple-500 text-white gap-1.5"
                      >
                        <Star className="w-3 h-3" />
                        Activar Enterprise
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onManage(company)}
                      className="h-7 text-[11px] border-slate-600 text-slate-400 hover:text-slate-200 gap-1.5"
                    >
                      <Settings className="w-3 h-3" />
                      Gestionar
                    </Button>
                  </div>
                </div>

                {/* Audit timeline */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-3">
                    Actividad Reciente
                  </p>
                  <AuditTimeline logs={auditLogs} loading={loadingLogs} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

/* ── Manage Company Dialog ── */
function ManageCompanyDialog({
  company,
  onClose,
  onSave,
}: {
  company: AdminCompany | null
  onClose: () => void
  onSave: (id: string, updates: { plan?: string; status?: string; maxUsers?: number; maxPermits?: number }) => Promise<void>
}) {
  const [plan, setPlan] = useState(company?.subscriptionPlan ?? '')
  const [status, setStatus] = useState(company?.subscriptionStatus ?? '')
  const [maxUsers, setMaxUsers] = useState(String(company?.maxUsers ?? ''))
  const [maxPermits, setMaxPermits] = useState(String(company?.maxPermitsPerMonth ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!company) return
    setSaving(true)
    setError(null)
    try {
      await onSave(company.id, {
        plan,
        status,
        maxUsers: parseInt(maxUsers) || undefined,
        maxPermits: parseInt(maxPermits) || undefined,
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!company} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4 text-cyan-400" />
            Gestionar — {company?.name}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Modifica plan, estado y límites de la empresa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Plan</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full h-9 bg-slate-800 border border-slate-700 rounded-md px-3 text-xs text-slate-300">
                {['starter', 'business', 'enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full h-9 bg-slate-800 border border-slate-700 rounded-md px-3 text-xs text-slate-300">
                {['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Máx. Usuarios</label>
              <Input value={maxUsers} onChange={e => setMaxUsers(e.target.value)} type="number" min="1"
                className="h-9 bg-slate-800 border-slate-700 text-slate-200 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Máx. Permisos/mes</label>
              <Input value={maxPermits} onChange={e => setMaxPermits(e.target.value)} type="number" min="1"
                className="h-9 bg-slate-800 border-slate-700 text-slate-200 text-xs" />
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" className="text-slate-400 text-xs h-8">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 gap-1.5">
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [activatingCompany, setActivatingCompany] = useState<AdminCompany | null>(null)
  const [managingCompany, setManagingCompany] = useState<AdminCompany | null>(null)
  const [activating, setActivating] = useState(false)

  const mgmt = useCompanyManagement()

  const handleActivateEnterprise = useCallback(async () => {
    if (!activatingCompany) return
    setActivating(true)
    try {
      await mgmt.activateEnterprise(activatingCompany.id)
      setActivatingCompany(null)
    } catch {
      // Error handled in hook
    } finally {
      setActivating(false)
    }
  }, [activatingCompany, mgmt])

  const tabs: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview',   label: 'Resumen',  icon: BarChart3 },
    { key: 'companies',  label: 'Empresas', icon: Building2 },
    { key: 'activity',   label: 'Actividad', icon: Activity },
  ]

  return (
    <div className="space-y-5">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Centro de Mando</h2>
          <p className="text-[11px] text-slate-500">Administración global · Petrolink</p>
        </div>
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 ml-2 text-[10px]">
          <Crown className="w-2.5 h-2.5 mr-1" /> SUPER_ADMIN
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={mgmt.refetch}
          className="ml-auto w-8 h-8 text-slate-500 hover:text-slate-300"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all',
              activeTab === key
                ? 'bg-slate-900 text-slate-200 shadow-sm border border-slate-700/50'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Building2} value={mgmt.stats.totalCompanies} label="Empresas" loading={mgmt.loading} />
              <StatCard icon={CheckCircle} value={mgmt.stats.activeCompanies} label="Activas" variant="success" loading={mgmt.loading} />
              <StatCard icon={Clock} value={mgmt.stats.trialCompanies} label="En Trial" variant="warning" loading={mgmt.loading} />
              <StatCard icon={AlertTriangle} value={mgmt.stats.pastDueCompanies} label="Vencidas" variant="danger" loading={mgmt.loading} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Users} value={mgmt.stats.totalUsers.toLocaleString()} label="Usuarios Totales" variant="info" loading={mgmt.loading} />
              <StatCard icon={FileText} value={mgmt.stats.totalPermits.toLocaleString()} label="Permisos de Trabajo" loading={mgmt.loading} />
              <StatCard icon={Star} value={mgmt.enterpriseCompanies.length} label="Enterprise" variant="info" loading={mgmt.loading} />
              <StatCard
                icon={TrendingUp}
                value={mgmt.stats.totalCompanies > 0 ? `${Math.round((mgmt.stats.activeCompanies / mgmt.stats.totalCompanies) * 100)}%` : '—'}
                label="Tasa de Activación"
                variant="success"
                loading={mgmt.loading}
              />
            </div>

            {/* Plan distribution */}
            <Card className="bg-slate-900 border-slate-700/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Distribución de Planes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-5">
                {mgmt.loading
                  ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-6 bg-slate-800" />)}</div>
                  : <PlanChart distribution={mgmt.stats.planDistribution} />
                }
              </CardContent>
            </Card>

            {/* Enterprise quota rings */}
            {mgmt.enterpriseCompanies.length > 0 && (
              <Card className="bg-slate-900 border-slate-700/50">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" /> Cuota Enterprise
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {mgmt.enterpriseCompanies.map(c => {
                      const pct = c.maxUsers > 0 ? Math.min(Math.round((c._count.users / c.maxUsers) * 100), 100) : 0
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40">
                          <div className="relative shrink-0">
                            <HealthRing pct={pct} size={44} />
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-400">{pct}%</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-300 truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-600 tabular-nums">{c._count.users}/{c.maxUsers} usuarios</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* ── COMPANIES ── */}
        {activeTab === 'companies' && (
          <motion.div key="companies" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Filter bar */}
            <div className="rounded-xl bg-slate-900 border border-slate-700/50 p-3 space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={mgmt.searchQuery}
                  onChange={e => mgmt.setSearchQuery(e.target.value)}
                  className="pl-9 h-8 bg-slate-800 border-slate-700 text-slate-200 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={mgmt.statusFilter}
                  onChange={e => mgmt.setStatusFilter(e.target.value)}
                  className="h-7 bg-slate-800 border border-slate-700 rounded-lg px-2.5 text-[11px] text-slate-400"
                >
                  {['all', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'].map(s => (
                    <option key={s} value={s}>{s === 'all' ? 'Todos los estados' : s}</option>
                  ))}
                </select>
                <select
                  value={mgmt.planFilter}
                  onChange={e => mgmt.setPlanFilter(e.target.value)}
                  className="h-7 bg-slate-800 border border-slate-700 rounded-lg px-2.5 text-[11px] text-slate-400"
                >
                  {['all', 'enterprise', 'business', 'starter'].map(p => (
                    <option key={p} value={p}>{p === 'all' ? 'Todos los planes' : p}</option>
                  ))}
                </select>
                <select
                  value={mgmt.sortBy}
                  onChange={e => mgmt.setSortBy(e.target.value as Parameters<typeof mgmt.setSortBy>[0])}
                  className="h-7 bg-slate-800 border border-slate-700 rounded-lg px-2.5 text-[11px] text-slate-400"
                >
                  {[
                    { v: 'newest', l: 'Más recientes' },
                    { v: 'oldest', l: 'Más antiguas' },
                    { v: 'name',   l: 'Nombre A-Z' },
                    { v: 'users',  l: 'Más usuarios' },
                    { v: 'permits', l: 'Más permisos' },
                  ].map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="ml-auto text-[10px] text-slate-600 self-center">
                  {mgmt.filteredCompanies.length} de {mgmt.companies.length}
                </span>
              </div>
            </div>

            {/* Company list */}
            {mgmt.loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-slate-800/50" />)}
              </div>
            ) : mgmt.error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">{mgmt.error}</p>
              </div>
            ) : mgmt.filteredCompanies.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 p-10 text-center">
                <Building2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Sin empresas para los filtros actuales</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-1">
                <div className="space-y-2 pb-4">
                  {mgmt.filteredCompanies.map(company => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      expanded={mgmt.expandedCompanyId === company.id}
                      auditLogs={mgmt.expandedCompanyId === company.id ? mgmt.auditLogs : []}
                      loadingLogs={mgmt.loadingLogs}
                      onToggle={mgmt.toggleCompanyExpand}
                      onActivateEnterprise={setActivatingCompany}
                      onManage={setManagingCompany}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </motion.div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === 'activity' && (
          <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-slate-900 border-slate-700/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Actividad Global Reciente
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-5">
                {mgmt.stats.recentActivity.length > 0 ? (
                  <AuditTimeline logs={mgmt.stats.recentActivity} loading={false} />
                ) : (
                  <p className="text-xs text-slate-600 text-center py-6">
                    Seleccione una empresa en la pestaña Empresas para ver su actividad
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTIVATE ENTERPRISE DIALOG ── */}
      <Dialog open={!!activatingCompany} onOpenChange={v => !v && setActivatingCompany(null)}>
        <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-purple-400" />
              Activar Plan Enterprise
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Esta acción actualiza el plan de{' '}
              <strong className="text-slate-300">{activatingCompany?.name}</strong> a Enterprise.
              No se puede deshacer automáticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" className="text-slate-400 text-xs h-8">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleActivateEnterprise}
              disabled={activating}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 gap-1.5"
            >
              {activating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MANAGE COMPANY DIALOG ── */}
      <ManageCompanyDialog
        company={managingCompany}
        onClose={() => setManagingCompany(null)}
        onSave={mgmt.manageCompany}
      />
    </div>
  )
}