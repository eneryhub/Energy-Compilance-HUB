import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/transport/vehicles — List vehicles with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const isActiveParam = searchParams.get('isActive')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (type) where.type = type
    if (status) where.status = status
    if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    if (search) {
      where.OR = [
        { plate: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
      ]
    }

    const vehicles = await db.transportVehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        currentDriver: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Flatten driver data into vehicle response
    const flatVehicles = vehicles.map(v => ({
      ...v,
      currentDriverName: v.currentDriver?.name || null,
      mileage: null, // Will be computed from trips when available
    }))

    return NextResponse.json({
      vehicles: flatVehicles,
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET vehicles error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/vehicles — Register vehicle (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para registrar vehículos' }, { status: 403 })
    }

    const body = await request.json()
    const { plate, type, brand, model, year, capacityKg, vin } = body

    if (!plate || typeof plate !== 'string' || plate.trim().length === 0) {
      return NextResponse.json({ error: 'La patente es requerida' }, { status: 400 })
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'El tipo de vehículo es requerido' }, { status: 400 })
    }

    // Check plate uniqueness within company
    const existing = await db.transportVehicle.findFirst({
      where: { companyId: session.companyId, plate: plate.trim().toUpperCase() },
    })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un vehículo con esta patente' }, { status: 409 })
    }

    const vehicle = await db.transportVehicle.create({
      data: {
        companyId: session.companyId,
        plate: plate.trim().toUpperCase(),
        type: type.trim(),
        brand: brand ? String(brand).trim() : null,
        model: model ? String(model).trim() : null,
        year: typeof year === 'number' ? year : null,
        capacityKg: typeof capacityKg === 'number' ? capacityKg : null,
        vin: vin ? String(vin).trim() : null,
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_VEHICLE',
      entityId: vehicle.id,
      details: { plate: vehicle.plate, type: vehicle.type },
    }, request)

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST vehicle error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
