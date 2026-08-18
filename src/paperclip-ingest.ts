#!/usr/bin/env bun
// ════════════════════════════════════════════════════════════════════
// PAPERCLIP — Ingesta Local de Documentos (bypass Vercel Hobby)
// ════════════════════════════════════════════════════════════════════
//
// USO:
//   bun run scripts/paperclip-ingest.ts <archivo_o_carpeta> --company <ID>
//   bun run scripts/paperclip-ingest.ts ./documentos/ --company abc123
//   bun run scripts/paperclip-ingest.ts manual.pdf --company abc123
//
// REQUISITOS:
//   1. Archivo .env.local con:
//      NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
//      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//      OPENAI_API_KEY=sk-...
//
//   2. Ejecutar paperclip.sql en Supabase SQL Editor (crear tabla + RPCs)
//
//   3. bun install (ya deberia estar hecho)
//
// SOPORTA: .txt, .md, .pdf
// ════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'

// ── Configuración ──
const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 150
const MAX_CHUNKS_PER_FILE = 200
const EMBEDDING_BATCH_SIZE = 20 // OpenAI permite hasta 2048 inputs por batch
const DELAY_BETWEEN_BATCHES = 500 // ms entre batches para no rate-limit
const MAX_CONTENT_CHARS = 500_000

// ── Colores para terminal ──
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function log(color: string, prefix: string, msg: string) {
  console.log(`${color}${prefix}${colors.reset} ${msg}`)
}

// ── Cargar variables de entorno ──
function loadEnv(): { supabaseUrl: string; supabaseKey: string; openaiKey: string } {
  const envPaths = ['.env.local', '.env', '.env.production.local']

  for (const envFile of envPaths) {
    if (existsSync(envFile)) {
      const content = readFileSync(envFile, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIndex = trimmed.indexOf('=')
        if (eqIndex === -1) continue
        const key = trimmed.substring(0, eqIndex).trim()
        const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const openaiKey = process.env.OPENAI_API_KEY || process.env.ZAI_OPENAI_API_KEY || ''

  return { supabaseUrl, supabaseKey, openaiKey }
}

// ── Leer contenido de un archivo ──
function readFileContent(filePath: string): { text: string; pages?: number } {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.txt' || ext === '.md' || ext === '.csv' || ext === '.json') {
    const text = readFileSync(filePath, 'utf-8')
    return { text }
  }

  if (ext === '.pdf') {
    // PDF support via pdf-parse
    try {
      const pdfParse = require('pdf-parse')
      const buffer = readFileSync(filePath)
      const data = pdfParse(buffer)
      return { text: data.text, pages: data.numpages }
    } catch {
      log(colors.yellow, '⚠️', `pdf-parse no disponible para ${basename(filePath)}. Instala con: bun add pdf-parse`)
      log(colors.dim, '', 'Alternativa: convierte el PDF a .txt antes de procesarlo.')
      return { text: '' }
    }
  }

  log(colors.yellow, '⚠️', `Formato no soportado: ${ext} (${basename(filePath)})`)
  return { text: '' }
}

// ── Chunking ──
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
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
      if (breakPoint > start + chunkSize * 0.3) bestBreak = breakPoint + 1
      else if (breakLine > start + chunkSize * 0.3) bestBreak = breakLine + 1
      else if (breakSpace > start + chunkSize * 0.3) bestBreak = breakSpace + 1
      end = bestBreak
    }

    const chunk = text.substring(start, end).trim()
    if (chunk.length > 0) chunks.push(chunk)

    start = end - overlap
    if (start >= text.length || (chunks.length > 0 && start === end)) break
  }

  return chunks.length > 0 ? chunks : [text.trim()]
}

// ── Generar embeddings (batch) ──
async function generateEmbeddingsBatch(
  texts: string[],
  openaiKey: string
): Promise<(number[] | null)[]> {
  const baseUrl = (process.env.ZAI_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')

  try {
    const inputs = texts.map(t => t.substring(0, 8000))

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: inputs,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      console.error(`  ❌ OpenAI error ${response.status}: ${errText.substring(0, 200)}`)
      return texts.map(() => null)
    }

    const data = await response.json()
    const embeddings: (number[] | null)[] = data.data.map((item: any) =>
      Array.isArray(item.embedding) ? item.embedding : null
    )

    return embeddings
  } catch (err) {
    console.error('  ❌ Error generando embeddings batch:', err instanceof Error ? err.message : err)
    return texts.map(() => null)
  }
}

// ── Procesar un archivo completo ──
async function processFile(
  filePath: string,
  companyId: string,
  documentType: string,
  supabase: ReturnType<typeof createClient>,
  openaiKey: string
): Promise<{ success: boolean; chunks: number; errors: string[] }> {
  const fileName = basename(filePath)
  const errors: string[] = []

  log(colors.cyan, '📄', `Procesando: ${fileName}`)

  // Leer archivo
  const { text, pages } = readFileContent(filePath)
  if (!text || text.trim().length === 0) {
    log(colors.red, '❌', `  No se pudo leer contenido de ${fileName}`)
    return { success: false, chunks: 0, errors: ['No se pudo leer el archivo'] }
  }

  const cleanText = text.replace(/\0/g, '').trim()
  log(colors.dim, '', `  ${cleanText.length.toLocaleString()} caracteres${pages ? `, ${pages} páginas` : ''}`)

  if (cleanText.length > MAX_CONTENT_CHARS) {
    log(colors.yellow, '⚠️', `  Archivo muy grande (${Math.round(cleanText.length / 1000)}K). Solo se procesarán los primeros ${Math.round(MAX_CONTENT_CHARS / 1000)}K caracteres.`)
  }

  // Chunking
  const chunks = splitIntoChunks(cleanText, CHUNK_SIZE, CHUNK_OVERLAP)
  log(colors.blue, '  🔢', `${chunks.length} fragmentos (${CHUNK_SIZE} chars c/u)`)

  if (chunks.length > MAX_CHUNKS_PER_FILE) {
    log(colors.yellow, '⚠️', `  Demasiados fragmentos (${chunks.length}). Se procesarán solo los primeros ${MAX_CHUNKS_PER_FILE}.`)
    chunks.length = MAX_CHUNKS_PER_FILE
  }

  // Procesar en batches de embeddings
  let processedCount = 0
  const startTime = Date.now()
  const docTitle = fileName.replace(/\.[^.]+$/, '') // Quitar extensión

  for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBEDDING_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + EMBEDDING_BATCH_SIZE, chunks.length)
    const batchChunks = chunks.slice(batchStart, batchEnd)

    log(colors.dim, '', `  Batch ${Math.floor(batchStart / EMBEDDING_BATCH_SIZE) + 1}: fragmentos ${batchStart + 1}-${batchEnd}...`)

    // Generar embeddings del batch
    const embeddings = await generateEmbeddingsBatch(batchChunks, openaiKey)

    // Insertar en Supabase
    for (let j = 0; j < batchChunks.length; j++) {
      const chunkContent = batchChunks[j]
      const embedding = embeddings[j]
      const chunkIndex = batchStart + j

      if (!embedding) {
        errors.push(`Fragmento ${chunkIndex + 1}: embedding falló`)
        continue
      }

      try {
        const { error: insertError } = await supabase.from('document_chunks').insert({
          company_id: companyId,
          document_title: docTitle,
          document_type: documentType,
          chunk_content: chunkContent,
          embedding,
          chunk_index: chunkIndex,
          metadata: {
            chunkTotal: chunks.length,
            chunkChars: chunkContent.length,
            source: 'local-ingest',
          },
        })

        if (insertError) {
          console.error(`  ❌ Insert error chunk ${chunkIndex + 1}: ${insertError.message}`)
          errors.push(`Fragmento ${chunkIndex + 1}: ${insertError.message}`)
          continue
        }

        processedCount++
      } catch (err) {
        errors.push(`Fragmento ${chunkIndex + 1}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Delay entre batches para evitar rate limit
    if (batchEnd < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)

  if (processedCount > 0) {
    log(colors.green, '✅', `  Completado: ${processedCount}/${chunks.length} fragmentos en ${elapsed}s`)
  } else {
    log(colors.red, '❌', `  Falló: 0/${chunks.length} fragmentos procesados`)
  }

  if (errors.length > 0) {
    log(colors.yellow, '  ⚠️', `${errors.length} errores (ver arriba)`)
  }

  return { success: processedCount > 0, chunks: processedCount, errors }
}

// ── Listar documentos existentes ──
async function listDocuments(supabase: ReturnType<typeof createClient>, companyId: string) {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('document_title, document_type')
    .eq('company_id', companyId)

  if (error || !data || data.length === 0) {
    log(colors.dim, '', '  No hay documentos indexados.')
    return
  }

  const docMap = new Map<string, { type: string; count: number }>()
  for (const row of data) {
    const key = row.document_title
    const existing = docMap.get(key)
    if (existing) {
      existing.count++
    } else {
      docMap.set(key, { type: row.document_type || 'documento', count: 1 })
    }
  }

  log(colors.blue, '', `  ${docMap.size} documento(s) indexado(s):`)
  for (const [title, info] of docMap) {
    log(colors.dim, '', `  • ${title} (${info.type}) — ${info.count} fragmentos`)
  }
}

// ── Eliminar un documento ──
async function deleteDocument(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  title: string
) {
  log(colors.yellow, '🗑️', `Eliminando documento: ${title}...`)

  const { error, count } = await supabase
    .from('document_chunks')
    .delete({ count: 'exact' })
    .eq('company_id', companyId)
    .eq('document_title', title)

  if (error) {
    log(colors.red, '❌', `  Error: ${error.message}`)
  } else {
    log(colors.green, '✅', `  Eliminados ${count || 0} fragmentos de "${title}"`)
  }
}

// ── Mostrar ayuda ──
function showHelp() {
  console.log(`
${colors.bold}${colors.cyan}═══ PAPERCLIP — Ingesta Local de Documentos ═══${colors.reset}

${colors.bold}USO:${colors.reset}
  bun run scripts/paperclip-ingest.ts <archivo_o_carpeta> --company <ID> [opciones]
  bun run scripts/paperclip-ingest.ts --list --company <ID>
  bun run scripts/paperclip-ingest.ts --delete "Título" --company <ID>

${colors.bold}COMANDOS:${colors.reset}
  <archivo_o_carpeta>   Archivo o carpeta con documentos a indexar
  --company <ID>        ID de la empresa (OBLIGATORIO excepto --help)
  --type <tipo>         Tipo de documento (default: "documento")
  --list                Listar documentos ya indexados
  --delete "título"     Eliminar un documento y todos sus fragmentos
  --help                Mostrar esta ayuda

${colors.bold}FORMATOS SOPORTADOS:${colors.reset}
  .txt  .md  .csv  .json  .pdf (requiere: bun add pdf-parse)

${colors.bold}VARIABLES DE ENTORNO${colors.reset} (en .env.local):
  NEXT_PUBLIC_SUPABASE_URL    URL del proyecto Supabase
  NEXT_PUBLIC_SUPABASE_ANON_KEY   Clave anónima de Supabase
  OPENAI_API_KEY              Clave API de OpenAI

${colors.bold}REQUISITOS:${colors.reset}
  1. Ejecutar supabase/migrations/paperclip.sql en Supabase SQL Editor
  2. Configurar .env.local con las 3 variables de entorno
  3. bun install (ya debe estar hecho)

${colors.bold}EJEMPLOS:${colors.reset}
  bun run scripts/paperclip-ingest.ts ./documentos/ --company abc123
  bun run scripts/paperclip-ingest.ts manual-hse.pdf --company abc123 --type "HSE"
  bun run scripts/paperclip-ingest.ts --list --company abc123
  bun run scripts/paperclip-ingest.ts --delete "Procedimiento HSE" --company abc123

${colors.dim}Nota: Este script se ejecuta LOCALMENTE, no pasa por Vercel.
Es ideal para el plan Hobby de Vercel que bloquea solicitudes salientes.${colors.reset}
`)
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2)

  // Parsear argumentos
  const showHelpFlag = args.includes('--help') || args.includes('-h')
  const listFlag = args.includes('--list')
  const deleteFlag = args.includes('--delete')

  const companyIdx = args.indexOf('--company')
  const companyId = companyIdx !== -1 && args[companyIdx + 1] ? args[companyIdx + 1] : ''

  const typeIdx = args.indexOf('--type')
  const docType = typeIdx !== -1 && args[typeIdx + 1] ? args[typeIdx + 1] : 'documento'

  const deleteIdx = args.indexOf('--delete')
  const deleteTitle = deleteIdx !== -1 && args[deleteIdx + 1] ? args[deleteIdx + 1] : ''

  // Obtener archivos/carpeta (argumentos posicionales que no son flags)
  const positionalArgs = args.filter(a => !a.startsWith('--'))

  if (showHelpFlag || args.length === 0) {
    showHelp()
    process.exit(0)
  }

  if (!companyId && !showHelpFlag) {
    log(colors.red, '❌', 'Debes especificar --company <ID>')
    log(colors.dim, '', '  Ejemplo: bun run scripts/paperclip-ingest.ts ./documento.txt --company abc123')
    log(colors.dim, '', '  Para ver tu company ID, consulta la tabla Company en Supabase.')
    process.exit(1)
  }

  // Cargar entorno
  const { supabaseUrl, supabaseKey, openaiKey } = loadEnv()

  if (!supabaseUrl || !supabaseKey) {
    log(colors.red, '❌', 'Supabase no configurado. Agrega a .env.local:')
    log(colors.dim, '', '  NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co')
    log(colors.dim, '', '  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...')
    process.exit(1)
  }

  if (!openaiKey) {
    log(colors.red, '❌', 'OpenAI no configurado. Agrega a .env.local:')
    log(colors.dim, '', '  OPENAI_API_KEY=sk-...')
    process.exit(1)
  }

  // Crear cliente Supabase
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  log(colors.green, '🔗', `Supabase: ${supabaseUrl.substring(0, 40)}...`)
  log(colors.green, '🔑', `OpenAI: ${openaiKey.substring(0, 10)}...${openaiKey.length > 14 ? '****' : ''}`)
  log(colors.blue, '🏢', `Company ID: ${companyId}`)

  // Verificar conectividad con Supabase
  try {
    const { error } = await supabase.from('document_chunks').select('id').limit(1)
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        log(colors.red, '❌', 'La tabla document_chunks NO EXISTE en Supabase.')
        log(colors.dim, '', '  Debes ejecutar la migración SQL primero:')
        log(colors.dim, '', '  1. Abre Supabase Dashboard → SQL Editor')
        log(colors.dim, '', '  2. Copia y ejecuta el contenido de supabase/migrations/paperclip.sql')
        log(colors.dim, '', '  3. Vuelve a ejecutar este script')
        process.exit(1)
      }
      throw error
    }
    log(colors.green, '✅', 'Supabase conectado correctamente')
  } catch (err) {
    log(colors.red, '❌', `Error conectando a Supabase: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  // Verificar conectividad con OpenAI
  try {
    const baseUrl = (process.env.ZAI_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${openaiKey}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      log(colors.red, '❌', `OpenAI respondió con status ${response.status}. Verifica tu API key.`)
      process.exit(1)
    }
    log(colors.green, '✅', 'OpenAI conectado correctamente')
  } catch (err) {
    log(colors.red, '❌', `Error conectando a OpenAI: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  console.log()

  // ── Modo: listar documentos ──
  if (listFlag) {
    log(colors.bold, '📚', 'Documentos indexados:')
    await listDocuments(supabase, companyId)
    process.exit(0)
  }

  // ── Modo: eliminar documento ──
  if (deleteFlag) {
    if (!deleteTitle) {
      log(colors.red, '❌', 'Debes especificar el título: --delete "Título del documento"')
      process.exit(1)
    }
    await deleteDocument(supabase, companyId, deleteTitle)
    process.exit(0)
  }

  // ── Modo: ingestar archivos ──
  if (positionalArgs.length === 0) {
    log(colors.red, '❌', 'Debes especificar un archivo o carpeta')
    log(colors.dim, '', '  Ejemplo: bun run scripts/paperclip-ingest.ts ./documentos/ --company abc123')
    process.exit(1)
  }

  // Recolectar archivos
  const supportedExts = ['.txt', '.md', '.csv', '.json', '.pdf']
  const filePaths: string[] = []

  for (const arg of positionalArgs) {
    if (!existsSync(arg)) {
      log(colors.yellow, '⚠️', `No existe: ${arg}`)
      continue
    }

    const stat = statSync(arg)
    if (stat.isDirectory()) {
      const files = readdirSync(arg)
      for (const file of files) {
        const ext = extname(file).toLowerCase()
        if (supportedExts.includes(ext)) {
          filePaths.push(join(arg, file))
        }
      }
    } else {
      const ext = extname(arg).toLowerCase()
      if (supportedExts.includes(ext)) {
        filePaths.push(arg)
      } else {
        log(colors.yellow, '⚠️', `Formato no soportado: ${arg}`)
      }
    }
  }

  if (filePaths.length === 0) {
    log(colors.red, '❌', 'No se encontraron archivos válidos')
    process.exit(1)
  }

  log(colors.bold, '\n📂', `${filePaths.length} archivo(s) para procesar:`)
  for (const fp of filePaths) {
    log(colors.dim, '', `  • ${basename(fp)}`)
  }
  console.log()

  // Procesar cada archivo
  const totalStart = Date.now()
  let totalChunks = 0
  let totalErrors = 0
  let successCount = 0

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i]
    log(colors.bold, `\n[${i + 1}/${filePaths.length}]`, '─'.repeat(50))

    const result = await processFile(filePath, companyId, docType, supabase, openaiKey)
    totalChunks += result.chunks
    totalErrors += result.errors.length
    if (result.success) successCount++

    // Delay entre archivos
    if (i < filePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Resumen final
  const totalElapsed = Math.round((Date.now() - totalStart) / 1000)
  console.log()
  log(colors.bold, colors.cyan + '═══ RESUMEN ═══' + colors.reset, '')
  log(colors.green, '✅', `Archivos exitosos: ${successCount}/${filePaths.length}`)
  log(colors.blue, '📦', `Fragmentos totales: ${totalChunks}`)
  if (totalErrors > 0) {
    log(colors.yellow, '⚠️', `Errores: ${totalErrors}`)
  }
  log(colors.dim, '⏱️', `Tiempo total: ${totalElapsed}s`)

  if (successCount > 0) {
    log(colors.green, '\n🎉', '¡Documentos indexados! Ahora puedes usar Paperclip para consultarlos.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
