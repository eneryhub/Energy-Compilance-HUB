'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Check,
  X,
  Crown,
  Zap,
  Building2,
  Rocket,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Shield,
  Users,
  FileText,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api'

interface SubscriptionData {
  subscription: {
    plan: string
    planName: string
    status: string
    price: number
    expiresAt?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    trialEndsAt?: string | null
  }
  limits: {
    users: { current: number; max: number; percent: number }
    permits: { current: number; max: number; percent: number }
  }
  plans: Record<string, { name: string; price: number; features: string[]; popular?: boolean; description: string }>
  stripe: { configured: boolean; hasCustomer: boolean; billingEmail?: string | null }
  invoices: Array<{ id: string; amount: number; currency: string; status: string; planName: string; description?: string | null; paidAt: string }>
  isDemoMode: boolean
}

const PLAN_ICONS: Record<string, any> = {
  Rocket,
  TrendingUp,
  Building2,
}

const PLAN_COLORS: Record<string, { border: string; bg: string; accent: string; badge: string; badgeText: string }> = {
  starter: {
    border: 'border-slate-200',
    bg: 'bg-white',
    accent: 'text-slate-600',
    badge: 'bg-slate-100',
    badgeText: 'text-slate-700',
  },
  business: {
    border: 'border-emerald-300 ring-2 ring-emerald-100',
    bg: 'bg-gradient-to-b from-emerald-50/50 to-white',
    accent: 'text-emerald-600',
    badge: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
  enterprise: {
    border: 'border-amber-200',
    bg: 'bg-gradient-to-b from-amber-50/30 to-white',
    accent: 'text-amber-600',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><Check className="w-3 h-3" /> Activa</Badge>
    case 'TRIAL':
      return <Badge className="bg-blue-100 text-blue-700 border-0 gap-1"><Clock className="w-3 h-3" /> Prueba</Badge>
    case 'PAST_DUE':
      return <Badge className="bg-red-100 text-red-700 border-0 gap-1"><AlertTriangle className="w-3 h-3" /> Vencida</Badge>
    case 'CANCELLED':
      return <Badge className="bg-slate-100 text-slate-700 border-0 gap-1"><X className="w-3 h-3" /> Cancelada</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getInvoiceStatus(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Pagado</Badge>
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Pendiente</Badge>
    case 'failed':
      return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Fallido</Badge>
    case 'refunded':
      return <Badge className="bg-slate-100 text-slate-700 border-0 text-[10px]">Reembolsado</Badge>
    default:
      return null
  }
}

export default function SubscriptionManager() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [activeTab, setActiveTab] = useState<'plans' | 'usage' | 'billing'>('plans')

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await apiFetch<SubscriptionData>('/subscription')
      setData(res)
    } catch (err) {
      console.error('Error fetching subscription:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubscription() }, [fetchSubscription])

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey)
    try {
      const res = await apiFetch<{ success: boolean; checkoutUrl?: string; demo?: boolean; message: string; planName: string }>('/subscription', {
        method: 'POST',
        body: JSON.stringify({ planKey }),
      })
      if (res.checkoutUrl && !res.demo) {
        window.open(res.checkoutUrl, '_blank')
      }
      await fetchSubscription()
    } catch (err: any) {
      console.error('Upgrade error:', err)
    } finally {
      setUpgrading(null)
    }
  }

  const handleCancel = async () => {
    setCanceling(true)
    try {
      await apiFetch('/subscription', { method: 'DELETE' })
      setShowCancelDialog(false)
      await fetchSubscription()
    } catch (err) {
      console.error('Cancel error:', err)
    } finally {
      setCanceling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-slate-400" />
        <p>Error al cargar datos de suscripción</p>
      </div>
    )
  }

  const currentPlan = data.subscription.plan

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            Gestión de Suscripción
          </h2>
          <p className="text-sm text-slate-500 mt-1">Administra tu plan, uso y facturación</p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(data.subscription.status)}
          {data.isDemoMode && (
            <Badge className="bg-violet-100 text-violet-700 border-0 gap-1 text-[10px]">
              <Sparkles className="w-3 h-3" /> Modo Demo
            </Badge>
          )}
        </div>
      </div>

      {/* Current Plan Summary */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Crown className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Plan actual</p>
                <p className="text-xl font-bold text-slate-800">{data.subscription.planName}</p>
                <p className="text-sm text-slate-500">
                  ${data.subscription.price}/mes
                  {data.subscription.currentPeriodEnd && (
                    <span className="ml-2">
                      · Renueva {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('es')}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
                <Users className="w-3 h-3" />
                {data.limits.users.current}/{data.limits.users.max} usuarios
              </Badge>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
                <FileText className="w-3 h-3" />
                {data.limits.permits.current}/{data.limits.permits.max} permisos/mes
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'plans' as const, label: 'Planes', icon: Crown },
          { id: 'usage' as const, label: 'Uso', icon: Zap },
          { id: 'billing' as const, label: 'Facturación', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(data.plans).map(([key, plan]) => {
            const isCurrent = currentPlan === key
            const isPopular = (plan as any).popular
            const colors = PLAN_COLORS[key]
            const Icon = PLAN_ICONS[key] || Shield

            return (
              <Card
                key={key}
                className={`relative ${colors.border} ${colors.bg} transition-all hover:shadow-lg ${isCurrent ? 'ring-2 ring-emerald-400' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white border-0 gap-1 px-3 shadow-md">
                      <Star className="w-3 h-3" /> Más Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-3 pt-6">
                  <div className={`w-14 h-14 rounded-2xl ${colors.badge} mx-auto flex items-center justify-center mb-3`}>
                    <Icon className={`w-7 h-7 ${colors.accent}`} />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {(plan as any).description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-4">
                  <div className="flex items-baseline justify-center gap-1 mb-4">
                    <span className="text-3xl font-bold text-slate-800">${plan.price}</span>
                    <span className="text-sm text-slate-500">/mes</span>
                  </div>
                  <ul className="space-y-2 text-left mb-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-0 pb-5">
                  {isCurrent ? (
                    <Button className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200" disabled>
                      <Check className="w-4 h-4 mr-2" /> Plan Actual
                    </Button>
                  ) : (
                    <Button
                      className={`w-full gap-2 ${
                        key === 'business'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : key === 'enterprise'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                      onClick={() => handleUpgrade(key)}
                      disabled={!!upgrading}
                    >
                      {upgrading === key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {data.isDemoMode ? <Sparkles className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          {data.isDemoMode ? 'Activar Demo' : 'Upgrade'}
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Users Usage */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Usuarios
                </CardTitle>
                <span className="text-sm font-medium text-slate-600">
                  {data.limits.users.current} / {data.limits.users.max}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={Math.min(data.limits.users.percent, 100)}
                className={`h-3 ${data.limits.users.percent >= 90 ? '[&>div]:bg-red-500' : data.limits.users.percent >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{data.limits.users.percent}% utilizado</span>
                <span>{data.limits.users.max - data.limits.users.current} disponibles</span>
              </div>
              {data.limits.users.percent >= 90 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Casi al límite. Considera hacer upgrade para agregar más usuarios.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permits Usage */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Permisos este mes
                </CardTitle>
                <span className="text-sm font-medium text-slate-600">
                  {data.limits.permits.current} / {data.limits.permits.max}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={Math.min(data.limits.permits.percent, 100)}
                className={`h-3 ${data.limits.permits.percent >= 90 ? '[&>div]:bg-red-500' : data.limits.permits.percent >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{data.limits.permits.percent}% utilizado</span>
                <span>{data.limits.permits.max - data.limits.permits.current} restantes</span>
              </div>
              {data.limits.permits.percent >= 90 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Nearly at limit. Upgrade to increase your monthly permit allowance.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Resumen del Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <p className="text-2xl font-bold text-slate-800">${data.subscription.price}</p>
                  <p className="text-xs text-slate-500 mt-1">Precio/mes</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <p className="text-2xl font-bold text-slate-800">{data.limits.users.max}</p>
                  <p className="text-xs text-slate-500 mt-1">Max usuarios</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <p className="text-2xl font-bold text-slate-800">{data.limits.permits.max.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Permisos/mes</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50">
                  <p className="text-2xl font-bold text-slate-800">
                    {data.invoices.length > 0 ? `$${data.invoices.reduce((s, i) => s + i.amount, 0).toFixed(0)}` : '$0'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Total facturado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-5">
          {/* Stripe Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Estado de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Método de pago</p>
                  <p className="text-xs text-slate-500">
                    {data.stripe.configured
                      ? `Conectado${data.stripe.billingEmail ? ` · ${data.stripe.billingEmail}` : ''}`
                      : 'Modo Demo — los upgrades son simulados'}
                  </p>
                </div>
                {data.stripe.configured ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
                    <Check className="w-3 h-3" /> Stripe
                  </Badge>
                ) : (
                  <Badge className="bg-violet-100 text-violet-700 border-0 gap-1">
                    <Sparkles className="w-3 h-3" /> Demo
                  </Badge>
                )}
              </div>

              {data.subscription.currentPeriodStart && data.subscription.currentPeriodEnd && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Período actual</p>
                    <p className="text-xs text-slate-500">
                      {new Date(data.subscription.currentPeriodStart).toLocaleDateString('es')} — {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('es')}
                    </p>
                  </div>
                </div>
              )}

              {currentPlan !== 'starter' && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancelar Suscripción
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Historial de Facturas
              </CardTitle>
              <CardDescription>Últimas 12 facturas</CardDescription>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">No hay facturas registradas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white border flex items-center justify-center">
                          <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{invoice.description || invoice.planName}</p>
                          <p className="text-xs text-slate-500">{new Date(invoice.paidAt).toLocaleDateString('es')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700">${invoice.amount.toFixed(2)}</span>
                        {getInvoiceStatus(invoice.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Cancelar Suscripción
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar tu suscripción? Tu plan revertirá a Starter con límites reducidos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={canceling}>
              Mantener Plan
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={canceling}>
              {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sí, Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Star(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.width || 14} height={props.height || 14} viewBox="0 0 24 24" fill="currentColor" stroke="none" className={props.className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
