import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ PATCH: Update HSE report status ============
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
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

    const body = await request.json()
    const { estado } = body

    const validEstados = ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'DESCARTADO']
    if (!estado || !validEstados.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validEstados.join(', ')}` },
        { status: 400 }
      )
    }

    // Check report exists and belongs to the same company
    const existingReport = await db.hSEReport.findUnique({
      where: { id },
    })

    if (!existingReport) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    if (existingReport.companyId !== session.companyId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Update the report
    const updatedReport = await db.hSEReport.update({
      where: { id },
      data: { estado },
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
      action: 'UPDATE_HSE_REPORT_STATUS',
      entityType: 'HSE_REPORT',
      entityId: id,
      details: {
        previousEstado: existingReport.estado,
        newEstado: estado,
        reportCategoria: existingReport.categoria,
      },
    }, request)

    return NextResponse.json(updatedReport)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('Update HSE report error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
