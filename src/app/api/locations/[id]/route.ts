import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkSubscription } from '@/lib/subscription-guard'
import { generateQrSecret, buildQrPayload } from '@/lib/qr'
import { generateBeaconUuid, isValidBeaconUuid } from '@/lib/beacon'

// GET /api/locations/:id - Get single location
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
    const location = await db.workLocation.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        _count: {
          select: { sensors: true, permits: true },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    return NextResponse.json(location)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/locations/:id - Update location (with QR, Beacon support)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Sin permisos para editar ubicaciones' }, { status: 403 })
    }

    // Enforce subscription for write operations
    let subStatus
    try {
      subStatus = await checkSubscription(session.companyId)
    } catch (subErr) {
      console.error('[PUT /api/locations/:id] Subscription check failed:', subErr)
    }
    if (subStatus?.blockAccess) {
      return NextResponse.json(
        { error: `ACCESO BLOQUEADO: ${subStatus.message}`, code: 'SUBSCRIPTION_EXPIRED' },
        { status: 403 }
      )
    }

    const { id } = await params
    const existing = await db.workLocation.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      address,
      latitude,
      longitude,
      radiusMeters,
      verificationMethod,
      // Beacon fields
      beaconUuid: bodyBeaconUuid,
      beaconMajor,
      beaconMinor,
      beaconRssi,
      // QR fields
      regenerateQrCode,
    } = body

    // Validate fields
    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    }

    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: 'Latitud inválida (-90 a 90)' }, { status: 400 })
    }

    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: 'Longitud inválida (-180 a 180)' }, { status: 400 })
    }

    if (radiusMeters !== undefined && (radiusMeters < 10 || radiusMeters > 10000)) {
      return NextResponse.json({ error: 'El radio debe estar entre 10 y 10000 metros' }, { status: 400 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (address !== undefined) updateData.address = address || null
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (radiusMeters !== undefined) updateData.radiusMeters = radiusMeters
    if (verificationMethod !== undefined) updateData.verificationMethod = verificationMethod || null

    // ---- QR Code regeneration ----
    let qrResult = null
    if (regenerateQrCode) {
      const newSecret = generateQrSecret()
      const newPayload = buildQrPayload(id, newSecret, name || existing.name)
      updateData.qrCodeSecret = newSecret
      updateData.qrCodeData = JSON.stringify(newPayload)
      qrResult = { secret: newSecret, payload: newPayload }
    }

    // ---- Beacon field updates ----
    if (verificationMethod === 'BEACON' || bodyBeaconUuid !== undefined) {
      let uuid = bodyBeaconUuid

      if (uuid) {
        if (!isValidBeaconUuid(uuid)) {
          return NextResponse.json(
            { error: 'Formato de UUID de beacon inválido. Se espera formato 8-4-4-4-12 hex (ej: A1B2C3D4-E5F6-7890-ABCD-EF1234567890)' },
            { status: 400 }
          )
        }
        // Check UUID uniqueness (exclude current location)
        const existingUuid = await db.workLocation.findFirst({
          where: { beaconUuid: uuid, id: { not: id } },
        })
        if (existingUuid) {
          return NextResponse.json(
            { error: 'Ya existe otra ubicación con este UUID de beacon' },
            { status: 409 }
          )
        }
      }

      if (uuid !== undefined) updateData.beaconUuid = uuid || null
      if (beaconMajor !== undefined) {
        const major = Number(beaconMajor)
        if (major < 0 || major > 65535) {
          return NextResponse.json({ error: 'beaconMajor debe estar entre 0 y 65535' }, { status: 400 })
        }
        updateData.beaconMajor = major
      }
      if (beaconMinor !== undefined) {
        const minor = Number(beaconMinor)
        if (minor < 0 || minor > 65535) {
          return NextResponse.json({ error: 'beaconMinor debe estar entre 0 y 65535' }, { status: 400 })
        }
        updateData.beaconMinor = minor
      }
      if (beaconRssi !== undefined) {
        const rssi = Number(beaconRssi)
        if (rssi < -100 || rssi > 0) {
          return NextResponse.json({ error: 'beaconRssi debe estar entre -100 y 0 dBm' }, { status: 400 })
        }
        updateData.beaconRssi = rssi
      }
    }

    const updated = await db.workLocation.update({
      where: { id },
      data: updateData,
    })

    // Audit log (non-blocking)
    createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'WORK_LOCATION',
      entityId: id,
      details: {
        name,
        latitude,
        longitude,
        radiusMeters,
        verificationMethod,
        updatedFields: Object.keys(updateData),
      },
    }, request).catch(() => {/* non-blocking audit */})

    return NextResponse.json({
      location: updated,
      ...(qrResult ? { qr: qrResult } : {}),
    })
  } catch (error: unknown) {
    console.error('[PUT /api/locations/:id] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/locations/:id - Delete location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Sin permisos para eliminar ubicaciones' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.workLocation.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        _count: {
          select: { sensors: true, permits: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    // Check if location has related sensors or permits
    const relatedCount = existing._count.sensors + existing._count.permits
    if (relatedCount > 0) {
      return NextResponse.json({
        error: `No se puede eliminar. Tiene ${existing._count.sensors} sensor(es) y ${existing._count.permits} permiso(s) asociados. Elimine primero las relaciones.`,
      }, { status: 409 })
    }

    await db.workLocation.delete({ where: { id } })

    // Audit log (non-blocking)
    createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'WORK_LOCATION',
      entityId: id,
      details: { name: existing.name },
    }, request).catch(() => {/* non-blocking audit */})

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[DELETE /api/locations/:id] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
