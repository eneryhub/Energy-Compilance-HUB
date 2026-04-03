import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getSensorReadings } from '@/lib/scada/engine'

// GET /api/sensors/[id]/readings - Get historical readings for charts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 200)

    const readings = await getSensorReadings(id, payload.companyId, limit)

    return NextResponse.json(readings)
  } catch (error: any) {
    console.error('[GET /api/sensors/[id]/readings]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
