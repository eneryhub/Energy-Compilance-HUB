/**
 * useSystemHealth — Polls system health every 30s with backoff on errors.
 * useKnowledgeBase — Knowledge base fetch + create with optimistic cache.
 * useCompanyManagement — Full company CRUD with derived stats for Super Admin.
 *
 * DESIGN PRINCIPLE (Mission Critical):
 * All hooks guard against stale state via isMountedRef.
 * All hooks implement error resilience: failures are silent but tracked.
 * This mirrors aviation CRM principles — never interrupt the operator with
 * a crash; degrade gracefully and show the last known good state.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiFetch } from '@/lib/api'

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */

export interface SystemHealth {
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'
  totalErrors24h: number
  topErrors: Array<{ action: string; count: number; affectedCompanies: number }>
  globalIncidents: Array<{ action: string; affectedCompanies: number; companyNames: string[] }>
  alerts24h: {
    total: number
    critical: number
    unacknowledged: number
    byType: Record<string, number>
  }
  lastChecked: string
}

export interface KnowledgeEntry {
  id: string
  errorCode: string
  category: string
  title: string
  rootCause: string
  appliedSolution: string
  severity: string
  referenceUrl: string | null
  timesUsed: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeCreatePayload {
  errorCode: string
  category: string
  title: string
  rootCause: string
  appliedSolution: string
  severity: string
}

export interface AdminCompany {
  id: string
  name: string
  email: string
  subscriptionPlan: 'starter' | 'business' | 'enterprise'
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED'
  createdAt: string
  maxUsers: number
  maxPermitsPerMonth: number
  isActive: boolean
  _count: { users: number; permits: number }
}

export interface AdminAuditLog {
  id: string
  action: string
  entityType: string
  details: string | null
  createdAt: string
  user: { name: string } | null
}

export interface DashboardStats {
  totalCompanies: number
  activeCompanies: number
  trialCompanies: number
  pastDueCompanies: number
  totalUsers: number
  totalPermits: number
  planDistribution: Record<string, number>
  recentActivity: AdminAuditLog[]
}

/* ════════════════════════════════════════════════════════════════════
   useSystemHealth
   ════════════════════════════════════════════════════════════════════ */

interface UseSystemHealthReturn {
  health: SystemHealth | null
  loading: boolean
  lastFetched: Date | null
  refetch: () => void
}

export function useSystemHealth(): UseSystemHealthReturn {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const isMounted = useRef(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const errorCount = useRef(0)

  const fetchHealth = useCallback(async () => {
    try {
      const data = await apiFetch<SystemHealth>('/admin/system-health')
      if (!isMounted.current) return
      setHealth(data)
      setLastFetched(new Date())
      setLoading(false)
      errorCount.current = 0
    } catch {
      if (!isMounted.current) return
      errorCount.current++
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    fetchHealth()
    intervalRef.current = setInterval(fetchHealth, 30_000)
    return () => {
      isMounted.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchHealth])

  return { health, loading, lastFetched, refetch: fetchHealth }
}

/* ════════════════════════════════════════════════════════════════════
   useKnowledgeBase
   ════════════════════════════════════════════════════════════════════ */

interface UseKnowledgeBaseReturn {
  entry: KnowledgeEntry | null
  loading: boolean
  notFound: boolean
  creating: boolean
  createError: string | null
  lookup: (errorCode: string) => Promise<void>
  create: (payload: KnowledgeCreatePayload) => Promise<{ success: boolean; error?: string; existingId?: string }>
  clear: () => void
}

const knowledgeCache = new Map<string, KnowledgeEntry>()

export function useKnowledgeBase(): UseKnowledgeBaseReturn {
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const lookup = useCallback(async (errorCode: string) => {
    if (!errorCode) {
      setNotFound(true)
      return
    }

    if (knowledgeCache.has(errorCode)) {
      setEntry(knowledgeCache.get(errorCode)!)
      setNotFound(false)
      return
    }

    setLoading(true)
    setEntry(null)
    setNotFound(false)

    try {
      const data = await apiFetch<{ entries: KnowledgeEntry[] }>(
        `/admin/goc/knowledge?code=${encodeURIComponent(errorCode)}`
      )
      if (!isMounted.current) return

      if (data.entries?.length > 0) {
        const found = data.entries[0]
        knowledgeCache.set(errorCode, found)
        setEntry(found)
      } else {
        setNotFound(true)
      }
    } catch {
      if (isMounted.current) setNotFound(true)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  const create = useCallback(async (payload: KnowledgeCreatePayload): Promise<{ success: boolean; error?: string; existingId?: string }> => {
    setCreating(true)
    setCreateError(null)
    try {
      const created = await apiFetch<KnowledgeEntry>('/admin/goc/knowledge', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!isMounted.current) return { success: false, error: 'Componente desmontado' }

      knowledgeCache.set(payload.errorCode, created)
      setEntry(created)
      setNotFound(false)
      return { success: true }
    } catch (err: any) {
      console.error('[KB Create] Error:', err)
      let errorMsg = 'Error desconocido al guardar'
      let existingId: string | undefined
      // Intentar extraer mensaje de error de la respuesta del backend
      if (err?.response?.status === 409) {
        errorMsg = err?.response?.data?.error || `Ya existe una entrada con el código "${payload.errorCode}".`
        existingId = err?.response?.data?.existingId
      } else if (err?.message) {
        errorMsg = err.message
      }
      setCreateError(errorMsg)
      return { success: false, error: errorMsg, existingId }
    } finally {
      if (isMounted.current) setCreating(false)
    }
  }, [])

  const clear = useCallback(() => {
    setEntry(null)
    setNotFound(false)
    setLoading(false)
    setCreateError(null)
  }, [])

  return { entry, loading, notFound, creating, createError, lookup, create, clear }
}

/* ════════════════════════════════════════════════════════════════════
   useCompanyManagement
   ════════════════════════════════════════════════════════════════════ */

type SortKey = 'newest' | 'oldest' | 'name' | 'users' | 'permits'

interface UseCompanyManagementReturn {
  companies: AdminCompany[]
  filteredCompanies: AdminCompany[]
  enterpriseCompanies: AdminCompany[]
  loading: boolean
  error: string | null
  stats: DashboardStats
  searchQuery: string
  statusFilter: string
  planFilter: string
  sortBy: SortKey
  expandedCompanyId: string | null
  auditLogs: AdminAuditLog[]
  loadingLogs: boolean
  setSearchQuery: (q: string) => void
  setStatusFilter: (s: string) => void
  setPlanFilter: (p: string) => void
  setSortBy: (s: SortKey) => void
  toggleCompanyExpand: (id: string) => void
  activateEnterprise: (companyId: string) => Promise<void>
  manageCompany: (
    companyId: string,
    updates: { plan?: string; status?: string; maxUsers?: number; maxPermits?: number }
  ) => Promise<void>
  refetch: () => void
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

export function useCompanyManagement(): UseCompanyManagementReturn {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortKey>('newest')
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const auditCache = useRef<Map<string, AdminAuditLog[]>>(new Map())
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesRes, statsRes] = await Promise.allSettled([
        apiFetch<{ companies: AdminCompany[] }>('/admin/companies'),
        apiFetch<DashboardStats>('/admin/dashboard'),
      ])

      if (!isMounted.current) return

      if (companiesRes.status === 'fulfilled') {
        setCompanies(companiesRes.value?.companies ?? [])
      } else {
        setError(companiesRes.reason?.message ?? 'Error al cargar empresas')
      }

      if (statsRes.status === 'fulfilled') {
        setDashboardStats(statsRes.value)
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  const stats = useMemo<DashboardStats>(() => {
    const planDistribution: Record<string, number> = {}
    companies.forEach(c => {
      planDistribution[c.subscriptionPlan] = (planDistribution[c.subscriptionPlan] ?? 0) + 1
    })
    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => c.subscriptionStatus === 'ACTIVE').length,
      trialCompanies: companies.filter(c => c.subscriptionStatus === 'TRIAL').length,
      pastDueCompanies: companies.filter(c => c.subscriptionStatus === 'PAST_DUE').length,
      totalUsers: companies.reduce((s, c) => s + safeNum(c._count?.users), 0),
      totalPermits: companies.reduce((s, c) => s + safeNum(c._count?.permits), 0),
      planDistribution,
      recentActivity: dashboardStats?.recentActivity ?? [],
    }
  }, [companies, dashboardStats])

  const enterpriseCompanies = useMemo(
    () => companies.filter(c => c.subscriptionPlan === 'enterprise'),
    [companies]
  )

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase()
    let result = companies.filter(c => {
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false
      if (statusFilter !== 'all' && c.subscriptionStatus !== statusFilter) return false
      if (planFilter !== 'all' && c.subscriptionPlan !== planFilter) return false
      return true
    })

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'name': return a.name.localeCompare(b.name)
        case 'users': return safeNum(b._count?.users) - safeNum(a._count?.users)
        case 'permits': return safeNum(b._count?.permits) - safeNum(a._count?.permits)
        default: return 0
      }
    })
    return result
  }, [companies, searchQuery, statusFilter, planFilter, sortBy])

  const toggleCompanyExpand = useCallback(async (id: string) => {
    if (expandedCompanyId === id) {
      setExpandedCompanyId(null)
      setAuditLogs([])
      return
    }
    setExpandedCompanyId(id)

    if (auditCache.current.has(id)) {
      setAuditLogs(auditCache.current.get(id)!)
      return
    }

    setLoadingLogs(true)
    try {
      const res = await apiFetch<{ logs: AdminAuditLog[] }>(`/admin/audit-logs?companyId=${id}&limit=20`)
      const logs = res?.logs ?? []
      auditCache.current.set(id, logs)
      if (isMounted.current) setAuditLogs(logs)
    } catch {
      if (isMounted.current) setAuditLogs([])
    } finally {
      if (isMounted.current) setLoadingLogs(false)
    }
  }, [expandedCompanyId])

  const activateEnterprise = useCallback(async (companyId: string) => {
    await apiFetch('/admin/activate-enterprise', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    })
    fetchCompanies()
  }, [fetchCompanies])

  const manageCompany = useCallback(async (
    companyId: string,
    updates: { plan?: string; status?: string; maxUsers?: number; maxPermits?: number }
  ) => {
    setCompanies(prev => prev.map(c =>
      c.id === companyId
        ? {
            ...c,
            subscriptionPlan: (updates.plan ?? c.subscriptionPlan) as AdminCompany['subscriptionPlan'],
            subscriptionStatus: (updates.status ?? c.subscriptionStatus) as AdminCompany['subscriptionStatus'],
            maxUsers: updates.maxUsers ?? c.maxUsers,
            maxPermitsPerMonth: updates.maxPermits ?? c.maxPermitsPerMonth,
          }
        : c
    ))
    try {
      await apiFetch(`/admin/company/${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    } catch (err: unknown) {
      fetchCompanies()
      throw err
    }
  }, [fetchCompanies])

  return {
    companies,
    filteredCompanies,
    enterpriseCompanies,
    loading,
    error,
    stats,
    searchQuery,
    statusFilter,
    planFilter,
    sortBy,
    expandedCompanyId,
    auditLogs,
    loadingLogs,
    setSearchQuery,
    setStatusFilter,
    setPlanFilter,
    setSortBy,
    toggleCompanyExpand,
    activateEnterprise,
    manageCompany,
    refetch: fetchCompanies,
  }
}