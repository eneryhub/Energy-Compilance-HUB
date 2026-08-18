import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/erc/list - List emergency alerts with user info (paginated)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || undefined
    const prioridad = searchParams.get('prioridad') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {
      companyId: session.companyId,
    }

    if (estado) where.estado = estado
    if (prioridad) where.prioridad = prioridad

    const [alerts, total] = await Promise.all([
      db.emergencyAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.emergencyAlert.count({ where }),
    ])

    return NextResponse.json({
      alerts,
      total,
      pagination: { limit, offset, total },
    })
  } catch (error: unknown) {
    console.error('[ERC List] Error listing emergency alerts:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
