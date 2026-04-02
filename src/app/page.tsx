'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { Button } from '@/components/ui/button'
import { PlusCircle, List } from 'lucide-react'
import { removeToken, getUser, getToken, setUser } from '@/lib/api'
import type { LoginResponse } from '@/lib/api'

type AppState = 'login' | 'register' | 'app' | 'mounting'

export default function Home() {
  // Always start as 'mounting' to prevent hydration mismatch.
  // Server renders login form (no localStorage), client detects token in useEffect.
  const [appState, setAppState] = useState<AppState>('mounting')
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [user, setUserState] = useState<LoginResponse['user'] | null>(null)
  const [complianceStatus, setComplianceStatus] = useState<'COMPLIANT' | 'NON_COMPLIANT'>('NON_COMPLIANT')
  const [permitView, setPermitView] = useState<'list' | 'form'>('list')

  // Detect token on client-side only (after mount) to prevent SSR hydration mismatch.
  // Server renders login (no localStorage), client detects saved token.
  useEffect(() => {
    const token = getToken()
    const savedUser = getUser()

    if (!token || !savedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side init from localStorage
      setAppState('login')
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
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentView === 'dashboard' && <StatsCards />}

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
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
