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

    const sensorType = type as SensorType
    const defaults = getSensorProfileDefaults(sensorType)

    const sensor = await db.sensor.create({
      data: {
        companyId: payload.companyId,
        name,
        type,
        locationId: locationId || null,
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
      details: { name, type, locationId, isSimulated },
      req,
    })

    return NextResponse.json(sensor, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/sensors]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
