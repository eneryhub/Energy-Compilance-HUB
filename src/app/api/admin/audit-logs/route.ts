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

    // Get optional companyId filter from query params
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    // Fetch audit logs
    const logs = await db.auditLog.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('Admin audit logs error:', error)
    return NextResponse.json(
      { error: 'Error al cargar logs de auditoría' },
      { status: 500 }
    )
  }
}
