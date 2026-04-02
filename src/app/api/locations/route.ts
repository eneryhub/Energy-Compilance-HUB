import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/locations - List work locations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where = { companyId: session.companyId }

    const [locations, total] = await Promise.all([
      db.workLocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.workLocation.count({ where })
    ])

    return NextResponse.json({
      locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/locations - Create new work location with GPS
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN and SUPERVISOR can create locations
    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Solo administradores, supervisores y gerentes pueden crear ubicaciones' }, { status: 403 })
    }

    const body = await request.json()
    const { name, address, latitude, longitude, radiusMeters, verificationMethod } = body

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Nombre, latitud y longitud son requeridos' }, { status: 400 })
    }

    // Validate GPS coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordenadas GPS inválidas' }, { status: 400 })
    }

    if (radiusMeters && (radiusMeters < 10 || radiusMeters > 10000)) {
      return NextResponse.json({ error: 'El radio debe estar entre 10 y 10000 metros' }, { status: 400 })
    }

    const location = await db.workLocation.create({
      data: {
        companyId: session.companyId,
        name,
        address: address || null,
        latitude,
        longitude,
        radiusMeters: radiusMeters || 100,
        verificationMethod: verificationMethod || null
      }
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'WORK_LOCATION',
      entityId: location.id,
      details: { name, latitude, longitude, radiusMeters: location.radiusMeters }
    }, request)

    return NextResponse.json({ location }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
