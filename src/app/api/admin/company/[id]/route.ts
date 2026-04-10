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
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    const { id } = await params

    const company = await db.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            permits: true,
            hseDocuments: true, // Corregido: 'documents' no existía en tu DB, era hseDocuments
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

    const [
      users,
      recentAuditLogs,
      recentPermits,
      // unreadSupportCount eliminado porque la tabla SupportMessage no existe en tu Supabase
    ] = await Promise.all([
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
      db.auditLog.findMany({
        where: { companyId: id },
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
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
    ])

    return NextResponse.json({
      company,
      users,
      recentAuditLogs,
      recentPermits,
      unreadSupportMessages: 0, // Mantenemos la propiedad en 0 para no romper el Frontend
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
    const session = await getTokenPayload(req)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const allowedPlans = ['starter', 'business', 'enterprise']
    const allowedStatuses = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']

    const updateData: Record<string, any> = {}
    const changes: Record<string, { from: any; to: any }> = {}

    // --- Mantenemos todas tus validaciones originales ---
    
    if (body.subscriptionPlan !== undefined) {
      if (!allowedPlans.includes(body.subscriptionPlan)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
      }
      if (body.subscriptionPlan !== existing.subscriptionPlan) {
        changes.subscriptionPlan = { from: existing.subscriptionPlan, to: body.subscriptionPlan }
        updateData.subscriptionPlan = body.subscriptionPlan
      }
    }

    if (body.subscriptionStatus !== undefined) {
      if (!allowedStatuses.includes(body.subscriptionStatus)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      }
      if (body.subscriptionStatus !== existing.subscriptionStatus) {
        changes.subscriptionStatus = { from: existing.subscriptionStatus, to: body.subscriptionStatus }
        updateData.subscriptionStatus = body.subscriptionStatus
      }
    }

    if (body.isActive !== undefined && typeof body.isActive === 'boolean') {
      if (body.isActive !== existing.isActive) {
        changes.isActive = { from: existing.isActive, to: body.isActive }
        updateData.isActive = body.isActive
      }
    }

    if (body.maxUsers !== undefined && typeof body.maxUsers === 'number' && body.maxUsers > 0) {
      if (body.maxUsers !== existing.maxUsers) {
        changes.maxUsers = { from: existing.maxUsers, to: body.maxUsers }
        updateData.maxUsers = body.maxUsers
      }
    }

    if (body.maxPermitsPerMonth !== undefined && typeof body.maxPermitsPerMonth === 'number' && body.maxPermitsPerMonth > 0) {
      if (body.maxPermitsPerMonth !== existing.maxPermitsPerMonth) {
        changes.maxPermitsPerMonth = { from: existing.maxPermitsPerMonth, to: body.maxPermitsPerMonth }
        updateData.maxPermitsPerMonth = body.maxPermitsPerMonth
      }
    }

    if (body.subscriptionExpiresAt !== undefined) {
      if (body.subscriptionExpiresAt === null) {
        if (existing.subscriptionExpiresAt !== null) {
          changes.subscriptionExpiresAt = { from: existing.subscriptionExpiresAt.toISOString(), to: null }
          updateData.subscriptionExpiresAt = null
        }
      } else {
        const date = new Date(body.subscriptionExpiresAt)
        if (!isNaN(date.getTime())) {
          const existingDate = existing.subscriptionExpiresAt?.toISOString()
          const newDate = date.toISOString()
          if (existingDate !== newDate) {
            changes.subscriptionExpiresAt = { from: existingDate || null, to: newDate }
            updateData.subscriptionExpiresAt = date
          }
        }
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No hay cambios', company: existing })
    }

    const updatedCompany = await db.company.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      companyId: existing.id,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'COMPANY',
      entityId: existing.id,
      details: { updatedBy: session.name, updatedByEmail: session.email, changes },
    }, req)

    return NextResponse.json({
      message: 'Empresa actualizada correctamente',
      company: updatedCompany,
      changes,
    })
  } catch (error: any) {
    console.error('Admin company update error:', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}