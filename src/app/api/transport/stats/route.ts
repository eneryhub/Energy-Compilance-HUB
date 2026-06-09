import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/transport/stats — Transport KPIs
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId

    const [
      activeTrips,
      vehiclesAvailable,
      vehiclesTotal,
      driversActive,
      driversTotal,
      incidentsCount,
      criticalAlerts,
      completedTrips,
      blockedTrips,
      inspectionsToday,
    ] = await Promise.all([
      // Active trips (EN_TRANSITO, AUTORIZADO)
      db.transportTrip.count({
        where: { companyId, status: { in: ['EN_TRANSITO', 'AUTORIZADO', 'EN_INSPECCION'] } },
      }),
      // Vehicles available
      db.transportVehicle.count({
        where: { companyId, status: 'DISPONIBLE', isActive: true },
      }),
      // Total vehicles
      db.transportVehicle.count({
        where: { companyId, isActive: true },
      }),
      // Active drivers
      db.transportDriver.count({
        where: { companyId, status: 'ACTIVO' },
      }),
      // Total drivers
      db.transportDriver.count({
        where: { companyId },
      }),
      // Driver events in last 30 days
      db.transportDriverEvent.count({
        where: {
          companyId,
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          riskLevel: { in: ['ALTO', 'CRITICO'] },
        },
      }),
      // Critical alerts (CRITICO events in last 24h)
      db.transportDriverEvent.count({
        where: {
          companyId,
          riskLevel: 'CRITICO',
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      // Completed trips this month
      db.transportTrip.count({
        where: {
          companyId,
          status: 'COMPLETADO',
          startDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      // Blocked trips
      db.transportTrip.count({
        where: { companyId, status: 'BLOQUEADO' },
      }),
      // Inspections today
      db.transportInspection.count({
        where: {
          companyId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ])

    return NextResponse.json({
      activeTrips,
      vehiclesAvailable,
      vehiclesTotal,
      driversActive,
      driversTotal,
      incidentsCount,
      criticalAlerts,
      completedTrips,
      blockedTrips,
      inspectionsToday,
      utilizationRate: vehiclesTotal > 0
        ? Math.round(((vehiclesTotal - vehiclesAvailable) / vehiclesTotal) * 100)
        : 0,
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET stats error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
