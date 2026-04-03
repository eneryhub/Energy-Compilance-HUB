import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ POST Handler ============

export async function POST(req: NextRequest) {
  try {
    // Authenticate — only SUPER_ADMIN
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    // Parse body
    const body = await req.json()
    const { companyId } = body

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      )
    }

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    // Update company to Enterprise
    const updatedCompany = await db.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: 'enterprise',
        subscriptionStatus: 'ACTIVE',
        maxUsers: 999999,
        maxPermitsPerMonth: 999999,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    })

    // Create audit log
    await createAuditLog(
      {
        companyId: company.id,
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'COMPANY',
        entityId: company.id,
        details: {
          reason: 'SUPER_ADMIN enterprise activation',
          previousPlan: company.subscriptionPlan,
          previousStatus: company.subscriptionStatus,
          newPlan: 'enterprise',
          newStatus: 'ACTIVE',
        },
      },
      req
    )

    return NextResponse.json({
      success: true,
      company: updatedCompany,
      message: `Plan Enterprise activado para ${company.name}`,
    })
  } catch (error: any) {
    console.error('Activate enterprise error:', error)
    return NextResponse.json(
      { error: 'Error al activar plan Enterprise' },
      { status: 500 }
    )
  }
}
