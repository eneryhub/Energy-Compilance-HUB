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
import SuperAdminPanel from '@/components/admin/super-admin-panel'
import DiagnosticDashboard from '@/components/diagnostics/diagnostic-dashboard'
import ReportsDashboard from '@/components/reports/reports-dashboard'
import TechnicalManual from '@/components/manuals/technical-manual'
import UserManual from '@/components/manuals/user-manual'
import LandingPage from '@/components/landing/landing-page'
import { Button } from '@/components/ui/button'
import { PlusCircle, List, Crown } from 'lucide-react'
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

        // Check subscription status
        const subRes = await fetch('/api/subscription/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (subRes.ok) {
          const subData = await subRes.json()
          if (subData.blockAccess) {
            setSubscriptionBlocked(true)
            setSubscriptionMessage(subData.message || 'Suscripción expirada. Actualice su plan.')
          }
        }
        // Other errors (500, etc.) — keep user logged in, skip compliance data
      } catch {
        // Network error — ignore, user is already logged in
      }
    }

    restoreSession()
  }, [])

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
        onBackToHome={() => setAppState('landing')}
      />
    )
  }

  if (appState === 'register') {
    return (
      <RegisterForm
        onRegister={() => setAppState('login')}
        onSwitchToLogin={() => setAppState('login')}
        onBackToHome={() => setAppState('landing')}
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

          {currentView === 'system' && (
            <SystemOverview />
          )}

          {currentView === 'diagnostics' && (
            <DiagnosticDashboard />
          )}

          {currentView === 'reports' && (
            <ReportsDashboard />
          )}

          {currentView === 'technical-manual' && (
            <TechnicalManual />
          )}

          {currentView === 'user-manual' && (
            <UserManual />
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
