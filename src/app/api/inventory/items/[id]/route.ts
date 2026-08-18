import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/inventory/items/[id] — Fetch single item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: {
        locations: {
          include: {
            item: true,
            location: true,
          },
        },
      },
    })

    if (!item || item.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error: unknown) {
    console.error('[Inventory API] GET item by id error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/inventory/items/[id] — Update item
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
        { error: 'Sin permisos para actualizar items de inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.inventoryItem.findUnique({ where: { id } })
    if (!existing || existing.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { name, sku, category, unit, thumbnailUrl, thresholdMin, thresholdMax, isActive } = body

    // Check SKU uniqueness if changed
    if (sku && typeof sku === 'string' && sku.trim() !== existing.sku) {
      const skuConflict = await db.inventoryItem.findFirst({
        where: { companyId: session.companyId, sku: sku.trim() },
      })
      if (skuConflict && skuConflict.id !== id) {
        return NextResponse.json(
          { error: 'Ya existe un item con este SKU en la empresa' },
          { status: 409 }
        )
      }
    }

    const updated = await db.inventoryItem.update({
      where: { id },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(sku !== undefined && typeof sku === 'string' ? { sku: sku.trim() || null } : {}),
        ...(category && typeof category === 'string' ? { category } : {}),
        ...(unit && typeof unit === 'string' ? { unit } : {}),
        ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl || null } : {}),
        ...(typeof thresholdMin === 'number' ? { thresholdMin } : {}),
        ...(thresholdMax !== undefined ? { thresholdMax: thresholdMax !== null ? thresholdMax : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'INVENTORY_ITEM',
      entityId: id,
      details: {
        name: updated.name,
        sku: updated.sku,
        changes: Object.keys(body).filter(k => body[k] !== undefined && body[k] !== existing[k as keyof typeof existing]),
      },
    }, request)

    return NextResponse.json(updated)
  } catch (error: unknown) {
    console.error('[Inventory API] PUT item error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/inventory/items/[id] — Soft delete (set isActive=false)
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
        { error: 'Sin permisos para eliminar items de inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.inventoryItem.findUnique({ where: { id } })
    if (!existing || existing.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    if (!existing.isActive) {
      return NextResponse.json({ error: 'El item ya está desactivado' }, { status: 400 })
    }

    const updated = await db.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'INVENTORY_ITEM',
      entityId: id,
      details: { name: existing.name, sku: existing.sku },
    }, request)

    return NextResponse.json({ message: 'Item desactivado exitosamente', item: updated })
  } catch (error: unknown) {
    console.error('[Inventory API] DELETE item error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
