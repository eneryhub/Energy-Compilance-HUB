import { SignJWT, jwtVerify } from 'jose'

export interface Session {
  userId: string
  companyId: string
  role: string
  email: string
  name: string
  subscriptionPlan: string // starter, business, enterprise
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'energy-compliance-hub-jwt-secret-key-2024'
)

// ============ Create JWT token (stateless, no server storage needed) ============

export async function createSession(user: {
  id: string
  companyId: string
  role: string
  email: string
  name: string
  subscriptionPlan?: string
}): Promise<string> {
  const payload = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    name: user.name,
    subscriptionPlan: user.subscriptionPlan || 'starter',
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)

  return token
}

// ============ Verify JWT token from request ============

export async function getSession(request: Request): Promise<Session | null> {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('x-authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as string,
      companyId: payload.companyId as string,
      role: payload.role as string,
      email: payload.email as string,
      name: payload.name as string,
      subscriptionPlan: (payload.subscriptionPlan as string) || 'starter',
    }
  } catch {
    return null
  }
}

// ============ Logout is client-side only (remove token from localStorage) ============

export function deleteSession(_request: Request): void {
  // JWT is stateless — logout is handled client-side by removing token from localStorage
  // This is a no-op on the server side
}

// Alias for convenience in API routes
export function getTokenPayload(request: Request): Promise<Session | null> {
  return getSession(request)
}

// ============ Plan access helpers ============

export type PlanType = 'starter' | 'business' | 'enterprise'

// Modules that require a specific minimum plan
export const PLAN_GATES: Record<string, { minPlan: PlanType; label: string; upsellMessage: string }> = {
  scada: {
    minPlan: 'business',
    label: 'SCADA Telemetría',
    upsellMessage: 'Pásate al plan Business para monitorear tus sensores en tiempo real con telemetría SCADA.',
  },
  predictive: {
    minPlan: 'business',
    label: 'IA Predictiva',
    upsellMessage: 'Pásate al plan Business para acceder al análisis predictivo con Inteligencia Artificial.',
  },
  reports: {
    minPlan: 'business',
    label: 'Reportes Avanzados',
    upsellMessage: 'Pásate al plan Business para generar reportes analíticos avanzados de tu operación.',
  },
}

export const PLAN_PRIORITY: Record<PlanType, number> = {
  starter: 0,
  business: 1,
  enterprise: 2,
}

export function isModuleAccessible(moduleId: string, plan: string): boolean {
  const gate = PLAN_GATES[moduleId]
  if (!gate) return true // No gate = accessible to all
  return (PLAN_PRIORITY[plan as PlanType] ?? 0) >= (PLAN_PRIORITY[gate.minPlan] ?? 0)
}

export function getModuleGate(moduleId: string) {
  return PLAN_GATES[moduleId] || null
}
