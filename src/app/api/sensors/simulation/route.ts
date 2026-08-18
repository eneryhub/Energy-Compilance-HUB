import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { setDemoMode, isDemoMode } from '@/lib/scada/engine'
import { appendFileSync } from 'fs'

// Diagnostic log to file (survives context restarts)
function diagLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  console.log(msg)
  try { appendFileSync('/tmp/demo-mode-diag.log', line) } catch { /* ignore */ }
}

// POST /api/sensors/simulation - Toggle demo mode on/off
export async function POST(req: NextRequest) {
  diagLog(`>>> POST /api/sensors/simulation HIT <<< url=${req.url}`)
  try {
    const payload = await getTokenPayload(req)
    diagLog(`POST payload: ${JSON.stringify(payload)}`)
    if (!payload) {
      diagLog('POST: 401 No autorizado')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(payload.role)) {
      diagLog(`POST: 403 role=${payload.role}`)
      return NextResponse.json({ error: 'Sin permisos para cambiar modo simulación' }, { status: 403 })
    }

    const body = await req.json()
    const { enabled } = body
    diagLog(`POST body: enabled=${enabled} type=${typeof enabled}`)

    if (typeof enabled !== 'boolean') {
      diagLog(`POST: 400 invalid enabled type=${typeof enabled}`)
      return NextResponse.json({ error: 'Parámetro "enabled" (boolean) requerido' }, { status: 400 })
    }

    const newMode = await setDemoMode(payload.companyId, enabled)
    diagLog(`POST: setDemoMode returned=${newMode} type=${typeof newMode}`)

    // Sanitize: ensure demoMode is always a strict boolean
    const safeMode = newMode === true
    diagLog(`POST: safeMode=${safeMode}`)

    const response = {
      demoMode: safeMode,
      message: safeMode
        ? 'Modo Demo ACTIVADO - Sensores simulan datos en tiempo real'
        : 'Modo Demo DESACTIVADO - Esperando datos de hardware real',
    }
    diagLog(`POST: responding with ${JSON.stringify(response)}`)
    return NextResponse.json(response)
  } catch (error: any) {
    diagLog(`POST ERROR: ${error.message} stack=${error.stack?.substring(0, 200)}`)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

// GET /api/sensors/simulation - Get current simulation mode
export async function GET(req: NextRequest) {
  diagLog(`>>> GET /api/sensors/simulation HIT <<< url=${req.url}`)
  try {
    const payload = await getTokenPayload(req)
    diagLog(`GET payload: ${JSON.stringify(payload)}`)
    if (!payload) {
      diagLog('GET: 401 No autorizado')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const demoMode = await isDemoMode(payload.companyId)
    diagLog(`GET: demoMode=${demoMode} type=${typeof demoMode}`)
    // Sanitize: ensure response is always a strict boolean
    return NextResponse.json({ demoMode: demoMode === true })
  } catch (error: any) {
    diagLog(`GET ERROR: ${error.message}`)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}