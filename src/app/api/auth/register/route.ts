import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, companyName } = body

    if (!name || !email || !password || !companyName) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Create company — 7-day trial period
    const trialDays = 7
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

    const company = await db.company.create({
      data: {
        name: companyName,
        email: email.toLowerCase().trim(),
        subscriptionPlan: 'starter',
        subscriptionStatus: 'TRIAL',
        trialEndsAt,
        subscriptionExpiresAt: new Date(trialEndsAt.getTime()), // trial = subscription window
      },
    })

    // Create user
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: hash,
        name,
        role: 'ADMIN',
        companyId: company.id,
      },
    })

    return NextResponse.json({
      message: 'Cuenta creada exitosamente',
      userId: user.id,
      companyId: company.id,
    })
  } catch (error: any) {
    console.error('Register error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
