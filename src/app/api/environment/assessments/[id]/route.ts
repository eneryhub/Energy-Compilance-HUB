import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/environment/assessments/[id] — Get single assessment
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

    const assessment = await db.environmentalAssessment.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ assessment })
  } catch (error: unknown) {
    console.error('[Environment API] GET assessment by ID error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/environment/assessments/[id] — Approve assessment (ADMIN, SUPERVISOR, MANAGER only)
export async function PATCH(
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
      return NextResponse.json({ error: 'Sin permisos para modificar evaluaciones' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, title, description, findings, recommendations, nextReviewDate } = body

    // Find existing assessment
    const existing = await db.environmentalAssessment.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (status) {
      const validStatuses = ['BORRADOR', 'EN_REVISION', 'APROBADO', 'VENCIDO']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Estado inválido: ${status}` }, { status: 400 })
      }
      updateData.status = status

      if (status === 'APROBADO') {
        updateData.approvedById = session.userId
        updateData.approvedAt = new Date()
      }
    }

    if (title) updateData.title = String(title).trim()
    if (description !== undefined) updateData.description = description ? String(description).trim() : null
    if (findings) updateData.findings = JSON.stringify(findings)
    if (recommendations) updateData.recommendations = JSON.stringify(recommendations)
    if (nextReviewDate) updateData.nextReviewDate = new Date(nextReviewDate)

    const assessment = await db.environmentalAssessment.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'ENVIRONMENTAL_ASSESSMENT',
      entityId: id,
      details: {
        statusChange: status ? `${existing.status} → ${status}` : undefined,
        title: existing.title,
        type: existing.type,
      },
    }, request)

    return NextResponse.json({ assessment })
  } catch (error: unknown) {
    console.error('[Environment API] PATCH assessment error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/environment/assessments/[id] — Delete assessment
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
      return NextResponse.json({ error: 'Sin permisos para eliminar evaluaciones' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.environmentalAssessment.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    }

    await db.environmentalAssessment.delete({
      where: { id },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'ENVIRONMENTAL_ASSESSMENT',
      entityId: id,
      details: {
        title: existing.title,
        type: existing.type,
        deletedBy: session.name,
      },
    }, request)

    return NextResponse.json({ success: true, message: 'Evaluación eliminada exitosamente' })
  } catch (error: unknown) {
    console.error('[Environment API] DELETE assessment error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
