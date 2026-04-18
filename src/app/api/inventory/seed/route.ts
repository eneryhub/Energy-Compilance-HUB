import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/inventory/seed — Populate demo data for the current company
// Idempotent: checks if seed data already exists (by checking for the first location name)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const companyId = session.companyId
    const userId = session.userId

    // Check if seed data already exists for this company
    const existingLocations = await db.inventoryLocation.findMany({
      where: { companyId },
      take: 1,
    })

    if (existingLocations.length > 0) {
      return NextResponse.json({
        message: 'Ya existen datos de inventario para esta empresa. Usa DELETE para limpiar primero.',
        alreadySeeded: true,
      })
    }

    // ── 1) LOCATIONS ──
    const locs = await Promise.all([
      db.inventoryLocation.create({
        data: {
          companyId,
          name: 'Almacén Central BsAs',
          province: 'Buenos Aires',
          city: 'CABA',
          address: 'Av. Corrientes 2450, Puerto Madero',
          latitude: -34.6037,
          longitude: -58.3816,
        },
      }),
      db.inventoryLocation.create({
        data: {
          companyId,
          name: 'Planta Norte Zárate',
          province: 'Buenos Aires',
          city: 'Zárate',
          address: 'Ruta 12 Km 78, Parque Industrial',
          latitude: -34.0981,
          longitude: -59.0257,
        },
      }),
      db.inventoryLocation.create({
        data: {
          companyId,
          name: 'Depósito Sur Bahía Blanca',
          province: 'Buenos Aires',
          city: 'Bahía Blanca',
          address: 'Calles 12 y 54, Ing. White',
          latitude: -38.7183,
          longitude: -62.2676,
        },
      }),
    ])

    const [locCABA, locZarate, locBahia] = locs

    // ── 2) ITEMS ──
    const items = await Promise.all([
      db.inventoryItem.create({ data: { companyId, name: 'Casco de Seguridad Industrial', sku: 'EPP-CS-001', category: 'EPP', unit: 'unidad', thresholdMin: 5, thresholdMax: 100 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Lentes de Seguridad', sku: 'EPP-LT-002', category: 'EPP', unit: 'par', thresholdMin: 10, thresholdMax: 200 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Guantes de Cuero', sku: 'EPP-GC-003', category: 'EPP', unit: 'par', thresholdMin: 15, thresholdMax: 300 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Arnés de Seguridad 5 Puntos', sku: 'EPP-AR-004', category: 'EPP', unit: 'unidad', thresholdMin: 3, thresholdMax: 50 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Batería 12V Sellada', sku: 'BAT-12V-001', category: 'BATERIA', unit: 'unidad', thresholdMin: 8, thresholdMax: 120 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Batería 24V Ciclo Profundo', sku: 'BAT-24V-002', category: 'BATERIA', unit: 'unidad', thresholdMin: 4, thresholdMax: 60 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Taladro Percutor Dewalt', sku: 'HER-TD-001', category: 'HERRAMIENTA', unit: 'unidad', thresholdMin: 2, thresholdMax: 30 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Multímetro Digital Fluke', sku: 'HER-MM-002', category: 'HERRAMIENTA', unit: 'unidad', thresholdMin: 2, thresholdMax: 20 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Cable Eléctrico 2.5mm x 100m', sku: 'MAT-CE-001', category: 'MATERIAL', unit: 'rollo', thresholdMin: 5, thresholdMax: 50 } }),
      db.inventoryItem.create({ data: { companyId, name: 'Cinta Aislante 3M x 18mm', sku: 'MAT-CA-002', category: 'MATERIAL', unit: 'rollo', thresholdMin: 20, thresholdMax: 500 } }),
    ])

    const [casco, lentes, guantes, arnes, bat12v, bat24v, taladro, multimetro, cable, cinta] = items

    // ── 3) DEVICES ──
    const devices = await Promise.all([
      db.inventoryDevice.create({ data: { companyId, locationId: locCABA.id, name: 'Cámara Zona A - Recepción', type: 'CAMERA', ipAddress: '192.168.1.101', status: 'ONLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locCABA.id, name: 'Cámara Zona B - Estantes', type: 'CAMERA', ipAddress: '192.168.1.102', status: 'ONLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locZarate.id, name: 'Cámara Planta Norte - Hangar', type: 'CAMERA', ipAddress: '10.0.0.50', status: 'ONLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locCABA.id, name: 'Gateway BLE CABA Principal', type: 'BEACON_GATEWAY', ipAddress: '192.168.1.200', status: 'ONLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locZarate.id, name: 'Gateway BLE Zárate', type: 'BEACON_GATEWAY', ipAddress: '10.0.0.200', status: 'ONLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locBahia.id, name: 'Gateway BLE Bahía Blanca', type: 'BEACON_GATEWAY', status: 'OFFLINE' } }),
      db.inventoryDevice.create({ data: { companyId, locationId: locBahia.id, name: 'Cámara Depósito Sur', type: 'CAMERA', ipAddress: '172.16.0.50', status: 'MAINTENANCE' } }),
    ])

    const [camCABA_A, camCABA_B, camZarate, gwCABA, gwZarate, gwBahia, camBahia] = devices

    // ── 4) STOCK (SmartInventory) ──
    const stockEntries = [
      // CABA location — most items here
      { itemId: casco.id, locationId: locCABA.id, quantity: 42, cameraCount: 40, beaconCount: 42, discrepancy: true },
      { itemId: lentes.id, locationId: locCABA.id, quantity: 8, cameraCount: 8, beaconCount: 8, discrepancy: false },
      { itemId: guantes.id, locationId: locCABA.id, quantity: 120, cameraCount: 118, beaconCount: 120, discrepancy: true },
      { itemId: arnes.id, locationId: locCABA.id, quantity: 2, cameraCount: 2, beaconCount: 2, discrepancy: false },
      { itemId: bat12v.id, locationId: locCABA.id, quantity: 15, cameraCount: 15, beaconCount: 15, discrepancy: false },
      { itemId: cable.id, locationId: locCABA.id, quantity: 22, cameraCount: 22, beaconCount: 22, discrepancy: false },
      { itemId: cinta.id, locationId: locCABA.id, quantity: 3, cameraCount: 3, beaconCount: 3, discrepancy: false },

      // Zárate location — batteries and tools
      { itemId: bat12v.id, locationId: locZarate.id, quantity: 6, cameraCount: 6, beaconCount: 6, discrepancy: false },
      { itemId: bat24v.id, locationId: locZarate.id, quantity: 3, cameraCount: 4, beaconCount: 3, discrepancy: true },
      { itemId: taladro.id, locationId: locZarate.id, quantity: 1, cameraCount: 1, beaconCount: 1, discrepancy: false },
      { itemId: multimetro.id, locationId: locZarate.id, quantity: 0, cameraCount: 0, beaconCount: 0, discrepancy: false },
      { itemId: casco.id, locationId: locZarate.id, quantity: 18, cameraCount: 18, beaconCount: 18, discrepancy: false },

      // Bahía Blanca — minimal stock (critical)
      { itemId: bat24v.id, locationId: locBahia.id, quantity: 1, cameraCount: 1, beaconCount: 2, discrepancy: true },
      { itemId: guantes.id, locationId: locBahia.id, quantity: 5, cameraCount: null, beaconCount: null, discrepancy: false },
    ]

    const now = new Date()
    const dayOffset = (offset: number) => new Date(now.getTime() - offset * 60 * 60 * 1000)

    await Promise.all(
      stockEntries.map((s, i) =>
        db.smartInventory.create({
          data: {
            companyId,
            itemId: s.itemId,
            locationId: s.locationId,
            quantity: s.quantity,
            cameraCount: s.cameraCount,
            beaconCount: s.beaconCount,
            discrepancy: s.discrepancy,
            lastCountedAt: dayOffset(Math.floor(i * 4.2) + 1),
            lastSyncAt: dayOffset(Math.floor(i * 4.2)),
          },
        })
      )
    )

    // ── 5) AUDITS (InventoryAudit) ──
    const auditEntries = [
      { locationId: locCABA.id, deviceId: camCABA_A.id, itemName: 'Casco de Seguridad Industrial', itemCount: 40, beaconCount: 42, confidence: 0.92, discrepancy: true },
      { locationId: locCABA.id, deviceId: camCABA_B.id, itemName: 'Guantes de Cuero', itemCount: 118, beaconCount: 120, confidence: 0.88, discrepancy: true },
      { locationId: locCABA.id, deviceId: camCABA_A.id, itemName: 'Lentes de Seguridad', itemCount: 8, beaconCount: 8, confidence: 0.95, discrepancy: false },
      { locationId: locCABA.id, deviceId: camCABA_B.id, itemName: 'Batería 12V Sellada', itemCount: 15, beaconCount: 15, confidence: 0.91, discrepancy: false },
      { locationId: locZarate.id, deviceId: camZarate.id, itemName: 'Batería 24V Ciclo Profundo', itemCount: 4, beaconCount: 3, confidence: 0.85, discrepancy: true },
      { locationId: locZarate.id, deviceId: camZarate.id, itemName: 'Taladro Percutor Dewalt', itemCount: 1, beaconCount: 1, confidence: 0.97, discrepancy: false },
      { locationId: locBahia.id, deviceId: camBahia.id, itemName: 'Batería 24V Ciclo Profundo', itemCount: 1, beaconCount: 2, confidence: 0.72, discrepancy: true },
      { locationId: locZarate.id, deviceId: camZarate.id, itemName: 'Cable Eléctrico 2.5mm', itemCount: 0, beaconCount: 0, confidence: 0.0, discrepancy: false },
    ]

    await Promise.all(
      auditEntries.map((a, i) =>
        db.inventoryAudit.create({
          data: {
            companyId,
            locationId: a.locationId,
            deviceId: a.deviceId,
            itemName: a.itemName,
            itemCount: a.itemCount,
            beaconCount: a.beaconCount,
            confidence: a.confidence,
            discrepancy: a.discrepancy,
            createdAt: dayOffset(i * 6 + 2),
            metadata: JSON.stringify({ model: 'gpt-4o-mini-vlm', processingMs: Math.floor(Math.random() * 3000) + 800 }),
          },
        })
      )
    )

    // ── Audit Log ──
    await createAuditLog({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'INVENTORY_SEED',
      details: {
        locations: 3,
        items: 10,
        devices: 7,
        stockRecords: 14,
        audits: 8,
      },
    }, request)

    return NextResponse.json({
      message: 'Datos demo cargados exitosamente',
      seeded: true,
      summary: {
        locations: 3,
        items: 10,
        devices: 7,
        stockRecords: 14,
        audits: 8,
      },
    })
  } catch (error: unknown) {
    console.error('[Inventory API] POST seed error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/inventory/seed — Clean all demo data for the current company
export async function DELETE(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const companyId = session.companyId

    // Delete in correct order (children first)
    const deletedAudits = await db.inventoryAudit.deleteMany({ where: { companyId } })
    const deletedStock = await db.smartInventory.deleteMany({ where: { companyId } })
    const deletedDevices = await db.inventoryDevice.deleteMany({ where: { companyId } })
    const deletedItems = await db.inventoryItem.deleteMany({ where: { companyId } })
    const deletedLocations = await db.inventoryLocation.deleteMany({ where: { companyId } })

    // Audit log
    await createAuditLog({
      companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'INVENTORY_SEED',
      details: {
        locations: deletedLocations.count,
        items: deletedItems.count,
        devices: deletedDevices.count,
        stockRecords: deletedStock.count,
        audits: deletedAudits.count,
      },
    }, request)

    return NextResponse.json({
      message: 'Datos de inventario eliminados',
      deleted: true,
      summary: {
        locations: deletedLocations.count,
        items: deletedItems.count,
        devices: deletedDevices.count,
        stockRecords: deletedStock.count,
        audits: deletedAudits.count,
      },
    })
  } catch (error: unknown) {
    console.error('[Inventory API] DELETE seed error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
