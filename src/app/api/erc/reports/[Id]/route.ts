import { NextRequest, NextResponse } from 'next/server'
import { db, isPostgreSQL } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/erc/reports/[Id] - Fetch report by ID (company-scoped)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ Id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { Id } = await params
    const pg = isPostgreSQL()

    let reports: Array<Record<string, unknown>>

    if (pg) {
      reports = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT r.*, u."name" as "userName", u."email" as "userEmail"
         FROM "HseReport" r
         LEFT JOIN "User" u ON r."userId" = u."id"
         WHERE r."id" = $1 AND r."companyId" = $2`,
        Id,
        session.companyId
      )
    } else {
      reports = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT r.*, u."name" as "userName", u."email" as "userEmail"
         FROM "HseReport" r
         LEFT JOIN "User" u ON r."userId" = u."id"
         WHERE r."id" = '${Id}' AND r."companyId" = '${session.companyId}'`
      )
    }

    if (reports.length === 0) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ report: reports[0] })
  } catch (error: unknown) {
    console.error('[ERC Reports] Error fetching report by ID:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/erc/reports/[Id] - Update report status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ Id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, MANAGER can update reports
    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Solo administradores, supervisores o gerentes pueden actualizar reportes' },
        { status: 403 }
      )
    }

    const { Id } = await params
    const body = await request.json()
    const { estado } = body

    const validEstados = ['ABIERTO', 'EN_PROGRESO', 'CERRADO']
    if (!estado || !validEstados.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validEstados.join(', ')}` },
        { status: 400 }
      )
    }

    const pg = isPostgreSQL()

    if (pg) {
      await db.$executeRawUnsafe(
        `UPDATE "HseReport"
         SET "estado" = $1, "updatedAt" = NOW()
         WHERE "id" = $2 AND "companyId" = $3`,
        estado,
        Id,
        session.companyId
      )
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "HseReport"
         SET "estado" = '${estado}', "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = '${Id}' AND "companyId" = '${session.companyId}'`
      )
    }

    // Fetch updated report
    const updatedReports = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "HseReport" WHERE "id" = '${Id}' AND "companyId" = '${session.companyId}'`
    )

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'HSE_REPORT_UPDATED',
      entityType: 'HseReport',
      entityId: Id,
      details: { estado, updatedBy: session.name },
    }, request)

    return NextResponse.json({ report: updatedReports[0] ?? null })
  } catch (error: unknown) {
    console.error('[ERC Reports] Error updating report:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
