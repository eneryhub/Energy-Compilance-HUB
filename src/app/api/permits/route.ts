import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkUserCompliance } from '@/lib/compliance'
import { createAuditLog } from '@/lib/audit'
import { generatePermitPDF } from '@/lib/pdf-generator'
import { calculateDistance } from '@/lib/gps'
import { validateQrPayload, decodeQrPayloadFromString } from '@/lib/qr'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const where: any = { companyId: session.companyId }
    if (statusFilter) {
      where.status = statusFilter
    }

    const permits = await db.permit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(permits)
  } catch (error: any) {
    console.error('Get permits error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check compliance
    const compliance = await checkUserCompliance(session.userId, session.companyId)
    if (!compliance.isCompliant) {
      return NextResponse.json(
        {
          error: 'OPERACIONES BLOQUEADAS: Tiene documentos críticos vencidos',
          expiredDocuments: compliance.expiredCriticalDocuments,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      riskType,
      safetyChecks,
      checklistNotes,
      technicianName,
      supervisorName,
      workLocation,
      workDescription,
      technicianSignature,
      technicianSignatureGps,
      workLatitude,
      workLongitude,
      workLocationId,
      photos,
      qrScannedCode,
      beaconDetected,
    } = body

    if (!riskType || !technicianName || !supervisorName || !workLocation || !workDescription) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    // ---- Location verification ----
    // If a WorkLocationId is provided, verify based on verificationMethod
    if (workLocationId) {
      // Verify the location belongs to the company
      const savedLocation = await db.workLocation.findFirst({
        where: { id: workLocationId, companyId: session.companyId },
      })

      if (!savedLocation) {
        return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
      }

      const method = savedLocation.verificationMethod || 'GPS'

      // ---- GPS verification (default) ----
      if (method === 'GPS') {
        if (!workLatitude || !workLongitude) {
          return NextResponse.json(
            {
              error: 'GPS_REQUERIDO',
              message: 'Debe capturar su ubicación GPS para crear un permiso en esta ubicación.',
            },
            { status: 400 }
          )
        }

        const distance = calculateDistance(
          { latitude: workLatitude, longitude: workLongitude },
          { latitude: savedLocation.latitude, longitude: savedLocation.longitude }
        )

        if (distance > savedLocation.radiusMeters) {
          return NextResponse.json(
            {
              error: 'GEOFENCE_VIOLATION',
              message: `Fuera del área de trabajo. Está a ${Math.round(distance)}m de "${savedLocation.name}" (radio máximo: ${savedLocation.radiusMeters}m).`,
              distance: Math.round(distance),
              maxRadius: savedLocation.radiusMeters,
              locationName: savedLocation.name,
            },
            { status: 403 }
          )
        }
      }

      // ---- QR Code verification ----
      else if (method === 'QR_CODE') {
        if (!qrScannedCode) {
          return NextResponse.json(
            {
              error: 'QR_REQUERIDO',
              message: 'Debe escanear el código QR de esta ubicación para crear el permiso.',
            },
            { status: 400 }
          )
        }

        const qrCodeSecret = (savedLocation as Record<string, unknown>).qrCodeSecret as string | null | undefined
        if (!qrCodeSecret) {
          return NextResponse.json(
            {
              error: 'QR_NO_CONFIGURADO',
              message: 'Esta ubicación no tiene código QR configurado. Genere uno desde SCADA → Ubicaciones.',
            },
            { status: 400 }
          )
        }

        // Decode the scanned string and validate against stored secret
        const decodedPayload = decodeQrPayloadFromString(qrScannedCode.trim())
        if (!decodedPayload) {
          return NextResponse.json(
            {
              error: 'QR_INVALIDO',
              message: 'Formato de código QR no reconocido. Escanee el código QR de la ubicación.',
            },
            { status: 403 }
          )
        }

        const qrResult = validateQrPayload(decodedPayload, qrCodeSecret)
        if (!qrResult.valid) {
          return NextResponse.json(
            {
              error: 'QR_INVALIDO',
              message: `Verificación QR fallida: ${qrResult.message}`,
            },
            { status: 403 }
          )
        }
      }

      // ---- Beacon BLE verification ----
      else if (method === 'BEACON') {
        if (!beaconDetected) {
          return NextResponse.json(
            {
              error: 'BEACON_REQUERIDO',
              message: 'Debe estar dentro del rango del Beacon BLE para crear el permiso en esta ubicación.',
            },
            { status: 400 }
          )
        }
        // beaconDetected=true means the client confirmed BLE proximity
      }
    }

    // Generate permit number
    const year = new Date().getFullYear()
    const count = await db.permit.count({
      where: { companyId: session.companyId },
    })
    const permitNumber = `PT-${year}-${String(count + 1).padStart(4, '0')}`

    // Create permit
    const permit = await db.permit.create({
      data: {
        companyId: session.companyId,
        permitNumber,
        riskType,
        status: 'PENDING',
        safetyChecks: JSON.stringify(safetyChecks || {}),
        checklistNotes: checklistNotes ? JSON.stringify(checklistNotes) : null,
        technicianName,
        supervisorName,
        workLocation,
        workDescription,
        technicianSignature: technicianSignature
          ? JSON.stringify({
              data: technicianSignature,
              gps: technicianSignatureGps || null,
            })
          : undefined,
        photos: photos ? JSON.stringify(photos) : undefined,
        photosCount: photos?.length || 0,
        workLatitude: workLatitude || null,
        workLongitude: workLongitude || null,
        locationSource: method === 'QR_CODE' ? 'qr' : method === 'BEACON' ? 'beacon' : (workLatitude ? 'gps' : 'manual'),
        workLocationId: workLocationId || null,
        createdById: session.userId,
        createdByName: session.name,
        createdByRole: session.role,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'PERMIT',
      entityId: permit.id,
      details: { permitNumber, riskType, technicianName, workLocation, photosCount: photos?.length || 0, workLocationId: workLocationId || null },
    }, request)

    // Generate PDF for the new permit
    const pdfData = {
      permitNumber: permit.permitNumber,
      status: 'PENDING',
      riskType: permit.riskType,
      createdAt: permit.createdAt.toISOString(),
      technicianName: permit.technicianName,
      supervisorName: permit.supervisorName,
      workLocation: permit.workLocation,
      workDescription: permit.workDescription,
      safetyChecks: JSON.parse(permit.safetyChecks || '{}'),
      checklistNotes: permit.checklistNotes ? JSON.parse(permit.checklistNotes) : {},
      technicianSignature: permit.technicianSignature ? (() => {
        try {
          const sig = JSON.parse(permit.technicianSignature)
          return {
            signerName: session.name,
            timestamp: permit.createdAt.toISOString(),
            location: sig.gps || null,
            signatureData: sig.data || null,
          }
        } catch { return null }
      })() : null,
      supervisorSignature: null,
      photos: permit.photos ? JSON.parse(permit.photos) : null,
      workLatitude: permit.workLatitude,
      workLongitude: permit.workLongitude,
      workRadius: permit.workRadius,
    }

    let pdfBase64: string | null = null
    try {
      const pdfBuffer = await generatePermitPDF(pdfData)
      pdfBase64 = pdfBuffer.toString('base64')
    } catch (pdfError) {
      console.error('PDF generation error on create:', pdfError)
      // Don't block the response if PDF fails
    }

    return NextResponse.json({
      permitNumber: permit.permitNumber,
      permitId: permit.id,
      message: 'Permiso creado exitosamente. Pendiente de aprobación.',
      pdf: pdfBase64,
    })
  } catch (error: any) {
    console.error('Create permit error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
