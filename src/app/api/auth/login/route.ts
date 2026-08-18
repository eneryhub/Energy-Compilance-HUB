import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    // Find user with company info
    const user = await db.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { company: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    // Verify password
    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Audit log
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: { method: 'credentials' },
    }, request)

    // Create session token using auth helper (includes subscriptionPlan for instant gating)
    const token = await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      subscriptionPlan: user.company?.subscriptionPlan || 'starter',
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company?.name || '',
        subscriptionPlan: user.company?.subscriptionPlan || 'starter',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Login error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
