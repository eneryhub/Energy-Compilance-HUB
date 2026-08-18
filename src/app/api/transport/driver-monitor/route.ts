import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'
import { analyzeDriverFrame } from '@/lib/driver-monitoring-service'

// POST /api/transport/driver-monitor — Receive image, analyze with AI, create DriverEvent, emit alert
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { imageBase64, tripId, driverId, vehicleId } = body

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'La imagen es requerida (base64)' }, { status: 400 })
    }

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'El ID del viaje es requerido' }, { status: 400 })
    }

    if (!driverId || typeof driverId !== 'string') {
      return NextResponse.json({ error: 'El ID del conductor es requerido' }, { status: 400 })
    }

    if (!vehicleId || typeof vehicleId !== 'string') {
      return NextResponse.json({ error: 'El ID del vehículo es requerido' }, { status: 400 })
    }

    // Verify trip belongs to company
    const trip = await db.transportTrip.findFirst({
      where: { id: tripId, companyId: session.companyId },
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
      },
    })
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    // Get driver name for context
    const driver = await db.user.findFirst({
      where: { id: driverId, companyId: session.companyId },
      select: { name: true },
    })

    // Analyze with AI
    const analysis = await analyzeDriverFrame(imageBase64, {
      companyId: session.companyId,
      tripId,
      driverId,
      vehicleId,
      driverName: driver?.name || '',
      timestamp: new Date().toISOString(),
    })

    // Create DriverEvent record
    const driverEvent = await db.transportDriverEvent.create({
      data: {
        companyId: session.companyId,
        tripId,
        driverId,
        vehicleId,
        eventType: analysis.eventType,
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        aiAnalysis: JSON.stringify({
          observations: analysis.observations,
          recommendations: analysis.recommendations,
          rawAnalysis: analysis.rawAnalysis,
        }),
        timestamp: new Date(),
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_DRIVER_EVENT',
      entityId: driverEvent.id,
      details: {
        source: 'AI_DMS',
        tripId,
        driverId,
        eventType: analysis.eventType,
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        observations: analysis.observations,
      },
    }, request)

    // Emit DRIVER_ALERT via HSEEventManager (this triggers cross-module reactions)
    const severityMap: Record<string, 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'> = {
      BAJO: 'INFO',
      MEDIO: 'WARNING',
      ALTO: 'HIGH',
      CRITICO: 'CRITICAL',
    }

    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType: 'DRIVER_ALERT',
      severity: severityMap[analysis.riskLevel] || 'WARNING',
      title: `Alerta IA de conductor: ${analysis.eventType}`,
      description: analysis.observations.slice(0, 3).join('. '),
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: tripId,
      relatedEntityType: 'TRIP',
      metadata: {
        eventId: driverEvent.id,
        eventType: analysis.eventType,
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        driverId,
        vehicleId,
        tripId,
        recommendations: analysis.recommendations,
      },
    })

    return NextResponse.json({
      event: driverEvent,
      analysis,
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST driver-monitor error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
