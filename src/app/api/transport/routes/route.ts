import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/transport/routes — List routes
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActiveParam = searchParams.get('isActive')
    const riskLevel = searchParams.get('riskLevel')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    if (riskLevel) where.riskLevel = riskLevel

    const routes = await db.transportRoute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        _count: {
          select: { trips: { where: { status: { in: ['EN_TRANSITO', 'AUTORIZADO', 'EN_INSPECCION'] } } } },
        },
      },
    })

    // Map to frontend-expected fields
    const mappedRoutes = routes.map(r => ({
      ...r,
      durationMinutes: r.estimatedDurationMin,
      activeTrips: (r as any)._count?.trips || 0,
    }))

    return NextResponse.json({
      routes: mappedRoutes,
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET routes error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/routes — Create route (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para crear rutas' }, { status: 403 })
    }

    const body = await request.json()
    const { name, origin, destination, distanceKm, estimatedDurationMin, riskLevel, hasHSECheckpoints, checkpointConfig, waypoints } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre de la ruta es requerido' }, { status: 400 })
    }

    if (!origin || typeof origin !== 'string' || origin.trim().length === 0) {
      return NextResponse.json({ error: 'El origen es requerido' }, { status: 400 })
    }

    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
      return NextResponse.json({ error: 'El destino es requerido' }, { status: 400 })
    }

    const route = await db.transportRoute.create({
      data: {
        companyId: session.companyId,
        name: name.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        distanceKm: typeof distanceKm === 'number' ? distanceKm : 0,
        estimatedDurationMin: typeof estimatedDurationMin === 'number' ? estimatedDurationMin : 60,
        riskLevel: riskLevel || 'MEDIO',
        hasHSECheckpoints: typeof hasHSECheckpoints === 'boolean' ? hasHSECheckpoints : false,
        checkpointConfig: checkpointConfig ? JSON.stringify(checkpointConfig) : undefined,
        waypoints: waypoints ? JSON.stringify(waypoints) : undefined,
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_ROUTE',
      entityId: route.id,
      details: { name: route.name, origin: route.origin, destination: route.destination, distanceKm: route.distanceKm },
    }, request)

    return NextResponse.json(route, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST route error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
