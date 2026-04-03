import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { enforceCompliance } from '@/lib/compliance'
import { generatePermitPDF } from '@/lib/pdf-generator'
import { checkGeofence } from '@/lib/gps'
import { hashSignature } from '@/lib/gps'
import { createAuditLog } from '@/lib/audit'

// POST /api/permits/[id]/approve - Approve or reject a permit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, GERENTE, MANAGER can approve/reject
    const canApproveRoles = ['ADMIN', 'SUPERVISOR', 'GERENTE', 'MANAGER']
    if (!canApproveRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Solo supervisores, gerentes o administradores pueden aprobar o rechazar permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, signature, gpsLatitude, gpsLongitude, gpsAccuracy, rejectionReason, deviceInfo } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida. Use "approve" o "reject"' }, { status: 400 })
    }

    // Find permit
    const permit = await db.permit.findFirst({
      where: {
        id,
        companyId: session.companyId,
        status: 'PENDING'
      },
      include: {
        createdBy: { select: { id: true, name: true } }
      }
    })

    if (!permit) {
      return NextResponse.json({ error: 'Permiso no encontrado o no está pendiente' }, { status: 404 })
    }

    // CRITICAL: Enforce compliance for supervisor too
    await enforceCompliance(session.userId, session.companyId)

    if (action === 'approve') {
      // Validate supervisor GPS is within geofence (only if GPS is available)
      const hasGps = gpsLatitude != null && gpsLongitude != null
      const hasWorkCoords = permit.workLatitude != null && permit.workLongitude != null

      let geoResult: ReturnType<typeof checkGeofence> | null = null

      if (hasGps && hasWorkCoords) {
        geoResult = checkGeofence(
          { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy },
          { latitude: permit.workLatitude, longitude: permit.workLongitude },
          permit.workRadius
        )

        if (!geoResult.isWithinRadius) {
          return NextResponse.json(
            {
              error: `Supervisor fuera del área de trabajo. Distancia: ${geoResult.distanceMeters}m (máximo permitido: ${geoResult.radiusMeters}m). Acerquese al sitio de trabajo para aprobar.`,
              code: 'GEOFENCE_VIOLATION',
              distance: geoResult.distanceMeters,
              maxRadius: geoResult.radiusMeters
            },
            { status: 403 }
          )
        }
      }

      // Save signature with GPS data if available
      const signatureData = JSON.stringify({
        signerName: session.name,
        timestamp: new Date().toISOString(),
        ...(hasGps ? { location: { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy } } : {}),
        signatureData: signature || null,
        is_within_geofence: geoResult?.isWithinRadius ?? null,
        distance_to_work_meters: geoResult?.distanceMeters ?? null
      })

      // Hash signature for integrity
      const sigHash = await hashSignature(signatureData)

      // Create signature record
      await db.signature.create({
        data: {
          permitId: permit.id,
          signerType: 'SUPERVISOR',
          signerName: session.name,
          signerId: session.userId,
          signatureData: signature || '',
          signatureHash: sigHash,
          signedAt: new Date(),
          ...(hasGps ? {
            latitude: gpsLatitude,
            longitude: gpsLongitude,
            accuracyMeters: gpsAccuracy || null,
          } : {}),
          isWithinGeofence: geoResult?.isWithinRadius ?? null,
          distanceToWorkMeters: geoResult?.distanceMeters ?? null,
          deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null
        }
      })

      // Update permit
      const updatedPermit = await db.permit.update({
        where: { id: permit.id },
        data: {
          status: 'APPROVED',
          approvedById: session.userId,
          approvedByName: session.name,
          approvedAt: new Date(),
          supervisorSignature: signatureData
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } }
        }
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

      // Generate APPROVED PDF
      const pdfData = {
        permitNumber: updatedPermit.permitNumber,
        status: 'APPROVED',
        riskType: updatedPermit.riskType,
        createdAt: updatedPermit.createdAt.toISOString(),
        technicianName: updatedPermit.technicianName,
        supervisorName: updatedPermit.supervisorName,
        approvedByName: updatedPermit.approvedByName || undefined,
        workLocation: updatedPermit.workLocation,
        workDescription: updatedPermit.workDescription,
        safetyChecks: JSON.parse(updatedPermit.safetyChecks || '{}'),
        technicianSignature: normalizedTechSigForPdf,
        supervisorSignature: { signerName: session.name, timestamp: new Date().toISOString(), ...(hasGps ? { location: { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy } } : {}), signatureData: signature || undefined, is_within_geofence: geoResult?.isWithinRadius ?? null, distance_to_work_meters: geoResult?.distanceMeters ?? null },
        photos: updatedPermit.photos ? JSON.parse(updatedPermit.photos) : null,
        workLatitude: updatedPermit.workLatitude,
        workLongitude: updatedPermit.workLongitude,
        workRadius: updatedPermit.workRadius
      }

      const pdfBuffer = await generatePermitPDF(pdfData)
      const pdfBase64 = pdfBuffer.toString('base64')

      // Audit log
      await createAuditLog({
        companyId: session.companyId, userId: session.userId,
        action: 'APPROVE', entityType: 'PERMIT', entityId: permit.id,
        details: { permitNumber: permit.permitNumber, gpsAvailable: hasGps, gpsWithinGeofence: geoResult?.isWithinRadius ?? null, distanceMeters: geoResult?.distanceMeters ?? null },
      }, request)

      return NextResponse.json({
        permit: updatedPermit,
        pdf: pdfBase64,
        ...(geoResult ? { geofence: geoResult } : {})
      })

    } else {
      // REJECT action
      if (!rejectionReason) {
        return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 })
      }

      const updatedPermit = await db.permit.update({
        where: { id: permit.id },
        data: {
          status: 'REJECTED',
          rejectedById: session.userId,
          rejectedByName: session.name,
          rejectedAt: new Date(),
          rejectionReason
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          rejectedBy: { select: { id: true, name: true } }
        }
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
        rejectionReason
      }

      const pdfBuffer = await generatePermitPDF(pdfData)
      const pdfBase64 = pdfBuffer.toString('base64')

      // Audit log
      await createAuditLog({
        companyId: session.companyId, userId: session.userId,
        action: 'REJECT', entityType: 'PERMIT', entityId: permit.id,
        details: { permitNumber: permit.permitNumber, reason: rejectionReason },
      }, request)

      return NextResponse.json({
        permit: updatedPermit,
        pdf: pdfBase64
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'

    if (message.includes('BLOQUEADO POR CUMPLIMIENTO HSE')) {
      return NextResponse.json({ error: message, code: 'COMPLIANCE_BLOCKED' }, { status: 403 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
