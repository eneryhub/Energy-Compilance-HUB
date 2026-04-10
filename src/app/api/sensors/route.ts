import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSensorProfileDefaults, generateSimulatedValue } from '@/lib/scada/engine'
import { createAuditLog } from '@/lib/audit'
import type { SensorType } from '@/lib/scada/engine'

// GET /api/sensors - List all sensors
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const type = searchParams.get('type')

    const sensors = await db.sensor.findMany({
      where: {
        companyId: payload.companyId,
        ...(locationId ? { locationId } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        location: {
          select: { id: true, name: true },
        },
        _count: {
          select: { readings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sensors)
  } catch (error: any) {
    console.error('[GET /api/sensors]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// POST /api/sensors - Create sensor
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { name, type, locationId, unit, thresholdCritical, thresholdWarning, isSimulated } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Nombre y tipo son requeridos' }, { status: 400 })
    }

    // Validate locationId: only accept non-empty strings that exist in DB
    const safeLocationId = (typeof locationId === 'string' && locationId.trim()) ? locationId.trim() : null

    if (safeLocationId) {
      try {
        const location = await db.workLocation.findFirst({
          where: { id: safeLocationId, companyId: payload.companyId },
          select: { id: true },
        })
        if (!location) {
          return NextResponse.json(
            {
              error: 'La ubicacion seleccionada no existe o no pertenece a tu empresa.',
              hint: 'Selecciona una ubicacion valida en el formulario o deja el campo vacio para crear el sensor sin ubicacion.',
            },
            { status: 400 }
          )
        }
      } catch (err: any) {
        console.error('[POST /api/sensors] Location check error:', err)
        // P2021 or P2022 = table/column doesn't exist (schema out of sync)
        if (err?.code?.startsWith('P202')) {
          return NextResponse.json(
            { error: 'Error de base de datos: la tabla de ubicaciones no esta sincronizada. Ejecuta "prisma db push" o verifica la migracion en Supabase.' },
            { status: 503 }
          )
        }
        return NextResponse.json({ error: 'Error al verificar la ubicacion.' }, { status: 500 })
      }
    }

    const sensorType = type as SensorType
    const defaults = getSensorProfileDefaults(sensorType)

    try {
      const sensor = await db.sensor.create({
        data: {
          companyId: payload.companyId,
          name,
          type,
          locationId: safeLocationId,
          unit: unit || defaults.unit,
          thresholdCritical: thresholdCritical || defaults.thresholdCritical,
          thresholdWarning: thresholdWarning || defaults.thresholdWarning,
          isSimulated: isSimulated !== false,
          currentValue: generateSimulatedValue({
            id: 'temp',
            type,
            thresholdCritical: thresholdCritical || defaults.thresholdCritical,
          } as any),
          lastReadingAt: new Date(),
        },
      })

      await createAuditLog({
        companyId: payload.companyId,
        userId: payload.userId,
        action: 'CREATE',
        entityType: 'SENSOR',
        entityId: sensor.id,
        details: { name, type, locationId: safeLocationId, isSimulated },
        req,
      })

      return NextResponse.json(sensor, { status: 201 })
    } catch (error: any) {
      // P2003 = Foreign key constraint violated (locationId doesn't exist)
      if (error?.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'La ubicacion referenciada no existe en la base de datos.',
            hint: 'El sensor se creo sin ubicacion asignada. Verifica que la ubicacion exista antes de reasignar.',
          },
          { status: 400 }
        )
      }
      console.error('[POST /api/sensors] Create error:', error)
      return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[POST /api/sensors] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
