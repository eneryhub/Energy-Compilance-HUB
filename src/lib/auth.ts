import { SignJWT, jwtVerify } from 'jose'

export interface Session {
  userId: string
  companyId: string
  role: string
  email: string
  name: string
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
}): Promise<string> {
  const payload = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    name: user.name,
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
