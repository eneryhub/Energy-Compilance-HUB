import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// PUT /api/risk-types/[id] - Update risk type
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { label, color, description, icon, isActive, sortOrder } = body

    const riskType = await db.riskTypeConfig.findFirst({ where: { id, companyId: payload.companyId } })
    if (!riskType) return NextResponse.json({ error: 'Tipo de riesgo no encontrado' }, { status: 404 })

    const updated = await db.riskTypeConfig.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'UPDATE',
      entityType: 'RISK_TYPE',
      entityId: id,
      details: { changes: body, label: updated.label },
    }, req)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update risk type error:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de riesgo' }, { status: 500 })
  }
}

// DELETE /api/risk-types/[id] - Delete risk type and its checklist items
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    const riskType = await db.riskTypeConfig.findFirst({
      where: { id, companyId: payload.companyId },
      include: { checklist: true },
    })
    if (!riskType) return NextResponse.json({ error: 'Tipo de riesgo no encontrado' }, { status: 404 })

    // Check if there are permits using this risk type
    const permitsUsing = await db.permit.count({
      where: { companyId: payload.companyId, riskType: riskType.key },
    })
    if (permitsUsing > 0) {
      return NextResponse.json({
        error: `No se puede eliminar: ${permitsUsing} permiso(s) usan este tipo de riesgo`,
      }, { status: 400 })
    }

    // Delete checklist items first (cascade should handle this, but being explicit)
    await db.checklistItemConfig.deleteMany({ where: { riskTypeKey: riskType.key, companyId: payload.companyId } })
    await db.riskTypeConfig.delete({ where: { id } })

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'DELETE',
      entityType: 'RISK_TYPE',
      entityId: id,
      details: { key: riskType.key, label: riskType.label },
    }, req)

    return NextResponse.json({ success: true, message: 'Tipo de riesgo eliminado' })
  } catch (error) {
    console.error('Delete risk type error:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de riesgo' }, { status: 500 })
  }
}
