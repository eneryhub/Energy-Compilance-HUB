import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { validateApiKey } from '@/lib/api-keys'
import { ingestSensorData } from '@/lib/scada/engine'

/**
 * POST /api/sensors/ingest
 * Receive sensor data from external sources (IoT devices, gateways, scripts).
 *
 * Authentication: Requires EITHER a valid JWT token OR a valid API Key.
 * - JWT: Send in Authorization header as "Bearer <token>"
 * - API Key: Send in X-API-Key header as "ech_live_xxxxx..."
 */
export async function POST(request: NextRequest) {
  try {
    // ── Authentication: JWT or API Key ────────────────────
    let companyId: string | null = null
    let authMethod: 'jwt' | 'api_key' | null = null

    // Try JWT first
    const session = await getSession(request)
    if (session) {
      companyId = session.companyId
      authMethod = 'jwt'
    }

    // Try API Key if no JWT
    if (!companyId) {
      const apiKeyHeader = request.headers.get('x-api-key')
      console.log('[Ingest] Trying API Key auth, header:', apiKeyHeader ? `${apiKeyHeader.substring(0, 20)}...` : '(empty)')
      if (apiKeyHeader) {
        const keyValidation = await validateApiKey(apiKeyHeader)
        console.log('[Ingest] API Key validation result:', keyValidation ? `VALID (companyId=${keyValidation.companyId})` : 'INVALID')
        if (keyValidation) {
          companyId = keyValidation.companyId
          authMethod = 'api_key'
        }
      }
    }

    if (!companyId || !authMethod) {
      console.warn('[Ingest] Auth failed — no valid JWT or API Key')
      return NextResponse.json(
        {
          error: 'No autorizado',
          details: 'Se requiere autenticación JWT (Authorization: Bearer <token>) o API Key (X-API-Key: ech_live_xxx...)',
          hint: 'Genera tus credenciales en SCADA → Credenciales API',
        },
        { status: 401 }
      )
    }

    // ── Parse request body ────────────────────────────────
    const body = await request.json()
    const { sensorId, value, timestamp, source } = body

    if (!sensorId || value === undefined || value === null) {
      return NextResponse.json(
        { error: 'sensorId y value son requeridos' },
        { status: 400 }
      )
    }

    const numericValue = parseFloat(value)
    if (isNaN(numericValue)) {
      return NextResponse.json(
        { error: 'value debe ser un número' },
        { status: 400 }
      )
    }

    // ── Ingest data ───────────────────────────────────────
    console.log('[Ingest] Incoming data:', { sensorId, value: numericValue, source, companyId, authMethod })

    const result = await ingestSensorData(
      sensorId,
      numericValue,
      (source as 'webhook' | 'mqtt' | 'manual') || 'webhook',
      companyId  // Pass companyId for multi-tenant validation
    )

    if (!result) {
      console.warn('[Ingest] 404 — Sensor not found, inactive, or wrong company:', { sensorId, companyId })
      return NextResponse.json(
        {
          error: 'Sensor no encontrado, inactivo, o no pertenece a tu empresa',
          sensorId,
          hint: 'Verifica que el sensorId sea correcto y que pertenezca a la misma empresa que la API Key.',
        },
        { status: 404 }
      )
    }

    // ── Handle blocked sensors (e.g. simulated/demo mode) ──
    if ('blocked' in result) {
      console.warn('[Ingest] 403 — Sensor blocked:', { sensorId, reason: result.reason })
      return NextResponse.json(
        {
          error: result.reason,
          sensorId,
          hint: 'Para enviar datos externos, el sensor debe estar configurado como real (isSimulated: false).',
        },
        { status: 403 }
      )
    }

    // ── Response ──────────────────────────────────────────
    console.log('[Ingest] Success:', { sensorId: result.sensorId, sensorName: result.sensorName, value: result.value, status: result.status, authMethod })
    return NextResponse.json({
      success: true,
      sensorId: result.sensorId,
      sensorName: result.sensorName,
      value: result.value,
      unit: result.unit,
      status: result.status,
      timestamp: timestamp || result.timestamp,
      authMethod,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[Ingest] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
