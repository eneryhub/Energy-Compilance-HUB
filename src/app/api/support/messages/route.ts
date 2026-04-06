import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/support/messages — list company support messages
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const messages = await db.supportMessage.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        message: true,
        senderType: true,
        userName: true,
        isRead: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get support messages error:', error)
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 })
  }
}

// POST /api/support/messages — send a support message
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'El mensaje no puede exceder 2000 caracteres' }, { status: 400 })
    }

    // Create user message
    const userMessage = await db.supportMessage.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        userName: payload.name,
        message: message.trim(),
        senderType: 'USER',
      },
    })

    // Auto-reply from system (partial support — real integration pending)
    await db.supportMessage.create({
      data: {
        companyId: payload.companyId,
        message: 'Gracias por tu mensaje. Tu ticket ha sido registrado exitosamente. Nuestro equipo de soporte te responderá a la brevedad. Si tu consulta es urgente, también puedes escribir a soporte@energycompliance.com.',
        senderType: 'SYSTEM',
        isRead: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: userMessage,
    })
  } catch (error) {
    console.error('Post support message error:', error)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}
