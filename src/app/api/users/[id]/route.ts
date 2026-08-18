import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/users/[id] - Get single user details
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

    const user = await db.user.findFirst({
      where: { id, companyId: session.companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        avatarUrl: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            permitsCreated: true,
            permitsApproved: true,
            permitsRejected: true,
            documents: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden editar usuarios' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, email, role, phone, isActive, password } = body

    // Verify user belongs to this company
    const existingUser = await db.user.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Prevent self-demotion
    if (id === session.userId && role && role !== 'ADMIN') {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }

    // Prevent deactivating yourself
    if (id === session.userId && isActive === false) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'MANAGER', 'VIEWER']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const duplicate = await db.user.findFirst({
        where: { email: email.toLowerCase(), companyId: session.companyId, id: { not: id } },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe otro usuario con este email' }, { status: 409 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (email) updateData.email = email.toLowerCase().trim()
    if (role) updateData.role = role
    if (phone !== undefined) updateData.phone = phone || null
    if (isActive !== undefined) updateData.isActive = isActive

    // Hash new password if provided
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      updateData.passwordHash = await bcrypt.hash(password, 12)
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        avatarUrl: true,
        updatedAt: true,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: id,
      details: {
        changes: Object.keys(updateData),
        targetUser: existingUser.name,
        targetEmail: existingUser.email,
      },
    }, request)

    return NextResponse.json({ user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Deactivate user (admin only, soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar usuarios' }, { status: 403 })
    }

    const { id } = await params

    // Prevent deleting yourself
    if (id === session.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
    }

    // Verify user belongs to this company
    const existingUser = await db.user.findFirst({
      where: { id, companyId: session.companyId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Soft delete: deactivate instead of removing from DB
    await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'USER',
      entityId: id,
      details: { name: existingUser.name, email: existingUser.email, role: existingUser.role },
    }, request)

    return NextResponse.json({ success: true, message: 'Usuario desactivado correctamente' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
