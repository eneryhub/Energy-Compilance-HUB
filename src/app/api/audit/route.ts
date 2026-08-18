import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de Sesión',
  LOGOUT: 'Cierre de Sesión',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  VIEW: 'Visualización',
}

const ENTITY_LABELS: Record<string, string> = {
  USER: 'Usuario',
  PERMIT: 'Permiso',
  DOCUMENT: 'Documento HSE',
  COMPANY: 'Empresa',
  SIGNATURE: 'Firma Digital',
  WORK_LOCATION: 'Ubicación de Trabajo',
  RISK_TYPE: 'Tipo de Riesgo',
  CHECKLIST_ITEM: 'Item de Checklist',
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const entityType = searchParams.get('entityType')
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (entityType) where.entityType = entityType
    if (action) where.action = action
    if (userId) where.userId = userId
    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, unknown> = {}
      if (dateFrom) createdAtFilter.gte = new Date(dateFrom)
      if (dateTo) createdAtFilter.lte = new Date(dateTo + 'T23:59:59')
      where.createdAt = createdAtFilter
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Get summary stats
    const [totalLogs, todayLogs, uniqueUsers, permitsCreated, permitsApproved, permitsRejected] = await Promise.all([
      db.auditLog.count({ where: { companyId: session.companyId } }),
      db.auditLog.count({
        where: {
          companyId: session.companyId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.auditLog.groupBy({
        by: ['userId'],
        where: { companyId: session.companyId },
      }),
      db.auditLog.count({ where: { companyId: session.companyId, entityType: 'PERMIT', action: 'CREATE' } }),
      db.auditLog.count({ where: { companyId: session.companyId, entityType: 'PERMIT', action: 'APPROVE' } }),
      db.auditLog.count({ where: { companyId: session.companyId, entityType: 'PERMIT', action: 'REJECT' } }),
    ])

    const summary = {
      totalLogs,
      todayLogs,
      uniqueUsers: uniqueUsers.length,
      permitsCreated,
      permitsApproved,
      permitsRejected,
    }

    return NextResponse.json({
      logs,
      summary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      labels: { actions: ACTION_LABELS, entities: ENTITY_LABELS },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
