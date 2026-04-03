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

    return NextResponse.json({ companies })
  } catch (error: any) {
    console.error('Admin companies error:', error)
    return NextResponse.json(
      { error: 'Error al cargar empresas' },
      { status: 500 }
    )
  }
}
