import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { reviewPermitSafety } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { riskType, riskLabel, workDescription, workLocation, safetyChecks, technicianName, supervisorName, hasPhotos, photosCount } = body

    if (!riskType || !workDescription || !safetyChecks) {
      return NextResponse.json({ error: 'Datos del permiso incompletos' }, { status: 400 })
    }

    const review = await reviewPermitSafety({
      riskType,
      riskLabel: riskLabel || riskType,
      workDescription,
      workLocation: workLocation || '',
      safetyChecks,
      technicianName: technicianName || 'Técnico',
      supervisorName: supervisorName || 'Supervisor',
      hasPhotos: hasPhotos || false,
      photosCount: photosCount || 0,
    })

    return NextResponse.json({ review })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
