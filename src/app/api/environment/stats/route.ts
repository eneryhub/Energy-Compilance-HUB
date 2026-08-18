import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/environment/stats — Environment KPIs
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId

    const [
      openIncidents,
      criticalCount,
      pendingAssessments,
      metricsBreached,
      totalIncidents,
      remediatedIncidents,
      totalAssessments,
      approvedAssessments,
      metricsThisMonth,
      exceededMetrics,
    ] = await Promise.all([
      // Open incidents (not closed)
      db.environmentalIncident.count({
        where: { companyId, status: { notIn: ['CERRADO'] } },
      }),
      // Critical incidents
      db.environmentalIncident.count({
        where: { companyId, severity: 'CRITICO', status: { notIn: ['CERRADO'] } },
      }),
      // Pending assessments
      db.environmentalAssessment.count({
        where: { companyId, status: { in: ['BORRADOR', 'EN_REVISION'] } },
      }),
      // Metrics breached (exceeded thresholds)
      db.environmentalMetric.count({
        where: {
          companyId,
          currentValue: { not: null },
          measurementDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Total incidents
      db.environmentalIncident.count({
        where: { companyId },
      }),
      // Remediated incidents
      db.environmentalIncident.count({
        where: { companyId, status: { in: ['REMEDIADO', 'CERRADO'] } },
      }),
      // Total assessments
      db.environmentalAssessment.count({
        where: { companyId },
      }),
      // Approved assessments
      db.environmentalAssessment.count({
        where: { companyId, status: 'APROBADO' },
      }),
      // Metrics this month
      db.environmentalMetric.count({
        where: {
          companyId,
          measurementDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      // Exceeded metrics this month
      db.environmentalMetric.count({
        where: {
          companyId,
          currentValue: { not: null },
          thresholdCritical: { not: null },
          measurementDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])

    // Calculate breach rate (exceeded / total this month)
    const breachRate = metricsThisMonth > 0
      ? Math.round((exceededMetrics / metricsThisMonth) * 100)
      : 0

    // Calculate remediation rate
    const remediationRate = totalIncidents > 0
      ? Math.round((remediatedIncidents / totalIncidents) * 100)
      : 0

    return NextResponse.json({
      openIncidents,
      criticalCount,
      pendingAssessments,
      metricsBreached: exceededMetrics,
      totalIncidents,
      remediatedIncidents,
      totalAssessments,
      approvedAssessments,
      metricsThisMonth,
      breachRate,
      remediationRate,
    })
  } catch (error: unknown) {
    console.error('[Environment API] GET stats error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
