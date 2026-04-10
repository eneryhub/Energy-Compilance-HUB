import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ GET Handler — Full company detail for Super Admin ============

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate — only SUPER_ADMIN
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    const { id } = await params

    // Fetch company with full counts
    const company = await db.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            permits: true,
            documents: true,
            sensors: true,
            workLocations: true,
            apiKeys: true,
           
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    // Parallel queries for additional detail
    const [
      users,
      recentAuditLogs,
      recentPermits,
      unreadSupportCount,
    ] = await Promise.all([
      // Users list
      db.user.findMany({
        where: { companyId: id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Recent audit logs (last 30)
      db.auditLog.findMany({
        where: { companyId: id },
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),

      // Recent permits (last 10 with status)
      db.permit.findMany({
        where: { companyId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          permitNumber: true,
          riskType: true,
          status: true,
          technicianName: true,
          supervisorName: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
        },
      }),

      // Support messages unread count
      db.supportMessage.count({
        where: {
          companyId: id,
          isRead: false,
          senderType: 'USER',
        },
      }),
    ])

    return NextResponse.json({
      company,
      users,
      recentAuditLogs,
      recentPermits,
      unreadSupportMessages: unreadSupportCount,
    })
  } catch (error: any) {
    console.error('Admin company detail error:', error)
    return NextResponse.json(
      { error: 'Error al cargar detalle de la empresa' },
      { status: 500 }
    )
  }
}

// ============ PUT Handler — Update company (Super Admin only) ============

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate — only SUPER_ADMIN
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    const { id } = await params

    // Check company exists
    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const body = await req.json()

    // Validate allowed fields
    const allowedPlans = ['starter', 'business', 'enterprise']
    const allowedStatuses = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    // subscriptionPlan
    if (body.subscriptionPlan !== undefined) {
      if (!allowedPlans.includes(body.subscriptionPlan)) {
        return NextResponse.json(
          { error: `Plan inválido. Valores permitidos: ${allowedPlans.join(', ')}` },
          { status: 400 }
        )
      }
      if (body.subscriptionPlan !== existing.subscriptionPlan) {
        changes.subscriptionPlan = { from: existing.subscriptionPlan, to: body.subscriptionPlan }
        updateData.subscriptionPlan = body.subscriptionPlan
      }
    }

    // subscriptionStatus
    if (body.subscriptionStatus !== undefined) {
      if (!allowedStatuses.includes(body.subscriptionStatus)) {
        return NextResponse.json(
          { error: `Estado inválido. Valores permitidos: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      if (body.subscriptionStatus !== existing.subscriptionStatus) {
        changes.subscriptionStatus = { from: existing.subscriptionStatus, to: body.subscriptionStatus }
        updateData.subscriptionStatus = body.subscriptionStatus
      }
    }

    // isActive
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive debe ser un valor booleano' }, { status: 400 })
      }
      if (body.isActive !== existing.isActive) {
        changes.isActive = { from: existing.isActive, to: body.isActive }
        updateData.isActive = body.isActive
      }
    }

    // maxUsers
    if (body.maxUsers !== undefined) {
      if (typeof body.maxUsers !== 'number' || body.maxUsers < 1) {
        return NextResponse.json({ error: 'maxUsers debe ser un número mayor a 0' }, { status: 400 })
      }
      if (body.maxUsers !== existing.maxUsers) {
        changes.maxUsers = { from: existing.maxUsers, to: body.maxUsers }
        updateData.maxUsers = body.maxUsers
      }
    }

    // maxPermitsPerMonth
    if (body.maxPermitsPerMonth !== undefined) {
      if (typeof body.maxPermitsPerMonth !== 'number' || body.maxPermitsPerMonth < 1) {
        return NextResponse.json({ error: 'maxPermitsPerMonth debe ser un número mayor a 0' }, { status: 400 })
      }
      if (body.maxPermitsPerMonth !== existing.maxPermitsPerMonth) {
        changes.maxPermitsPerMonth = { from: existing.maxPermitsPerMonth, to: body.maxPermitsPerMonth }
        updateData.maxPermitsPerMonth = body.maxPermitsPerMonth
      }
    }

    // subscriptionExpiresAt
    if (body.subscriptionExpiresAt !== undefined) {
      if (body.subscriptionExpiresAt === null) {
        if (existing.subscriptionExpiresAt !== null) {
          changes.subscriptionExpiresAt = { from: existing.subscriptionExpiresAt.toISOString(), to: null }
          updateData.subscriptionExpiresAt = null
        }
      } else {
        const date = new Date(body.subscriptionExpiresAt)
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'subscriptionExpiresAt debe ser una fecha ISO válida' },
            { status: 400 }
          )
        }
        const existingDate = existing.subscriptionExpiresAt?.toISOString()
        const newDate = date.toISOString()
        if (existingDate !== newDate) {
          changes.subscriptionExpiresAt = { from: existingDate || null, to: newDate }
          updateData.subscriptionExpiresAt = date
        }
      }
    }

    // Check if there are any changes
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({
        message: 'No se detectaron cambios',
        company: existing,
      })
    }

    // Update company
    const updatedCompany = await db.company.update({
      where: { id },
      data: updateData,
    })

    // Create audit log for the changes
    await createAuditLog(
      {
        companyId: existing.id,
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'COMPANY',
        entityId: existing.id,
        details: {
          updatedBy: session.name,
          updatedByEmail: session.email,
          changes,
        },
      },
      req
    )

    return NextResponse.json({
      message: 'Empresa actualizada correctamente',
      company: updatedCompany,
      changes,
    })
  } catch (error: any) {
    console.error('Admin company update error:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la empresa' },
      { status: 500 }
    )
  }
}
