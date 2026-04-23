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
import UserManager from '@/components/users/user-manager'
import PredictiveDashboard from '@/components/predictive/predictive-dashboard'
import PaperclipChat from '@/components/ai/paperclip-chat'
import LocationsManager from '@/components/scada/locations-manager'
import RiskHeatMap from '@/components/risk/risk-heatmap'
import GlobalOperationsCenter from '@/components/admin/global-operations-center'
import SuperAdminPanel from '@/components/admin/super-admin-panel'
import ReportsDashboard from '@/components/reports/reports-dashboard'
import UserManual from '@/components/manuals/user-manual'
import TechnicalManual from '@/components/manuals/technical-manual'
import DiagnosticDashboard from '@/components/diagnostics/diagnostic-dashboard'
import LandingPage from '@/components/landing/landing-page'
import PanicButton from '@/components/erc/panic-button'
import ERCMonitor from '@/components/erc/erc-monitor'
import InventoryDashboard from '@/components/inventory/inventory-dashboard'
import SentinelAvatar from '@/components/ai/sentinel-avatar'
import { Button } from '@/components/ui/button'
import { PlusCircle, List, Crown, Clock, CreditCard, ShieldAlert, Siren, Package } from 'lucide-react'
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
  // const [subscriptionBlocked, setSubscriptionBlocked] = useState(false)
  // const [subscriptionMessage, setSubscriptionMessage] = useState('')
  // const [subscriptionBanner, setSubscriptionBanner] = useState<{
  //   visible: boolean
  //   message: string
  //   type: 'info' | 'warning' | 'error'
  //   isTrial: boolean
  //   trialDaysRemaining: number | null
  //   trialTotalDays: number | null
  //   trialPercent: number | null
  //   subscriptionDaysRemaining: number | null
  //   billingCycle: string | null
  //   planName: string | null
  // } | null>(null)

  // Reusable: fetch subscription status (trial countdown, renewal, blocking)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const fetchSubscriptionStatus = useCallback(async () => {
    // DISABLED: subscription logic hidden for enterprise presentation
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
      // Employee starts on the ERC (field safety) view, not dashboard
      if (savedUser.role === 'EMPLOYEE') {
        setCurrentView('erc')
      }
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

        // // Check subscription status (trial countdown, renewal reminder)
        // await fetchSubscriptionStatus()
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
    // setSubscriptionBlocked(false)
    // setSubscriptionMessage('')
    // setSubscriptionBanner(null)
  }, [])

  // Listen for plan-updated events (dispatched by SubscriptionManager after upgrades)
  // DISABLED: subscription logic hidden for enterprise presentation
  // useEffect(() => {
  //   const handler = async () => {
  //     await fetchSubscriptionStatus()
  //     // Also refresh compliance in case plan changed limits
  //     checkCompliance()
  //   }
  //   window.addEventListener('plan-updated', handler)
  //   return () => window.removeEventListener('plan-updated', handler)
  // }, [fetchSubscriptionStatus, checkCompliance])

  const handleLogin = (userData: LoginResponse['user']) => {
    setUserState(userData)
    setUser(userData)
    // Employee starts on the ERC (field safety) view, not dashboard
    if (userData.role === 'EMPLOYEE') {
      setCurrentView('erc')
    }
    setAppState('app')
    // setSubscriptionBlocked(false)
    // setSubscriptionMessage('')
    // setSubscriptionBanner(null)
    checkCompliance()
    // Fetch subscription status to show trial countdown banner on login
    // fetchSubscriptionStatus()
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
        onBackToLanding={() => setAppState('landing')}
      />
    )
  }

  if (appState === 'register') {
    return (
      <RegisterForm
        onRegister={() => setAppState('login')}
        onSwitchToLogin={() => setAppState('login')}
        onBackToLanding={() => setAppState('landing')}
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
      onUpgradeRequest={(/*moduleId, moduleName, upsellMessage*/) => {
        // DISABLED: subscription logic hidden for enterprise presentation
      }}
    >
      {/* HIDDEN: Subscription banners removed for Enterprise presentation mode */}

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

          {currentView === 'risk-map' && (
            <RiskHeatMap />
          )}

          {currentView === 'paperclip' && (
            <PaperclipChat />
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

          {/* {currentView === 'subscription' && (*/}
          {/*   <SubscriptionManager />*/}
          {/* )}*/}

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

          {currentView === 'goc' && user?.role === 'SUPER_ADMIN' && (
            <GlobalOperationsCenter />
          )}

          {currentView === 'erc' && <PanicButton />}

          {currentView === 'erc-monitor' && (
            (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.role === 'MANAGER' || user?.role === 'TECHNICIAN') ? (
              <ERCMonitor />
            ) : (
              <div className="py-20 text-center text-slate-400">
                <Siren className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Acceso restringido</p>
              </div>
            )
          )}

          {currentView === 'inventory' && (
            (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.role === 'MANAGER') ? (
              <InventoryDashboard />
            ) : (
              <div className="py-20 text-center text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Acceso restringido a administradores y supervisores</p>
              </div>
            )
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Sentinel-AI: Proactive Monitoring Avatar (all roles) ── */}
      <SentinelAvatar />
    </AppShell>
  )
}
