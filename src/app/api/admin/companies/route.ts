import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

// ============ GET Handler — Enriched company list for Super Admin ============

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

    // Fetch all companies with basic counts
    const companies = await db.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            permits: true,
            documents: true,
            sensors: true,
            workLocations: true,
            apiKeys: true,
            supportMessages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // For each company, fetch enriched stats in parallel
    const enrichedCompanies = await Promise.all(
      companies.map(async (company) => {
        const companyId = company.id

        // Parallel queries for enriched data
        const [
          permitStatsRaw,
          expiredDocCount,
          sensorStats,
          lastActivityRaw,
          invoiceTotalRaw,
        ] = await Promise.all([
          // Permit stats by status
          db.permit.groupBy({
            by: ['status'],
            where: { companyId },
            _count: { status: true },
          }),

          // Document stats: total expired
          db.hseDocument.count({
            where: { companyId, status: 'EXPIRED' },
          }),

          // Sensor stats: active and critical
          Promise.all([
            db.sensor.count({ where: { companyId, isActive: true } }),
            db.sensor.count({
              where: {
                companyId,
                isActive: true,
                currentValue: { not: null },
                thresholdCritical: { not: null },
              },
            }),
          ]).then(async ([activeCount, sensorsWithValues]) => {
            // For sensors with values, check if any are critical
            // We need to check currentValue >= thresholdCritical
            if (sensorsWithValues === 0) return { active: activeCount, critical: 0 }
            const criticalSensors = await db.sensor.count({
              where: {
                companyId,
                isActive: true,
                currentValue: { gte: 0 }, // will be filtered below
              },
            })
            // Fetch active sensors and filter in-memory for critical check
            const activeSensors = await db.sensor.findMany({
              where: { companyId, isActive: true },
              select: { currentValue: true, thresholdCritical: true },
            })
            const critical = activeSensors.filter(
              (s) => s.currentValue !== null && s.currentValue >= s.thresholdCritical
            ).length
            return { active: activeCount, critical }
          }),

          // Last activity (most recent audit log for this company)
          db.auditLog.findFirst({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, id: true },
          }),

          // Invoice total (sum of all amounts, coalesce to 0)
          db.subscriptionInvoice.aggregate({
            where: { companyId },
            _sum: { amount: true },
          }),
        ])

        // Build permit stats object
        const permitStatsMap: Record<string, number> = {}
        let permitTotal = 0
        for (const row of permitStatsRaw) {
          permitStatsMap[row.status] = row._count.status
          permitTotal += row._count.status
        }

        const permitStats = {
          total: permitTotal,
          pending: permitStatsMap['PENDING'] || 0,
          approved: permitStatsMap['APPROVED'] || 0,
          rejected: permitStatsMap['REJECTED'] || 0,
          cancelled: permitStatsMap['CANCELLED'] || 0,
        }

        const documentStats = {
          total: company._count.documents,
          expired: expiredDocCount,
        }

        const sensorStatsObj = {
          total: company._count.sensors,
          active: sensorStats.active,
          critical: sensorStats.critical,
        }

        return {
          ...company,
          _count: company._count,
          permitStats,
          documentStats,
          sensorStats: sensorStatsObj,
          lastActivity: lastActivityRaw?.createdAt || null,
          invoiceTotal: invoiceTotalRaw._sum.amount || 0,
        }
      })
    )

    return NextResponse.json({ companies: enrichedCompanies })
  } catch (error: any) {
    console.error('Admin companies error:', error)
    return NextResponse.json(
      { error: 'Error al cargar empresas' },
      { status: 500 }
    )
  }
}
