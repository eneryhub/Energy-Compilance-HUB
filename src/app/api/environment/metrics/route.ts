import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/environment/metrics — List environmental metrics with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const source = searchParams.get('source')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (type) where.type = type
    if (source) where.source = source
    if (dateFrom || dateTo) {
      const measurementDateFilter: Record<string, unknown> = {}
      if (dateFrom) measurementDateFilter.gte = new Date(dateFrom)
      if (dateTo) measurementDateFilter.lte = new Date(dateTo)
      where.measurementDate = measurementDateFilter
    }

    const metrics = await db.environmentalMetric.findMany({
      where,
      orderBy: { measurementDate: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      metrics: Array.isArray(metrics) ? metrics : [],
    })
  } catch (error: unknown) {
    console.error('[Environment API] GET metrics error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/environment/metrics — Create metric reading (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, unit, currentValue, thresholdWarning, thresholdCritical, measurementDate, source, sensorId, notes } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'El tipo de métrica es requerido' }, { status: 400 })
    }

    if (!unit || typeof unit !== 'string') {
      return NextResponse.json({ error: 'La unidad es requerida' }, { status: 400 })
    }

    if (!measurementDate) {
      return NextResponse.json({ error: 'La fecha de medición es requerida' }, { status: 400 })
    }

    // Determine status based on thresholds
    let status = 'NORMAL'
    if (thresholdCritical && currentValue && currentValue >= thresholdCritical) {
      status = 'EXCEDIDO'
    } else if (thresholdWarning && currentValue && currentValue >= thresholdWarning) {
      status = 'ADVERTENCIA'
    }

    const metric = await db.environmentalMetric.create({
      data: {
        companyId: session.companyId,
        name: name.trim(),
        type: type.trim(),
        unit: unit.trim(),
        currentValue: typeof currentValue === 'number' ? currentValue : null,
        thresholdWarning: typeof thresholdWarning === 'number' ? thresholdWarning : 0,
        thresholdCritical: typeof thresholdCritical === 'number' ? thresholdCritical : 100,
        measurementDate: new Date(measurementDate),
        source: source || 'MANUAL',
        sensorId: sensorId || null,
        notes: notes ? String(notes).trim() : null,
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'ENVIRONMENTAL_METRIC',
      entityId: metric.id,
      details: {
        name: metric.name,
        type: metric.type,
        value: metric.currentValue,
        status,
      },
    }, request)

    // Create SystemAlert if metric is exceeded
    if (status === 'EXCEDIDO') {
      try {
        // Dedup: check if alert exists in last 60 minutes for same metric type
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const recentAlert = await db.systemAlert.findFirst({
          where: {
            companyId: session.companyId,
            type: 'ENV_METRIC_EXCEEDED',
            relatedEntityId: metric.id,
            createdAt: { gte: oneHourAgo },
          },
        })

        if (!recentAlert) {
          await db.systemAlert.create({
            data: {
              companyId: session.companyId,
              type: 'ENV_METRIC_EXCEEDED',
              severity: 'HIGH',
              title: `Métrica ambiental excedida: ${metric.name}`,
              message: `Valor actual: ${metric.currentValue} ${metric.unit}. Umbral crítico: ${metric.thresholdCritical} ${metric.unit}. Tipo: ${metric.type}.`,
              metadata: JSON.stringify({ metricId: metric.id, name: metric.name, type: metric.type, value: metric.currentValue, threshold: metric.thresholdCritical }),
              relatedEntityId: metric.id,
              relatedEntityType: 'ENVIRONMENTAL_METRIC',
            },
          })
        }
      } catch (alertErr) {
        console.error('[Environment API] Failed to create metric alert:', alertErr instanceof Error ? alertErr.message : alertErr)
      }
    }

    return NextResponse.json({ metric, status }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Environment API] POST metric error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
