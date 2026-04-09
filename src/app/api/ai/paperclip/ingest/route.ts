import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getEmbeddings } from '@/lib/ai'
import { getSupabaseClient } from '@/lib/supabase'

// ── Chunking utility ──

function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text || text.trim().length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    // Try to break at a sentence or word boundary within the chunk
    if (end < text.length) {
      // Look for a period, newline, or space near the end of the chunk
      const breakPoint = text.lastIndexOf('.', end)
      const breakLine = text.lastIndexOf('\n', end)
      const breakSpace = text.lastIndexOf(' ', end)

      let bestBreak = end
      if (breakPoint > start + chunkSize * 0.3) {
        bestBreak = breakPoint + 1
      } else if (breakLine > start + chunkSize * 0.3) {
        bestBreak = breakLine + 1
      } else if (breakSpace > start + chunkSize * 0.3) {
        bestBreak = breakSpace + 1
      }

      end = bestBreak
    }

    const chunk = text.substring(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Move forward by chunk size minus overlap
    start = end - overlap
    // Prevent infinite loop when chunk is too small
    if (start >= text.length || (chunks.length > 0 && start === end)) {
      break
    }
  }

  return chunks.length > 0 ? chunks : [text.trim()]
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Solo administradores y supervisores pueden indexar documentos' },
        { status: 403 }
      )
    }

    // ── Parse body ──
    const body = await req.json()
    const { title, content, documentType } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'El titulo del documento es obligatorio' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'El contenido del documento es obligatorio' }, { status: 400 })
    }

    const docType = typeof documentType === 'string' && documentType.trim()
      ? documentType.trim()
      : 'documento'

    if (content.length > 500000) {
      return NextResponse.json(
        { error: `El documento es demasiado largo (${Math.round(content.length / 1000)}K caracteres). Maximo permitido: 500,000 caracteres (${Math.round(500000 / 1000)}K). Dividelo en partes mas pequenas.` },
        { status: 400 }
      )
    }

    // ── Get Supabase client ──
    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase no esta configurado. Debes configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno de Vercel, y ejecutar la migracion SQL en Supabase.' },
        { status: 503 }
      )
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontro la empresa del usuario' }, { status: 400 })
    }

    // ── Step 1: Split content into chunks ──
    const chunks = splitIntoChunks(content)
    console.log(`[Paperclip Ingest] Document "${title}": ${content.length} chars, split into ${chunks.length} chunks`)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No se pudieron crear fragmentos del documento' }, { status: 400 })
    }

    // ── Step 2: Verify OpenAI is available before processing all chunks ──
    const testEmbedding = await getEmbeddings('test')
    if (!testEmbedding) {
      return NextResponse.json(
        { error: 'No se pudo conectar con OpenAI para generar embeddings. Verifica que OPENAI_API_KEY este configurada en Vercel.' },
        { status: 503 }
      )
    }

    // ── Step 3: Embed each chunk and insert into Supabase ──
    let processedCount = 0
    const errors: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i]
        const embedding = await getEmbeddings(chunk)

        if (!embedding) {
          errors.push(`Fragmento ${i + 1}: no se pudo generar el embedding`)
          continue
        }

        const { error: insertError } = await supabase.from('document_chunks').insert({
          company_id: companyId,
          document_title: title.trim(),
          document_type: docType,
          chunk_content: chunk,
          embedding,
          chunk_index: i,
          metadata: {
            chunkTotal: chunks.length,
            chunkChars: chunk.length,
          },
        })

        if (insertError) {
          console.error(`[Paperclip Ingest] Insert error for chunk ${i + 1}:`, insertError.message)
          errors.push(`Fragmento ${i + 1}: error al insertar en Supabase (${insertError.message})`)
          continue
        }

        processedCount++
      } catch (chunkError) {
        console.error(`[Paperclip Ingest] Error processing chunk ${i + 1}:`, chunkError)
        errors.push(`Fragmento ${i + 1}: error interno`)
      }
    }

    console.log(`[Paperclip Ingest] Completed: ${processedCount}/${chunks.length} chunks processed for "${title}"`)

    if (processedCount === 0) {
      return NextResponse.json(
        { error: 'No se pudo procesar ningun fragmento. Verifica que OpenAI API y Supabase esten configurados.', details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      chunksProcessed: processedCount,
      totalChunks: chunks.length,
      documentTitle: title.trim(),
      documentType: docType,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Paperclip Ingest Error]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
