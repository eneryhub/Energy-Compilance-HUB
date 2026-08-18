import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getPlan } from '@/lib/plans'
import { createAuditLog } from '@/lib/audit'

// GET /api/users - List users in company (admin/supervisor only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Solo administradores, supervisores y gerentes pueden listar usuarios' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const active = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (role) where.role = role
    if (active !== null && active !== undefined) {
      where.isActive = active === 'true'
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          avatarUrl: true,
          phone: true,
          createdAt: true,
          _count: {
            select: {
              permitsCreated: true,
              permitsApproved: true,
              documents: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/users - Create user (admin only, with subscription limits)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden crear usuarios' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, role, password, phone, avatarUrl } = body

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Nombre, email y rol son requeridos' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'MANAGER', 'VIEWER']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    // Check subscription limits
    const company = await db.company.findUnique({ where: { id: session.companyId } })
    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const currentUsers = await db.user.count({
      where: { companyId: session.companyId, isActive: true }
    })

    if (currentUsers >= company.maxUsers) {
      const plan = getPlan(company.subscriptionPlan)
      if (plan.enterprise) {
        return NextResponse.json(
          {
            error: `Límite de plan alcanzado (${company.maxUsers}/${company.maxUsers}). Para ampliar su capacidad de usuarios, contacte con nuestro equipo de ventas en ventas@energycompliancehub.com`,
            code: 'SUBSCRIPTION_LIMIT_ENTERPRISE'
          },
          { status: 403 }
        )
      }
      return NextResponse.json(
        {
          error: `Límite de usuarios alcanzado (${company.maxUsers}/${company.maxUsers}). Plan actual: ${plan.name}. Actualice su suscripción para agregar más usuarios.`,
          code: 'SUBSCRIPTION_LIMIT'
        },
        { status: 403 }
      )
    }

    // Check if email already exists in company
    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase(), companyId: session.companyId }
    })
    if (existingUser) {
      return NextResponse.json({ error: 'Ya existe un usuario con este email en su empresa' }, { status: 409 })
    }

    // Hash password if provided, otherwise set a default
    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : await bcrypt.hash('ChangeMe123!', 12)

    const user = await db.user.create({
      data: {
        companyId: session.companyId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        avatarUrl: true,
        createdAt: true
      }
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      details: { name: user.name, email: user.email, role: user.role, invitedBy: session.name }
    }, request)

    return NextResponse.json({ user }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
