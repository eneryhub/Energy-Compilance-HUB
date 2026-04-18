import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// PUT /api/inventory/devices/[id] — Update device status/info
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para actualizar dispositivos' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.inventoryDevice.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { name, type, status, ipAddress } = body

    const device = await db.inventoryDevice.update({
      where: { id },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(type && typeof type === 'string' ? { type } : {}),
        ...(status && typeof status === 'string' ? { status } : {}),
        ...(ipAddress !== undefined ? { ipAddress: ipAddress ? String(ipAddress).trim() : null } : {}),
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'INVENTORY_DEVICE',
      entityId: id,
      details: { name: device.name, type: device.type, status: device.status },
    }, request)

    return NextResponse.json(device)
  } catch (error: unknown) {
    console.error('[Inventory API] PUT device error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/inventory/devices/[id] — Remove device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para eliminar dispositivos' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.inventoryDevice.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
    }

    await db.inventoryDevice.delete({ where: { id } })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'INVENTORY_DEVICE',
      entityId: id,
      details: { name: existing.name, type: existing.type },
    }, request)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Inventory API] DELETE device error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
