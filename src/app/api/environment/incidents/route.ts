import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { hseEventManager } from '@/lib/hse-event-manager'

// GET /api/environment/incidents — List environmental incidents with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const sourceType = searchParams.get('sourceType')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (type) where.type = type
    if (severity) where.severity = severity
    if (status) where.status = status
    if (sourceType) where.sourceType = sourceType

    const incidents = await db.environmentalIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({
      incidents: Array.isArray(incidents) ? incidents : [],
    })
  } catch (error: unknown) {
    console.error('[Environment API] GET incidents error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/environment/incidents — Report incident (emits ENV_INCIDENT_REPORTED)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type, severity, description, location, photos, estimatedImpact, sourceType, sourceId } = body

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'El tipo de incidente es requerido' }, { status: 400 })
    }

    if (!severity || typeof severity !== 'string') {
      return NextResponse.json({ error: 'La severidad es requerida' }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    }

    const incident = await db.environmentalIncident.create({
      data: {
        companyId: session.companyId,
        reportedById: session.userId,
        type: type.trim(),
        severity: severity.trim().toUpperCase(),
        sourceType: sourceType || 'MANUAL',
        sourceId: sourceId || null,
        description: description.trim(),
        location: location ? JSON.stringify(location) : undefined,
        photos: photos ? JSON.stringify(photos) : undefined,
        estimatedImpact: estimatedImpact ? JSON.stringify(estimatedImpact) : undefined,
        status: 'REPORTADO',
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'ENVIRONMENTAL_INCIDENT',
      entityId: incident.id,
      details: {
        type: incident.type,
        severity: incident.severity,
        sourceType: incident.sourceType,
      },
    }, request)

    // Emit ENV_INCIDENT_REPORTED event via HSEEventManager
    const severityToHSE: Record<string, 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'> = {
      BAJO: 'INFO',
      MEDIO: 'WARNING',
      ALTO: 'HIGH',
      CRITICO: 'CRITICAL',
    }

    await hseEventManager.emit({
      sourceModule: 'ENVIRONMENT',
      eventType: 'ENV_INCIDENT_REPORTED',
      severity: severityToHSE[incident.severity] || 'WARNING',
      title: `Incidente ambiental reportado: ${incident.type}`,
      description: incident.description.substring(0, 200),
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      relatedEntityId: incident.id,
      relatedEntityType: 'ENVIRONMENTAL_INCIDENT',
      metadata: {
        incidentType: incident.type,
        severity: incident.severity,
        sourceType: incident.sourceType,
      },
    })

    return NextResponse.json(incident, { status: 201 })
  } catch (error: unknown) {
    console.error('[Environment API] POST incident error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
