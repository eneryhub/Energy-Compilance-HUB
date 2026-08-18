import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// ============ GET Handler — Global Platform Dashboard Stats for Super Admin ============

export async function GET(req: NextRequest) {
  try {
    // Authenticate — only SUPER_ADMIN
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    // Run all independent counts in parallel
    const [
      companiesCount,
      usersCount,
      permitsCount,
      documentsCount,
      sensorsCount,
      locationsCount,
      apiKeysCount,
      invoicesCount,
    ] = await Promise.all([
      db.company.count(),
      db.user.count(),
      db.permit.count(),
      db.hseDocument.count(),
      db.sensor.count(),
      db.workLocation.count(),
      db.apiKey.count(),
      db.subscriptionInvoice.count(),
    ])

    // Companies by subscription plan
    const byPlanRaw = await db.company.groupBy({
      by: ['subscriptionPlan'],
      _count: { subscriptionPlan: true },
    })
    const byPlanMap: Record<string, number> = {}
    for (const row of byPlanRaw) {
      byPlanMap[row.subscriptionPlan] = row._count.subscriptionPlan
    }

    // Companies by subscription status
    const byStatusRaw = await db.company.groupBy({
      by: ['subscriptionStatus'],
      _count: { subscriptionStatus: true },
    })
    const byStatusMap: Record<string, number> = {}
    for (const row of byStatusRaw) {
      byStatusMap[row.subscriptionStatus] = row._count.subscriptionStatus
    }

    // Permits by status
    const permitsByStatusRaw = await db.permit.groupBy({
      by: ['status'],
      _count: { status: true },
    })
    const permitsByStatusMap: Record<string, number> = {}
    for (const row of permitsByStatusRaw) {
      permitsByStatusMap[row.status] = row._count.status
    }

    // Documents expired
    const documentsExpired = await db.hseDocument.count({
      where: { status: 'EXPIRED' },
    })

    // Sensors critical: active sensors where currentValue >= thresholdCritical
    const activeSensors = await db.sensor.findMany({
      where: { isActive: true },
      select: { currentValue: true, thresholdCritical: true },
    })
    const sensorsCritical = activeSensors.filter(
      (s) => s.currentValue !== null && s.currentValue >= s.thresholdCritical
    ).length

    // Total revenue: sum of all SubscriptionInvoice amounts
    const revenueRaw = await db.subscriptionInvoice.aggregate({
      _sum: { amount: true },
    })

    // Companies created this month
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const companiesThisMonth = await db.company.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    })

    // Permits created today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const permitsToday = await db.permit.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    })

    // Recent activity: last 20 audit logs with user info
    const recentActivity = await db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    const response = {
      overview: {
        totalCompanies: companiesCount,
        totalUsers: usersCount,
        totalPermits: permitsCount,
        totalDocuments: documentsCount,
        totalSensors: sensorsCount,
        totalLocations: locationsCount,
        totalApiKeys: apiKeysCount,
      },
      byPlan: {
        starter: byPlanMap['starter'] || 0,
        business: byPlanMap['business'] || 0,
        enterprise: byPlanMap['enterprise'] || 0,
      },
      byStatus: {
        TRIAL: byStatusMap['TRIAL'] || 0,
        ACTIVE: byStatusMap['ACTIVE'] || 0,
        PAST_DUE: byStatusMap['PAST_DUE'] || 0,
        CANCELLED: byStatusMap['CANCELLED'] || 0,
      },
      permitsByStatus: {
        PENDING: permitsByStatusMap['PENDING'] || 0,
        APPROVED: permitsByStatusMap['APPROVED'] || 0,
        REJECTED: permitsByStatusMap['REJECTED'] || 0,
        CANCELLED: permitsByStatusMap['CANCELLED'] || 0,
      },
      documentsExpired,
      sensorsCritical,
      totalRevenue: revenueRaw._sum.amount || 0,
      companiesThisMonth,
      permitsToday,
      recentActivity,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Error al cargar estadísticas del panel' },
      { status: 500 }
    )
  }
}
