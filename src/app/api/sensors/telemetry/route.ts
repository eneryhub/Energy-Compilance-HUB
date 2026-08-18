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
    const demoMode = await isDemoMode(payload.companyId)
    const runSimulation = searchParams.get('simulate') !== 'false' && demoMode

    const result = await getTelemetry(payload.companyId, runSimulation)

    // IMPORTANT: Do NOT return demoMode in telemetry response.
    // demoMode is managed exclusively by /api/sensors/simulation endpoint.
    // Including it here caused race conditions where polling reverted the user's toggle.
    return NextResponse.json({
      points: result.points,
      siteSafety: result.siteSafety,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[GET /api/sensors/telemetry]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
