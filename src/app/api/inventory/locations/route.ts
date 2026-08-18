import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/inventory/locations — List inventory locations
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')

    const where: Record<string, unknown> = { companyId: session.companyId }
    if (province) {
      where.province = province
    }

    const locations = await db.inventoryLocation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        _count: {
          select: {
            stock: true,
            devices: true,
            audits: true,
          },
        },
      },
    })

    return NextResponse.json({
      locations: Array.isArray(locations) ? locations : [],
      total: Array.isArray(locations) ? locations.length : 0,
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET locations error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/inventory/locations — Create inventory location
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para crear ubicaciones de inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, province, city, address, latitude, longitude } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre de la ubicación es requerido' }, { status: 400 })
    }

    const location = await db.inventoryLocation.create({
      data: {
        companyId: session.companyId,
        name: name.trim(),
        province: province && typeof province === 'string' ? province.trim() : null,
        city: city && typeof city === 'string' ? city.trim() : null,
        address: address && typeof address === 'string' ? address.trim() : null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'INVENTORY_LOCATION',
      entityId: location.id,
      details: { name: location.name, province: location.province, city: location.city },
    }, request)

    return NextResponse.json(location, { status: 201 })
  } catch (error: unknown) {
    console.error('[Inventory API] POST location error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
