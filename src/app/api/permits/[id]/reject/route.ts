import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { enforceCompliance } from '@/lib/compliance'
import { generatePermitPDF } from '@/lib/pdf-generator'
import { createAuditLog } from '@/lib/audit'

// POST /api/permits/[id]/reject - Reject a permit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Solo administradores y supervisores pueden rechazar permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 })
    }

    // Enforce compliance
    await enforceCompliance(session.userId, session.companyId)

    const permit = await db.permit.findFirst({
      where: { id, companyId: session.companyId, status: 'PENDING' },
    })

    if (!permit) {
      return NextResponse.json({ error: 'Permiso no encontrado o no está pendiente' }, { status: 404 })
    }

    const updatedPermit = await db.permit.update({
      where: { id: permit.id },
      data: {
        status: 'REJECTED',
        rejectedById: session.userId,
        rejectedByName: session.name,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    })

    // Generate rejection PDF
    const pdfData = {
      permitNumber: updatedPermit.permitNumber,
      status: 'REJECTED',
      riskType: updatedPermit.riskType,
      createdAt: updatedPermit.createdAt.toISOString(),
      technicianName: updatedPermit.technicianName,
      supervisorName: updatedPermit.supervisorName,
      workLocation: updatedPermit.workLocation,
      workDescription: updatedPermit.workDescription,
      safetyChecks: JSON.parse(updatedPermit.safetyChecks || '{}'),
      technicianSignature: updatedPermit.technicianSignature ? JSON.parse(updatedPermit.technicianSignature) : null,
      supervisorSignature: null,
      photos: updatedPermit.photos ? JSON.parse(updatedPermit.photos) : null,
      workLatitude: updatedPermit.workLatitude,
      workLongitude: updatedPermit.workLongitude,
      workRadius: updatedPermit.workRadius,
      rejectionReason: reason.trim(),
    }

    const pdfBuffer = await generatePermitPDF(pdfData)
    const pdfBase64 = pdfBuffer.toString('base64')

    await createAuditLog({
      companyId: session.companyId, userId: session.userId,
      action: 'REJECT', entityType: 'PERMIT', entityId: permit.id,
      details: { permitNumber: permit.permitNumber, reason: reason.trim() },
    }, request)

    return NextResponse.json({ permit: updatedPermit, pdf: pdfBase64 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    if (message.includes('BLOQUEADO POR CUMPLIMIENTO HSE')) {
      return NextResponse.json({ error: message, code: 'COMPLIANCE_BLOCKED' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
