import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { revokeApiKey, deleteApiKey } from '@/lib/api-keys'
import { createAuditLog } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params

    // Check if revoke or permanent delete
    const url = new URL(request.url)
    const permanent = url.searchParams.get('permanent') === 'true'

    let success: boolean
    let action: string

    if (permanent) {
      success = await deleteApiKey(id, session.companyId)
      action = 'DELETE'
    } else {
      success = await revokeApiKey(id, session.companyId)
      action = 'REVOKE'
    }

    if (!success) {
      return NextResponse.json({ error: 'Clave no encontrada' }, { status: 404 })
    }

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action,
      entityType: 'API_KEY',
      entityId: id,
    }, request)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
