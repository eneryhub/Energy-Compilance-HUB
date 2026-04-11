import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// ============ GET: ERC Dashboard Stats (Ultra-Defensive) ============
// Each query is independently wrapped so one failure never crashes the whole response.
// Returns partial data with safe defaults (0/null/empty) for any failing query.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Helper: run a single Prisma query, return fallback on ANY error
    async function safeQuery<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
      try {
        return await fn()
      } catch (err) {
        console.error(`[ERC Stats] Query failed (${label}):`, err instanceof Error ? err.message : err)
        return fallback
      }
    }

    // Run all queries in parallel, each independently safe
    const [
      activeAlerts,
      totalAlerts,
      totalReports,
      openReports,
      resolvedReports,
      alertsByTypeResult,
      reportsByCategoriaResult,
      reportsByEstadoResult,
      recentAlerts,
      recentReports,
      alertsLast7Days,
      reportsLast7Days,
      reportsLast30Days,
      avgResolutionTimeResult,
      criticalOpenReports,
    ] = await Promise.all([
      safeQuery(
        () => db.emergencyAlert.count({ where: { companyId, estado: 'ACTIVA' } }),
        0, 'activeAlerts'
      ),
      safeQuery(
        () => db.emergencyAlert.count({ where: { companyId } }),
        0, 'totalAlerts'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId } }),
        0, 'totalReports'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId, estado: 'ABIERTO' } }),
        0, 'openReports'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId, estado: 'RESUELTO' } }),
        0, 'resolvedReports'
      ),
      safeQuery(
        () => db.emergencyAlert.groupBy({ by: ['tipo'], where: { companyId }, _count: { tipo: true } }),
        [] as Array<{ tipo: string; _count: { tipo: number } }>, 'alertsByType'
      ),
      safeQuery(
        () => db.hSEReport.groupBy({ by: ['categoria'], where: { companyId }, _count: { categoria: true } }),
        [] as Array<{ categoria: string; _count: { categoria: number } }>, 'reportsByCategoria'
      ),
      safeQuery(
        () => db.hSEReport.groupBy({ by: ['estado'], where: { companyId }, _count: { estado: true } }),
        [] as Array<{ estado: string; _count: { estado: number } }>, 'reportsByEstado'
      ),
      safeQuery(
        () => db.emergencyAlert.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        [], 'recentAlerts'
      ),
      safeQuery(
        () => db.hSEReport.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        [], 'recentReports'
      ),
      safeQuery(
        () => db.emergencyAlert.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
        0, 'alertsLast7Days'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
        0, 'reportsLast7Days'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
        0, 'reportsLast30Days'
      ),
      safeQuery(
        () => db.hSEReport.findMany({
          where: { companyId, estado: 'RESUELTO', updatedAt: { not: null } },
          select: { createdAt: true, updatedAt: true },
          take: 50,
          orderBy: { updatedAt: 'desc' },
        }),
        [] as Array<{ createdAt: Date; updatedAt: Date }>, 'avgResolutionTime'
      ),
      safeQuery(
        () => db.hSEReport.count({ where: { companyId, estado: 'ABIERTO', prioridad: 'ALTA' } }),
        0, 'criticalOpenReports'
      ),
    ])

    // Build alertsByType record
    const alertsByType: Record<string, number> = {}
    for (const item of alertsByTypeResult) {
      alertsByType[item.tipo] = item._count.tipo
    }

    // Build reportsByCategoria record
    const reportsByCategoria: Record<string, number> = {}
    for (const item of reportsByCategoriaResult) {
      reportsByCategoria[item.categoria] = item._count.categoria
    }

    // Build reportsByEstado record
    const reportsByEstado: Record<string, number> = {}
    for (const item of reportsByEstadoResult) {
      reportsByEstado[item.estado] = item._count.estado
    }

    // Calculate average resolution time in hours
    let avgResolutionHours: number | null = null
    if (avgResolutionTimeResult.length > 0) {
      const totalHours = avgResolutionTimeResult.reduce((acc, r) => {
        if (r.updatedAt) {
          const diffMs = new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()
          return acc + diffMs / (1000 * 60 * 60)
        }
        return acc
      }, 0)
      avgResolutionHours = Math.round(totalHours / avgResolutionTimeResult.length)
    }

    // Resolution rate
    const resolutionRate = totalReports > 0
      ? Math.round((resolvedReports / totalReports) * 100)
      : 0

    return NextResponse.json({
      activeAlerts,
      totalAlerts,
      totalReports,
      openReports,
      resolvedReports,
      criticalOpenReports,
      alertsByType,
      reportsByCategoria,
      reportsByEstado,
      recentAlerts,
      recentReports,
      alertsLast7Days,
      reportsLast7Days,
      reportsLast30Days,
      avgResolutionHours,
      resolutionRate,
    })
  } catch (error: unknown) {
    // Last resort fallback — return empty stats so the dashboard still renders
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[ERC Stats] Fatal error:', error)

    // Return 200 with safe defaults instead of 500 — the dashboard should ALWAYS render
    return NextResponse.json({
      activeAlerts: 0,
      totalAlerts: 0,
      totalReports: 0,
      openReports: 0,
      resolvedReports: 0,
      criticalOpenReports: 0,
      alertsByType: {},
      reportsByCategoria: {},
      reportsByEstado: {},
      recentAlerts: [],
      recentReports: [],
      alertsLast7Days: 0,
      reportsLast7Days: 0,
      reportsLast30Days: 0,
      avgResolutionHours: null,
      resolutionRate: 0,
    })
  }
}
