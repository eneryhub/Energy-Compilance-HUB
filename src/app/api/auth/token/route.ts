import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * GET /api/auth/token
 * Returns the current JWT token so the user can copy it for API integrations.
 * Requires a valid session (the token in the request itself).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Return the raw Authorization header value
    const authHeader = request.headers.get('authorization') || request.headers.get('x-authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token no disponible' }, { status: 400 })
    }

    return NextResponse.json({
      token,
      type: 'JWT',
      algorithm: 'HS256',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      userId: session.userId,
      companyId: session.companyId,
      role: session.role,
      warning: 'No compartas este token. Cada integración debería usar su propia API Key para mayor seguridad.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
