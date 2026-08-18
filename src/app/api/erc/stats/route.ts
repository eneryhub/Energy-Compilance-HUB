import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/erc/stats - Full emergency report statistics for the Incident Monitor
// Returns the complete ErcStats interface expected by the frontend component
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const companyId = session.companyId

    // Run all queries in parallel for performance
    const [
      activeAlertsCount,
      totalAlertsCount,
      totalReportsCount,
      openReportsCount,
      resolvedReportsCount,
      criticalOpenReportsCount,
      alertsLast7DaysCount,
      reportsLast7DaysCount,
      reportsLast30DaysCount,
      alertsGroupedByType,
      reportsGroupedByEstado,
      recentAlerts,
      recentReports,
    ] = await Promise.all([
      // Active (ACTIVA) emergency alerts
      db.emergencyAlert.count({
        where: { companyId, estado: 'ACTIVA' },
      }),

      // Total emergency alerts
      db.emergencyAlert.count({
        where: { companyId },
      }),

      // Total HSE reports
      db.hseReport.count({
        where: { companyId },
      }),

      // Open (ABIERTO) HSE reports
      db.hseReport.count({
        where: { companyId, estado: 'ABIERTO' },
      }),

      // Resolved (CERRADO) HSE reports
      db.hseReport.count({
        where: { companyId, estado: 'CERRADO' },
      }),

      // Critical open reports (ALTA priority + ABIERTO)
      db.hseReport.count({
        where: { companyId, estado: 'ABIERTO', prioridad: 'ALTA' },
      }),

      // Alerts from last 7 days
      db.emergencyAlert.count({
        where: { companyId, createdAt: { gte: startOf7Days } },
      }),

      // Reports from last 7 days
      db.hseReport.count({
        where: { companyId, createdAt: { gte: startOf7Days } },
      }),

      // Reports from last 30 days
      db.hseReport.count({
        where: { companyId, createdAt: { gte: startOf30Days } },
      }),

      // Alerts grouped by type (for chart)
      db.emergencyAlert.groupBy({
        by: ['tipo'],
        where: { companyId },
        _count: { id: true },
      }),

      // Reports grouped by estado (for chart)
      db.hseReport.groupBy({
        by: ['estado'],
        where: { companyId },
        _count: { id: true },
      }),

      // Recent alerts (last 10, with user info)
      db.emergencyAlert.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),

      // Recent reports (last 10, with user info)
      db.hseReport.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ])

    // Build alertsByType map
    const alertsByType: Record<string, number> = {}
    for (const group of alertsGroupedByType) {
      alertsByType[group.tipo] = group._count.id
    }

    // Build reportsByEstado map
    const reportsByEstado: Record<string, number> = {}
    for (const group of reportsGroupedByEstado) {
      reportsByEstado[group.estado] = group._count.id
    }

    // Calculate resolution rate
    const resolutionRate = totalReportsCount > 0
      ? Math.round((resolvedReportsCount / totalReportsCount) * 100)
      : 0

    // Calculate average resolution time (simple estimate from closed reports)
    let avgResolutionHours: number | null = null
    try {
      const closedReports = await db.hseReport.findMany({
        where: { companyId, estado: 'CERRADO' },
        select: { createdAt: true, updatedAt: true },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      })
      if (closedReports.length > 0) {
        const totalHours = closedReports.reduce((sum, r) => {
          const created = new Date(r.createdAt).getTime()
          const updated = new Date(r.updatedAt).getTime()
          const diffHours = (updated - created) / (1000 * 60 * 60)
          return sum + diffHours
        }, 0)
        avgResolutionHours = Math.round(totalHours / closedReports.length)
      }
    } catch {
      avgResolutionHours = null
    }

    return NextResponse.json({
      activeAlerts: activeAlertsCount,
      totalAlerts: totalAlertsCount,
      totalReports: totalReportsCount,
      openReports: openReportsCount,
      resolvedReports: resolvedReportsCount,
      criticalOpenReports: criticalOpenReportsCount,
      alertsByType,
      reportsByEstado,
      recentAlerts: recentAlerts.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt?.toISOString() ?? null,
        attendedAt: a.attendedAt?.toISOString() ?? null,
      })),
      recentReports: recentReports.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
      alertsLast7Days: alertsLast7DaysCount,
      reportsLast7Days: reportsLast7DaysCount,
      reportsLast30Days: reportsLast30DaysCount,
      avgResolutionHours,
      resolutionRate,
    })
  } catch (error: unknown) {
    console.error('[ERC Stats] Error fetching stats:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
