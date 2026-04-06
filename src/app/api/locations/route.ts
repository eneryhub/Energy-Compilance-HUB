import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { checkSubscription } from '@/lib/subscription-guard'
import { generateQrSecret, buildQrPayload, type QrPayload } from '@/lib/qr'
import { generateBeaconUuid, isValidBeaconUuid } from '@/lib/beacon'

// GET /api/locations - List work locations with verification fields
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

    // Use a safe select that only includes core fields
    // to avoid issues if the DB schema is out of sync
    const [locations, total] = await Promise.all([
      db.workLocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.workLocation.count({ where }),
    ])

    return NextResponse.json({
      locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    console.error('[POST /api/locations GET] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/locations - Create new work location with GPS, QR, or Beacon verification
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, and MANAGER can create locations
    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Solo administradores, supervisores y gerentes pueden crear ubicaciones' },
        { status: 403 }
      )
    }

    // Enforce subscription for write operations
    let subStatus
    try {
      subStatus = await checkSubscription(session.companyId)
    } catch (subErr) {
      console.error('[POST /api/locations] Subscription check failed:', subErr)
      // Continue without blocking if subscription check fails
    }
    if (subStatus?.blockAccess) {
      return NextResponse.json(
        { error: `ACCESO BLOQUEADO: ${subStatus.message}`, code: 'SUBSCRIPTION_EXPIRED' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      address,
      latitude,
      longitude,
      radiusMeters,
      verificationMethod,
      // Beacon fields (optional)
      beaconUuid: bodyBeaconUuid,
      beaconMajor,
      beaconMinor,
      beaconRssi,
    } = body

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Nombre, latitud y longitud son requeridos' },
        { status: 400 }
      )
    }

    // Validate GPS coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordenadas GPS inválidas' }, { status: 400 })
    }

    if (radiusMeters && (radiusMeters < 10 || radiusMeters > 10000)) {
      return NextResponse.json(
        { error: 'El radio debe estar entre 10 y 10000 metros' },
        { status: 400 }
      )
    }

    // Build creation data with only core fields
    const createData = {
      companyId: session.companyId,
      name,
      address: address || null,
      latitude,
      longitude,
      radiusMeters: radiusMeters || 100,
      verificationMethod: verificationMethod || null,
    }

    let qrData: QrPayload | null = null
    let qrSecret: string | null = null
    let beaconConfig: {
      uuid: string
      major: number | null
      minor: number | null
      rssi: number
    } | null = null

    // ---- QR_CODE verification ----
    if (verificationMethod === 'QR_CODE') {
      qrSecret = generateQrSecret()

      // Create location first, then build payload with the generated ID
      const tempLocation = await db.workLocation.create({
        data: createData,
      })

      qrData = buildQrPayload(tempLocation.id, qrSecret, session.companyId)

      // Update the location with QR fields
      try {
        const location = await db.workLocation.update({
          where: { id: tempLocation.id },
          data: {
            qrCodeSecret: qrSecret,
            qrCodeData: JSON.stringify(qrData),
          },
        })

        // Audit log (non-blocking)
        createAuditLog({
          companyId: session.companyId,
          userId: session.userId,
          action: 'CREATE',
          entityType: 'WORK_LOCATION',
          entityId: location.id,
          details: {
            name,
            latitude,
            longitude,
            radiusMeters: location.radiusMeters,
            verificationMethod: 'QR_CODE',
            hasQrCode: true,
          },
        }, request).catch(() => {/* non-blocking audit */})

        return NextResponse.json(
          {
            location,
            qr: {
              secret: qrSecret,
              payload: qrData,
            },
          },
          { status: 201 }
        )
      } catch (updateErr) {
        console.error('[POST /api/locations] QR update failed (DB schema may need migration):', updateErr)
        // If QR fields don't exist in DB, return location without QR data
        return NextResponse.json(
          {
            location: tempLocation,
            qr: {
              secret: qrSecret,
              payload: qrData,
              warning: 'QR data generated but could not be persisted. The database may need a schema migration.',
            },
          },
          { status: 201 }
        )
      }
    }

    // ---- BEACON verification ----
    if (verificationMethod === 'BEACON') {
      let uuid = bodyBeaconUuid
      if (uuid) {
        if (!isValidBeaconUuid(uuid)) {
          return NextResponse.json(
            { error: 'Formato de UUID de beacon inválido. Se espera formato 8-4-4-4-12 hex (ej: A1B2C3D4-E5F6-7890-ABCD-EF1234567890)' },
            { status: 400 }
          )
        }
        // Check UUID uniqueness
        const existing = await db.workLocation.findUnique({
          where: { beaconUuid: uuid },
        })
        if (existing) {
          return NextResponse.json(
            { error: 'Ya existe una ubicación con este UUID de beacon' },
            { status: 409 }
          )
        }
      } else {
        // Auto-generate a unique beacon UUID
        uuid = generateBeaconUuid()
        let unique = false
        while (!unique) {
          const exists = await db.workLocation.findUnique({ where: { beaconUuid: uuid } })
          if (!exists) {
            unique = true
          } else {
            uuid = generateBeaconUuid()
          }
        }
      }

      const major = beaconMajor != null ? Number(beaconMajor) : null
      const minor = beaconMinor != null ? Number(beaconMinor) : null
      const rssi = beaconRssi != null ? Number(beaconRssi) : -70

      if (major !== null && (major < 0 || major > 65535)) {
        return NextResponse.json({ error: 'beaconMajor debe estar entre 0 y 65535' }, { status: 400 })
      }
      if (minor !== null && (minor < 0 || minor > 65535)) {
        return NextResponse.json({ error: 'beaconMinor debe estar entre 0 y 65535' }, { status: 400 })
      }
      if (rssi < -100 || rssi > 0) {
        return NextResponse.json({ error: 'beaconRssi debe estar entre -100 y 0 dBm' }, { status: 400 })
      }

      beaconConfig = { uuid: uuid!, major, minor, rssi }

      try {
        const location = await db.workLocation.create({
          data: {
            ...createData,
            beaconUuid: uuid,
            beaconMajor: major,
            beaconMinor: minor,
            beaconRssi: rssi,
          },
        })

        // Audit log (non-blocking)
        createAuditLog({
          companyId: session.companyId,
          userId: session.userId,
          action: 'CREATE',
          entityType: 'WORK_LOCATION',
          entityId: location.id,
          details: {
            name,
            latitude,
            longitude,
            radiusMeters: location.radiusMeters,
            verificationMethod: 'BEACON',
            beaconUuid: uuid,
            beaconMajor: major,
            beaconMinor: minor,
            beaconRssi: rssi,
          },
        }, request).catch(() => {/* non-blocking audit */})

        return NextResponse.json(
          {
            location,
            beacon: beaconConfig,
          },
          { status: 201 }
        )
      } catch (createErr) {
        console.error('[POST /api/locations] Beacon location creation failed (DB schema may need migration):', createErr)
        // Fallback: try creating without beacon fields
        try {
          const location = await db.workLocation.create({
            data: createData,
          })
          return NextResponse.json(
            {
              location,
              beacon: beaconConfig,
              warning: 'Location created but beacon fields could not be persisted. The database may need a schema migration.',
            },
            { status: 201 }
          )
        } catch (fallbackErr) {
          console.error('[POST /api/locations] Fallback creation also failed:', fallbackErr)
          throw fallbackErr
        }
      }
    }

    // ---- GPS verification (default) ----
    const location = await db.workLocation.create({
      data: createData,
    })

    // Audit log (non-blocking)
    createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'WORK_LOCATION',
      entityId: location.id,
      details: { name, latitude, longitude, radiusMeters: location.radiusMeters },
    }, request).catch(() => {/* non-blocking audit */})

    return NextResponse.json({ location }, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/locations] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
