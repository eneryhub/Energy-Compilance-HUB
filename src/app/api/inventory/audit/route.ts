import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/inventory/audit — List inventory audit records
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const discrepancy = searchParams.get('discrepancy')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (locationId) {
      where.locationId = locationId
    }

    if (discrepancy !== null && discrepancy !== '') {
      where.discrepancy = discrepancy === 'true'
    }

    const [audits, total] = await Promise.all([
      db.inventoryAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          location: {
            select: { id: true, name: true, province: true, city: true },
          },
          device: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      db.inventoryAudit.count({ where }),
    ])

    return NextResponse.json({
      audits: Array.isArray(audits) ? audits : [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET audit error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
