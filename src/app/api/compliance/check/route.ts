import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkUserCompliance } from '@/lib/compliance'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verify the company still exists (database may have been reset/reseeded)
    const companyExists = await db.company.count({ where: { id: session.companyId } })
    if (companyExists === 0) {
      return NextResponse.json({ error: 'Sesión inválida — empresa no encontrada' }, { status: 401 })
    }

    const compliance = await checkUserCompliance(session.userId, session.companyId)

    return NextResponse.json({
      isCompliant: compliance.isCompliant,
      expiredCritical: compliance.expiredCriticalDocuments,
      expiringSoon: compliance.expiringSoonDocuments,
      totalDocuments: compliance.totalDocuments,
      activeDocuments: compliance.totalDocuments - compliance.expiredCount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Compliance check error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
