import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, token } = body

    // Validate all required fields
    if (!name || !email || !password || !token) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Find company by token (company ID as cuid)
    const company = await db.company.findUnique({
      where: { id: token },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Enlace de registro invalido' },
        { status: 404 }
      )
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists with same email + companyId
    const existingUser = await db.user.findUnique({
      where: {
        email_companyId: {
          email: normalizedEmail,
          companyId: company.id,
        },
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email ya está registrado en la empresa' },
        { status: 409 }
      )
    }

    // Hash password
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with EMPLOYEE role
    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: 'EMPLOYEE',
        companyId: company.id,
      },
    })

    // Create session token
    const sessionToken = await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      subscriptionPlan: company.subscriptionPlan || 'starter',
    })

    // Audit log
    await createAuditLog({
      companyId: company.id,
      userId: user.id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
      details: { method: 'employee-invite', role: 'EMPLOYEE' },
    }, request)

    return NextResponse.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: company.name,
        subscriptionPlan: company.subscriptionPlan || 'starter',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Register employee error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
