import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// Default risk types to seed for new companies
const DEFAULT_RISK_TYPES = [
  { key: 'ALTURA', label: 'Trabajo en Altura', color: '#ef4444', description: 'Trabajos en alturas superiores a 1.8m', icon: 'ArrowUp', sortOrder: 0 },
  { key: 'ELECTRICO', label: 'Riesgo Eléctrico', color: '#f59e0b', description: 'Trabajos con tensión eléctrica', icon: 'Zap', sortOrder: 1 },
  { key: 'CONFINADO', label: 'Espacio Confinado', color: '#8b5cf6', description: 'Ingreso a espacios confinados', icon: 'Box', sortOrder: 2 },
  { key: 'CALIENTE', label: 'Trabajo en Caliente', color: '#dc2626', description: 'Soldadura, corte, trabajos con fuego', icon: 'Flame', sortOrder: 3 },
  { key: 'TRANSPORTE', label: 'Permiso de Transporte HSE', color: '#0ea5e9', description: 'Autorización para salida de vehículos de transporte, incluye checklist de vehículo y conductor', icon: 'Truck', sortOrder: 4 },
]

const DEFAULT_CHECKLISTS: Record<string, { itemKey: string; label: string; required: boolean; sortOrder: number }[]> = {
  ALTURA: [
    { itemKey: 'has_harness', label: 'Arnés de seguridad colocado', required: true, sortOrder: 0 },
    { itemKey: 'has_anchor_point', label: 'Punto de anclaje certificado', required: true, sortOrder: 1 },
    { itemKey: 'has_first_aid_kit', label: 'Botiquín de primeros auxilios disponible', required: false, sortOrder: 2 },
    { itemKey: 'briefing_completed', label: 'Charla de seguridad (briefing) completada', required: false, sortOrder: 3 },
    { itemKey: 'emergency_routes_identified', label: 'Rutas de emergencia identificadas', required: false, sortOrder: 4 },
  ],
  ELECTRICO: [
    { itemKey: 'has_dielectric_ppe', label: 'EPP dieléctrico completo', required: true, sortOrder: 0 },
    { itemKey: 'voltage_test_performed', label: 'Prueba de ausencia de tensión realizada', required: true, sortOrder: 1 },
    { itemKey: 'has_first_aid_kit', label: 'Botiquín de primeros auxilios disponible', required: false, sortOrder: 2 },
    { itemKey: 'briefing_completed', label: 'Charla de seguridad (briefing) completada', required: false, sortOrder: 3 },
    { itemKey: 'emergency_routes_identified', label: 'Rutas de emergencia identificadas', required: false, sortOrder: 4 },
  ],
  CONFINADO: [
    { itemKey: 'atmosphere_monitored', label: 'Monitoreo de atmósfera realizado', required: true, sortOrder: 0 },
    { itemKey: 'has_entry_permit', label: 'Permiso de entrada vigente', required: true, sortOrder: 1 },
    { itemKey: 'has_first_aid_kit', label: 'Botiquín de primeros auxilios disponible', required: false, sortOrder: 2 },
    { itemKey: 'briefing_completed', label: 'Charla de seguridad (briefing) completada', required: false, sortOrder: 3 },
    { itemKey: 'emergency_routes_identified', label: 'Rutas de emergencia identificadas', required: false, sortOrder: 4 },
  ],
  CALIENTE: [
    { itemKey: 'has_fire_extinguisher', label: 'Extintor disponible en el área', required: true, sortOrder: 0 },
    { itemKey: 'has_first_aid_kit', label: 'Botiquín de primeros auxilios disponible', required: false, sortOrder: 1 },
    { itemKey: 'briefing_completed', label: 'Charla de seguridad (briefing) completada', required: false, sortOrder: 2 },
    { itemKey: 'emergency_routes_identified', label: 'Rutas de emergencia identificadas', required: false, sortOrder: 3 },
  ],
  TRANSPORTE: [
    { itemKey: 'vehicle_exterior_lights', label: 'Luces exteriores funcionando', required: true, sortOrder: 0 },
    { itemKey: 'vehicle_tires_ok', label: 'Neumáticos en buen estado', required: true, sortOrder: 1 },
    { itemKey: 'vehicle_fuel_ok', label: 'Nivel de combustible adecuado', required: true, sortOrder: 2 },
    { itemKey: 'vehicle_seatbelt', label: 'Cinturón de seguridad disponible', required: true, sortOrder: 3 },
    { itemKey: 'vehicle_fire_extinguisher', label: 'Extintor vigente', required: true, sortOrder: 4 },
    { itemKey: 'vehicle_emergency_kit', label: 'Kit de emergencia completo', required: true, sortOrder: 5 },
    { itemKey: 'vehicle_docs_up_to_date', label: 'Documentación del vehículo al día', required: true, sortOrder: 6 },
    { itemKey: 'vehicle_gps_active', label: 'GPS/DMS activo', required: true, sortOrder: 7 },
    { itemKey: 'driver_license_valid', label: 'Licencia de conducir vigente', required: true, sortOrder: 8 },
    { itemKey: 'driver_rest_compliant', label: 'Conductor cumple descanso obligatorio (<8h)', required: true, sortOrder: 9 },
    { itemKey: 'driver_briefing_completed', label: 'Charla de seguridad completada', required: false, sortOrder: 10 },
  ],
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const withChecklist = searchParams.get('withChecklist') === 'true'
    const riskTypeKey = searchParams.get('riskTypeKey')

    const where: any = { companyId: session.companyId, isActive: true }

    const riskTypes = await db.riskTypeConfig.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    // Seed defaults if none exist (verify company exists first)
    if (riskTypes.length === 0) {
      const companyExists = await db.company.count({ where: { id: session.companyId } })
      if (companyExists === 0) {
        return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 401 })
      }

      try {
        for (const rt of DEFAULT_RISK_TYPES) {
          await db.riskTypeConfig.create({
            data: { companyId: session.companyId, ...rt },
          })
          if (DEFAULT_CHECKLISTS[rt.key]) {
            for (const item of DEFAULT_CHECKLISTS[rt.key]) {
              await db.checklistItemConfig.create({
                data: { companyId: session.companyId, riskTypeKey: rt.key, ...item },
              })
            }
          }
        }
      } catch (seedErr: unknown) {
        // FK constraint or unique violation — another request may have seeded concurrently
        console.warn('[GET /api/risk-types] Seed error (may be a race condition):', seedErr)
      }
      const seeded = await db.riskTypeConfig.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
      })

      if (withChecklist && !riskTypeKey) {
        const allItems = await db.checklistItemConfig.findMany({
          where: { companyId: session.companyId, isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json({ riskTypes: seeded, checklistItems: allItems })
      }
      return NextResponse.json({ riskTypes: seeded })
    }

    if (withChecklist && riskTypeKey) {
      const items = await db.checklistItemConfig.findMany({
        where: { companyId: session.companyId, riskTypeKey, isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ riskTypes, checklistItems: items })
    }

    if (withChecklist && !riskTypeKey) {
      const allItems = await db.checklistItemConfig.findMany({
        where: { companyId: session.companyId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ riskTypes, checklistItems: allItems })
    }

    return NextResponse.json({ riskTypes })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { type, data } = body // type: 'riskType' | 'checklistItem'

    if (type === 'riskType') {
      const { key, label, color, description, icon } = data
      if (!key || !label) return NextResponse.json({ error: 'Key y label requeridos' }, { status: 400 })
      
      const riskType = await db.riskTypeConfig.create({
        data: {
          companyId: session.companyId,
          key: key.toUpperCase().replace(/\s+/g, '_'),
          label,
          color: color || '#6366f1',
          description: description || null,
          icon: icon || 'AlertTriangle',
        },
      })
      
      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'CREATE',
        entityType: 'RISK_TYPE',
        entityId: riskType.id,
        details: { key: riskType.key, label },
      }, request)
      
      return NextResponse.json({ riskType }, { status: 201 })
    }

    if (type === 'checklistItem') {
      const { riskTypeKey, itemKey, label, required, sortOrder } = data
      if (!riskTypeKey || !itemKey || !label) return NextResponse.json({ error: 'riskTypeKey, itemKey y label requeridos' }, { status: 400 })

      const item = await db.checklistItemConfig.create({
        data: {
          companyId: session.companyId,
          riskTypeKey,
          itemKey: itemKey.toLowerCase().replace(/\s+/g, '_'),
          label,
          required: required || false,
          sortOrder: sortOrder || 0,
        },
      })

      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'CREATE',
        entityType: 'CHECKLIST_ITEM',
        entityId: item.id,
        details: { riskTypeKey, itemKey: item.itemKey, label },
      }, request)

      return NextResponse.json({ checklistItem: item }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tipo inválido. Use riskType o checklistItem' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
