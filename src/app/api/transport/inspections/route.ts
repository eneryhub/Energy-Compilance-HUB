import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/transport/inspections — List inspections
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get('tripId')
    const vehicleId = searchParams.get('vehicleId')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (tripId) where.tripId = tripId
    if (vehicleId) where.vehicleId = vehicleId

    const inspections = await db.transportInspection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        trip: { select: { id: true, status: true, startDate: true } },
        vehicle: { select: { id: true, plate: true, type: true } },
        inspector: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      inspections: Array.isArray(inspections) ? inspections : [],
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET inspections error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/inspections — Create inspection (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tripId, vehicleId, type, checklistResult, passed, issues, photos } = body

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'El ID del viaje es requerido' }, { status: 400 })
    }

    if (!vehicleId || typeof vehicleId !== 'string') {
      return NextResponse.json({ error: 'El ID del vehículo es requerido' }, { status: 400 })
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'El tipo de inspección es requerido' }, { status: 400 })
    }

    if (typeof passed !== 'boolean') {
      return NextResponse.json({ error: 'El resultado (aprobado/rechazado) es requerido' }, { status: 400 })
    }

    // Verify trip belongs to company
    const trip = await db.transportTrip.findFirst({
      where: { id: tripId, companyId: session.companyId },
    })
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    const inspection = await db.transportInspection.create({
      data: {
        companyId: session.companyId,
        tripId,
        vehicleId,
        inspectorId: session.userId,
        type: type.trim(),
        checklistResult: checklistResult ? JSON.stringify(checklistResult) : undefined,
        passed,
        issues: issues ? JSON.stringify(issues) : undefined,
        photos: photos ? JSON.stringify(photos) : undefined,
      },
      include: {
        trip: { select: { id: true, status: true } },
        vehicle: { select: { id: true, plate: true } },
        inspector: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_INSPECTION',
      entityId: inspection.id,
      details: {
        tripId,
        vehicleId,
        type: inspection.type,
        passed: inspection.passed,
      },
    }, request)

    // Emit HSE event
    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType: inspection.passed ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED',
      severity: inspection.passed ? 'INFO' : 'HIGH',
      title: inspection.passed
        ? `Inspección aprobada: viaje ${tripId}`
        : `Inspección RECHAZADA: viaje ${tripId}`,
      description: `Tipo: ${inspection.type}. Inspector: ${session.name}. ${!inspection.passed ? `Issues: ${Array.isArray(issues) ? issues.length : 0} problemas detectados.` : ''}`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: tripId,
      relatedEntityType: 'TRIP',
      metadata: { inspectionId: inspection.id, passed: inspection.passed },
    })

    return NextResponse.json(inspection, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST inspection error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
