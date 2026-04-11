import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ PATCH: Update HSE report status ============
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  let reportId: string
  let estado: string
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

    const { id } = await params
    reportId = id

    const body = await request.json()
    estado = body.estado

    const validEstados = ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'DESCARTADO']
    if (!estado || !validEstados.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validEstados.join(', ')}` },
        { status: 400 }
      )
    }

    // ---- Step 1: Find the report using Prisma ORM ----
    let existingReport = await db.hSEReport.findUnique({
      where: { id: reportId },
    })

    // ---- Step 2: If Prisma fails, fallback to raw SQL ----
    if (!existingReport) {
      console.warn(`[ERC] Prisma findUnique returned null for report ${reportId}, trying raw SQL fallback`)

      try {
        const rows = await db.$queryRawUnsafe<Array<{
          id: string; companyId: string; estado: string; descripcion: string;
        }>>(`SELECT "id", "companyId", "estado", "descripcion" FROM "HSEReport" WHERE "id" = '${reportId}' LIMIT 1`)

        if (rows.length > 0) {
          const row = rows[0]
          existingReport = {
            id: row.id,
            companyId: row.companyId,
            estado: row.estado,
            descripcion: row.descripcion,
            // Fill remaining fields as defaults
            userId: '',
            fotoUrl: null,
            categoria: 'CONDICION_INSEGURA',
            prioridad: 'MEDIA',
            ubicacion: null,
            createdAt: new Date(),
            updatedAt: new Date(),
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

        // If it's a constraint error, give a clear message
        if (errMsg.includes('constraint') || errMsg.includes('CHECK') || rawMsg.includes('constraint')) {
          return NextResponse.json({
            error: `No se puede cambiar al estado "${estado}". Restriccion de base de datos.`,
            details: rawMsg || errMsg,
          }, { status: 422 })
        }

        // Otherwise return a generic 500 with the actual error message
        return NextResponse.json({
          error: 'Error al actualizar el reporte',
          details: rawMsg || errMsg,
        }, { status: 500 })
      }
    }

    // Audit log (non-blocking — don't fail the update if audit fails)
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

    const { id } = await params

    // Try Prisma first
    let report = await db.hSEReport.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
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
