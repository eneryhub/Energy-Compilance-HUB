import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { enforceCompliance } from '@/lib/compliance'
import { generatePermitPDF } from '@/lib/pdf-generator'
import { createAuditLog } from '@/lib/audit'
import { checkSubscription } from '@/lib/subscription-guard'

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

    const canApproveRoles = ['ADMIN', 'SUPERVISOR', 'GERENTE', 'MANAGER']
    if (!canApproveRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Solo supervisores, gerentes o administradores pueden rechazar permisos' }, { status: 403 })
    }

    // Enforce subscription for write operations
    const subStatus = await checkSubscription(session.companyId)
    if (subStatus.blockAccess) {
      return NextResponse.json(
        { error: `ACCESO BLOQUEADO: ${subStatus.message}`, code: 'SUBSCRIPTION_EXPIRED' },
        { status: 403 }
      )
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

    // Normalize technician signature for PDF (technician uses {data, gps} format)
    let normalizedTechSigForPdf = null
    if (updatedPermit.technicianSignature) {
      try {
        const raw = JSON.parse(updatedPermit.technicianSignature)
        normalizedTechSigForPdf = {
          signerName: raw.signerName || updatedPermit.technicianName,
          timestamp: raw.timestamp || updatedPermit.createdAt.toISOString(),
          location: raw.location || raw.gps || null,
          signatureData: raw.signatureData || raw.data || null,
          is_within_geofence: raw.is_within_geofence,
          distance_to_work_meters: raw.distance_to_work_meters,
        }
      } catch { normalizedTechSigForPdf = null }
    }

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
      technicianSignature: normalizedTechSigForPdf,
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
