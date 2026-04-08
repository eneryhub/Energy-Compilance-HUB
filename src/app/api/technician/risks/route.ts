import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// ──────────────────────────────────────────────────────────────
// GET /api/technician/risks
// Returns ONLY the risk types belonging to the technician's company.
// Multi-tenant: companyId from session ONLY.
// No technician can see another company's risk types.
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // All roles can read their own company's risk types
    const companyId = session.companyId // NEVER from client

    const riskTypes = await db.riskTypeConfig.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        checklist: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json({ riskTypes })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
