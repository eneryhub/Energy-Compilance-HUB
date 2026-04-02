import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/documents/[id] - Get single document
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

    const document = await db.hseDocument.findFirst({
      where: {
        id,
        companyId: session.companyId
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
        alertConfigs: { where: { isActive: true } }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const result = {
      ...document,
      aiExtractedData: document.aiExtractedData ? JSON.parse(document.aiExtractedData) : null,
      tags: document.tags ? JSON.parse(document.tags) : null
    }

    return NextResponse.json({ document: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/documents/[id] - Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Solo administradores y supervisores pueden editar documentos' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Check document exists and belongs to company
    const existing = await db.hseDocument.findFirst({
      where: { id, companyId: session.companyId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'documentType', 'category', 'criticality', 'status',
      'expiryDate', 'issueDate', 'holderName', 'description',
      'fileUrl', 'fileName', 'fileSize', 'mimeType', 'tags',
      'reviewedById', 'reviewedAt', 'userId'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'expiryDate' || field === 'issueDate' || field === 'reviewedAt') {
          updateData[field] = body[field] ? new Date(body[field]) : null
        } else if (field === 'tags') {
          updateData[field] = body[field] ? JSON.stringify(body[field]) : null
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // If userId is being set, verify it belongs to the same company
    if (updateData.userId) {
      const targetUser = await db.user.findFirst({
        where: { id: updateData.userId as string, companyId: session.companyId }
      })
      if (!targetUser) {
        return NextResponse.json({ error: 'Usuario asignado no encontrado' }, { status: 404 })
      }
    }

    const document = await db.hseDocument.update({
      where: { id },
      data: updateData,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } }
      }
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'DOCUMENT',
      entityId: document.id,
      details: { updatedFields: Object.keys(updateData) }
    }, request)

    const result = {
      ...document,
      aiExtractedData: document.aiExtractedData ? JSON.parse(document.aiExtractedData) : null,
      tags: document.tags ? JSON.parse(document.tags) : null
    }

    return NextResponse.json({ document: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Delete document
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
      return NextResponse.json({ error: 'Solo administradores pueden eliminar documentos' }, { status: 403 })
    }

    const { id } = await params

    // Check document exists and belongs to company
    const existing = await db.hseDocument.findFirst({
      where: { id, companyId: session.companyId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    await db.hseDocument.delete({ where: { id } })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'DELETE',
      entityType: 'DOCUMENT',
      entityId: id,
      details: { title: existing.title, documentType: existing.documentType }
    }, request)

    return NextResponse.json({ message: 'Documento eliminado correctamente' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
