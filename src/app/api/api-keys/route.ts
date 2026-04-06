import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createHash } from 'crypto'

// ============ Helpers ============

function generateApiKey(): { plain: string; hash: string; prefix: string } {
  const random = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${process.env.JWT_SECRET || 'default'}`)
    .digest('hex')
  const key = `ech_${random.slice(0, 32)}`
  return {
    plain: key,
    hash: createHash('sha256').update(key).digest('hex'),
    prefix: key.slice(0, 16),
  }
}

// ============ GET: List API Keys ============

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const keys = await db.apiKey.findMany({
      where: { companyId: session.companyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('API Keys GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ============ POST: Create API Key ============

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Solo administradores pueden crear API keys' }, { status: 403 })
    }

    const body = await request.json()
    const { name, permissions, expiresDays } = body || {}

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nombre requerido (min 2 caracteres)' }, { status: 400 })
    }

    const validPermissions = ['read', 'write', 'admin']
    const perm = validPermissions.includes(permissions) ? permissions : 'read'

    const { plain, hash, prefix } = generateApiKey()

    let expiresAt: Date | null = null
    if (expiresDays && typeof expiresDays === 'number' && expiresDays > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresDays)
    }

    const apiKey = await db.apiKey.create({
      data: {
        companyId: session.companyId,
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        permissions: perm,
        expiresAt,
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          companyId: session.companyId,
          userId: session.userId,
          action: 'CREATE',
          entityType: 'API_KEY',
          entityId: apiKey.id,
          details: JSON.stringify({ name: apiKey.name, permissions: perm, prefix }),
        },
      })
    } catch { /* non-critical */ }

    // Return the plain key ONLY on creation — never again
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      key: plain, // Show ONCE
      keyPrefix: prefix,
      permissions: perm,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error('API Keys POST error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ============ DELETE: Revoke API Key ============

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const key = await db.apiKey.findFirst({
      where: { id, companyId: session.companyId },
    })
    if (!key) {
      return NextResponse.json({ error: 'API Key no encontrada' }, { status: 404 })
    }

    await db.apiKey.delete({ where: { id } })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          companyId: session.companyId,
          userId: session.userId,
          action: 'DELETE',
          entityType: 'API_KEY',
          entityId: id,
          details: JSON.stringify({ name: key.name, prefix: key.keyPrefix }),
        },
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'API Key revocada' })
  } catch (error) {
    console.error('API Keys DELETE error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
