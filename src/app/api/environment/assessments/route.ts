import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/environment/assessments — List environmental assessments
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (type) where.type = type
    if (status) where.status = status

    const assessments = await db.environmentalAssessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      assessments: Array.isArray(assessments) ? assessments : [],
    })
  } catch (error: unknown) {
    console.error('[Environment API] GET assessments error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/environment/assessments — Create assessment (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para crear evaluaciones' }, { status: 403 })
    }

    const body = await request.json()
    const { title, type, description, location, scope, findings, recommendations, nextReviewDate } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'El tipo de evaluación es requerido' }, { status: 400 })
    }

    const assessment = await db.environmentalAssessment.create({
      data: {
        companyId: session.companyId,
        title: title.trim(),
        type: type.trim(),
        status: 'BORRADOR',
        description: description ? String(description).trim() : null,
        location: location ? JSON.stringify(location) : undefined,
        scope: scope ? JSON.stringify(scope) : undefined,
        findings: findings ? JSON.stringify(findings) : undefined,
        recommendations: recommendations ? JSON.stringify(recommendations) : undefined,
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'ENVIRONMENTAL_ASSESSMENT',
      entityId: assessment.id,
      details: { title: assessment.title, type: assessment.type },
    }, request)

    // Emit ASSESSMENT_CREATED event
    await hseEventManager.emit({
      sourceModule: 'ENVIRONMENT',
      eventType: 'ASSESSMENT_CREATED',
      severity: 'INFO',
      title: `Evaluación ambiental creada: ${assessment.title}`,
      description: `Tipo: ${assessment.type}. Creador: ${session.name}.`,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: assessment.id,
      relatedEntityType: 'ENVIRONMENTAL_ASSESSMENT',
    })

    return NextResponse.json(assessment, { status: 201 })
  } catch (error: unknown) {
    console.error('[Environment API] POST assessment error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
