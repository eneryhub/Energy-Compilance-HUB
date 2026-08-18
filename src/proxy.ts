import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'energy-compliance-hub-jwt-secret-key-2024'
)

// Routes that require a specific minimum plan
// This middleware protects API routes for gated modules
const PLAN_PROTECTED_PATHS: Record<string, string> = {
  '/api/sensors': 'business',
  '/api/sensors/telemetry': 'business',
  '/api/predictive': 'business',
  '/api/reports/generate': 'business',
}

// Paths that are EXCLUDED from plan gating even if they match a protected prefix.
// These are configuration/auth endpoints, not premium data modules.
const PLAN_EXCLUDED_PATHS: string[] = [
  '/api/sensors/simulation',   // Demo mode toggle — config control, not premium data
]

const PLAN_PRIORITY: Record<string, number> = {
  starter: 0,
  business: 1,
  enterprise: 2,
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip plan check for excluded paths (config endpoints)
  if (PLAN_EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Only intercept API routes that are plan-gated
  const matchedPath = Object.keys(PLAN_PROTECTED_PATHS).find(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )

  if (!matchedPath) {
    return NextResponse.next()
  }

  // Get token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.next() // Let the route handler handle missing auth
  }

  const token = authHeader.replace('Bearer ', '').trim()

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userPlan = (payload.subscriptionPlan as string) || 'starter'
    const requiredPlan = PLAN_PROTECTED_PATHS[matchedPath]!

    if ((PLAN_PRIORITY[userPlan] ?? 0) < (PLAN_PRIORITY[requiredPlan] ?? 0)) {
      return NextResponse.json(
        {
          error: 'Módulo no disponible en tu plan actual',
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredPlan,
          currentPlan: userPlan,
          message: `Este módulo requiere el plan ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} o superior.`,
        },
        { status: 403 }
      )
    }
  } catch {
    // Token verification failed — let the route handler deal with it
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  match: [
    '/api/sensors/:path*',
    '/api/predictive/:path*',
    '/api/reports/generate/:path*',
  ],
}
