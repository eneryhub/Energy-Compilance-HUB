import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/environment/incidents/[id] — Get single environmental incident
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

    const incident = await db.environmentalIncident.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        reportedBy: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!incident) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ incident })
  } catch (error: unknown) {
    console.error('[Environment API] GET incident by ID error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/environment/incidents/[id] — Update status, add containment/remediation
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
      return NextResponse.json({ error: 'Sin permisos para modificar incidentes' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, containmentMeasures, remediationPlan, description } = body

    // Find existing incident
    const existing = await db.environmentalIncident.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (status) {
      const validStatuses = ['REPORTADO', 'EN_INVESTIGACION', 'CONTENIDO', 'REMEDIADO', 'CERRADO']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Estado inválido: ${status}` }, { status: 400 })
      }
      updateData.status = status

      if (status === 'CONTENIDO') {
        updateData.containmentMeasures = containmentMeasures ? JSON.stringify(containmentMeasures) : '[]'
      }
      if (status === 'REMEDIADO') {
        updateData.remediationPlan = remediationPlan || null
        updateData.remediationDate = new Date()
      }
      if (status === 'CERRADO') {
        updateData.closedById = session.userId
        updateData.closedAt = new Date()
      }
    }

    if (containmentMeasures) {
      updateData.containmentMeasures = JSON.stringify(containmentMeasures)
    }
    if (remediationPlan) {
      updateData.remediationPlan = remediationPlan
    }
    if (description) {
      updateData.description = description
    }

    const incident = await db.environmentalIncident.update({
      where: { id },
      data: updateData,
      include: {
        reportedBy: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'ENVIRONMENTAL_INCIDENT',
      entityId: id,
      details: {
        statusChange: status ? `${existing.status} → ${status}` : undefined,
        type: existing.type,
        severity: existing.severity,
      },
    }, request)

    // Emit HSE event based on status change
    if (status) {
      let eventType = 'ENV_INCIDENT_REPORTED'
      let severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL' = 'INFO'
      let title = ''

      switch (status) {
        case 'CONTENIDO':
          eventType = 'ENV_CONTAINMENT'
          title = `Contención activada: incidente ${id}`
          severity = 'HIGH'
          break
        case 'REMEDIADO':
          eventType = 'ENV_REMEDIATION'
          title = `Remediación completada: incidente ${id}`
          severity = 'WARNING'
          break
        case 'CERRADO':
          eventType = 'ENV_REMEDIATION'
          title = `Incidente ambiental cerrado: ${id}`
          severity = 'INFO'
          break
        default:
          title = `Incidente actualizado: ${id}`
          severity = 'WARNING'
      }

      await hseEventManager.emit({
        sourceModule: 'ENVIRONMENT',
        eventType,
        severity,
        title,
        description: `Tipo: ${existing.type}. Severidad: ${existing.severity}. Estado: ${status}.`,
        companyId: session.companyId,
        actorId: session.userId,
        actorName: session.name,
        relatedEntityId: id,
        relatedEntityType: 'ENVIRONMENTAL_INCIDENT',
      })
    }

    return NextResponse.json({ incident })
  } catch (error: unknown) {
    console.error('[Environment API] PATCH incident error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/environment/incidents/[id] — Delete incident (soft delete/close)
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
      return NextResponse.json({ error: 'Sin permisos para eliminar incidentes' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.environmentalIncident.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    // Soft delete — close the incident
    await db.environmentalIncident.update({
      where: { id },
      data: {
        status: 'CERRADO',
        closedById: session.userId,
        closedAt: new Date(),
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'ENVIRONMENTAL_INCIDENT',
      entityId: id,
      details: {
        type: existing.type,
        severity: existing.severity,
        deletedBy: session.name,
      },
    }, request)

    return NextResponse.json({ success: true, message: 'Incidente cerrado exitosamente' })
  } catch (error: unknown) {
    console.error('[Environment API] DELETE incident error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
