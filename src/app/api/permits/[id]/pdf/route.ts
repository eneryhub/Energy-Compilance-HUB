import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generatePermitPDF } from '@/lib/pdf-generator'

// GET /api/permits/[id]/pdf - Generate PDF for an existing permit
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

    // Normalize technician signature (technician uses {data, gps}, supervisor uses {signatureData, location})
    let normalizedTechSig = null
    if (permit.technicianSignature) {
      try {
        const raw = JSON.parse(permit.technicianSignature)
        normalizedTechSig = {
          signerName: raw.signerName || permit.technicianName,
          timestamp: raw.timestamp || permit.createdAt.toISOString(),
          location: raw.location || raw.gps || null,
          signatureData: raw.signatureData || raw.data || null,
          is_within_geofence: raw.is_within_geofence,
          distance_to_work_meters: raw.distance_to_work_meters,
        }
      } catch { normalizedTechSig = null }
    }

    // Normalize supervisor signature
    let normalizedSupSig = null
    if (permit.supervisorSignature) {
      try {
        const raw = JSON.parse(permit.supervisorSignature)
        normalizedSupSig = {
          signerName: raw.signerName || permit.approvedByName || 'Supervisor',
          timestamp: raw.timestamp || null,
          location: raw.location || raw.gps || null,
          signatureData: raw.signatureData || raw.data || null,
          is_within_geofence: raw.is_within_geofence,
          distance_to_work_meters: raw.distance_to_work_meters,
        }
      } catch { normalizedSupSig = null }
    }

    // Build PDF data
    const pdfData = {
      permitNumber: permit.permitNumber,
      status: permit.status,
      riskType: permit.riskType,
      createdAt: permit.createdAt.toISOString(),
      technicianName: permit.technicianName,
      supervisorName: permit.supervisorName,
      approvedByName: permit.approvedByName || undefined,
      workLocation: permit.workLocation,
      workDescription: permit.workDescription,
      safetyChecks: JSON.parse(permit.safetyChecks || '{}'),
      technicianSignature: normalizedTechSig,
      supervisorSignature: normalizedSupSig,
      photos: permit.photos ? (() => {
        try { return JSON.parse(permit.photos) } catch { return null }
      })() : null,
      workLatitude: permit.workLatitude,
      workLongitude: permit.workLongitude,
      workRadius: permit.workRadius,
      rejectionReason: permit.rejectionReason,
    }

    const pdfBuffer = await generatePermitPDF(pdfData)
    const pdfBase64 = pdfBuffer.toString('base64')

    return NextResponse.json({
      pdf: pdfBase64,
      permitNumber: permit.permitNumber,
      status: permit.status,
    })
  } catch (error: unknown) {
    console.error('PDF generation error:', error)
    const message = error instanceof Error ? error.message : 'Error al generar PDF'
    return NextResponse.json({ error: `Error al generar PDF: ${message}` }, { status: 500 })
  }
}
