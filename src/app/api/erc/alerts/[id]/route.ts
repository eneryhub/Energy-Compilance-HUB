import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ PATCH: Update alert status (attend / discard) ============
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, or MANAGER can attend alerts
    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para atender alertas' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { estado, attendedById, attendedByName } = body

    if (!estado || !['ATENDIDA', 'DESCARTADA'].includes(estado)) {
      return NextResponse.json(
        { error: 'estado debe ser ATENDIDA o DESCARTADA' },
        { status: 400 }
      )
    }

    // Find the alert
    const alert = await db.emergencyAlert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      )
    }

    // Validate alert belongs to same company (multitenancy)
    if (alert.companyId !== session.companyId) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      )
    }

    // Update the alert
    const updatedAlert = await db.emergencyAlert.update({
      where: { id },
      data: {
        estado,
        attendedById: attendedById || session.userId,
        attendedByName: attendedByName || session.name,
        attendedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE_EMERGENCY_ALERT',
      entityType: 'EMERGENCY_ALERT',
      entityId: alert.id,
      details: {
        previousEstado: alert.estado,
        newEstado: estado,
        attendedByName: attendedByName || session.name,
      },
    }, request)

    return NextResponse.json(updatedAlert)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Update emergency alert error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
