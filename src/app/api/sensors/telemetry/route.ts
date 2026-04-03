import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getTelemetry, isDemoMode } from '@/lib/scada/engine'

// GET /api/sensors/telemetry - Get all telemetry data (with simulation tick if demo mode)
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const runSimulation = searchParams.get('simulate') !== 'false' && isDemoMode()

    const result = await getTelemetry(payload.companyId, runSimulation)

    return NextResponse.json({
      points: result.points,
      siteSafety: result.siteSafety,
      demoMode: isDemoMode(),
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[GET /api/sensors/telemetry]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
