import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ Helper: Extract ID from URL (reliable, params-independent) ============

function extractIdFromUrl(request: NextRequest): string | null {
  const pathname = request.nextUrl.pathname
  // pathname: /api/erc/reports/{id}
  const match = pathname.match(/\/api\/erc\/reports\/([^/]+)$/)
  return match?.[1] ?? null
}

async function resolveId(request: NextRequest, params: Promise<{ id: string }>): Promise<string> {
  // Method 1: Extract from URL (most reliable)
  const fromUrl = extractIdFromUrl(request)
  if (fromUrl && fromUrl !== 'undefined' && fromUrl !== 'null') {
    return fromUrl
  }

  // Method 2: Await params (Next.js standard)
  try {
    const resolved = await params
    if (resolved?.id && resolved.id !== 'undefined' && resolved.id !== 'null') {
      return resolved.id
    }
  } catch {
    // params resolution failed
  }

  return ''
}

// ============ PATCH: Update HSE report status ============

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  let reportId = ''
  let estado = ''
  let previousEstado: string | null = null

  try {
    session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, MANAGER can update report status
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para actualizar reportes' },
        { status: 403 }
      )
    }

    // ---- Resolve report ID from URL (reliable) or params (fallback) ----
    reportId = await resolveId(request, params)

    if (!reportId) {
      console.error('[ERC] PATCH report: ID could not be resolved from URL or params', {
        pathname: request.nextUrl.pathname,
      })
      return NextResponse.json({ error: 'ID de reporte no proporcionado' }, { status: 400 })
    }

    const body = await request.json()
    estado = body.estado

    const validEstados = ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'DESCARTADO']
    if (!estado || !validEstados.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validEstados.join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`[ERC] PATCH report ${reportId}: changing estado to ${estado}`)

    // ---- Step 1: Find the report using Prisma ORM ----
    let existingReport = await db.hSEReport.findUnique({
      where: { id: reportId },
    }).catch((err) => {
      console.error('[ERC] Prisma findUnique failed:', err instanceof Error ? err.message : err)
      return null
    })

    // ---- Step 2: If Prisma fails or returns null, fallback to raw SQL ----
    if (!existingReport) {
      console.warn(`[ERC] Prisma findUnique returned null for report ${reportId}, trying raw SQL fallback`)

      try {
        const rows = await db.$queryRawUnsafe<Array<{
          id: string; companyId: string; userId: string; estado: string; descripcion: string
          fotoUrl: string | null; categoria: string; prioridad: string; ubicacion: string | null
          createdAt: Date; updatedAt: Date
        }>>(`SELECT "id", "companyId", "userId", "estado", "descripcion", "fotoUrl", "categoria", "prioridad", "ubicacion", "createdAt", "updatedAt" FROM "HSEReport" WHERE "id" = '${reportId}' LIMIT 1`)

        if (rows.length > 0) {
          const row = rows[0]
          existingReport = {
            id: row.id,
            companyId: row.companyId,
            userId: row.userId,
            estado: row.estado,
            descripcion: row.descripcion,
            fotoUrl: row.fotoUrl,
            categoria: row.categoria,
            prioridad: row.prioridad,
            ubicacion: row.ubicacion,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          } as Awaited<ReturnType<typeof db.hSEReport.findUnique>>

          console.log(`[ERC] Raw SQL found report ${reportId} (estado: ${row.estado})`)
        } else {
          console.warn(`[ERC] Report ${reportId} not found via raw SQL either`)
        }
      } catch (rawSqlErr) {
        console.error(`[ERC] Raw SQL fallback also failed:`, rawSqlErr)
      }
    }

    // ---- Step 3: If still not found, return 404 ----
    if (!existingReport) {
      return NextResponse.json({
        error: 'Reporte no encontrado',
        reportId,
      }, { status: 404 })
    }

    // Check company access
    if (existingReport.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    previousEstado = existingReport.estado

    // ---- Step 4: Try Prisma update ----
    let updatedReport
    try {
      updatedReport = await db.hSEReport.update({
        where: { id: reportId },
        data: { estado },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })
      console.log(`[ERC] Report ${reportId} updated: ${previousEstado} → ${estado} (Prisma)`)
    } catch (updateError) {
      const errMsg = updateError instanceof Error ? updateError.message : String(updateError)
      console.error(`[ERC] Prisma update failed for ${reportId}:`, errMsg)

      // ---- Step 5: Fallback to raw SQL update ----
      try {
        await db.$executeRawUnsafe(
          `UPDATE "HSEReport" SET "estado" = '${estado}', "updatedAt" = NOW() WHERE "id" = '${reportId}'`
        )
        console.log(`[ERC] Report ${reportId} updated via raw SQL: ${previousEstado} → ${estado}`)

        // Fetch the updated record
        const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT r.*, u."id" as "userId", u."name" as "userName", u."email" as "userEmail" FROM "HSEReport" r LEFT JOIN "User" u ON r."userId" = u."id" WHERE r."id" = '${reportId}' LIMIT 1`
        )

        updatedReport = rows[0] ? {
          id: rows[0].id,
          companyId: rows[0].companyId,
          userId: rows[0].userId,
          descripcion: rows[0].descripcion,
          fotoUrl: rows[0].fotoUrl,
          categoria: rows[0].categoria,
          prioridad: rows[0].prioridad,
          estado: rows[0].estado,
          ubicacion: rows[0].ubicacion,
          createdAt: rows[0].createdAt,
          updatedAt: rows[0].updatedAt,
          user: rows[0].userId ? {
            id: rows[0].userId,
            name: rows[0].userName,
            email: rows[0].userEmail,
          } : null,
        } : { id: reportId, estado }
      } catch (rawUpdateErr) {
        const rawMsg = rawUpdateErr instanceof Error ? rawUpdateErr.message : String(rawUpdateErr)
        console.error(`[ERC] Raw SQL update also failed for ${reportId}:`, rawMsg)

        if (errMsg.includes('constraint') || errMsg.includes('CHECK') || rawMsg.includes('constraint')) {
          return NextResponse.json({
            error: `No se puede cambiar al estado "${estado}". Restriccion de base de datos.`,
            details: rawMsg || errMsg,
          }, { status: 422 })
        }

        return NextResponse.json({
          error: 'Error al actualizar el reporte',
          details: rawMsg || errMsg,
        }, { status: 500 })
      }
    }

    // Audit log (non-blocking)
    try {
      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'UPDATE_HSE_REPORT_STATUS',
        entityType: 'HSE_REPORT',
        entityId: reportId,
        details: {
          previousEstado,
          newEstado: estado,
          reportCategoria: (existingReport as Record<string, unknown>).categoria || null,
        },
      }, request)
    } catch {
      // Audit log failure is non-critical
    }

    return NextResponse.json(updatedReport)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[ERC] Update HSE report error:', { reportId, estado, previousEstado, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============ GET: Fetch single HSE report by ID ============

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // ---- Resolve report ID from URL (reliable) or params (fallback) ----
    const id = await resolveId(request, params)

    if (!id) {
      console.error('[ERC] GET report: ID could not be resolved from URL or params', {
        pathname: request.nextUrl.pathname,
      })
      return NextResponse.json({ error: 'ID de reporte no proporcionado' }, { status: 400 })
    }

    // Try Prisma first
    let report = await db.hSEReport.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }).catch((err) => {
      console.error('[ERC] Prisma findUnique GET failed:', err instanceof Error ? err.message : err)
      return null
    })

    // Fallback to raw SQL if Prisma returns null (possible schema mismatch)
    if (!report) {
      try {
        const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT r.*, u."id" as "userId", u."name" as "userName", u."email" as "userEmail" FROM "HSEReport" r LEFT JOIN "User" u ON r."userId" = u."id" WHERE r."id" = '${id}' AND r."companyId" = '${session.companyId}' LIMIT 1`
        )
        if (rows.length > 0) {
          report = rows[0] as typeof report
        }
      } catch (rawErr) {
        console.error('[ERC] Raw SQL GET fallback failed:', rawErr)
      }
    }

    if (!report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    if ((report as Record<string, unknown>).companyId !== session.companyId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[ERC] Get HSE report error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
