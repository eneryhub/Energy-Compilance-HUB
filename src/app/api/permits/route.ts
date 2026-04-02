import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkUserCompliance } from '@/lib/compliance'
import { createAuditLog } from '@/lib/audit'

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
      technicianName,
      supervisorName,
      workLocation,
      workDescription,
      technicianSignature,
      technicianSignatureGps,
      workLatitude,
      workLongitude,
      photos,
    } = body

    if (!riskType || !technicianName || !supervisorName || !workLocation || !workDescription) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
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
        locationSource: workLatitude ? 'gps' : 'manual',
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
      details: { permitNumber, riskType, technicianName, workLocation, photosCount: photos?.length || 0 },
    }, request)

    return NextResponse.json({
      permitNumber: permit.permitNumber,
      permitId: permit.id,
      message: 'Permiso creado exitosamente. Pendiente de aprobación.',
      pdf: null,
    })
  } catch (error: any) {
    console.error('Create permit error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
