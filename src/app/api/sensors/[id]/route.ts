import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

// GET /api/sensors/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const sensor = await db.sensor.findFirst({
      where: { id, companyId: payload.companyId },
      include: {
        location: {
          select: { id: true, name: true, latitude: true, longitude: true },
        },
        _count: { select: { readings: true } },
      },
    })

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 })
    }

    return NextResponse.json(sensor)
  } catch (error: any) {
    console.error('[GET /api/sensors/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// PUT /api/sensors/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, type, locationId, unit, thresholdCritical, thresholdWarning, isSimulated, isActive } = body

    const existing = await db.sensor.findFirst({
      where: { id, companyId: payload.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 })
    }

    const sensor = await db.sensor.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(locationId !== undefined ? { locationId: locationId || null } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(thresholdCritical !== undefined ? { thresholdCritical } : {}),
        ...(thresholdWarning !== undefined ? { thresholdWarning } : {}),
        ...(isSimulated !== undefined ? { isSimulated } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'UPDATE',
      entityType: 'SENSOR',
      entityId: id,
      details: { name, type, thresholdCritical, isSimulated, isActive },
      req,
    })

    return NextResponse.json(sensor)
  } catch (error: any) {
    console.error('[PUT /api/sensors/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/sensors/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Solo ADMIN puede eliminar sensores' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.sensor.findFirst({
      where: { id, companyId: payload.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Sensor no encontrado' }, { status: 404 })
    }

    await db.sensor.delete({ where: { id } })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'DELETE',
      entityType: 'SENSOR',
      entityId: id,
      details: { name: existing.name, type: existing.type },
      req,
    })

    return NextResponse.json({ message: 'Sensor eliminado' })
  } catch (error: any) {
    console.error('[DELETE /api/sensors/[id]]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
