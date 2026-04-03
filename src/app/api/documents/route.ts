import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const documents = await db.hseDocument.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      documentType,
      category,
      criticality,
      issueDate,
      expiryDate,
      holderName,
      description,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
    } = body

    if (!title || !documentType || !category) {
      return NextResponse.json({ error: 'Título, tipo y categoría son requeridos' }, { status: 400 })
    }

    // Determine status based on expiry date
    let status = 'ACTIVE'
    if (expiryDate) {
      const expDate = new Date(expiryDate)
      if (expDate < new Date()) {
        status = 'EXPIRED'
      }
    }

    // Find user by holder name if provided
    let userId = null
    if (holderName) {
      const holder = await db.user.findFirst({
        where: {
          companyId: session.companyId,
          name: { contains: holderName },
        },
      })
      if (holder) userId = holder.id
    }

    const document = await db.hseDocument.create({
      data: {
        companyId: session.companyId,
        userId,
        title,
        documentType,
        category,
        criticality: criticality || 'NORMAL',
        status,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        holderName: holderName || null,
        description: description || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
      },
    })

    // Audit log
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'DOCUMENT',
      entityId: document.id,
      details: { title, documentType, category, criticality: criticality || 'NORMAL', holderName },
    }, request)

    return NextResponse.json({ message: 'Documento creado exitosamente', document })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
