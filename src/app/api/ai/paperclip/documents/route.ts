import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // ── Auth check ──
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontro la empresa del usuario' }, { status: 400 })
    }

    // ── Get Supabase client ──
    const supabase = getSupabaseClient()
    if (!supabase) {
      console.warn('[Paperclip Documents] Supabase not configured — returning empty document list')
      return NextResponse.json({ documents: [], supabaseNotConfigured: true })
    }

    // ── Query: use RPC for document stats ──
    const { data, error } = await supabase.rpc('get_document_stats', {
      company_id: companyId,
    })

    if (error) {
      console.error('[Paperclip Documents] RPC get_document_stats error:', error.message)
      // Fallback: query directly if RPC doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('document_chunks')
        .select('document_title, document_type, created_at')
        .eq('company_id', companyId)

      if (fallbackError) {
        console.error('[Paperclip Documents] Fallback query error:', fallbackError.message)
        return NextResponse.json({ documents: [] })
      }

      // Aggregate manually
      const docMap = new Map<string, { title: string; type: string; chunksCount: number; createdAt: string }>()
      for (const row of fallbackData || []) {
        const key = row.document_title
        const existing = docMap.get(key)
        if (existing) {
          existing.chunksCount++
          if (row.created_at > existing.createdAt) {
            existing.createdAt = row.created_at
          }
        } else {
          docMap.set(key, {
            title: row.document_title,
            type: row.document_type || 'documento',
            chunksCount: 1,
            createdAt: row.created_at,
          })
        }
      }

      const documents = Array.from(docMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      return NextResponse.json({ documents })
    }

    const documents = Array.isArray(data)
      ? data.map((row: Record<string, any>) => ({
          title: String(row.document_title || ''),
          type: String(row.document_type || 'documento'),
          chunksCount: Number(row.chunks_count || 0),
          createdAt: String(row.created_at || ''),
        }))
      : []

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('[Paperclip Documents Error]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
