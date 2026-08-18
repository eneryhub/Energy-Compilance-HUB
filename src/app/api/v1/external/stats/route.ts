import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ GET Handler ============

export async function GET(req: NextRequest) {
  try {
    // Authenticate via API key
    const apiKey = req.headers.get('PAPERCLIP_API_KEY')
    const expectedKey = process.env.PAPERCLIP_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'No autorizado. API key inválida o ausente.' },
        { status: 401 }
      )
    }

    // Fetch platform-wide stats in parallel
    const [totalCompanies, activeCompanies, totalUsers, totalPermits, totalSensors] =
      await Promise.all([
        db.company.count(),
        db.company.count({ where: { subscriptionStatus: 'ACTIVE' } }),
        db.user.count(),
        db.permit.count(),
        db.sensor.count(),
      ])

    return NextResponse.json({
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalPermits,
      totalSensors,
      platformVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('External stats error:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
