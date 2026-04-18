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
    const { name, locationId, type, ipAddress, metadata, beaconUuid, beaconMajor, beaconMinor, beaconRssi } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del dispositivo es requerido' }, { status: 400 })
    }

    if (!locationId || typeof locationId !== 'string') {
      return NextResponse.json({ error: 'La ubicación es requerida' }, { status: 400 })
    }

    const deviceType = type || 'CAMERA'

    // Validate BLE fields for BEACON_GATEWAY type
    if (deviceType === 'BEACON_GATEWAY') {
      if (beaconUuid && typeof beaconUuid === 'string') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(beaconUuid)) {
          return NextResponse.json(
            { error: 'El UUID del beacon debe tener formato UUID v4 (36 caracteres con guiones)' },
            { status: 400 }
          )
        }
      }
      if (beaconMajor !== undefined && beaconMajor !== null) {
        const major = Number(beaconMajor)
        if (!Number.isInteger(major) || major < 0 || major > 65535) {
          return NextResponse.json(
            { error: 'El valor Major debe ser un entero entre 0 y 65535' },
            { status: 400 }
          )
        }
      }
      if (beaconMinor !== undefined && beaconMinor !== null) {
        const minor = Number(beaconMinor)
        if (!Number.isInteger(minor) || minor < 0 || minor > 65535) {
          return NextResponse.json(
            { error: 'El valor Minor debe ser un entero entre 0 y 65535' },
            { status: 400 }
          )
        }
      }
      if (beaconRssi !== undefined && beaconRssi !== null) {
        const rssi = Number(beaconRssi)
        if (!Number.isInteger(rssi) || rssi < -100 || rssi > 0) {
          return NextResponse.json(
            { error: 'El RSSI debe ser un valor entero entre -100 y 0 dBm' },
            { status: 400 }
          )
        }
      }
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
        type: deviceType,
        ipAddress: deviceType === 'CAMERA' && ipAddress && typeof ipAddress === 'string' ? ipAddress.trim() : null,
        beaconUuid: deviceType === 'BEACON_GATEWAY' && beaconUuid && typeof beaconUuid === 'string' ? beaconUuid.trim().toLowerCase() : null,
        beaconMajor: deviceType === 'BEACON_GATEWAY' && beaconMajor !== undefined && beaconMajor !== null ? Number(beaconMajor) : null,
        beaconMinor: deviceType === 'BEACON_GATEWAY' && beaconMinor !== undefined && beaconMinor !== null ? Number(beaconMinor) : null,
        beaconRssi: deviceType === 'BEACON_GATEWAY' && beaconRssi !== undefined && beaconRssi !== null ? Number(beaconRssi) : -70,
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
