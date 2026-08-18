/**
 * ── FUTURE: Permit-Inventory Validation (Commented for Future Activation) ──
 *
 * This function will be activated to validate stock availability
 * before allowing permit issuance. DO NOT UNCOMMENT until the
 * inventory-to-permit workflow is fully tested.
 *
 * async function validateInventoryForPermit(
 *   companyId: string,
 *   requiredItems: Array<{ itemId: string; quantity: number; locationId?: string }>
 * ): Promise<{ valid: boolean; shortages: Array<{ itemName: string; available: number; required: number }> }> {
 *   const shortages: Array<{ itemName: string; available: number; required: number }> = []
 *   for (const req of requiredItems) {
 *     const totalStock = await db.smartInventory.aggregate({
 *       where: { companyId, itemId: req.itemId },
 *       _sum: { quantity: true }
 *     })
 *     const available = totalStock._sum.quantity ?? 0
 *     if (available < req.quantity) {
 *       const item = await db.inventoryItem.findUnique({ where: { id: req.itemId } })
 *       shortages.push({ itemName: item?.name ?? 'Desconocido', available, required: req.quantity })
 *     }
 *   }
 *   return { valid: shortages.length === 0, shortages }
 * }
 *
 * // Usage in permit creation flow (uncomment when ready):
 * // const validation = await validateInventoryForPermit(companyId, [
 * //   { itemId: 'bateria_12v_id', quantity: 2 },
 * //   { itemId: 'casco_seguridad_id', quantity: 1 },
 * // ])
 * // if (!validation.valid) {
 * //   return NextResponse.json({
 * //     error: 'Stock insuficiente',
 * //     shortages: validation.shortages
 * //   }, { status: 409 })
 * // }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/inventory/stock — Get stock summary for a location
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json({ error: 'locationId es requerido' }, { status: 400 })
    }

    // Verify location belongs to company
    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, companyId: session.companyId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    const stockRecords = await db.smartInventory.findMany({
      where: { companyId: session.companyId, locationId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            unit: true,
            thresholdMin: true,
            thresholdMax: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const total = Array.isArray(stockRecords) ? stockRecords.length : 0

    return NextResponse.json({
      stock: Array.isArray(stockRecords) ? stockRecords : [],
      total,
      location: {
        id: location.id,
        name: location.name,
        province: location.province,
        city: location.city,
      },
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET stock error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/inventory/stock — Update stock quantity for an item at a location
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para actualizar stock' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { itemId, locationId, quantity, notes } = body

    if (!itemId || !locationId) {
      return NextResponse.json({ error: 'itemId y locationId son requeridos' }, { status: 400 })
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json({ error: 'quantity debe ser un número >= 0' }, { status: 400 })
    }

    // Verify item belongs to company
    const item = await db.inventoryItem.findFirst({
      where: { id: itemId, companyId: session.companyId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    // Verify location belongs to company
    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, companyId: session.companyId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    // Upsert stock record
    const stockRecord = await db.smartInventory.upsert({
      where: {
        itemId_locationId: { itemId, locationId },
      },
      create: {
        companyId: session.companyId,
        itemId,
        locationId,
        quantity,
        notes: notes && typeof notes === 'string' ? notes : null,
        lastSyncAt: new Date(),
      },
      update: {
        quantity,
        notes: notes && typeof notes === 'string' ? notes : undefined,
        lastSyncAt: new Date(),
      },
      include: {
        item: true,
        location: true,
      },
    })

    // ── Low stock alert ──
    if (quantity <= item.thresholdMin) {
      // Check if alert already exists for this entity in the last 60 minutes
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000)
      const existingAlert = await db.systemAlert.findFirst({
        where: {
          companyId: session.companyId,
          type: 'INVENTORY_LOW',
          relatedEntityId: stockRecord.id,
          createdAt: { gte: sixtyMinutesAgo },
        },
      })

      if (!existingAlert) {
        await db.systemAlert.create({
          data: {
            companyId: session.companyId,
            type: 'INVENTORY_LOW',
            severity: 'HIGH',
            title: `Stock bajo: ${item.name}`,
            message: `${item.name} en ${location.name}: ${quantity} ${item.unit} (mínimo: ${item.thresholdMin})`,
            relatedEntityId: stockRecord.id,
            relatedEntityType: 'INVENTORY',
          },
        })
      }
    }

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'INVENTORY_STOCK',
      entityId: stockRecord.id,
      details: {
        itemId: item.id,
        itemName: item.name,
        locationId: location.id,
        locationName: location.name,
        newQuantity: quantity,
        unit: item.unit,
        thresholdMin: item.thresholdMin,
        lowStockAlert: quantity <= item.thresholdMin,
      },
    }, request)

    return NextResponse.json({
      stock: stockRecord,
      lowStockAlert: quantity <= item.thresholdMin,
    })
  } catch (error: unknown) {
    console.error('[Inventory API] POST stock error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
