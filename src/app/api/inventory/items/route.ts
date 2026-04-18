import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/inventory/items — List all inventory items for the company
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const isActiveParam = searchParams.get('isActive')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (category) {
      where.category = category
    }

    if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.inventoryItem.count({ where }),
    ])

    return NextResponse.json({
      items: Array.isArray(items) ? items : [],
      total,
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET items error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/inventory/items — Create new inventory item (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para crear items de inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, sku, category, unit, thumbnailUrl, thresholdMin, thresholdMax } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del item es requerido' }, { status: 400 })
    }

    // Check SKU uniqueness within company
    if (sku && typeof sku === 'string' && sku.trim().length > 0) {
      const existing = await db.inventoryItem.findFirst({
        where: { companyId: session.companyId, sku: sku.trim() },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un item con este SKU en la empresa' },
          { status: 409 }
        )
      }
    }

    const item = await db.inventoryItem.create({
      data: {
        companyId: session.companyId,
        name: name.trim(),
        sku: sku && typeof sku === 'string' ? sku.trim() : null,
        category: category || 'GENERAL',
        unit: unit || 'unidad',
        thumbnailUrl: thumbnailUrl || null,
        thresholdMin: typeof thresholdMin === 'number' ? thresholdMin : 5,
        thresholdMax: typeof thresholdMax === 'number' ? thresholdMax : null,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'INVENTORY_ITEM',
      entityId: item.id,
      details: { name: item.name, sku: item.sku, category: item.category },
    }, request)

    return NextResponse.json(item, { status: 201 })
  } catch (error: unknown) {
    console.error('[Inventory API] POST item error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
