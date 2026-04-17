import { NextRequest, NextResponse } from 'next/server'
import { db, isPostgreSQL } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/erc/reports - Create a new HSE field report
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      descripcion,
      fotoUrl,
      categoria = 'CONDICION_INSEGURA',
      prioridad = 'MEDIA',
      ubicacion,
    } = body

    if (!descripcion || !descripcion.trim()) {
      return NextResponse.json(
        { error: 'La descripción es requerida' },
        { status: 400 }
      )
    }

    const validCategorias = ['CONDICION_INSEGURA', 'ACTO_INSEGURO', 'NEAR_MISS', 'MEJORA']
    if (!validCategorias.includes(categoria)) {
      return NextResponse.json(
        { error: `Categoría inválida. Valores permitidos: ${validCategorias.join(', ')}` },
        { status: 400 }
      )
    }

    const validPrioridades = ['BAJA', 'MEDIA', 'ALTA']
    if (!validPrioridades.includes(prioridad)) {
      return NextResponse.json(
        { error: `Prioridad inválida. Valores permitidos: ${validPrioridades.join(', ')}` },
        { status: 400 }
      )
    }

    const pg = isPostgreSQL()
    const ubicacionStr = ubicacion
      ? (typeof ubicacion === 'string' ? ubicacion : JSON.stringify(ubicacion))
      : null

    if (pg) {
      await db.$executeRawUnsafe(
        `INSERT INTO "HseReport" (
          "companyId", "userId", "descripcion", "fotoUrl", "categoria", "prioridad", "estado", "ubicacion", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ABIERTO', $7, NOW(), NOW())`,
        session.companyId,
        session.userId,
        descripcion.trim(),
        fotoUrl || null,
        categoria,
        prioridad,
        ubicacionStr
      )
    } else {
      await db.$executeRawUnsafe(
        `INSERT INTO "HseReport" (
          "companyId", "userId", "descripcion", "fotoUrl", "categoria", "prioridad", "estado", "ubicacion", "createdAt", "updatedAt"
        ) VALUES (
          '${session.companyId}', '${session.userId}', '${descripcion.trim().replace(/'/g, "''")}',
          ${fotoUrl ? `'${fotoUrl.replace(/'/g, "''")}'` : 'NULL'},
          '${categoria}', '${prioridad}', 'ABIERTO',
          ${ubicacionStr ? `'${ubicacionStr.replace(/'/g, "''")}'` : 'NULL'},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      )
    }

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'HSE_REPORT_CREATED',
      entityType: 'HseReport',
      details: { categoria, prioridad },
    }, request)

    return NextResponse.json(
      { success: true, message: 'Reporte HSE creado exitosamente' },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('[ERC Reports] Error creating HSE report:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/erc/reports - List HSE reports for the user's company
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || undefined
    const categoria = searchParams.get('categoria') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const pg = isPostgreSQL()

    // Build WHERE clause
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (pg) {
      conditions.push(`"companyId" = $${paramIndex++}`)
      params.push(session.companyId)
      if (estado) { conditions.push(`"estado" = $${paramIndex++}`); params.push(estado) }
      if (categoria) { conditions.push(`"categoria" = $${paramIndex++}`); params.push(categoria) }
    } else {
      conditions.push(`"companyId" = '${session.companyId}'`)
      if (estado) conditions.push(`"estado" = '${estado}'`)
      if (categoria) conditions.push(`"categoria" = '${categoria}'`)
    }

    const whereClause = conditions.join(' AND ')

    const query = `
      SELECT
        r.*,
        u."name" as "userName",
        u."email" as "userEmail"
      FROM "HseReport" r
      LEFT JOIN "User" u ON r."userId" = u."id"
      WHERE ${whereClause}
      ORDER BY r."createdAt" DESC
      LIMIT ${pg ? `$${paramIndex++}` : limit}
      ${pg ? `OFFSET $${paramIndex++}` : `OFFSET ${offset}`}
    `

    if (pg) {
      params.push(limit)
      params.push(offset)
    }

    const countQuery = `SELECT COUNT(*) as count FROM "HseReport" r WHERE ${whereClause}`

    const [reports, countResult] = await Promise.all([
      pg
        ? db.$queryRawUnsafe<Array<Record<string, unknown>>>(query, ...params)
        : db.$queryRawUnsafe<Array<Record<string, unknown>>>(query),
      pg
        ? db.$queryRawUnsafe<Array<{ count: bigint | number }>>(countQuery, ...params.slice(0, estado && categoria ? 3 : estado || categoria ? 2 : 1))
        : db.$queryRawUnsafe<Array<{ count: bigint | number }>>(countQuery),
    ])

    const total = Number(countResult[0]?.count ?? 0)

    return NextResponse.json({ reports, total })
  } catch (error: unknown) {
    console.error('[ERC Reports] Error listing HSE reports:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
