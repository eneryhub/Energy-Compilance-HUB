import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/transport/driver-events — List driver events with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')
    const eventType = searchParams.get('eventType')
    const riskLevel = searchParams.get('riskLevel')
    const driverId = searchParams.get('driverId')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (tripId) where.tripId = tripId
    if (driverId) where.driverId = driverId
    if (eventType) where.eventType = eventType
    if (riskLevel) where.riskLevel = riskLevel

    const events = await db.transportDriverEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: {
        trip: { select: { id: true, status: true, startDate: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
      },
    })

    return NextResponse.json({
      events: Array.isArray(events) ? events : [],
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET driver-events error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/driver-events — Create driver event (from AI or manual)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tripId, driverId, vehicleId, eventType, riskLevel, confidence, aiAnalysis, gpsLocation, snapshotUrl } = body

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'El ID del viaje es requerido' }, { status: 400 })
    }

    if (!driverId || typeof driverId !== 'string') {
      return NextResponse.json({ error: 'El ID del conductor es requerido' }, { status: 400 })
    }

    if (!vehicleId || typeof vehicleId !== 'string') {
      return NextResponse.json({ error: 'El ID del vehículo es requerido' }, { status: 400 })
    }

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'El tipo de evento es requerido' }, { status: 400 })
    }

    if (!riskLevel || typeof riskLevel !== 'string') {
      return NextResponse.json({ error: 'El nivel de riesgo es requerido' }, { status: 400 })
    }

    // Verify trip belongs to company
    const trip = await db.transportTrip.findFirst({
      where: { id: tripId, companyId: session.companyId },
    })
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    const driverEvent = await db.transportDriverEvent.create({
      data: {
        companyId: session.companyId,
        tripId,
        driverId,
        vehicleId,
        eventType: eventType.trim(),
        riskLevel: riskLevel.trim().toUpperCase(),
        confidence: typeof confidence === 'number' ? confidence : 0.5,
        aiAnalysis: aiAnalysis ? JSON.stringify(aiAnalysis) : undefined,
        gpsLocation: gpsLocation ? JSON.stringify(gpsLocation) : undefined,
        snapshotUrl: snapshotUrl || null,
        timestamp: new Date(),
      },
      include: {
        trip: { select: { id: true, status: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_DRIVER_EVENT',
      entityId: driverEvent.id,
      details: {
        tripId,
        driverId,
        eventType: driverEvent.eventType,
        riskLevel: driverEvent.riskLevel,
        confidence: driverEvent.confidence,
      },
    }, request)

    // Emit HSE event for DRIVER_ALERT
    const severityMap: Record<string, 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'> = {
      BAJO: 'INFO',
      MEDIO: 'WARNING',
      ALTO: 'HIGH',
      CRITICO: 'CRITICAL',
    }

    const driver = await db.user.findFirst({
      where: { id: driverId, companyId: session.companyId },
      select: { name: true },
    })

    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType: 'DRIVER_ALERT',
      severity: severityMap[driverEvent.riskLevel] || 'WARNING',
      title: `Alerta de conductor: ${driverEvent.eventType}`,
      description: `Conductor: ${driver?.name || 'N/A'}. Nivel de riesgo: ${driverEvent.riskLevel}. Confianza: ${(driverEvent.confidence * 100).toFixed(0)}%.`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: tripId,
      relatedEntityType: 'TRIP',
      metadata: {
        eventId: driverEvent.id,
        eventType: driverEvent.eventType,
        riskLevel: driverEvent.riskLevel,
        confidence: driverEvent.confidence,
        driverId,
        tripId,
      },
    })

    return NextResponse.json(driverEvent, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST driver-event error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
