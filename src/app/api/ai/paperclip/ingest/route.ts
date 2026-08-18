import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'

// ── Runtime config: use Node.js runtime for longer timeout ──
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max for large documents

// ── Lazy imports — prevents serverless crash if packages aren't installed ──
let _getEmbeddings: typeof import('@/lib/ai').getEmbeddings | null = null

async function getEmbeddingsFn() {
  if (!_getEmbeddings) {
    try {
      const mod = await import('@/lib/ai')
      _getEmbeddings = mod.getEmbeddings
    } catch (err) {
      console.error('[Paperclip Ingest] Failed to import @/lib/ai:', err)
      return null
    }
  }
  return _getEmbeddings
}

// ── Chunking utility ──

function splitIntoChunks(text: string, chunkSize = 1000, overlap = 100): string[] {
  if (!text || text.trim().length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    if (end < text.length) {
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

    start = end - overlap
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
        { error: `El documento es demasiado largo (${Math.round(content.length / 1000)}K caracteres). Maximo permitido: 500,000 caracteres. Dividelo en partes mas pequenas.` },
        { status: 400 }
      )
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontro la empresa del usuario' }, { status: 400 })
    }

    // ── Get Supabase client (async dynamic import) ──
    let supabase: Awaited<ReturnType<typeof import('@/lib/supabase').getSupabaseClient>> | null = null
    try {
      const { getSupabaseClient } = await import('@/lib/supabase')
      supabase = await getSupabaseClient()
    } catch (err) {
      console.error('[Paperclip Ingest] Error loading Supabase module:', err)
    }

    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase no esta configurado. Debes configurar las siguientes variables de entorno en Vercel:',
          required: [
            'NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...',
            'OPENAI_API_KEY=sk-...',
          ],
          also: 'Ejecuta la migracion SQL en Supabase SQL Editor (archivo: supabase/migrations/paperclip.sql)',
        },
        { status: 503 }
      )
    }

    // ── Step 1: Split content into chunks ──
    // Use larger chunk size (1000 chars) to reduce API calls and processing time
    const chunks = splitIntoChunks(content, 1000, 100)
    console.log(`[Paperclip Ingest] Document "${title}": ${content.length} chars → ${chunks.length} chunks (1000 chars each)`)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No se pudieron crear fragmentos del documento' }, { status: 400 })
    }

    // Warn if too many chunks (may timeout)
    if (chunks.length > 500) {
      return NextResponse.json(
        {
          error: `El documento es muy grande para procesar en una sola solicitud (${chunks.length} fragmentos). Reducelo a menos de 100,000 caracteres o divide en partes mas pequenas.`,
          chunks: chunks.length,
          suggestedMax: 100000,
        },
        { status: 400 }
      )
    }

    // ── Step 2: Verify OpenAI is available before processing all chunks ──
    let getEmbeddings: Awaited<ReturnType<typeof getEmbeddingsFn>> | null = null
    try {
      getEmbeddings = await getEmbeddingsFn()
    } catch (err) {
      console.error('[Paperclip Ingest] Error loading AI module:', err)
    }

    if (!getEmbeddings) {
      return NextResponse.json(
        {
          error: 'No se pudo cargar el modulo de IA. Verifica que las dependencias esten instaladas correctamente.',
        },
        { status: 503 }
      )
    }

    const testEmbedding = await getEmbeddings('test')
    if (!testEmbedding) {
      return NextResponse.json(
        {
          error: 'No se pudo conectar con OpenAI para generar embeddings.',
          checks: [
            'Verifica que OPENAI_API_KEY este configurada en Vercel.',
            'Verifica que la API key sea valida y tenga credito.',
            'Nota: Vercel Hobby bloquea solicitudes salientes. Necesitas plan Pro o superior.',
          ],
        },
        { status: 503 }
      )
    }

    // ── Step 3: Process chunks in small batches ──
    // Instead of loading all embeddings into memory at once,
    // process in batches of BATCH_SIZE, free memory between batches
    const BATCH_SIZE = 10
    let processedCount = 0
    const errors: string[] = []
    const startTime = Date.now()

    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length)

      for (let i = batchStart; i < batchEnd; i++) {
        try {
          const chunk = chunks[i]
          let embedding: number[] | null = null

          try {
            embedding = await getEmbeddings(chunk)
          } catch {
            console.error(`[Paperclip Ingest] Embedding call threw for chunk ${i + 1}`)
          }

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

      // Log progress per batch
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`[Paperclip Ingest] Progress: ${processedCount}/${chunks.length} chunks (${elapsed}s)`)

      // ── Memory cleanup between batches ──
      // Null out processed chunks to allow garbage collection
      for (let i = batchStart; i < batchEnd; i++) {
        chunks[i] = '' // Release string memory
      }

      // Hint to GC — only available with --expose-gc flag
      if (global.gc) {
        global.gc()
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Paperclip Ingest] Completed: ${processedCount}/${chunks.length} chunks in ${elapsed}s for "${title}"`)

    if (processedCount === 0) {
      return NextResponse.json(
        {
          error: 'No se pudo procesar ningun fragmento.',
          details: errors,
          checks: [
            'OpenAI API key configurada y valida?',
            'Supabase pgvector habilitado?',
            'Tabla document_chunks creada?',
            'Funcion match_documents creada?',
          ],
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      chunksProcessed: processedCount,
      totalChunks: chunks.length,
      documentTitle: title.trim(),
      documentType: docType,
      processingTimeSeconds: elapsed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Paperclip Ingest UNHANDLED ERROR]', error)

    // Return JSON error instead of letting Next.js render HTML 500
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      {
        error: 'Error interno del servidor al procesar el documento.',
        details: message,
        hint: 'Si el error persiste, intenta con un documento mas pequeno o contacta al soporte.',
      },
      { status: 500 }
    )
  }
}
