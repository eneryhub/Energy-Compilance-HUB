'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  CheckCircle,
  LogOut,
  Menu,
  Shield,
  ChevronLeft,
  User,
  Building2,
  Layers,
  History,
  CreditCard,
  AlertTriangle,
  Activity,
  Brain,
  Crown,
  BarChart3,
  BookOpen,
  Wrench,
  Stethoscope,
  Lock,
  Radar,
  MapPin,
  Flame,
  MessageSquareText,
  Siren,
  Bell,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { removeToken, getToken } from '@/lib/api'
import AIAssistant from '@/components/ai/ai-assistant'

export type ViewType = 'dashboard' | 'users' | 'permits' | 'documents' | 'approval' | 'scada' | 'locations' | 'system' | 'audit' | 'subscription' | 'risk-types' | 'predictive' | 'admin-portal-hq' | 'reports' | 'risk-map' | 'user-manual' | 'technical-manual' | 'diagnostics' | 'goc' | 'paperclip' | 'erc' | 'erc-monitor'

interface AppShellProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  user: {
    name: string
    email: string
    role: string
    companyName: string
    subscriptionPlan?: string
  }
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT'
  children: React.ReactNode
  onLogout: () => void
  onUpgradeRequest?: (moduleId: string, moduleName: string, upsellMessage: string) => void
}

// Plan-gated modules: which modules require which minimum plan
const PLAN_GATES: Record<string, { minPlan: string; upsellMessage: string }> = {
  scada: {
    minPlan: 'business',
    upsellMessage: 'Pásate al plan Business para monitorear tus sensores en tiempo real con telemetría SCADA.',
  },
  predictive: {
    minPlan: 'business',
    upsellMessage: 'Pásate al plan Business para acceder al análisis predictivo con Inteligencia Artificial.',
  },
  reports: {
    minPlan: 'business',
    upsellMessage: 'Pásate al plan Business para generar reportes analíticos avanzados de tu operación.',
  },
  'risk-map': {
    minPlan: 'enterprise',
    upsellMessage: 'Pásate al plan Enterprise para acceder a los mapas de calor de riesgo con análisis avanzado.',
  },
}

const PLAN_PRIORITY: Record<string, number> = {
  starter: 0,
  business: 1,
  enterprise: 2,
}

function isModuleAccessible(moduleId: string, plan: string): boolean {
  const gate = PLAN_GATES[moduleId]
  if (!gate) return true
  return (PLAN_PRIORITY[plan] ?? 0) >= (PLAN_PRIORITY[gate.minPlan] ?? 0)
}

const navItems: { id: ViewType; label: string; icon: React.ComponentType<any>; roles?: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'permits', label: 'Permisos', icon: FileText },
  { id: 'documents', label: 'Documentos HSE', icon: FolderOpen },
  { id: 'approval', label: 'Aprobaciones', icon: CheckCircle, roles: ['ADMIN', 'SUPERVISOR', 'GERENTE', 'MANAGER'] },
  { id: 'risk-types', label: 'Riesgos', icon: AlertTriangle, roles: ['ADMIN', 'SUPERVISOR'] },
  { id: 'locations', label: 'Ubicaciones', icon: MapPin, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'TECHNICIAN'] },
  { id: 'scada', label: 'SCADA', icon: Activity, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'TECHNICIAN'] },
  { id: 'predictive', label: 'IA Predictiva', icon: Brain, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER'] },
  { id: 'reports', label: 'Reportes', icon: BarChart3, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER'] },
  { id: 'risk-map', label: 'Mapa de Riesgo', icon: Flame, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER'] },
  { id: 'paperclip', label: 'Paperclip IA', icon: MessageSquareText, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'GERENTE'] },
  { id: 'erc', label: 'Seguridad en Campo', icon: Siren, roles: ['EMPLOYEE'] },
  { id: 'erc-monitor', label: 'Monitor de Incidentes', icon: Bell, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER', 'TECHNICIAN'] },
  { id: 'subscription', label: 'Suscripción', icon: CreditCard, roles: ['ADMIN'] },
  { id: 'audit', label: 'Auditoría', icon: History, roles: ['ADMIN'] },
  { id: 'users', label: 'Usuarios', icon: User, roles: ['ADMIN'] },
  { id: 'system', label: 'Plataforma', icon: Layers, roles: ['ADMIN'] },
  // Hidden: only SUPER_ADMIN sees this (not in the visible nav, accessed via URL)
  { id: 'user-manual', label: 'Manual de Usuario', icon: BookOpen },
  { id: 'technical-manual', label: 'Manual Técnico', icon: Wrench, roles: ['ADMIN', 'SUPERVISOR', 'MANAGER'] },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Stethoscope, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { id: 'goc', label: 'GOC', icon: Radar, roles: ['SUPER_ADMIN'] },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-red-100 text-red-700'
    case 'ADMIN':
      return 'bg-emerald-100 text-emerald-700'
    case 'SUPERVISOR':
      return 'bg-amber-100 text-amber-700'
    case 'MANAGER':
      return 'bg-blue-100 text-blue-700'
    case 'TECHNICIAN':
      return 'bg-slate-100 text-slate-700'
    case 'EMPLOYEE':
      return 'bg-orange-100 text-orange-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

// ── Emergency Alert Indicator (visible for ALL roles in header) ──
function EmergencyAlertIndicator({ onViewMonitor }: { onViewMonitor: () => void }) {
  const [activeCount, setActiveCount] = useState(0)

  useEffect(() => {
    const poll = async () => {
      try {
        const token = getToken()
        if (!token) return
        const res = await fetch('/api/erc/stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setActiveCount(data.activeAlerts ?? 0)
        }
      } catch { /* silent */ }
    }
    poll()
    const timer = setInterval(poll, 15000)
    return () => clearInterval(timer)
  }, [])

  if (activeCount === 0) return null

  return (
    <button
      onClick={onViewMonitor}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <Bell className="w-3.5 h-3.5" />
      <span>{activeCount}</span>
      <span className="hidden sm:inline">Emergencia{activeCount !== 1 ? 's' : ''}</span>
    </button>
  )
}

function SidebarContent({
  currentView,
  onViewChange,
  user,
  complianceStatus,
  onLogout,
  onNavigate,
  onUpgradeRequest,
}: AppShellProps & { onNavigate?: () => void }) {
  const userPlan = user.subscriptionPlan || 'starter'

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Logo + Mobile Close Button */}
      <div className="flex-shrink-0 p-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 overflow-hidden">
          <img src="/logo.jpeg" alt="ECH Logo" className="w-7 h-7 object-cover rounded" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">Energy-Compliance</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hub</p>
        </div>
        {/* Mobile-only close button for better UX on dark background */}
        <button
          onClick={onNavigate}
          className="lg:hidden flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <Separator className="flex-shrink-0 bg-slate-800" />

      {/* Navigation — scrollable area */}
      <nav
        className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain min-h-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold px-3 mb-2">
          Navegación
        </p>
        {navItems.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          const gated = PLAN_GATES[item.id]
          const locked = gated && !isModuleAccessible(item.id, userPlan)

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (locked && onUpgradeRequest) {
                      onUpgradeRequest(item.id, item.label, gated.upsellMessage)
                      onNavigate?.()
                      return
                    }
                    onViewChange(item.id)
                    onNavigate?.()
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    locked
                      ? 'text-slate-600 hover:bg-amber-500/10 hover:text-amber-400/80 cursor-pointer'
                      : isActive
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                >
                  {locked ? (
                    <div className="relative">
                      <Icon className="w-4.5 h-4.5" />
                      <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-0.5" />
                    </div>
                  ) : (
                    <Icon className={cn('w-4.5 h-4.5', isActive && 'text-emerald-400')} />
                  )}
                  <span className="flex-1 text-left">{item.label}</span>
                  {locked && (
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide',
                      gated?.minPlan === 'enterprise'
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-amber-500/15 text-amber-500'
                    )}>
                      {gated?.minPlan === 'enterprise' ? 'Ent' : 'Pro'}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="hidden lg:block">
                {locked ? `${item.label} — Plan ${gated?.minPlan === 'enterprise' ? 'Enterprise' : 'Business'}` : item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}

        {/* Hidden SUPER_ADMIN portal — only visible to SUPER_ADMIN role */}
        {user.role === 'SUPER_ADMIN' && (
          <>
            <Separator className="bg-slate-800 my-2" />
            <p className="text-[10px] uppercase tracking-wider text-red-500/60 font-semibold px-3 mb-2">
              Super Admin
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    onViewChange('admin-portal-hq')
                    onNavigate?.()
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    currentView === 'admin-portal-hq'
                      ? 'bg-red-500/15 text-red-400'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-red-400'
                  )}
                >
                  <Crown className="w-4.5 h-4.5" />
                  <span>Centro de Mando</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="hidden lg:block">
                Centro de Mando
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </nav>

      {/* Compliance Status — pinned at bottom */}
      <div className="flex-shrink-0 p-3">
        <div
          className={cn(
            'p-3 rounded-lg text-xs',
            complianceStatus === 'COMPLIANT'
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                complianceStatus === 'COMPLIANT' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
              )}
            />
            <span
              className={cn(
                'font-semibold',
                complianceStatus === 'COMPLIANT' ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {complianceStatus === 'COMPLIANT' ? 'Cumplimiento HSE: OK' : '¡OPERACIONES BLOQUEADAS!'}
            </span>
          </div>
        </div>
      </div>

      <Separator className="flex-shrink-0 bg-slate-800" />

      {/* User info + Logout — pinned at bottom */}
      <div className="flex-shrink-0 p-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
          <Avatar className="w-9 h-9 bg-emerald-600">
            <AvatarFallback className="text-white text-xs font-bold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <div className="flex items-center gap-1.5">
              <Badge className={cn('text-[10px] px-1.5 py-0', getRoleBadgeColor(user.role))}>
                {user.role}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {user.companyName}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full mt-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 justify-start gap-2"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}

export default function AppShell(props: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {collapsed ? (
          <div className="flex flex-col h-full">
            <div className="p-3 flex justify-center">
              <button
                onClick={() => setCollapsed(false)}
                className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center overflow-hidden"
              >
                <img src="/logo.jpeg" alt="ECH" className="w-7 h-7 object-cover rounded" />
              </button>
            </div>
            <Separator className="bg-slate-800" />
            <nav className="flex-1 p-2 space-y-1 flex flex-col items-center overflow-y-auto overscroll-contain min-h-0">
              {navItems.filter((item) => !item.roles || item.roles.includes(props.user.role)).map((item) => {
                const Icon = item.icon
                const isActive = props.currentView === item.id
                const userPlan = props.user.subscriptionPlan || 'starter'
                const gated = PLAN_GATES[item.id]
                const locked = gated && !isModuleAccessible(item.id, userPlan)
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (locked && props.onUpgradeRequest) {
                            props.onUpgradeRequest(item.id, item.label, gated.upsellMessage)
                            return
                          }
                          props.onViewChange(item.id)
                        }}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                          locked
                            ? 'text-slate-600 hover:bg-amber-500/10 hover:text-amber-400'
                            : isActive
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        )}
                      >
                        <div className="relative">
                          <Icon className="w-5 h-5" />
                          {locked && <Lock className="w-3 h-3 text-amber-500 absolute -top-1 -right-1.5" />}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {locked ? `${item.label} — Plan ${gated?.minPlan === 'enterprise' ? 'Enterprise' : 'Business'}` : item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </nav>
            <div className="p-2">
              <button
                onClick={() => setCollapsed(false)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <SidebarContent {...props} />
            <div className="p-2 flex-shrink-0">
              <button
                onClick={() => setCollapsed(true)}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all text-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Colapsar
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Mobile Sidebar — Sheet with scrollable content */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-slate-900 border-slate-800 [&>button]:text-slate-400 [&>button]:hover:text-white"
        >
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarContent {...props} onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden lg:flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-800">
                  {navItems.find((i) => i.id === props.currentView)?.label || 'Dashboard'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Compliance indicator in header */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
                  props.complianceStatus === 'COMPLIANT'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    props.complianceStatus === 'COMPLIANT'
                      ? 'bg-emerald-500'
                      : 'bg-red-500 animate-pulse'
                  )}
                />
                {props.complianceStatus === 'COMPLIANT' ? 'Cumplimiento OK' : 'Bloqueado'}
              </div>

              {/* Emergency Alert Indicator — visible for ALL roles */}
              <EmergencyAlertIndicator
                onViewMonitor={() => {
                  const targetView = props.user.role === 'EMPLOYEE' ? 'erc' as ViewType : 'erc-monitor' as ViewType
                  props.onViewChange(targetView)
                }}
              />

              <Avatar className="w-8 h-8 bg-emerald-600 lg:hidden">
                <AvatarFallback className="text-white text-xs font-bold">
                  {getInitials(props.user.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {props.children}
        </main>
      </div>

      {/* AI Voice Guide — Zero-risk UI add-on, isolated component */}
      <AIAssistant currentView={props.currentView} />
    </div>
  )
}
