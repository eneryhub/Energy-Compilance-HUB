import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId

    // Fetch all environmental incidents for the company
    const incidents = await db.environmentalIncident.findMany({
      where: { companyId },
      include: {
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch all environmental assessments for the company
    const assessments = await db.environmentalAssessment.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch metrics record count
    const metricsRecords = await db.environmentalMetric.count({
      where: { companyId },
    })

    // Build summary
    const totalIncidents = incidents.length
    const openIncidents = incidents.filter(i =>
      i.status === 'REPORTADO' || i.status === 'EN_INVESTIGACION' || i.status === 'CONTENIDO'
    ).length
    const criticalIncidents = incidents.filter(i => i.severity === 'CRITICO').length
    const totalAssessments = assessments.length

    // Build chart data - incidents by type
    const incidentTypes = ['DERRAME', 'EMISION', 'RESIDUO_PELIGROSO', 'RUIDO'] as const
    const incidentsByType: Record<string, number> = {}
    for (const type of incidentTypes) {
      incidentsByType[type] = incidents.filter(i => i.type === type).length
    }

    // Build chart data - incidents by severity
    const severities = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const
    const incidentsBySeverity: Record<string, number> = {}
    for (const sev of severities) {
      incidentsBySeverity[sev] = incidents.filter(i => i.severity === sev).length
    }

    // Build chart data - assessments by status
    const assessStatuses = ['ABIERTA', 'EN_CURSO', 'COMPLETADA'] as const
    const assessmentsByStatus: Record<string, number> = {}
    for (const st of assessStatuses) {
      // Map our status values to the simplified labels
      if (st === 'ABIERTA') {
        assessmentsByStatus[st] = assessments.filter(a => a.status === 'BORRADOR' || a.status === 'EN_REVISION').length
      } else if (st === 'EN_CURSO') {
        assessmentsByStatus[st] = assessments.filter(a => a.status === 'APROBADO' && a.nextReviewDate && a.nextReviewDate > new Date()).length
      } else if (st === 'COMPLETADA') {
        assessmentsByStatus[st] = assessments.filter(a => a.status === 'VENCIDO').length
      }
    }

    // Map incidents to response format
    const mappedIncidents = incidents.map(i => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      description: i.description,
      status: i.status,
      location: i.location,
      sourceType: i.sourceType,
      reportedByName: i.reportedBy?.name || '-',
      createdAt: i.createdAt.toISOString(),
      remediationDate: i.remediationDate?.toISOString() || null,
    }))

    // Map assessments to response format
    const mappedAssessments = assessments.map(a => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
      nextReviewDate: a.nextReviewDate?.toISOString() || null,
    }))

    return NextResponse.json({
      summary: {
        totalIncidents,
        openIncidents,
        criticalIncidents,
        totalAssessments,
        metricsRecords,
      },
      incidents: mappedIncidents,
      assessments: mappedAssessments,
      charts: {
        incidentsByType,
        incidentsBySeverity,
        assessmentsByStatus,
      },
    })
  } catch (err) {
    console.error('[GET /api/reports/environment]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
