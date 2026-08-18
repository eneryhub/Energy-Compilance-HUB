import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/admin/goc/alerts — Fetch system alerts with filters
export async function GET(request: NextRequest) {
  try {
    const payload = await getTokenPayload(request)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol SUPER_ADMIN.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const severity = searchParams.get('severity') || undefined
    const companyId = searchParams.get('companyId') || undefined
    const isAcknowledged = searchParams.get('isAcknowledged')
    let limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build where clause
    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (severity) where.severity = severity
    if (companyId) where.companyId = companyId
    if (isAcknowledged !== null && isAcknowledged !== undefined && isAcknowledged !== '') {
      where.isAcknowledged = isAcknowledged === 'true'
    }

    // Fetch alerts with company name
    const [alerts, total, unacknowledged] = await Promise.all([
      db.systemAlert.findMany({
        where,
        include: {
          company: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.systemAlert.count({ where }),
      db.systemAlert.count({ where: { isAcknowledged: false } }),
    ])

    return NextResponse.json({
      alerts: alerts.map(a => ({
        id: a.id,
        companyId: a.companyId,
        companyName: a.company.name,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        isAcknowledged: a.isAcknowledged,
        acknowledgedById: a.acknowledgedById,
        acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
        relatedEntityId: a.relatedEntityId,
        relatedEntityType: a.relatedEntityType,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      unacknowledged,
    })
  } catch (error: unknown) {
    console.error('[GOC Alerts GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/admin/goc/alerts — Acknowledge an alert
export async function POST(request: NextRequest) {
  try {
    const payload = await getTokenPayload(request)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol SUPER_ADMIN.' }, { status: 403 })
    }

    const body = await request.json()
    const { alertId } = body

    if (!alertId) {
      return NextResponse.json({ error: 'alertId es requerido.' }, { status: 400 })
    }

    // Find and update the alert
    const alert = await db.systemAlert.findUnique({ where: { id: alertId } })
    if (!alert) {
      return NextResponse.json({ error: 'Alerta no encontrada.' }, { status: 404 })
    }

    if (alert.isAcknowledged) {
      return NextResponse.json({ error: 'Esta alerta ya fue reconocida.', message: 'Alerta ya reconocida' }, { status: 409 })
    }

    const updated = await db.systemAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedById: payload.userId,
        acknowledgedAt: new Date(),
      },
      include: {
        company: { select: { name: true } },
      },
    })

    return NextResponse.json({
      id: updated.id,
      companyId: updated.companyId,
      companyName: updated.company.name,
      type: updated.type,
      severity: updated.severity,
      title: updated.title,
      message: updated.message,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
      isAcknowledged: updated.isAcknowledged,
      acknowledgedById: updated.acknowledgedById,
      acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
      relatedEntityId: updated.relatedEntityId,
      relatedEntityType: updated.relatedEntityType,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (error: unknown) {
    console.error('[GOC Alerts POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
