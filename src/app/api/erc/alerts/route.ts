import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/erc/alerts - Create a new emergency/panic alert
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body de la petición inválido (JSON malformado)' }, { status: 400 })
    }

    const tipo = typeof body.tipo === 'string' ? body.tipo : 'PANICO'
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion : ''
    const prioridad = typeof body.prioridad === 'string' ? body.prioridad : 'ALTA'
    const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl : null

    // Handle ubicacion: can be string, object, null, or missing
    let ubicacionRaw = body.ubicacion
    let ubicacionStr = '{}'
    if (ubicacionRaw !== null && ubicacionRaw !== undefined) {
      ubicacionStr = typeof ubicacionRaw === 'string' ? ubicacionRaw : JSON.stringify(ubicacionRaw)
    }

    // Validate prioridad
    const validPrioridades = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
    if (!validPrioridades.includes(prioridad)) {
      return NextResponse.json(
        { error: `Prioridad inválida: "${prioridad}". Valores: ${validPrioridades.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate tipo
    const validTipos = ['PANICO', 'INCENDIO', 'DERRAME', 'EVACUACION', 'LESION', 'OTRO']
    if (!validTipos.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo de alerta inválido: "${tipo}". Valores: ${validTipos.join(', ')}` },
        { status: 400 }
      )
    }

    const alert = await db.emergencyAlert.create({
      data: {
        companyId: session.companyId,
        userId: session.userId,
        tipo,
        ubicacion: ubicacionStr,
        descripcion: descripcion || null,
        photoUrl: photoUrl || null,
        prioridad,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Audit log — non-blocking: don't fail the alert if audit log fails
    try {
      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'ERC_ALERT_CREATED',
        entityType: 'EmergencyAlert',
        entityId: alert.id,
        details: {
          tipo,
          prioridad,
          descripcion: descripcion || null,
          createdBy: session.name,
        },
      }, request)
    } catch (auditError) {
      console.error('[ERC Alerts] Audit log failed (non-blocking):', auditError)
    }

    return NextResponse.json({ alert }, { status: 201 })
  } catch (error: unknown) {
    console.error('[ERC Alerts] Error creating emergency alert:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/erc/alerts - List emergency alerts for the user's company
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || undefined
    const prioridad = searchParams.get('prioridad') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const where: Record<string, unknown> = {
      companyId: session.companyId,
    }

    if (estado) where.estado = estado
    if (prioridad) where.prioridad = prioridad

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

    return NextResponse.json({ alerts })
  } catch (error: unknown) {
    console.error('[ERC Alerts] Error listing emergency alerts:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
