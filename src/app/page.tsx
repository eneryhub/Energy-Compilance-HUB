'use client'

import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LoginForm, { RegisterForm } from '@/components/auth/login-form'
import AppShell, { type ViewType } from '@/components/layout/app-shell'
import StatsCards from '@/components/dashboard/stats-cards'
import PermitForm from '@/components/permits/permit-form'
import PermitList from '@/components/permits/permit-list'
import ApprovalPanel from '@/components/approval/approval-panel'
import SystemOverview from '@/components/dashboard/system-overview'
import AuditTrail from '@/components/audit/audit-trail'
import DocumentManager from '@/components/documents/document-manager'
import SubscriptionManager from '@/components/subscription/subscription-manager'
import RiskTypeManager from '@/components/risk-types/risk-type-manager'
import TelemetryBoard from '@/components/scada/telemetry-board'
import LocationsManager from '@/components/scada/locations-manager'
import UserManager from '@/components/users/user-manager'
import PredictiveDashboard from '@/components/predictive/predictive-dashboard'
import SuperAdminPanel from '@/components/admin/super-admin-panel'
import ReportsDashboard from '@/components/reports/reports-dashboard'
import UserManual from '@/components/manuals/user-manual'
import TechnicalManual from '@/components/manuals/technical-manual'
import DiagnosticDashboard from '@/components/diagnostics/diagnostic-dashboard'
import RiskHeatMap from '@/components/risk/risk-heatmap'
import GlobalOperationsCenter from '@/components/admin/global-operations-center'
import LandingPage from '@/components/landing/landing-page'
import { Button } from '@/components/ui/button'
import { PlusCircle, List, Crown, Clock, CreditCard, ShieldAlert } from 'lucide-react'
import { removeToken, getUser, getToken, setUser } from '@/lib/api'
import type { LoginResponse } from '@/lib/api'

type AppState = 'landing' | 'login' | 'register' | 'app' | 'mounting'

export default function Home() {
  // Always start as 'mounting' to prevent hydration mismatch.
  // Server renders landing (no localStorage), client detects token in useEffect.
  const [appState, setAppState] = useState<AppState>('mounting')
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [user, setUserState] = useState<LoginResponse['user'] | null>(null)
  const [complianceStatus, setComplianceStatus] = useState<'COMPLIANT' | 'NON_COMPLIANT'>('NON_COMPLIANT')
  const [permitView, setPermitView] = useState<'list' | 'form'>('list')
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState('')
  const [subscriptionBanner, setSubscriptionBanner] = useState<{
    visible: boolean
    message: string
    type: 'info' | 'warning' | 'error'
    isTrial: boolean
    trialDaysRemaining: number | null
    trialTotalDays: number | null
    trialPercent: number | null
    subscriptionDaysRemaining: number | null
    billingCycle: string | null
    planName: string | null
  } | null>(null)

  // Reusable: fetch subscription status (trial countdown, renewal, blocking)
  const fetchSubscriptionStatus = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      const subRes = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!subRes.ok) return
      const subData = await subRes.json()
      if (subData.blockAccess) {
        setSubscriptionBlocked(true)
        setSubscriptionMessage(subData.message || 'Suscripción expirada. Actualice su plan.')
      } else {
        setSubscriptionBlocked(false)
        setSubscriptionMessage('')
      }
      if (subData.message) {
        setSubscriptionBanner({
          visible: true,
          message: subData.message,
          type: subData.bannerType || 'info',
          isTrial: !!subData.isTrial,
          trialDaysRemaining: subData.trialDaysRemaining,
          trialTotalDays: subData.trialTotalDays,
          trialPercent: subData.trialPercent,
          subscriptionDaysRemaining: subData.subscriptionDaysRemaining,
          billingCycle: subData.billingCycle,
          planName: subData.planName,
        })
      } else {
        setSubscriptionBanner(null)
      }
    } catch {
      // Network error — ignore
    }
  }, [])

  // Detect token on client-side only (after mount) to prevent SSR hydration mismatch.
  // Server renders login (no localStorage), client detects saved token.
  useEffect(() => {
    const token = getToken()
    const savedUser = getUser()

    if (!token || !savedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side init from localStorage
      setAppState('landing')
      return
    }

    // Restore session immediately, then verify in background
    const restoreSession = async () => {
      setUserState(savedUser)
      setAppState('app')

      try {
        const res = await fetch('/api/compliance/check', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) {
          removeToken()
          setUserState(null)
          setAppState('login')
          return
        }
        if (res.ok) {
          const data = await res.json()
          setComplianceStatus(data.isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT')
        }

        // Check subscription status (trial countdown, renewal reminder)
        await fetchSubscriptionStatus()
      } catch {
        // Network error — ignore, user is already logged in
      }
    }

    restoreSession()
  }, [fetchSubscriptionStatus])

  const checkCompliance = useCallback(() => {
    const token = getToken()
    if (!token) return
    fetch('/api/compliance/check', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (data) {
          setComplianceStatus(data.isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT')
        }
      })
      .catch(() => {
        // keep default
      })
  }, [])

  const handleLogout = useCallback(() => {
    removeToken()
    setUserState(null)
    setAppState('login')
    setCurrentView('dashboard')
    setPermitView('list')
    setSubscriptionBlocked(false)
    setSubscriptionMessage('')
    setSubscriptionBanner(null)
  }, [])

  // Listen for plan-updated events (dispatched by SubscriptionManager after upgrades)
  useEffect(() => {
    const handler = async () => {
      await fetchSubscriptionStatus()
      // Also refresh compliance in case plan changed limits
      checkCompliance()
    }
    window.addEventListener('plan-updated', handler)
    return () => window.removeEventListener('plan-updated', handler)
  }, [fetchSubscriptionStatus, checkCompliance])

  const handleLogin = (userData: LoginResponse['user']) => {
    setUserState(userData)
    setUser(userData)
    setAppState('app')
    setSubscriptionBlocked(false)
    setSubscriptionMessage('')
    setSubscriptionBanner(null)
    checkCompliance()
    // Fetch subscription status to show trial countdown banner on login
    fetchSubscriptionStatus()
  }

  const refreshCompliance = () => {
    checkCompliance()
  }

  // Show nothing while mounting (prevents hydration mismatch flash)
  if (appState === 'mounting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    )
  }

  // Login/Register views
  if (appState === 'landing') {
    return (
      <LandingPage
        onLogin={() => setAppState('login')}
        onRegister={() => setAppState('register')}
      />
    )
  }

  if (appState === 'login') {
    return (
      <LoginForm
        onLogin={handleLogin}
        onSwitchToRegister={() => setAppState('register')}
      />
    )
  }

  if (appState === 'register') {
    return (
      <RegisterForm
        onRegister={() => setAppState('login')}
        onSwitchToLogin={() => setAppState('login')}
      />
    )
  }

  // App views
  return (
    <AppShell
      currentView={currentView}
      onViewChange={(view) => {
        setCurrentView(view)
        if (view !== 'permits') setPermitView('list')
      }}
      user={user!}
      complianceStatus={complianceStatus}
      onLogout={handleLogout}
    >
      {/* Subscription Info Banner (Trial countdown + Renewal reminder) */}
      {subscriptionBanner?.visible && currentView !== 'subscription' && !subscriptionBlocked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 rounded-xl border p-4 ${
            subscriptionBanner.type === 'warning'
              ? 'border-amber-300 bg-amber-50'
              : subscriptionBanner.type === 'error'
              ? 'border-red-300 bg-red-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          {subscriptionBanner.isTrial ? (
            /* ===== TRIAL COUNTDOWN BANNER ===== */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  (subscriptionBanner.trialDaysRemaining ?? 7) <= 2
                    ? 'bg-amber-200'
                    : 'bg-blue-100'
                }`}>
                  <Clock className={`w-5 h-5 ${
                    (subscriptionBanner.trialDaysRemaining ?? 7) <= 2
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    subscriptionBanner.type === 'warning' ? 'text-amber-800' : 'text-blue-800'
                  }`}>
                    {subscriptionBanner.trialDaysRemaining === 1
                      ? '¡Último día de prueba!'
                      : subscriptionBanner.trialDaysRemaining === 0
                      ? '¡Tu prueba expira hoy!'
                      : `Período de prueba — ${subscriptionBanner.trialDaysRemaining} día(s) restante(s)`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{subscriptionBanner.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Trial progress bar */}
                <div className="hidden sm:block w-32">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>Progreso</span>
                    <span>{Math.round(subscriptionBanner.trialPercent ?? 0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (subscriptionBanner.trialPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${subscriptionBanner.trialPercent ?? 0}%` }}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setCurrentView('subscription')}
                  className={`text-sm gap-1.5 ${
                    (subscriptionBanner.trialDaysRemaining ?? 7) <= 2
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  Suscribirme
                </Button>
              </div>
            </div>
          ) : subscriptionBanner.subscriptionDaysRemaining !== null ? (
            /* ===== SUBSCRIPTION RENEWAL REMINDER ===== */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  (subscriptionBanner.subscriptionDaysRemaining ?? 30) <= 3
                    ? 'bg-amber-200'
                    : 'bg-emerald-100'
                }`}>
                  <CreditCard className={`w-5 h-5 ${
                    (subscriptionBanner.subscriptionDaysRemaining ?? 30) <= 3
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    subscriptionBanner.type === 'warning' ? 'text-amber-800' : 'text-emerald-800'
                  }`}>
                    {subscriptionBanner.subscriptionDaysRemaining <= 1
                      ? '¡Tu suscripción vence hoy!'
                      : `Suscripción renueva en ${subscriptionBanner.subscriptionDaysRemaining} día(s)`}
                    {subscriptionBanner.billingCycle === 'annual' && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">(plan anual)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{subscriptionBanner.message}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentView('subscription')}
                className="text-sm gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                Ver Suscripción
              </Button>
            </div>
          ) : (
            /* ===== GENERIC INFO BANNER ===== */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-800">{subscriptionBanner.message}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentView('subscription')}
                className="text-sm gap-1.5"
              >
                Ver Planes
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Subscription Block Banner (expired — blocks access) */}
      {subscriptionBlocked && currentView !== 'subscription' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Acceso Bloqueado</p>
              <p className="text-xs text-red-600">{subscriptionMessage}</p>
            </div>
          </div>
          <Button
            onClick={() => setCurrentView('subscription')}
            className="bg-red-600 hover:bg-red-700 text-white text-sm gap-1.5"
          >
            <Crown className="w-4 h-4" />
            Actualizar Plan
          </Button>
        </motion.div>
      )}

      {/* Hard block: when subscription is expired, only show subscription page */}
      {subscriptionBlocked && currentView !== 'subscription' ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700">Tu período de prueba ha expirado</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">Actualiza tu plan para continuar utilizando la plataforma.</p>
          <Button
            onClick={() => setCurrentView('subscription')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Crown className="w-4 h-4" />
            Ver Planes Disponibles
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentView === 'dashboard' && <StatsCards />}

          {currentView === 'users' && (
            <UserManager />
          )}

          {currentView === 'permits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Gestión de Permisos</h2>
                <Button
                  size="sm"
                  onClick={() => setPermitView(permitView === 'form' ? 'list' : 'form')}
                  className={permitView === 'form'
                    ? 'bg-slate-600 hover:bg-slate-700 text-white gap-1.5'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                  }
                >
                  {permitView === 'form' ? (
                    <>
                      <List className="w-4 h-4" />
                      Ver Lista
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Nuevo Permiso
                    </>
                  )}
                </Button>
              </div>

              {permitView === 'form' ? (
                <PermitForm onPermitCreated={() => { setPermitView('list'); refreshCompliance() }} />
              ) : (
                <PermitList userRole={user?.role} onRefresh={refreshCompliance} />
              )}
            </div>
          )}

          {currentView === 'documents' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Documentos HSE</h2>
              <DocumentManager />
            </div>
          )}

          {currentView === 'approval' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Panel de Aprobaciones</h2>
              <ApprovalPanel />
            </div>
          )}

          {currentView === 'risk-types' && (
            <RiskTypeManager />
          )}

          {currentView === 'locations' && (
            <LocationsManager />
          )}

          {currentView === 'scada' && (
            <TelemetryBoard />
          )}

          {currentView === 'predictive' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Análisis Predictivo con IA</h2>
              <PredictiveDashboard />
            </div>
          )}

          {currentView === 'admin-portal-hq' && (
            user?.role === 'SUPER_ADMIN' ? (
              <SuperAdminPanel />
            ) : (
              <div className="py-20 text-center text-slate-400">
                <Crown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Acceso restringido</p>
              </div>
            )
          )}

          {currentView === 'subscription' && (
            <SubscriptionManager />
          )}

          {currentView === 'audit' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Auditoría y Trazabilidad</h2>
              <AuditTrail />
            </div>
          )}

          {currentView === 'reports' && (
            <ReportsDashboard />
          )}

          {currentView === 'system' && (
            <SystemOverview />
          )}

          {currentView === 'user-manual' && (
            <UserManual />
          )}

          {currentView === 'technical-manual' && (
            <TechnicalManual />
          )}

          {currentView === 'diagnostics' && (
            <DiagnosticDashboard />
          )}

          {currentView === 'risk-map' && (
            <RiskHeatMap />
          )}

          {currentView === 'goc' && user?.role === 'SUPER_ADMIN' && (
            <GlobalOperationsCenter />
          )}
        </motion.div>
      </AnimatePresence>
      )}
    </AppShell>
  )
}
