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

    // Only ADMIN and SUPERVISOR can approve/reject
    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Solo administradores y supervisores pueden aprobar o rechazar permisos' }, { status: 403 })
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
      // Validate supervisor GPS is within geofence
      if (permit.workLatitude && permit.workLongitude) {
        if (!gpsLatitude || !gpsLongitude) {
          return NextResponse.json(
            { error: 'Coordenadas GPS del supervisor son requeridas para la aprobación. Active su ubicación.' },
            { status: 400 }
          )
        }

        const geoResult = checkGeofence(
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

        // Save signature with GPS validation
        const signatureData = JSON.stringify({
          signerName: session.name,
          timestamp: new Date().toISOString(),
          location: { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy },
          signatureData: signature || null,
          is_within_geofence: true,
          distance_to_work_meters: geoResult.distanceMeters
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
            latitude: gpsLatitude,
            longitude: gpsLongitude,
            accuracyMeters: gpsAccuracy || null,
            isWithinGeofence: true,
            distanceToWorkMeters: geoResult.distanceMeters,
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
          technicianSignature: updatedPermit.technicianSignature ? JSON.parse(updatedPermit.technicianSignature) : null,
          supervisorSignature: { signerName: session.name, timestamp: new Date().toISOString(), location: { latitude: gpsLatitude, longitude: gpsLongitude, accuracy: gpsAccuracy }, signatureData: signature || undefined, is_within_geofence: true, distance_to_work_meters: geoResult.distanceMeters },
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
          details: { permitNumber: permit.permitNumber, gpsWithinGeofence: true, distanceMeters: geoResult.distanceMeters },
        }, request)

        return NextResponse.json({
          permit: updatedPermit,
          pdf: pdfBase64,
          geofence: geoResult
        })

      } else {
        // No GPS required (manual location)
        const signatureData = JSON.stringify({
          signerName: session.name,
          timestamp: new Date().toISOString(),
          signatureData: signature || null,
          is_within_geofence: null,
          distance_to_work_meters: null
        })

        const sigHash = await hashSignature(signatureData)

        await db.signature.create({
          data: {
            permitId: permit.id,
            signerType: 'SUPERVISOR',
            signerName: session.name,
            signerId: session.userId,
            signatureData: signature || '',
            signatureHash: sigHash,
            signedAt: new Date()
          }
        })

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

        // Generate PDF
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
          technicianSignature: updatedPermit.technicianSignature ? JSON.parse(updatedPermit.technicianSignature) : null,
          supervisorSignature: { signerName: session.name, timestamp: new Date().toISOString(), signatureData: signature || undefined },
          photos: updatedPermit.photos ? JSON.parse(updatedPermit.photos) : null,
          workLatitude: updatedPermit.workLatitude,
          workLongitude: updatedPermit.workLongitude,
          workRadius: updatedPermit.workRadius
        }

        const pdfBuffer = await generatePermitPDF(pdfData)
        const pdfBase64 = pdfBuffer.toString('base64')

        await createAuditLog({
          companyId: session.companyId, userId: session.userId,
          action: 'APPROVE', entityType: 'PERMIT', entityId: permit.id,
          details: { permitNumber: permit.permitNumber, gpsNotRequired: true },
        }, request)

        return NextResponse.json({
          permit: updatedPermit,
          pdf: pdfBase64
        })
      }

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
