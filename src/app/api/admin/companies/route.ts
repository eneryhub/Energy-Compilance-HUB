import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// ============ GET Handler ============

export async function GET(req: NextRequest) {
  try {
    // Authenticate — only SUPER_ADMIN
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Solo SUPER_ADMIN.' }, { status: 403 })
    }

    // Fetch all companies with counts
    const companies = await db.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            permits: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Normalize data defensively — ensure every field has a valid value
    const normalized = companies.map((c) => ({
      id: c.id,
      name: c.name || 'Sin nombre',
      email: c.email || '',
      subscriptionPlan: c.subscriptionPlan || 'starter',
      subscriptionStatus: c.subscriptionStatus || 'TRIAL',
      createdAt: c.createdAt?.toISOString?.() || new Date().toISOString(),
      maxUsers: c.maxUsers ?? 10,
      maxPermitsPerMonth: c.maxPermitsPerMonth ?? 200,
      isActive: c.isActive ?? true,
      _count: {
        users: c._count?.users ?? 0,
        permits: c._count?.permits ?? 0,
      },
    }))

    return NextResponse.json({ companies: normalized })
  } catch (error: any) {
    console.error('[Admin Companies] Error:', error?.message || error)
    return NextResponse.json(
      { error: 'Error al cargar empresas', companies: [] },
      { status: 500 }
    )
  }
}
