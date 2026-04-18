import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/inventory/devices — List inventory devices
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (locationId) {
      where.locationId = locationId
    }

    if (type) {
      where.type = type
    }

    const devices = await db.inventoryDevice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        location: {
          select: { id: true, name: true, province: true },
        },
      },
    })

    return NextResponse.json({
      devices: Array.isArray(devices) ? devices : [],
      total: Array.isArray(devices) ? devices.length : 0,
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET devices error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/inventory/devices — Register new device
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para registrar dispositivos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, locationId, type, ipAddress, metadata } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del dispositivo es requerido' }, { status: 400 })
    }

    if (!locationId || typeof locationId !== 'string') {
      return NextResponse.json({ error: 'La ubicación es requerida' }, { status: 400 })
    }

    // Verify location belongs to company
    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, companyId: session.companyId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    const device = await db.inventoryDevice.create({
      data: {
        companyId: session.companyId,
        locationId,
        name: name.trim(),
        type: type || 'CAMERA',
        ipAddress: ipAddress && typeof ipAddress === 'string' ? ipAddress.trim() : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'INVENTORY_DEVICE',
      entityId: device.id,
      details: {
        name: device.name,
        type: device.type,
        locationId,
        locationName: location.name,
      },
    }, request)

    return NextResponse.json(device, { status: 201 })
  } catch (error: unknown) {
    console.error('[Inventory API] POST device error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
