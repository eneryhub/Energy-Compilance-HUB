import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/permits/[id] - Get single permit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const permit = await db.permit.findUnique({
      where: { id },
    })

    if (!permit || permit.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 })
    }

    return NextResponse.json(permit)
  } catch (error) {
    console.error('Get permit error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// POST /api/permits/[id]/approve or /api/permits/[id]/reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const permit = await db.permit.findUnique({
      where: { id },
    })

    if (!permit || permit.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 })
    }

    if (permit.status !== 'PENDING') {
      return NextResponse.json({ error: 'El permiso no está pendiente' }, { status: 400 })
    }

    const body = await request.json()
    const action = body.action || 'approve'
    const reason = body.reason

    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 })
      }

      const updated = await db.permit.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedById: session.userId,
          rejectedByName: session.name,
          rejectedAt: new Date(),
        },
      })

      // Audit log
      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'REJECT',
        entityType: 'PERMIT',
        entityId: id,
        details: { permitNumber: permit.permitNumber, reason },
      }, request)

      return NextResponse.json({ message: 'Permiso rechazado', permit: updated })
    }

    // Approve
    const updated = await db.permit.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: session.userId,
        approvedByName: session.name,
        approvedAt: new Date(),
        supervisorSignature: body.signatureData
          ? JSON.stringify({
              data: body.signatureData,
              gps: body.gpsCoordinates || null,
            })
          : undefined,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'APPROVE',
      entityType: 'PERMIT',
      entityId: id,
      details: { permitNumber: permit.permitNumber },
    }, request)

    return NextResponse.json({ message: 'Permiso aprobado exitosamente', permit: updated })
  } catch (error) {
    console.error('Permit action error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
