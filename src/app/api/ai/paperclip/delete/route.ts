import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  try {
    // ── Auth check ──
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only ADMIN can delete documents
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo los administradores pueden eliminar documentos' },
        { status: 403 }
      )
    }

    // ── Parse body ──
    const body = await req.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'El titulo del documento es obligatorio' }, { status: 400 })
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontro la empresa del usuario' }, { status: 400 })
    }

    // ── Get Supabase client ──
    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase no esta configurado' },
        { status: 500 }
      )
    }

    // ── Delete all chunks for this document within the company ──
    const { error: deleteError, count } = await supabase
      .from('document_chunks')
      .delete({ count: 'exact' })
      .eq('company_id', companyId)
      .eq('document_title', title.trim())

    if (deleteError) {
      console.error('[Paperclip Delete] Error:', deleteError.message)
      return NextResponse.json(
        { error: 'Error al eliminar el documento de la base de datos' },
        { status: 500 }
      )
    }

    const deletedChunks = count ?? 0

    console.log(`[Paperclip Delete] Deleted ${deletedChunks} chunks for "${title}" in company ${companyId}`)

    return NextResponse.json({
      success: true,
      deletedChunks,
      documentTitle: title.trim(),
    })
  } catch (error) {
    console.error('[Paperclip Delete Error]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
