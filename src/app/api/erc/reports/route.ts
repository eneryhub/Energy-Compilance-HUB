import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ POST: Create HSE report ============
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { descripcion, fotoUrl, categoria, prioridad, ubicacion } = body

    if (!descripcion) {
      return NextResponse.json(
        { error: 'descripcion es requerida' },
        { status: 400 }
      )
    }

    // Validate ubicacion is a valid JSON string if provided
    let parsedUbicacion: unknown
    if (ubicacion) {
      try {
        parsedUbicacion = typeof ubicacion === 'string' ? JSON.parse(ubicacion) : ubicacion
      } catch {
        return NextResponse.json(
          { error: 'ubicacion debe ser un JSON válido' },
          { status: 400 }
        )
      }
    }

    const report = await db.hSEReport.create({
      data: {
        companyId: session.companyId,
        userId: session.userId,
        descripcion,
        fotoUrl: fotoUrl || null,
        categoria: categoria || 'CONDICION_INSEGURA',
        prioridad: prioridad || 'MEDIA',
        ubicacion: ubicacion
          ? JSON.stringify(parsedUbicacion)
          : null,
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
      action: 'CREATE_HSE_REPORT',
      entityType: 'HSE_REPORT',
      entityId: report.id,
      details: {
        categoria: categoria || 'CONDICION_INSEGURA',
        prioridad: prioridad || 'MEDIA',
      },
    }, request)

    return NextResponse.json(report, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Create HSE report error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============ GET: List HSE reports ============
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || undefined
    const categoria = searchParams.get('categoria') || undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

    const where: Record<string, unknown> = {
      companyId: session.companyId,
    }

    if (estado) {
      where.estado = estado
    }
    if (categoria) {
      where.categoria = categoria
    }

    const reports = await db.hSEReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(reports)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Get HSE reports error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
