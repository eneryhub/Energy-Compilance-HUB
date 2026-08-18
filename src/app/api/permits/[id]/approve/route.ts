import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { enforceCompliance } from '@/lib/compliance'
import { generatePermitPDF } from '@/lib/pdf-generator'
import { checkGeofence } from '@/lib/gps'
import { hashSignature } from '@/lib/gps'
import { createAuditLog } from '@/lib/audit'
import { emitGOCAlert } from '@/lib/goc-alerts'

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
    const { action, signature, gpsLatitude, gpsLongitude, gpsAccuracy, rejectionReason, approveJustification, rejectGeofenceJustification, deviceInfo, specialProtocol, overrideJustification } = body

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
        createdBy: { select: { id: true, name: true } },
        workLocationRef: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true } },
      }
    })

    if (!permit) {
      return NextResponse.json({ error: 'Permiso no encontrado o no está pendiente' }, { status: 404 })
    }

    // CRITICAL: Enforce compliance for supervisor too
    // EXCEPTION: Special Protocol bypass (requires ADMIN role + mandatory justification)
    if (specialProtocol) {
      // Only ADMIN can authorize special protocol bypass
      if (session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo ADMIN puede autorizar el Protocolo de Seguridad Especial' }, { status: 403 })
      }
      if (!overrideJustification || overrideJustification.trim().length < 20) {
        return NextResponse.json({ error: 'SPECIAL_PROTOCOL_JUSTIFICATION_REQUIRED', message: 'Debe proporcionar una justificación técnica detallada (mínimo 20 caracteres) para habilitar el Protocolo de Seguridad Especial.' }, { status: 400 })
      }
      // Skip enforceCompliance — proceed with approval under special protocol
    } else {
      await enforceCompliance(session.userId, session.companyId)
    }

    if (action === 'approve') {
      // Validate supervisor GPS is within geofence (only if GPS is available)
      const hasGps = gpsLatitude != null && gpsLongitude != null
      const hasWorkCoords = permit.workLatitude != null && permit.workLongitude != null

      // Determine effective radius: use WorkLocation's radius if linked, otherwise default
      const effectiveRadius = permit.workLocationRef?.radiusMeters || permit.workRadius || 100

      let geoResult: ReturnType<typeof checkGeofence> | null = null
      let isOutsideGeofence = false

      if (hasGps && hasWorkCoords) {
        geoResult = checkGeofence(
          { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy },
          { latitude: permit.workLatitude, longitude: permit.workLongitude },
          effectiveRadius
        )

        if (!geoResult.isWithinRadius) {
          isOutsideGeofence = true
          // Supervisors can approve outside geofence but MUST provide justification
          if (!approveJustification || approveJustification.trim().length < 10) {
            return NextResponse.json(
              {
                error: 'GEOFENCE_JUSTIFICATION_REQUIRED',
                message: `Supervisor fuera del área de trabajo (${Math.round(geoResult.distanceMeters)}m del sitio, radio: ${effectiveRadius}m). Debe proporcionar una justificación para aprobar este permiso fuera del rango.`,
                distance: geoResult.distanceMeters,
                maxRadius: effectiveRadius,
                requiresJustification: true,
              },
              { status: 403 }
            )
          }
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

      // ── GOC Side Effect: Geofence breach alert ──
      if (isOutsideGeofence && geoResult && hasGps) {
        try {
          await emitGOCAlert({
            companyId: session.companyId,
            type: 'GEOFENCE_BREACH',
            severity: 'HIGH',
            title: `Geocerca Violada: Permiso ${permit.permitNumber}`,
            message: `Supervisor ${session.name} aprobó el permiso ${permit.permitNumber} fuera de la geocerca. Distancia: ${Math.round(geoResult.distanceMeters)}m, Radio máximo: ${effectiveRadius}m.`,
            metadata: {
              permitId: permit.id,
              permitNumber: permit.permitNumber,
              supervisorName: session.name,
              supervisorId: session.userId,
              gpsLatitude,
              gpsLongitude,
              gpsAccuracy,
              workLatitude: permit.workLatitude,
              workLongitude: permit.workLongitude,
              distanceMeters: Math.round(geoResult.distanceMeters),
              effectiveRadius,
              justification: approveJustification,
            },
            relatedEntityId: permit.id,
            relatedEntityType: 'PERMIT',
          })
        } catch {
          // Fire-and-forget: don't block permit approval
        }
      }

      // Update permit
      const updatedPermit = await db.permit.update({
        where: { id: permit.id },
        data: {
          status: 'APPROVED',
          approvedById: session.userId,
          approvedByName: session.name,
          approvedAt: new Date(),
          supervisorSignature: signatureData,
          // Store justification if approved outside geofence
          ...(isOutsideGeofence ? { approveJustification } : {}),
          // Store Special Protocol fields if applicable
          ...(specialProtocol ? {
            isSpecialProtocol: true,
            overrideJustification: overrideJustification.trim(),
            specialApprovedById: session.userId,
          } : {}),
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          specialApprovedBy: { select: { id: true, name: true, role: true } },
        }
      })

      // Normalize technician signature for PDF
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
        workRadius: effectiveRadius,
        approveJustification: isOutsideGeofence ? approveJustification : undefined,
      }

      const pdfBuffer = await generatePermitPDF(pdfData)
      const pdfBase64 = pdfBuffer.toString('base64')

      // Audit log
      await createAuditLog({
        companyId: session.companyId, userId: session.userId,
        action: specialProtocol ? 'APPROVE_SPECIAL_PROTOCOL' : 'APPROVE',
        entityType: 'PERMIT', entityId: permit.id,
        details: {
          permitNumber: permit.permitNumber,
          gpsAvailable: hasGps,
          gpsWithinGeofence: geoResult?.isWithinRadius ?? null,
          distanceMeters: geoResult?.distanceMeters ?? null,
          outOfRangeJustification: isOutsideGeofence ? approveJustification : undefined,
          ...(specialProtocol ? {
            specialProtocol: true,
            overrideJustification: overrideJustification.trim(),
          } : {}),
        },
      }, request)

      return NextResponse.json({
        permit: updatedPermit,
        pdf: pdfBase64,
        ...(geoResult ? { geofence: geoResult } : {}),
        outOfRangeApproved: isOutsideGeofence,
      })

    } else {
      // REJECT action
      if (!rejectionReason) {
        return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 })
      }

      // Check GPS geofence for rejection (same logic as approval)
      const hasGps = gpsLatitude != null && gpsLongitude != null
      const hasWorkCoords = permit.workLatitude != null && permit.workLongitude != null
      const effectiveRadius = permit.workLocationRef?.radiusMeters || permit.workRadius || 100

      let geoResult: ReturnType<typeof checkGeofence> | null = null
      let isOutsideGeofence = false

      if (hasGps && hasWorkCoords) {
        geoResult = checkGeofence(
          { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy },
          { latitude: permit.workLatitude, longitude: permit.workLongitude },
          effectiveRadius
        )

        if (!geoResult.isWithinRadius) {
          isOutsideGeofence = true
          // Rejection is a safety action and should always be allowed,
          // but if outside geofence, justification is required
          if (!rejectGeofenceJustification || rejectGeofenceJustification.trim().length < 10) {
            return NextResponse.json(
              {
                error: 'GEOFENCE_JUSTIFICATION_REQUIRED',
                message: `Supervisor fuera del área de trabajo (${Math.round(geoResult.distanceMeters)}m del sitio, radio: ${effectiveRadius}m). Debe proporcionar una justificación para rechazar este permiso fuera del rango.`,
                distance: geoResult.distanceMeters,
                maxRadius: effectiveRadius,
                requiresJustification: true,
              },
              { status: 403 }
            )
          }
        }
      }

      // If outside geofence, prepend geofence warning to rejection reason
      let finalRejectionReason = rejectionReason
      if (isOutsideGeofence && geoResult) {
        const distance = Math.round(geoResult.distanceMeters)
        finalRejectionReason = `[SUPERVISOR FUERA DE GEOFENCE - ${distance}m] ${rejectionReason}`
      }

      const updatedPermit = await db.permit.update({
        where: { id: permit.id },
        data: {
          status: 'REJECTED',
          rejectedById: session.userId,
          rejectedByName: session.name,
          rejectedAt: new Date(),
          rejectionReason: finalRejectionReason
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          rejectedBy: { select: { id: true, name: true } }
        }
      })

      // Normalize technician signature for PDF
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
        workRadius: effectiveRadius,
        rejectionReason: finalRejectionReason,
        rejectGeofenceJustification: isOutsideGeofence ? rejectGeofenceJustification : undefined,
      }

      const pdfBuffer = await generatePermitPDF(pdfData)
      const pdfBase64 = pdfBuffer.toString('base64')

      // Audit log with geofence details
      await createAuditLog({
        companyId: session.companyId, userId: session.userId,
        action: 'REJECT', entityType: 'PERMIT', entityId: permit.id,
        details: {
          permitNumber: permit.permitNumber,
          reason: rejectionReason,
          gpsAvailable: hasGps,
          gpsWithinGeofence: geoResult?.isWithinRadius ?? null,
          distanceMeters: geoResult?.distanceMeters ?? null,
          outOfRangeJustification: isOutsideGeofence ? rejectGeofenceJustification : undefined,
        },
      }, request)

      return NextResponse.json({
        permit: updatedPermit,
        pdf: pdfBase64,
        ...(geoResult ? { geofence: geoResult } : {}),
        ...(isOutsideGeofence ? { outOfRangeRejected: true } : {}),
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
