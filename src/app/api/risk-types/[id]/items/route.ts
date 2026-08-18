import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/risk-types/[id]/items - Add checklist item to risk type
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id: riskTypeId } = await params
    const body = await req.json()
    const { label, required, itemKey } = body

    const riskType = await db.riskTypeConfig.findFirst({ where: { id: riskTypeId, companyId: payload.companyId } })
    if (!riskType) return NextResponse.json({ error: 'Tipo de riesgo no encontrado' }, { status: 404 })

    const key = itemKey || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)

    const item = await db.checklistItemConfig.create({
      data: {
        companyId: payload.companyId,
        riskTypeKey: riskType.key,
        itemKey: key,
        label: label.trim(),
        required: required || false,
        sortOrder: body.sortOrder || 0,
      },
    })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'CREATE',
      entityType: 'CHECKLIST_ITEM',
      entityId: item.id,
      details: { riskType: riskType.key, label: item.label, required: item.required },
    }, req)

    return NextResponse.json(item)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Este campo ya existe en la lista de verificación' }, { status: 409 })
    }
    console.error('Create checklist item error:', error)
    return NextResponse.json({ error: 'Error al crear campo de verificación' }, { status: 500 })
  }
}

// DELETE /api/risk-types/[id]/items - Delete checklist item
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id: riskTypeId } = await params
    const { searchParams } = new URL(req.url)
    const itemKey = searchParams.get('itemKey')

    if (!itemKey) {
      return NextResponse.json({ error: 'itemKey es requerido' }, { status: 400 })
    }

    const riskType = await db.riskTypeConfig.findFirst({ where: { id: riskTypeId, companyId: payload.companyId } })
    if (!riskType) return NextResponse.json({ error: 'Tipo de riesgo no encontrado' }, { status: 404 })

    await db.checklistItemConfig.deleteMany({
      where: { riskTypeKey: riskType.key, companyId: payload.companyId, itemKey },
    })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'DELETE',
      entityType: 'CHECKLIST_ITEM',
      details: { riskType: riskType.key, itemKey },
    }, req)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete checklist item error:', error)
    return NextResponse.json({ error: 'Error al eliminar campo de verificación' }, { status: 500 })
  }
}
