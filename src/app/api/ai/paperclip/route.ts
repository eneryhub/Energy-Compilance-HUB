import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { generateRagResponse } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER', 'GERENTE']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { question, history } = body

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'La pregunta es obligatoria' }, { status: 400 })
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontró la empresa del usuario' }, { status: 400 })
    }

    const chatHistory = Array.isArray(history)
      ? history.filter((msg: { role: string; content: string }) => msg.role && msg.content)
      : []

    const result = await generateRagResponse(question, companyId, chatHistory)

    const sources = (result.sources ?? []).map(
      (source: {
        id: string
        documentTitle: string
        documentType: string
        chunkContent: string
        similarity: number
      }) => ({
        id: source.id,
        documentTitle: source.documentTitle,
        documentType: source.documentType,
        chunkContent: source.chunkContent,
        similarity: source.similarity,
      })
    )

    return NextResponse.json({
      answer: result.answer,
      sources,
      aiSource: result.aiSource,
    })
  } catch (error) {
    console.error('[RAG Paperclip Error]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
