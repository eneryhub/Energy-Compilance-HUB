import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/stats - Dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Run all queries in parallel
    const [
      totalPermits,
      permitsByStatus,
      monthlyPermits,
      totalUsers,
      totalDocuments,
      expiringDocuments,
      recentPermits,
      recentAuditLogs,
      permitsByRiskType,
      companyInfo
    ] = await Promise.all([
      // Total permits
      db.permit.count({ where: { companyId } }),

      // Permits by status
      db.permit.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { status: true }
      }),

      // Monthly permits count
      db.permit.count({
        where: {
          companyId,
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      }),

      // Total active users
      db.user.count({ where: { companyId, isActive: true } }),

      // Total documents
      db.hseDocument.count({ where: { companyId } }),

      // Expiring documents (within 30 days)
      db.hseDocument.count({
        where: {
          companyId,
          status: 'ACTIVE',
          expiryDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
        }
      }),

      // Recent 10 permits
      db.permit.findMany({
        where: { companyId },
        include: {
          createdBy: { select: { name: true } },
          approvedBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Recent 20 audit logs
      db.auditLog.findMany({
        where: { companyId },
        include: {
          user: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),

      // Permits by risk type
      db.permit.groupBy({
        by: ['riskType'],
        where: { companyId },
        _count: { riskType: true }
      }),

      // Company info
      db.company.findUnique({
        where: { id: companyId },
        select: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          maxUsers: true,
          maxPermitsPerMonth: true,
          subscriptionExpiresAt: true
        }
      })
    ])

    // Format permits by status into a map
    const statusCounts: Record<string, number> = {}
    for (const item of permitsByStatus) {
      statusCounts[item.status] = item._count.status
    }

    // Format permits by risk type into a map
    const riskTypeCounts: Record<string, number> = {}
    for (const item of permitsByRiskType) {
      riskTypeCounts[item.riskType] = item._count.riskType
    }

    // Calculate compliance overview
    const expiredCriticalDocs = await db.hseDocument.count({
      where: {
        companyId,
        status: 'ACTIVE',
        criticality: 'CRITICAL',
        expiryDate: { lt: now }
      }
    })

    const totalCriticalDocs = await db.hseDocument.count({
      where: {
        companyId,
        criticality: 'CRITICAL'
      }
    })

    // Monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const count = await db.permit.count({
        where: { companyId, createdAt: { gte: start, lte: end } }
      })
      monthlyTrend.push({
        month: start.toLocaleString('es-ES', { month: 'short', year: 'numeric' }),
        count
      })
    }

    return NextResponse.json({
      permits: {
        total: totalPermits,
        byStatus: statusCounts,
        byRiskType: riskTypeCounts,
        thisMonth: monthlyPermits,
        monthlyTrend
      },
      compliance: {
        totalDocuments,
        expiringSoon: expiringDocuments,
        expiredCritical: expiredCriticalDocs,
        totalCritical: totalCriticalDocs,
        complianceRate: totalCriticalDocs > 0
          ? Math.round(((totalCriticalDocs - expiredCriticalDocs) / totalCriticalDocs) * 100)
          : 100
      },
      users: {
        total: totalUsers,
        maxUsers: companyInfo?.maxUsers || 0
      },
      subscription: companyInfo,
      recentActivity: {
        permits: recentPermits,
        auditLogs: recentAuditLogs
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
