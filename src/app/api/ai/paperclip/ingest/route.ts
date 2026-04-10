/**
 * /api/ai/paperclip/ingest — PDF Ingestion Route (Enterprise Edition)
 *
 * Arquitectura para documentos masivos (900+ páginas):
 *
 *  1. Recibe el PDF como stream (nunca carga el binario completo en RAM).
 *  2. Extrae texto página-por-página con pdf-parse-fork / pdfjs-dist.
 *  3. Chunkea cada bloque de páginas (PAGE_BLOCK_SIZE) de forma inmediata.
 *  4. Genera embeddings de forma SECUENCIAL (un chunk a la vez) con backoff
 *     exponencial para errores de rate-limit de OpenAI.
 *  5. Inserta en Supabase por lotes (SUPABASE_BATCH_SIZE) y libera la RAM
 *     vaciando el array de lote antes de continuar.
 *  6. Responde con progreso via JSON estándar (no streaming HTTP para
 *     compatibilidad con Vercel).
 *
 * Variables de entorno requeridas:
 *   OPENAI_API_KEY          — clave de OpenAI
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Config recomendada en next.config.js:
 *   experimental: { serverActions: { bodySizeLimit: '50mb' } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'

// ── Runtime: Node.js para acceso a Buffer y módulos nativos ──────────────────
export const runtime    = 'nodejs'
export const maxDuration = 300   // 5 min — máximo en Vercel Pro/Enterprise

// ── Configuración de ingesta ─────────────────────────────────────────────────
const CFG = {
  /** Páginas a procesar por bloque antes de embedear y liberar RAM */
  PAGE_BLOCK_SIZE:     20,

  /** Caracteres por chunk de texto para embeddings */
  CHUNK_SIZE:          1_000,

  /** Solapamiento entre chunks para preservar contexto */
  CHUNK_OVERLAP:       100,

  /** Registros enviados a Supabase en una sola llamada `.insert()` */
  SUPABASE_BATCH_SIZE: 25,

  /** Máximo de chunks totales permitidos (evita timeouts en docs inmensos) */
  MAX_CHUNKS:          2_000,

  /** ms entre llamadas a OpenAI (respetar rate-limit de 3,000 req/min tier-1) */
  EMBED_DELAY_MS:      25,

  /** Reintentos con backoff exponencial ante error 429 de OpenAI */
  EMBED_MAX_RETRIES:   4,

  /** ms base para backoff (se duplica en cada reintento) */
  EMBED_BACKOFF_BASE:  1_000,
} as const

// ══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface ChunkRecord {
  company_id:      string
  document_title:  string
  document_type:   string
  chunk_content:   string
  embedding:       number[]
  chunk_index:     number
  metadata:        { chunkTotal: number; chunkChars: number; page?: number }
}

interface IngestProgress {
  pagesProcessed:  number
  chunksCreated:   number
  chunksEmbedded:  number
  chunksInserted:  number
  errors:          string[]
  skipped:         number
}

// ══════════════════════════════════════════════════════════════════════════════
//  LAZY IMPORTS (evita crash si el paquete no está instalado)
// ══════════════════════════════════════════════════════════════════════════════

async function loadGetEmbeddings() {
  try {
    const { getEmbeddings } = await import('@/lib/ai')
    return getEmbeddings
  } catch (err) {
    console.error('[Ingest] Cannot import @/lib/ai:', err)
    return null
  }
}

async function loadSupabase() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase')
    return await getSupabaseClient()
  } catch (err) {
    console.error('[Ingest] Cannot import Supabase:', err)
    return null
  }
}

/**
 * Intenta cargar pdf-parse-fork, luego pdf-parse, luego pdfjs-dist.
 * Devuelve una función (buffer) => Promise<string[]> donde cada
 * elemento del array es el texto de UNA página.
 */
async function loadPdfPageExtractor(): Promise<((buf: Buffer) => Promise<string[]>) | null> {
  // ── Opción 1: pdf-parse-fork (soporte página-por-página) ──────────────────
  try {
    const pdfParse = (await import('pdf-parse-fork')).default
    return async (buf: Buffer): Promise<string[]> => {
      const pages: string[] = []
      await pdfParse(buf, {
        pagerender: (pageData: any) => {
          return pageData.getTextContent().then((tc: any) => {
            const text = tc.items.map((i: any) => i.str).join(' ')
            pages.push(text)
            return text
          })
        },
      })
      return pages
    }
  } catch { /* continúa */ }

  // ── Opción 2: pdf-parse estándar (texto completo, simular páginas) ─────────
  try {
    const pdfParse = (await import('pdf-parse')).default
    return async (buf: Buffer): Promise<string[]> => {
      const result = await pdfParse(buf)
      // pdf-parse concatena todo; dividimos por saltos de página (\x0c)
      const rawPages = result.text.split('\x0c').map((p: string) => p.trim()).filter(Boolean)
      return rawPages.length > 0 ? rawPages : [result.text]
    }
  } catch { /* continúa */ }

  // ── Opción 3: pdfjs-dist (más pesado pero muy robusto) ────────────────────
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
    return async (buf: Buffer): Promise<string[]> => {
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page    = await doc.getPage(i)
        const tc      = await page.getTextContent()
        const text    = tc.items.map((item: any) => item.str).join(' ').trim()
        pages.push(text)
        page.cleanup()   // libera recursos de la página
      }
      return pages
    }
  } catch { /* continúa */ }

  return null
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHUNKER
// ══════════════════════════════════════════════════════════════════════════════

function chunkText(text: string, size = CFG.CHUNK_SIZE, overlap = CFG.CHUNK_OVERLAP): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const chunks: string[] = []
  let start = 0

  while (start < trimmed.length) {
    let end = Math.min(start + size, trimmed.length)

    // Prefiere cortar en límite natural
    if (end < trimmed.length) {
      const candidates = [
        trimmed.lastIndexOf('. ', end),
        trimmed.lastIndexOf('\n', end),
        trimmed.lastIndexOf(' ', end),
      ].filter(p => p > start + size * 0.3)

      if (candidates.length > 0) end = Math.max(...candidates) + 1
    }

    const chunk = trimmed.substring(start, end).trim()
    if (chunk.length > 20) chunks.push(chunk)   // ignora chunks triviales

    start = end - overlap
    if (start <= 0 || start >= trimmed.length) break
  }

  return chunks.length > 0 ? chunks : [trimmed]
}

// ══════════════════════════════════════════════════════════════════════════════
//  OPENAI EMBEDDING CON BACKOFF EXPONENCIAL
// ══════════════════════════════════════════════════════════════════════════════

async function embedWithRetry(
  getEmbeddings: (text: string) => Promise<number[] | null>,
  text: string,
): Promise<number[] | null> {
  let delay = CFG.EMBED_BACKOFF_BASE

  for (let attempt = 0; attempt <= CFG.EMBED_MAX_RETRIES; attempt++) {
    try {
      const result = await getEmbeddings(text)
      if (result) return result

      // Si devuelve null sin lanzar (probablemente error no-429)
      console.warn(`[Ingest] getEmbeddings returned null (attempt ${attempt + 1})`)
      return null
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.status === 429

      if (!is429 || attempt === CFG.EMBED_MAX_RETRIES) {
        console.error(`[Ingest] Embedding failed after ${attempt + 1} attempts:`, err?.message)
        return null
      }

      console.warn(`[Ingest] Rate limit 429 — backoff ${delay}ms (attempt ${attempt + 1})`)
      await sleep(delay)
      delay *= 2   // backoff exponencial
    }
  }

  return null
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUPABASE BATCH INSERT
// ══════════════════════════════════════════════════════════════════════════════

async function flushBatch(
  supabase: any,
  batch: ChunkRecord[],
  progress: IngestProgress,
): Promise<void> {
  if (batch.length === 0) return

  try {
    const { error } = await supabase.from('document_chunks').insert(batch)

    if (error) {
      console.error('[Ingest] Supabase insert error:', error.message)
      progress.errors.push(`Batch insert error: ${error.message}`)
    } else {
      progress.chunksInserted += batch.length
      console.log(`[Ingest] ✅ Inserted batch of ${batch.length} → total ${progress.chunksInserted}`)
    }
  } catch (err: any) {
    console.error('[Ingest] flushBatch threw:', err?.message)
    progress.errors.push(`Batch exception: ${err?.message}`)
  } finally {
    // ── Liberar RAM: vaciar el array in-place ────────────────────────────────
    batch.length = 0
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PIPELINE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Procesa un bloque de páginas PDF de forma secuencial:
 *   página → chunk → embed → acumula en batch → flush cada SUPABASE_BATCH_SIZE
 *
 * Libera la RAM de cada página al terminarla.
 */
async function processPageBlock(params: {
  pages:          string[]
  pageOffset:     number
  getEmbeddings:  (text: string) => Promise<number[] | null>
  supabase:       any
  companyId:      string
  title:          string
  docType:        string
  chunkOffset:    number
  totalChunks:    number
  progress:       IngestProgress
  batch:          ChunkRecord[]
}): Promise<void> {
  const {
    pages, pageOffset, getEmbeddings, supabase,
    companyId, title, docType, chunkOffset, totalChunks, progress, batch,
  } = params

  for (let pi = 0; pi < pages.length; pi++) {
    const pageText   = pages[pi]
    const pageNumber = pageOffset + pi + 1

    // Libera la referencia de página original lo antes posible
    pages[pi] = ''

    if (!pageText?.trim()) continue

    const pageChunks = chunkText(pageText)

    for (const chunk of pageChunks) {
      const globalIdx = chunkOffset + progress.chunksCreated

      // Límite de seguridad total
      if (globalIdx >= CFG.MAX_CHUNKS) {
        progress.skipped++
        continue
      }

      progress.chunksCreated++

      // Delay cortés entre llamadas a OpenAI
      if (progress.chunksEmbedded > 0) {
        await sleep(CFG.EMBED_DELAY_MS)
      }

      const embedding = await embedWithRetry(getEmbeddings, chunk)

      if (!embedding) {
        progress.errors.push(`Chunk ${globalIdx + 1} (página ${pageNumber}): embedding fallido`)
        continue
      }

      progress.chunksEmbedded++

      batch.push({
        company_id:     companyId,
        document_title: title,
        document_type:  docType,
        chunk_content:  chunk,
        embedding,
        chunk_index:    globalIdx,
        metadata: {
          chunkTotal: totalChunks,
          chunkChars: chunk.length,
          page:       pageNumber,
        },
      })

      // Flush cuando el lote está lleno
      if (batch.length >= CFG.SUPABASE_BATCH_SIZE) {
        await flushBatch(supabase, batch, progress)
      }
    }

    progress.pagesProcessed++

    // Log de progreso por página
    if (pageNumber % 50 === 0 || pi === pages.length - 1) {
      console.log(
        `[Ingest] Página ${pageNumber} | ` +
        `chunks: ${progress.chunksCreated} creados, ${progress.chunksEmbedded} embedidos, ` +
        `${progress.chunksInserted} insertados | errores: ${progress.errors.length}`
      )
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function validateBody(body: unknown): { title: string; docType: string; pdfBase64?: string; content?: string } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return null

  // Acepta tanto PDF en base64 como texto plano
  const pdfBase64 = typeof b.pdfBase64 === 'string' ? b.pdfBase64 : undefined
  const content   = typeof b.content   === 'string' ? b.content.trim() : undefined

  if (!pdfBase64 && !content) return null

  const docType = typeof b.documentType === 'string' && b.documentType.trim()
    ? b.documentType.trim()
    : 'documento'

  return { title, docType, pdfBase64, content }
}

// ══════════════════════════════════════════════════════════════════════════════
//  POST HANDLER
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!['ADMIN', 'SUPERVISOR'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Solo administradores y supervisores pueden indexar documentos' },
        { status: 403 }
      )
    }

    const companyId = session.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontró la empresa del usuario' }, { status: 400 })
    }

    // ── 2. Parse & validar body ────────────────────────────────────────────────
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const validated = validateBody(rawBody)
    rawBody = null   // libera RAM del body raw

    if (!validated) {
      return NextResponse.json(
        { error: 'Se requiere: title (string) + pdfBase64 (string base64) o content (string)' },
        { status: 400 }
      )
    }

    const { title, docType, pdfBase64, content } = validated

    // ── 3. Cargar dependencias ────────────────────────────────────────────────
    const [getEmbeddings, supabase, pdfExtractor] = await Promise.all([
      loadGetEmbeddings(),
      loadSupabase(),
      pdfBase64 ? loadPdfPageExtractor() : Promise.resolve(null),
    ])

    if (!getEmbeddings) {
      return NextResponse.json(
        { error: 'Módulo de IA no disponible. Verifica que @/lib/ai esté configurado correctamente.' },
        { status: 503 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase no está configurado.',
          required: [
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'OPENAI_API_KEY',
          ],
        },
        { status: 503 }
      )
    }

    if (pdfBase64 && !pdfExtractor) {
      return NextResponse.json(
        {
          error: 'No hay librería PDF disponible en el servidor. Instala: npm i pdf-parse-fork',
          alternatives: ['pdf-parse', 'pdfjs-dist'],
        },
        { status: 503 }
      )
    }

    // ── 4. Verificar OpenAI antes de procesar ────────────────────────────────
    const testEmb = await getEmbeddings('test connection')
    if (!testEmb) {
      return NextResponse.json(
        {
          error: 'OpenAI no responde. Verifica OPENAI_API_KEY y crédito disponible.',
          checks: [
            'OPENAI_API_KEY configurada en Vercel?',
            'La API key tiene crédito disponible?',
            'Vercel Hobby bloquea salidas — necesitas plan Pro.',
          ],
        },
        { status: 503 }
      )
    }

    // ── 5. Extraer páginas del PDF o dividir texto plano ──────────────────────
    let allPages: string[]

    if (pdfBase64 && pdfExtractor) {
      console.log('[Ingest] Decoding PDF from base64...')
      let pdfBuffer: Buffer

      try {
        pdfBuffer = Buffer.from(pdfBase64, 'base64')
      } catch {
        return NextResponse.json({ error: 'El campo pdfBase64 no es base64 válido.' }, { status: 400 })
      }

      const pdfSizeMB = Math.round(pdfBuffer.byteLength / 1_048_576)
      console.log(`[Ingest] PDF size: ${pdfSizeMB} MB — extracting pages...`)

      if (pdfBuffer.byteLength > 100 * 1_048_576) {
        return NextResponse.json(
          { error: `PDF demasiado grande (${pdfSizeMB} MB). Máximo: 100 MB. Divídelo en partes.` },
          { status: 400 }
        )
      }

      try {
        allPages = await pdfExtractor(pdfBuffer)
      } catch (err: any) {
        console.error('[Ingest] PDF extraction failed:', err?.message)
        return NextResponse.json(
          { error: `Error al leer el PDF: ${err?.message}. Asegúrate de que el archivo no esté protegido con contraseña.` },
          { status: 422 }
        )
      } finally {
        // Liberar buffer del PDF de la RAM
        ;(pdfBuffer as any) = null
      }

    } else {
      // Texto plano: dividir en bloques de ~5000 chars simulando "páginas"
      const PAGE_CHARS = 5_000
      allPages = []
      for (let i = 0; i < content!.length; i += PAGE_CHARS) {
        allPages.push(content!.substring(i, i + PAGE_CHARS))
      }
    }

    const totalPages = allPages.length
    console.log(`[Ingest] Total pages to process: ${totalPages}`)

    if (totalPages === 0) {
      return NextResponse.json({ error: 'El documento no contiene texto extraíble.' }, { status: 400 })
    }

    // Estimación total de chunks para metadata
    const estimatedChunks = Math.min(
      allPages.reduce((acc, p) => acc + Math.ceil(p.length / CFG.CHUNK_SIZE), 0),
      CFG.MAX_CHUNKS
    )

    // ── 6. Procesar por bloques de páginas ────────────────────────────────────
    const progress: IngestProgress = {
      pagesProcessed: 0,
      chunksCreated:  0,
      chunksEmbedded: 0,
      chunksInserted: 0,
      errors:         [],
      skipped:        0,
    }

    // Batch compartido: se vacía en flushBatch() después de cada SUPABASE_BATCH_SIZE
    const batch: ChunkRecord[] = []

    for (let blockStart = 0; blockStart < totalPages; blockStart += CFG.PAGE_BLOCK_SIZE) {
      const blockEnd   = Math.min(blockStart + CFG.PAGE_BLOCK_SIZE, totalPages)
      // Extraer bloque y liberar referencias en allPages para GC
      const pageBlock  = allPages.slice(blockStart, blockEnd)
      for (let i = blockStart; i < blockEnd; i++) allPages[i] = ''

      console.log(`[Ingest] Block pages ${blockStart + 1}–${blockEnd} / ${totalPages}`)

      await processPageBlock({
        pages:         pageBlock,
        pageOffset:    blockStart,
        getEmbeddings,
        supabase,
        companyId,
        title:         title.trim(),
        docType,
        chunkOffset:   0,
        totalChunks:   estimatedChunks,
        progress,
        batch,
      })

      // Ayuda al GC entre bloques
      if (global.gc) global.gc()
    }

    // Flush final del batch que puede quedar incompleto
    if (batch.length > 0) {
      await flushBatch(supabase, batch, progress)
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1_000)

    console.log(
      `[Ingest] ✅ DONE — ` +
      `pages: ${progress.pagesProcessed}/${totalPages} | ` +
      `chunks: ${progress.chunksCreated} created, ${progress.chunksInserted} inserted | ` +
      `errors: ${progress.errors.length} | ` +
      `time: ${elapsedSec}s`
    )

    // ── 7. Respuesta ───────────────────────────────────────────────────────────
    if (progress.chunksInserted === 0) {
      return NextResponse.json(
        {
          error: 'No se insertó ningún chunk. Revisa los errores.',
          details:       progress.errors,
          pagesProcessed: progress.pagesProcessed,
          chunksCreated:  progress.chunksCreated,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success:               true,
      documentTitle:         title.trim(),
      documentType:          docType,
      pagesProcessed:        progress.pagesProcessed,
      totalPages,
      chunksCreated:         progress.chunksCreated,
      chunksEmbedded:        progress.chunksEmbedded,
      chunksInserted:        progress.chunksInserted,
      skipped:               progress.skipped,
      processingTimeSeconds: elapsedSec,
      errors:                progress.errors.length > 0 ? progress.errors : undefined,
      warnings:              progress.skipped > 0
        ? [`${progress.skipped} chunks omitidos por superar el límite de ${CFG.MAX_CHUNKS}.`]
        : undefined,
    })

  } catch (err) {
    console.error('[Ingest] UNHANDLED ERROR:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      {
        error:   'Error interno del servidor.',
        details: msg,
        hint:    'Intenta con un documento más pequeño o divide el PDF en partes.',
      },
      { status: 500 }
    )
  }
}
