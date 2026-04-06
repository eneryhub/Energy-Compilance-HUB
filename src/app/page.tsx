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
import UpgradeModal from '@/components/subscription/upgrade-modal'
import RiskTypeManager from '@/components/risk-types/risk-type-manager'
import TelemetryBoard from '@/components/scada/telemetry-board'
import LocationsManager from '@/components/scada/locations-manager'
import LocationImport from '@/components/import/location-import'
import UserManager from '@/components/users/user-manager'
import PredictiveDashboard from '@/components/predictive/predictive-dashboard'
import SuperAdminPanel from '@/components/admin/super-admin-panel'
import ReportsDashboard from '@/components/reports/reports-dashboard'
import UserManual from '@/components/manuals/user-manual'
import TechnicalManual from '@/components/manuals/technical-manual'
import DiagnosticDashboard from '@/components/diagnostics/diagnostic-dashboard'
import LandingPage from '@/components/landing/landing-page'
import { Button } from '@/components/ui/button'
import { PlusCircle, List, Crown, Lock } from 'lucide-react'
import { removeToken, getUser, getToken, setUser } from '@/lib/api'
import type { LoginResponse } from '@/lib/api'

// Plan-gated modules mirror (must match app-shell.tsx PLAN_GATES)
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

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeModuleName, setUpgradeModuleName] = useState('')
  const [upgradeMessage, setUpgradeMessage] = useState('')

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

        // Check subscription status — sync plan from server (authoritative source)
        // Always read the latest token from localStorage (may have been updated by upgrade)
        const latestToken = getToken()
        const subRes = await fetch('/api/subscription/status', {
          headers: { Authorization: `Bearer ${latestToken}` },
        })
        if (subRes.ok) {
          const subData = await subRes.json()
          if (subData.blockAccess) {
            setSubscriptionBlocked(true)
            setSubscriptionMessage(subData.message || 'Suscripción expirada. Actualice su plan.')
          }
          // ALWAYS sync subscriptionPlan from server — it's the authoritative source
          // This handles edge cases where localStorage may be stale or corrupted
          if (subData.plan) {
            setUserState((prev) => {
              if (!prev) return prev
              if (prev.subscriptionPlan === subData.plan) return prev // no change needed
              return { ...prev, subscriptionPlan: subData.plan }
            })
          }
        }
        // Other errors (500, etc.) — keep user logged in, skip compliance data
      } catch {
        // Network error — ignore, user is already logged in
      }
    }

    restoreSession()
  }, [])

  // Listen for plan updates from SubscriptionManager (no full reload needed)
  // Uses functional state update to avoid stale closure — no dependency on `user`
  useEffect(() => {
    const handlePlanUpdated = ((e: CustomEvent) => {
      const newPlan = (e as CustomEvent<{ plan: string }>).detail?.plan
      if (!newPlan) return
      // Functional update: always reads latest state, no stale closure risk
      setUserState((prev) => {
        if (!prev) return prev
        return { ...prev, subscriptionPlan: newPlan }
      })
    }) as EventListener

    window.addEventListener('plan-updated', handlePlanUpdated)
    return () => window.removeEventListener('plan-updated', handlePlanUpdated)
  }, []) // Empty deps — registered once, uses functional state update

  // Persist user state to localStorage whenever it changes (keeps ech_user in sync)
  useEffect(() => {
    if (user) {
      setUser(user)
    }
  }, [user])

  const handleLogout = useCallback(() => {
    removeToken()
    setUserState(null)
    setAppState('login')
    setCurrentView('dashboard')
    setPermitView('list')
    setSubscriptionBlocked(false)
    setSubscriptionMessage('')
  }, [])

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

  const handleLogin = (userData: LoginResponse['user']) => {
    setUserState(userData)
    setUser(userData)
    setAppState('app')
    setSubscriptionBlocked(false)
    setSubscriptionMessage('')
    checkCompliance()
  }

  const refreshCompliance = () => {
    checkCompliance()
  }

  // Handle upgrade request from sidebar (candado clic)
  const handleUpgradeRequest = useCallback((moduleId: string, moduleName: string, upsellMessage: string) => {
    setUpgradeModuleName(moduleName)
    setUpgradeMessage(upsellMessage)
    setUpgradeModalOpen(true)
  }, [])

  // Navigate to subscription page
  const handleUpgradeToSubscription = useCallback(() => {
    setCurrentView('subscription')
  }, [])

  // Handle view change: block if plan-gated module and user doesn't have access
  const handleViewChange = useCallback((view: ViewType) => {
    const userPlan = user?.subscriptionPlan || 'starter'
    if (!isModuleAccessible(view, userPlan)) {
      const gate = PLAN_GATES[view]
      if (gate) {
        setUpgradeModuleName(gate.upsellMessage.includes('SCADA') ? 'SCADA' : gate.upsellMessage.includes('IA') ? 'IA Predictiva' : 'Reportes')
        setUpgradeMessage(gate.upsellMessage)
        setUpgradeModalOpen(true)
        return
      }
    }
    setCurrentView(view)
    if (view !== 'permits') setPermitView('list')
  }, [user?.subscriptionPlan])

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

  const userPlan = user?.subscriptionPlan || 'starter'

  // App views
  return (
    <AppShell
      currentView={currentView}
      onViewChange={handleViewChange}
      user={user!}
      complianceStatus={complianceStatus}
      onLogout={handleLogout}
      onUpgradeRequest={handleUpgradeRequest}
    >
      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        moduleName={upgradeModuleName}
        upsellMessage={upgradeMessage}
        currentPlan={userPlan}
        onUpgrade={handleUpgradeToSubscription}
      />

      {/* Subscription Block Banner */}
      {subscriptionBlocked && currentView !== 'subscription' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Acceso Limitado</p>
              <p className="text-xs text-amber-600">{subscriptionMessage}</p>
            </div>
          </div>
          <Button
            onClick={() => setCurrentView('subscription')}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm gap-1.5"
          >
            Actualizar Plan
          </Button>
        </motion.div>
      )}

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
            <div className="space-y-4">
              <LocationsManager />
              <LocationImport />
            </div>
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
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}

