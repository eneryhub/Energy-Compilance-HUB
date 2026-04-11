import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ POST: Create emergency alert ============
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tipo, ubicacion, descripcion, photoUrl, prioridad } = body

    if (!tipo || !ubicacion) {
      return NextResponse.json(
        { error: 'tipo y ubicacion son requeridos' },
        { status: 400 }
      )
    }

    // Validate ubicacion is a valid JSON string
    let parsedUbicacion: unknown
    try {
      parsedUbicacion = typeof ubicacion === 'string' ? JSON.parse(ubicacion) : ubicacion
    } catch {
      return NextResponse.json(
        { error: 'ubicacion debe ser un JSON válido' },
        { status: 400 }
      )
    }

    const alert = await db.emergencyAlert.create({
      data: {
        companyId: session.companyId,
        userId: session.userId,
        tipo,
        ubicacion: JSON.stringify(parsedUbicacion),
        descripcion: descripcion || null,
        photoUrl: photoUrl || null,
        prioridad: prioridad || 'ALTA',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE_EMERGENCY_ALERT',
      entityType: 'EMERGENCY_ALERT',
      entityId: alert.id,
      details: { tipo, prioridad: prioridad || 'ALTA' },
    }, request)

    return NextResponse.json(alert, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Create emergency alert error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============ GET: List emergency alerts ============
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || undefined
    const prioridad = searchParams.get('prioridad') || undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

    const where: Record<string, unknown> = {
      companyId: session.companyId,
    }

    if (estado) {
      where.estado = estado
    }
    if (prioridad) {
      where.prioridad = prioridad
    }

    const alerts = await db.emergencyAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(alerts)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Get emergency alerts error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
