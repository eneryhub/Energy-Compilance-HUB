import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { setDemoMode, isDemoMode } from '@/lib/scada/engine'

// POST /api/sensors/simulation - Toggle demo mode on/off
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos para cambiar modo simulación' }, { status: 403 })
    }

    const body = await req.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Parámetro "enabled" (boolean) requerido' }, { status: 400 })
    }

    const newMode = setDemoMode(enabled)

    return NextResponse.json({
      demoMode: newMode,
      message: newMode ? 'Modo Demo ACTIVADO - Sensores simulan datos en tiempo real' : 'Modo Demo DESACTIVADO - Esperando datos de hardware real',
    })
  } catch (error: any) {
    console.error('[POST /api/sensors/simulation]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// GET /api/sensors/simulation - Get current simulation mode
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    return NextResponse.json({ demoMode: isDemoMode() })
  } catch (error: any) {
    console.error('[GET /api/sensors/simulation]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
