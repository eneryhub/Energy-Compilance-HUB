import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// ============ GET: ERC Dashboard Stats (Industrial-Grade) ============
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

    // Run all queries in parallel for performance
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
      // Active alerts count (estado = ACTIVA)
      db.emergencyAlert.count({
        where: { companyId, estado: 'ACTIVA' },
      }),

      // Total alerts all time
      db.emergencyAlert.count({
        where: { companyId },
      }),

      // Total HSE reports
      db.hSEReport.count({
        where: { companyId },
      }),

      // Open reports count (estado = ABIERTO)
      db.hSEReport.count({
        where: { companyId, estado: 'ABIERTO' },
      }),

      // Resolved reports count
      db.hSEReport.count({
        where: { companyId, estado: 'RESUELTO' },
      }),

      // Alerts grouped by tipo
      db.emergencyAlert.groupBy({
        by: ['tipo'],
        where: { companyId },
        _count: { tipo: true },
      }),

      // Reports grouped by categoria
      db.hSEReport.groupBy({
        by: ['categoria'],
        where: { companyId },
        _count: { categoria: true },
      }),

      // Reports grouped by estado
      db.hSEReport.groupBy({
        by: ['estado'],
        where: { companyId },
        _count: { estado: true },
      }),

      // Last 10 alerts with user name
      db.emergencyAlert.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),

      // Last 10 reports with user name
      db.hSEReport.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),

      // Alerts in the last 7 days
      db.emergencyAlert.count({
        where: {
          companyId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),

      // Reports in the last 7 days
      db.hSEReport.count({
        where: {
          companyId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),

      // Reports in the last 30 days
      db.hSEReport.count({
        where: {
          companyId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Average resolution time for resolved reports (in hours)
      db.hSEReport.findMany({
        where: {
          companyId,
          estado: 'RESUELTO',
          updatedAt: { not: null },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      }),

      // Critical open reports (ALTA priority + ABIERTO)
      db.hSEReport.count({
        where: {
          companyId,
          estado: 'ABIERTO',
          prioridad: 'ALTA',
        },
      }),
    ])

    // Build alertsByType record from groupBy result
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
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Get ERC stats error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
