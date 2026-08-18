import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ Helper: Extract ID from URL (reliable, params-independent) ============

function extractIdFromUrl(request: NextRequest): string | null {
  const pathname = request.nextUrl.pathname
  // pathname: /api/erc/alerts/{id}
  const match = pathname.match(/\/api\/erc\/alerts\/([^/]+)$/)
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

// ============ PATCH: Update alert status (attend / discard) ============

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only ADMIN, SUPERVISOR, or MANAGER can attend alerts
    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para atender alertas' },
        { status: 403 }
      )
    }

    // ---- Resolve alert ID from URL (reliable) or params (fallback) ----
    const id = await resolveId(request, params)

    if (!id) {
      console.error('[ERC] PATCH alert: ID could not be resolved from URL or params', {
        pathname: request.nextUrl.pathname,
      })
      return NextResponse.json({ error: 'ID de alerta no proporcionado' }, { status: 400 })
    }

    const body = await request.json()
    const { estado, attendedById, attendedByName } = body

    if (!estado || !['ATENDIDA', 'DESCARTADA'].includes(estado)) {
      return NextResponse.json(
        { error: 'estado debe ser ATENDIDA o DESCARTADA' },
        { status: 400 }
      )
    }

    console.log(`[ERC] PATCH alert ${id}: changing estado to ${estado}`)

    // Find the alert (with error tolerance)
    const alert = await db.emergencyAlert.findUnique({
      where: { id },
    }).catch(() => null)

    if (!alert) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      )
    }

    // Validate alert belongs to same company (multitenancy)
    if (alert.companyId !== session.companyId) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      )
    }

    // Update the alert
    const updatedAlert = await db.emergencyAlert.update({
      where: { id },
      data: {
        estado,
        attendedById: attendedById || session.userId,
        attendedByName: attendedByName || session.name,
        attendedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }).catch((err) => {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[ERC] Alert update failed:', errMsg)
      if (errMsg.includes('constraint') || errMsg.includes('CHECK') || errMsg.includes('column')) {
        return null
      }
      throw err
    })

    if (!updatedAlert) {
      return NextResponse.json({
        error: 'No se pudo actualizar la alerta. Restriccion de base de datos.',
      }, { status: 422 })
    }

    // Audit log (non-blocking)
    try {
      await createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'UPDATE_EMERGENCY_ALERT',
        entityType: 'EMERGENCY_ALERT',
        entityId: alert.id,
        details: {
          previousEstado: alert.estado,
          newEstado: estado,
          attendedByName: attendedByName || session.name,
        },
      }, request)
    } catch {
      // Audit log failure is non-critical
    }

    return NextResponse.json(updatedAlert)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[ERC] Update emergency alert error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
