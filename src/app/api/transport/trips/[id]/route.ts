import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/transport/trips/[id] — Get single trip with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const trip = await db.transportTrip.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        vehicle: { select: { id: true, plate: true, type: true, brand: true, model: true, status: true } },
        driver: { select: { id: true, name: true, email: true, phone: true } },
        route: true,
        inspections: {
          orderBy: { createdAt: 'desc' },
          include: {
            inspector: { select: { id: true, name: true } },
          },
        },
        driverEvents: {
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ trip })
  } catch (error: unknown) {
    console.error('[Transport API] GET trip by ID error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/transport/trips/[id] — Update trip status, add inspection/blocking
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para modificar viajes' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, notes, endOdometerKm, fuelConsumed, blockingReason } = body

    // Find existing trip
    const existing = await db.transportTrip.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        vehicle: { select: { id: true, plate: true } },
        driver: { select: { id: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      notes: notes !== undefined ? notes : existing.notes,
    }

    if (endOdometerKm !== undefined) updateData.endOdometerKm = endOdometerKm
    if (fuelConsumed !== undefined) updateData.fuelConsumed = fuelConsumed

    // Status transitions
    if (status) {
      const validStatuses = ['PLANIFICADO', 'EN_INSPECCION', 'AUTORIZADO', 'EN_TRANSITO', 'COMPLETADO', 'CANCELADO', 'BLOQUEADO']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Estado inválido: ${status}` }, { status: 400 })
      }
      updateData.status = status

      if (status === 'EN_TRANSITO') updateData.startDate = new Date()
      if (status === 'COMPLETADO') updateData.endDate = new Date()
      if (status === 'BLOQUEADO') {
        updateData.blockingReason = blockingReason || 'Bloqueado manualmente'
        updateData.blockedById = session.userId
        updateData.blockedAt = new Date()
      }
    }

    const trip = await db.transportTrip.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: { select: { id: true, plate: true, type: true } },
        driver: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'TRANSPORT_TRIP',
      entityId: id,
      details: {
        statusChange: status ? `${existing.status} → ${status}` : undefined,
        vehicle: existing.vehicle?.plate,
        driver: existing.driver?.name,
      },
    }, request)

    // Emit HSE event based on status change
    let eventType = 'TRIP_STARTED'
    let severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL' = 'INFO'
    let title = ''

    switch (status) {
      case 'EN_TRANSITO':
        eventType = 'TRIP_STARTED'
        title = `Viaje iniciado: ${existing.vehicle?.plate}`
        severity = 'INFO'
        break
      case 'COMPLETADO':
        eventType = 'TRIP_COMPLETED'
        title = `Viaje completado: ${existing.vehicle?.plate}`
        severity = 'INFO'
        break
      case 'BLOQUEADO':
        eventType = 'TRIP_BLOCKED'
        title = `Viaje bloqueado: ${existing.vehicle?.plate}`
        severity = 'HIGH'
        break
      case 'CANCELADO':
        eventType = 'TRIP_CANCELLED'
        title = `Viaje cancelado: ${existing.vehicle?.plate}`
        severity = 'WARNING'
        break
    }

    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType,
      severity,
      title,
      description: `Conductor: ${existing.driver?.name || 'N/A'}. ${blockingReason ? `Motivo: ${blockingReason}` : ''}`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: id,
      relatedEntityType: 'TRIP',
    })

    return NextResponse.json({ trip })
  } catch (error: unknown) {
    console.error('[Transport API] PATCH trip error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/transport/trips/[id] — Cancel trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para cancelar viajes' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.transportTrip.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        vehicle: { select: { id: true, plate: true } },
        driver: { select: { id: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    // Soft delete — mark as cancelled
    await db.transportTrip.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        notes: existing.notes ? `${existing.notes}\n[CANCELADO por ${session.name}]` : `Cancelado por ${session.name}`,
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'TRANSPORT_TRIP',
      entityId: id,
      details: {
        vehicle: existing.vehicle?.plate,
        driver: existing.driver?.name,
        cancelledBy: session.name,
      },
    }, request)

    await hseEventManager.emit({
      sourceModule: 'TRANSPORT',
      eventType: 'TRIP_CANCELLED',
      severity: 'WARNING',
      title: `Viaje cancelado: ${existing.vehicle?.plate}`,
      description: `Cancelado por ${session.name}. Conductor: ${existing.driver?.name || 'N/A'}.`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: id,
      relatedEntityType: 'TRIP',
    })

    return NextResponse.json({ success: true, message: 'Viaje cancelado exitosamente' })
  } catch (error: unknown) {
    console.error('[Transport API] DELETE trip error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
