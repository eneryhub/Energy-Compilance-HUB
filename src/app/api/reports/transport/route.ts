import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const companyId = session.companyId

    // Date filter
    const dateFilter: Record<string, unknown> = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom + 'T00:00:00.000Z')
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const where = {
      companyId,
      ...(Object.keys(dateFilter).length > 0 ? { startDate: dateFilter } : {}),
    }

    // Fetch trips with vehicle and driver includes
    const trips = await db.transportTrip.findMany({
      where,
      include: {
        vehicle: { select: { plate: true, type: true } },
        driver: { select: { name: true } },
        route: { select: { origin: true, destination: true, distanceKm: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    // Fetch driver events (alerts) for the company within date range
    const eventsWhere: Record<string, unknown> = {
      companyId,
    }
    if (dateFrom || dateTo) {
      eventsWhere.timestamp = dateFilter
    }

    const alerts = await db.transportDriverEvent.findMany({
      where: eventsWhere,
      include: {
        driver: { select: { name: true } },
        trip: { select: { id: true, status: true } },
      },
      orderBy: { timestamp: 'desc' },
    })

    // Fetch inspection pass rate
    const inspectionsWhere: Record<string, unknown> = { companyId }
    if (dateFrom || dateTo) {
      inspectionsWhere.createdAt = dateFilter
    }
    const inspections = await db.transportInspection.findMany({
      where: inspectionsWhere,
      select: { passed: true },
    })

    // Build summary
    const totalTrips = trips.length
    const completedTrips = trips.filter(t => t.status === 'COMPLETADO').length
    const blockedTrips = trips.filter(t => t.status === 'BLOQUEADO').length
    const activeTrips = trips.filter(t => t.status === 'EN_TRANSITO').length

    // Average duration
    const completedWithEnd = trips.filter(t => t.status === 'COMPLETADO' && t.endDate)
    const avgDurationMin = completedWithEnd.length > 0
      ? Math.round(
          completedWithEnd.reduce((sum, t) => {
            const ms = new Date(t.endDate!).getTime() - new Date(t.startDate).getTime()
            return sum + ms / 60000
          }, 0) / completedWithEnd.length
        )
      : 0

    // Total km
    const totalKm = trips.reduce((sum, t) => sum + (t.route?.distanceKm || 0), 0)

    // Fatigue alerts
    const fatigueAlerts = alerts.filter(a => a.eventType === 'FATIGA' || a.eventType === 'SOMNOLENCIA').length

    // Inspection pass rate
    const inspectionPassRate = inspections.length > 0
      ? Math.round((inspections.filter(i => i.passed).length / inspections.length) * 100)
      : 0

    // Build chart data - trips by status
    const statusKeys = ['PLANIFICADO', 'EN_TRANSITO', 'COMPLETADO', 'BLOQUEADO', 'CANCELADO'] as const
    const tripsByStatus: Record<string, number> = {}
    for (const key of statusKeys) {
      tripsByStatus[key] = trips.filter(t => t.status === key).length
    }

    // Build chart data - alerts by type
    const alertTypes = ['FATIGA', 'DISTRACCION_CELULAR', 'SOMNOLENCIA', 'SIN_CINTURON'] as const
    const alertsByType: Record<string, number> = {}
    for (const type of alertTypes) {
      alertsByType[type] = alerts.filter(a => a.eventType === type).length
    }

    // Build chart data - alerts by risk level
    const riskLevels = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const
    const alertsByRisk: Record<string, number> = {}
    for (const level of riskLevels) {
      alertsByRisk[level] = alerts.filter(a => a.riskLevel === level).length
    }

    // Map trips to response format
    const mappedTrips = trips.map(t => ({
      id: t.id,
      status: t.status,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate?.toISOString() || null,
      startOdometerKm: t.startOdometerKm,
      vehiclePlate: t.vehicle?.plate || '-',
      vehicleType: t.vehicle?.type || '-',
      driverName: t.driver?.name || '-',
      origin: t.route?.origin || '-',
      destination: t.route?.destination || '-',
      distanceKm: t.route?.distanceKm || 0,
      blockingReason: t.blockingReason,
    }))

    // Map alerts to response format
    const mappedAlerts = alerts.map(a => ({
      id: a.id,
      eventType: a.eventType,
      riskLevel: a.riskLevel,
      confidence: a.confidence,
      timestamp: a.timestamp.toISOString(),
      isResolved: a.isResolved,
      driverName: a.driver?.name || '-',
      tripId: a.tripId,
      tripStatus: a.trip?.status || '-',
    }))

    return NextResponse.json({
      summary: {
        totalTrips,
        completedTrips,
        blockedTrips,
        activeTrips,
        avgDurationMin,
        totalKm,
        fatigueAlerts,
        inspectionPassRate,
      },
      trips: mappedTrips,
      alerts: mappedAlerts,
      charts: {
        tripsByStatus,
        alertsByType,
        alertsByRisk,
      },
    })
  } catch (err) {
    console.error('[GET /api/reports/transport]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
