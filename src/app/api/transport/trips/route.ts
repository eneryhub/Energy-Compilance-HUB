import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { validateTripStart } from '@/lib/risk-validation'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/transport/trips — List trips with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const vehicleId = searchParams.get('vehicleId')
    const driverId = searchParams.get('driverId')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (status) where.status = status
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId) where.driverId = driverId

    const trips = await db.transportTrip.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: 200,
      include: {
        vehicle: { select: { id: true, plate: true, type: true, brand: true, model: true } },
        driver: { select: { id: true, name: true, email: true } },
        route: { select: { id: true, name: true, origin: true, destination: true } },
      },
    })

    // Flatten nested objects for frontend consumption
    const flatTrips = trips.map(t => ({
      ...t,
      tripNumber: t.id.slice(-8).toUpperCase(),
      origin: t.route?.origin || '',
      destination: t.route?.destination || '',
      driverName: t.driver?.name || '',
      vehiclePlate: t.vehicle?.plate || '',
      vehicleType: t.vehicle?.type || '',
      startTime: t.startDate,
      estimatedArrival: t.endDate || null,
    }))

    return NextResponse.json({
      trips: flatTrips,
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET trips error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/trips — Create trip (runs risk validation)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para crear viajes' }, { status: 403 })
    }

    const body = await request.json()
    const { vehicleId, driverId, routeId, startDate, notes } = body

    if (!vehicleId || typeof vehicleId !== 'string') {
      return NextResponse.json({ error: 'El ID del vehículo es requerido' }, { status: 400 })
    }

    if (!driverId || typeof driverId !== 'string') {
      return NextResponse.json({ error: 'El ID del conductor es requerido' }, { status: 400 })
    }

    if (!routeId || typeof routeId !== 'string') {
      return NextResponse.json({ error: 'El ID de la ruta es requerido' }, { status: 400 })
    }

    if (!startDate) {
      return NextResponse.json({ error: 'La fecha de inicio es requerida' }, { status: 400 })
    }

    // Run risk validation
    const validation = await validateTripStart({
      vehicleId,
      driverId,
      routeId,
      companyId: session.companyId,
    })

    // If validation failed and risk is critical, block the trip
    const blockedChecks = validation.checks.filter(c => !c.passed)
    const hasCriticalFailure = blockedChecks.some(c =>
      c.check === 'conductor_eventos_criticos' ||
      c.check === 'vehiculo_viaje_bloqueado' ||
      c.check === 'conductor_licencia_vencida' ||
      c.check === 'conductor_fatiga_horas'
    )

    const tripStatus = hasCriticalFailure ? 'BLOQUEADO' : 'PLANIFICADO'

    // Get vehicle plate and driver name for logging
    const [vehicle, driver] = await Promise.all([
      db.transportVehicle.findFirst({ where: { id: vehicleId, companyId: session.companyId } }),
      db.user.findFirst({ where: { id: driverId, companyId: session.companyId } }),
    ])

    const trip = await db.transportTrip.create({
      data: {
        companyId: session.companyId,
        vehicleId,
        driverId,
        routeId,
        status: tripStatus,
        startDate: new Date(startDate),
        notes: notes || null,
        riskValidationResult: JSON.stringify(validation),
        blockingReason: hasCriticalFailure ? validation.blockingReason : null,
        blockedById: hasCriticalFailure ? session.userId : null,
        blockedAt: hasCriticalFailure ? new Date() : null,
      },
      include: {
        vehicle: { select: { id: true, plate: true, type: true } },
        driver: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_TRIP',
      entityId: trip.id,
      details: {
        vehicle: vehicle?.plate,
        driver: driver?.name,
        status: tripStatus,
        authorized: validation.authorized,
        failedChecks: blockedChecks.map(c => c.check),
      },
    }, request)

    // Emit HSE event
    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType: hasCriticalFailure ? 'TRIP_BLOCKED' : 'TRIP_CREATED',
      severity: hasCriticalFailure ? 'CRITICAL' : validation.authorized ? 'INFO' : 'WARNING',
      title: hasCriticalFailure
        ? `Viaje bloqueado: ${vehicle?.plate || vehicleId}`
        : `Viaje creado: ${vehicle?.plate || vehicleId}`,
      description: hasCriticalFailure
        ? `Motivo: ${validation.blockingReason || 'Validación de riesgo fallida'}`
        : `Conductor: ${driver?.name || driverId}. Ruta: ${routeId}.`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: trip.id,
      relatedEntityType: 'TRIP',
      metadata: { validation, tripStatus },
    })

    return NextResponse.json({
      trip,
      validation,
      status: tripStatus,
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST trip error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
