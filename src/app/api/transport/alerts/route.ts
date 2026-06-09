import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/transport/alerts — Alias for driver-events (DMS alerts)
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    const events = await db.transportDriverEvent.findMany({
      where: { companyId: session.companyId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        driver: { select: { id: true, name: true } },
      },
    })

    const alerts = events.map(e => ({
      id: e.id,
      driverName: e.driver?.name || null,
      eventType: e.eventType,
      riskLevel: e.riskLevel,
      description: e.aiAnalysis ? (JSON.parse(e.aiAnalysis)).description || e.eventType : e.eventType,
      timestamp: e.timestamp.toISOString(),
      location: e.gpsLocation ? (() => {
        try {
          const loc = JSON.parse(e.gpsLocation)
          return `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}` || null
        } catch { return null }
      })() : null,
      isResolved: e.isResolved,
    }))

    return NextResponse.json({ alerts })
  } catch (error: unknown) {
    console.error('[Transport API] GET alerts error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
