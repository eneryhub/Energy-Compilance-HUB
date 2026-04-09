import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'

// ── Runtime config: use Node.js runtime for longer timeout ──
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max for large documents

// ── Configuration ──
const MAX_CONTENT_LENGTH = 200_000 // 200K chars max (reduced from 500K to prevent OOM)
const MAX_CHUNKS = 80 // Max chunks per request (prevents memory exhaustion on Vercel)
const CHUNK_SIZE = 1500 // Larger chunks = fewer API calls = less memory
const CHUNK_OVERLAP = 150
const FETCH_TIMEOUT_MS = 15_000 // 15 second timeout per API call
const PREFLIGHT_TIMEOUT_MS = 10_000 // 10 second timeout for connectivity check

// ── Lazy singleton: OpenAI config ──
interface OpenAIConfig {
  apiKey: string
  baseUrl: string
}

let _openaiConfig: OpenAIConfig | null = null
let _openaiChecked = false

function getOpenAIConfig(): OpenAIConfig | null {
  if (_openaiChecked) return _openaiConfig
  _openaiChecked = true

  const apiKey = (process.env.ZAI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  const baseUrl = (process.env.ZAI_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')

  if (!apiKey) {
    console.warn('[Paperclip Ingest] OPENAI_API_KEY not configured')
    return null
  }

  _openaiConfig = { apiKey, baseUrl }
  return _openaiConfig
}

// ── Fetch with timeout helper ──
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Generate a single embedding with timeout ──
async function generateEmbedding(text: string, config: OpenAIConfig): Promise<number[] | null> {
  try {
    const body = JSON.stringify({
      model: 'text-embedding-3-small',
      input: String(text).substring(0, 8000),
    })

    const response = await fetchWithTimeout(
      `${config.baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        body,
      },
      FETCH_TIMEOUT_MS
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      console.error(`[Paperclip Ingest] Embedding API error ${response.status}: ${errText.substring(0, 200)}`)
      return null
    }

    const data = await response.json()
    const embedding: number[] | undefined = data.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.error('[Paperclip Ingest] No embedding in API response')
      return null
    }

    return embedding
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('[Paperclip Ingest] Embedding API call timed out')
    } else {
      console.error('[Paperclip Ingest] Embedding API call failed:', err instanceof Error ? err.message : err)
    }
    return null
  }
}

// ── Pre-flight connectivity check ──
// Tests if outbound requests are allowed (Vercel Hobby blocks them)
async function checkOutboundConnectivity(config: OpenAIConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${config.baseUrl}/models`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      },
      PREFLIGHT_TIMEOUT_MS
    )

    if (!response.ok) {
      return { ok: false, error: `OpenAI API respondió con status ${response.status}` }
    }

    return { ok: true }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: 'La solicitud a OpenAI excedió el tiempo de espera. Esto puede indicar que tu plan de Vercel bloquea solicitudes salientes.',
      }
    }
    return {
      ok: false,
      error: `No se pudo conectar con OpenAI: ${err instanceof Error ? err.message : 'Error desconocido'}. Vercel Hobby bloquea solicitudes salientes — necesitas plan Pro o superior.`,
    }
  }
}

// ── Chunking utility ──
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.trim().length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    if (end < text.length) {
      // Try to break at sentence/paragraph boundaries
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

// ── Supabase lazy loader ──
async function getSupabase() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase')
    return await getSupabaseClient()
  } catch (err) {
    console.error('[Paperclip Ingest] Error loading Supabase:', err instanceof Error ? err.message : err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/paperclip/ingest
// Ingests a document into the RAG knowledge base
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    // ── Step 0: Auth check ──
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

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontro la empresa del usuario' }, { status: 400 })
    }

    // ── Step 1: Parse body (with size protection) ──
    let body: { title?: string; content?: string; documentType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no es JSON valido' }, { status: 400 })
    }

    const { title, content, documentType } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'El titulo del documento es obligatorio' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'El contenido del documento es obligatorio' }, { status: 400 })
    }

    // ── Step 2: Size limits (pre-OOM protection) ──
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `El documento es demasiado grande: ${Math.round(content.length / 1000)}K caracteres.`,
          limit: `${Math.round(MAX_CONTENT_LENGTH / 1000)}K caracteres.`,
          suggestion: 'Divide el documento en partes mas pequenas (menos de 200K caracteres cada una).',
        },
        { status: 400 }
      )
    }

    // ── Step 3: Chunk the document ──
    const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No se pudieron crear fragmentos del documento' }, { status: 400 })
    }

    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        {
          error: `El documento generaria ${chunks.length} fragmentos, excediendo el maximo de ${MAX_CHUNKS}.`,
          suggestion: `Reduce el documento a menos de ${Math.round(MAX_CHUNKS * CHUNK_SIZE / 1000)}K caracteres.`,
          chunksGenerated: chunks.length,
          maxChunks: MAX_CHUNKS,
        },
        { status: 400 }
      )
    }

    console.log(`[Paperclip Ingest] "${title}": ${content.length} chars → ${chunks.length} chunks (${CHUNK_SIZE} chars each)`)

    // ── Step 4: Check OpenAI configuration ──
    const openaiConfig = getOpenAIConfig()
    if (!openaiConfig) {
      return NextResponse.json(
        {
          error: 'OpenAI no esta configurado.',
          required: ['OPENAI_API_KEY=sk-... en las variables de entorno de Vercel'],
        },
        { status: 503 }
      )
    }

    // ── Step 5: Pre-flight connectivity check (detects Vercel Hobby blocking) ──
    console.log('[Paperclip Ingest] Running pre-flight connectivity check...')
    const connectivity = await checkOutboundConnectivity(openaiConfig)

    if (!connectivity.ok) {
      return NextResponse.json(
        {
          error: 'No se puede conectar con OpenAI desde este servidor.',
          reason: connectivity.error,
          vercelHobbyBlock: connectivity.error?.includes('bloquea') || connectivity.error?.includes('Vercel'),
          checks: [
            'Si usas Vercel Hobby, las solicitudes salientes estan BLOQUEADAS. Necesitas plan Pro o superior.',
            'Verifica que OPENAI_API_KEY sea valida.',
            'Alternativa: usa un servicio externo para la ingesta de documentos.',
          ],
        },
        { status: 503 }
      )
    }

    // ── Step 6: Quick embedding test ──
    console.log('[Paperclip Ingest] Testing embedding generation...')
    const testEmbedding = await generateEmbedding('test connectivity', openaiConfig)
    if (!testEmbedding) {
      return NextResponse.json(
        {
          error: 'La prueba de embedding fallo. OpenAI no pudo generar un vector de prueba.',
          checks: [
            'Verifica que OPENAI_API_KEY tenga credito activo.',
            'Verifica que el modelo text-embedding-3-small este disponible en tu cuenta.',
          ],
        },
        { status: 503 }
      )
    }

    // ── Step 7: Get Supabase client ──
    console.log('[Paperclip Ingest] Loading Supabase client...')
    const supabase = await getSupabase()

    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase no esta configurado.',
          required: [
            'NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...',
          ],
          also: 'Ejecuta la migracion SQL en Supabase SQL Editor (archivo: supabase/migrations/paperclip.sql)',
        },
        { status: 503 }
      )
    }

    // ── Step 8: Process chunks sequentially (memory-efficient) ──
    const docType = typeof documentType === 'string' && documentType.trim()
      ? documentType.trim()
      : 'documento'

    let processedCount = 0
    const errors: string[] = []
    const startTime = Date.now()

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i]

        // Generate embedding (with timeout)
        const embedding = await generateEmbedding(chunk, openaiConfig)
        if (!embedding) {
          errors.push(`Fragmento ${i + 1}: fallo al generar embedding`)
          continue
        }

        // Store in Supabase (with timeout)
        let insertError: any = null
        try {
          const result = await Promise.race([
            supabase.from('document_chunks').insert({
              company_id: companyId,
              document_title: title.trim(),
              document_type: docType,
              chunk_content: chunk,
              embedding,
              chunk_index: i,
              metadata: { chunkTotal: chunks.length, chunkChars: chunk.length },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase insert timeout')), FETCH_TIMEOUT_MS)),
          ])
          // @ts-expect-error - race result type
          if (result.error) insertError = result.error
        } catch (err) {
          insertError = err instanceof Error ? err : new Error(String(err))
        }

        if (insertError) {
          console.error(`[Paperclip Ingest] Insert error chunk ${i + 1}:`, insertError.message)
          errors.push(`Fragmento ${i + 1}: ${insertError.message}`)
          continue
        }

        processedCount++

        // Log progress
        if (processedCount % 20 === 0 || processedCount === chunks.length) {
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          console.log(`[Paperclip Ingest] Progress: ${processedCount}/${chunks.length} chunks (${elapsed}s)`)
        }

        // Force garbage collection hint for large batches
        if (i % 10 === 0 && global.gc) {
          global.gc()
        }
      } catch (chunkError) {
        console.error(`[Paperclip Ingest] Error processing chunk ${i + 1}:`, chunkError)
        errors.push(`Fragmento ${i + 1}: error interno`)
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Paperclip Ingest] Completed: ${processedCount}/${chunks.length} chunks in ${elapsed}s for "${title}"`)

    // ── Step 9: Return result ──
    if (processedCount === 0) {
      return NextResponse.json(
        {
          error: 'No se pudo procesar ningun fragmento.',
          details: errors.length > 0 ? errors.slice(0, 10) : undefined,
          checks: [
            'OpenAI API key valida y con credito?',
            'Supabase con extension pgvector habilitada?',
            'Tabla document_chunks creada (ejecuta paperclip.sql)?',
            'Vercel permite solicitudes salientes (plan Pro+)?',
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

    // Always return JSON — never let Vercel render HTML 500
    const message = error instanceof Error ? error.message : 'Error desconocido'

    return NextResponse.json(
      {
        error: 'Error interno del servidor al procesar el documento.',
        details: message,
        hint: 'Si el error persiste, intenta con un documento mas pequeno (menos de 100K caracteres) o contacta soporte.',
        troubleshooting: [
          'Reduce el tamano del documento',
          'Verifica que las variables de entorno esten configuradas en Vercel',
          'Si usas Vercel Hobby, actualiza a Pro para permitir solicitudes salientes',
        ],
      },
      { status: 500 }
    )
  }
}
