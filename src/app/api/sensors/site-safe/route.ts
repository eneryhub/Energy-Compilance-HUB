import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { isSiteSafe, isCompanySafe } from '@/lib/scada/engine'

// GET /api/sensors/site-safe - Security Gate: check if a site is safe for permit signing
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')

    let result
    if (locationId) {
      result = await isSiteSafe(locationId, payload.companyId)
    } else {
      result = await isCompanySafe(payload.companyId)
    }

    return NextResponse.json({
      ...result,
      checkedAt: new Date().toISOString(),
      locationId: locationId || null,
    })
  } catch (error: any) {
    console.error('[GET /api/sensors/site-safe]', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
