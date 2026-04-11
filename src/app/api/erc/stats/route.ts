import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// ============ GET: ERC Dashboard Stats ============
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId

    // Run all queries in parallel for performance
    const [
      activeAlerts,
      totalAlerts,
      totalReports,
      openReports,
      alertsByTypeResult,
      recentAlerts,
      recentReports,
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

      // Alerts grouped by tipo
      db.emergencyAlert.groupBy({
        by: ['tipo'],
        where: { companyId },
        _count: { tipo: true },
      }),

      // Last 5 alerts with user name
      db.emergencyAlert.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),

      // Last 5 reports with user name
      db.hSEReport.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ])

    // Build alertsByType record from groupBy result
    const alertsByType: Record<string, number> = {}
    for (const item of alertsByTypeResult) {
      alertsByType[item.tipo] = item._count.tipo
    }

    return NextResponse.json({
      activeAlerts,
      totalAlerts,
      totalReports,
      openReports,
      alertsByType,
      recentAlerts,
      recentReports,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Get ERC stats error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


