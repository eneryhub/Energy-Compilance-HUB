// Energy-Compliance Hub — AI Utilities
// Uses z-ai-web-dev-sdk when available (Z.ai sandbox),
// falls back to OpenAI-compatible API on Vercel.
//
// ENV VARS REQUIRED ON VERCEL:
//   OPENAI_API_KEY=sk-...        (your OpenAI API key)
//   ZAI_OPENAI_BASE_URL=...       (optional, defaults to https://api.openai.com/v1)
//   ZAI_MODEL=...                 (optional, defaults to gpt-4o-mini)
//   NEXT_PUBLIC_SUPABASE_URL=...  (for pgvector RAG — Paperclip)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//
// DIAGNOSTICS: Check Vercel function logs for [AI] prefixed messages.
//   Response objects include an `aiSource` field: 'openai' | 'sdk' | 'fallback'

export interface DocumentExtraction {
  documentType: string
  category: 'PERSONAL' | 'EQUIPOS' | 'LEGAL' | 'AMBIENTAL'
  expiryDate: string | null
  issueDate: string | null
  holderName: string | null
  confidence: number
  summary: string
  keywords: string[]
}

// ── Lazy ZAI singleton (same pattern as upload route) ──
let _zaiInstance: any = null
let _zaiInitAttempted = false
let _zaiAvailable = false

export async function getAI(): Promise<any | null> {
  if (_zaiInitAttempted) return _zaiAvailable ? _zaiInstance : null
  _zaiInitAttempted = true

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    _zaiInstance = await ZAI.create()
    _zaiAvailable = true
    console.log('[AI] ✅ Connected via z-ai-web-dev-sdk (sandbox native)')
    return _zaiInstance
  } catch {
    // Fallback: OpenAI-compatible API
    const apiKey = (process.env.ZAI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
    const baseUrl = (process.env.ZAI_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    const model = (process.env.ZAI_MODEL || 'gpt-4o-mini').trim()

    if (apiKey) {
      // Validate API key format (sk-... or similar)
      console.log(`[AI] OpenAI key preview: ${apiKey.substring(0, 7)}...${apiKey.length > 10 ? apiKey.substring(apiKey.length - 4) : ''}`)
      _zaiInstance = { type: 'openai', apiKey, baseUrl, model }
      _zaiAvailable = true
      console.log(`[AI] ✅ Connected via OpenAI — model: ${model}, base: ${baseUrl}`)
      return _zaiInstance
    }

    _zaiAvailable = false
    console.error('[AI] ❌ No AI backend available! z-ai-web-dev-sdk not found AND OPENAI_API_KEY not set.')
    console.error('[AI] → Set OPENAI_API_KEY in your Vercel environment variables to enable AI features.')
    return null
  }
}

/** Returns which AI backend is currently active */
export function getAISource(): string {
  if (!_zaiInitAttempted) return 'not-initialized'
  if (!_zaiAvailable) return 'fallback'
  if (!_zaiInstance) return 'fallback'
  if (_zaiInstance.type === 'openai') return 'openai'
  return 'sdk'
}

// ── Unified chat completion (works with both backends) ──

export async function chatCompletion(messages: Array<{ role: string; content: string }>, options?: { temperature?: number }): Promise<string> {
  const ai = await getAI()
  if (!ai) {
    console.warn('[AI] chatCompletion called but no AI backend available — returning empty string (caller should use fallback)')
    return ''
  }

  if (ai.type === 'openai') {
    // Build body with explicit field mapping — avoids prototype/extra-property issues on Vercel Edge
    const cleanMessages = messages.map(m => ({
      role: String(m.role),
      content: String(m.content),
    }))
    const temperature = typeof options?.temperature === 'number' ? options.temperature : 0.1
    const bodyObj = {
      model: String(ai.model),
      messages: cleanMessages,
      max_tokens: 2048,
      temperature,
    }
    const bodyStr = JSON.stringify(bodyObj)

    console.log(`[AI] → Calling OpenAI: model=${ai.model}, messages=${cleanMessages.length}, body=${bodyStr.length} bytes`)

    const response = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ai.apiKey}`,
        'Accept': 'application/json',
      },
      body: bodyStr,
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      console.error(`[AI] ❌ OpenAI error ${response.status}: ${errText}`)
      console.error(`[AI] ❌ Request body (first 500 chars): ${bodyStr.substring(0, 500)}`)
      throw new Error(`OpenAI error: ${response.status}`)
    }
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[AI] ✅ OpenAI response received (${content.length} chars)`)
    return content
  }

  // Native z-ai-web-dev-sdk
  console.log('[AI] → Calling z-ai-web-dev-sdk native')
  const response = await ai.chat.completions.create({
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    thinking: { type: 'disabled' },
  })
  const content = response.choices?.[0]?.message?.content || ''
  console.log(`[AI] ✅ SDK response received (${content.length} chars)`)
  return content
}

/**
 * Extract information from a document using AI
 */
export async function extractDocumentData(text: string): Promise<DocumentExtraction | null> {
  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content: `Eres un experto en análisis de documentos de seguridad industrial HSE para Latinoamérica.
Extrae información estructurada. Responde ÚNICAMENTE con JSON válido:
{
  "documentType": "string",
  "category": "PERSONAL|EQUIPOS|LEGAL|AMBIENTAL",
  "expiryDate": "YYYY-MM-DD|null",
  "issueDate": "YYYY-MM-DD|null",
  "holderName": "string|null",
  "confidence": 0.0-1.0,
  "summary": "string",
  "keywords": ["string"]
}`,
      },
      {
        role: 'user',
        content: `Analiza este documento:\n\n${text}`,
      },
    ], { temperature: 0.1 })

    if (!content) return null

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.warn('[AI] extractDocumentData → FALLBACK (no extraction)', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Generate AI-powered alert message for expiring documents
 */
export async function generateAlertMessage(params: {
  documentTitle: string
  documentType: string
  expiryDate: string
  daysRemaining: number
  holderName?: string
}): Promise<string> {
  const { documentTitle, documentType, expiryDate, daysRemaining, holderName } = params

  // Simple fallback for non-critical alerts
  if (daysRemaining > 0) {
    return `${documentType} "${documentTitle}" ${holderName ? `de ${holderName}` : ''} vence en ${daysRemaining} dias (${expiryDate}).`
  }

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content: 'Genera mensajes de alerta claros y concisos en español para seguridad industrial. Maximo 160 caracteres.',
      },
      {
        role: 'user',
        content: `Genera alerta URGENTE para documento VENCIDO: ${documentType} "${documentTitle}" de ${holderName || 'N/A'}, venció el ${expiryDate}.`,
      },
    ], { temperature: 0.5 })

    return content || `${documentType} "${documentTitle}" ha VENCIDO (${expiryDate}). Renueve inmediatamente.`
  } catch {
    return `ALERTA URGENTE: ${documentType} "${documentTitle}" ${holderName ? `de ${holderName}` : ''} ha VENCIDO (${expiryDate}). Renueve inmediatamente.`
  }
}

export interface PermitReviewResult {
  overallScore: number
  riskLevel: string
  recommendation: string
  findings: Array<{
    severity: string
    category: string
    description: string
    suggestion: string
  }>
  summary: string
  reviewedAt: string
  aiSource: 'openai' | 'sdk' | 'fallback'
}

/**
 * Review a work permit for safety compliance using AI.
 * Falls back to rule-based review when AI is unavailable.
 */
export async function reviewPermitSafety(params: {
  riskType: string
  riskLabel: string
  workDescription: string
  workLocation: string
  safetyChecks: Record<string, boolean>
  technicianName: string
  supervisorName: string
  hasPhotos: boolean
  photosCount: number
}): Promise<PermitReviewResult> {
  const { riskType, riskLabel, workDescription, workLocation, safetyChecks, technicianName, supervisorName, hasPhotos, photosCount } = params

  const failedChecks = Object.entries(safetyChecks).filter(([, val]) => !val)
  const passedChecks = Object.entries(safetyChecks).filter(([, val]) => val)
  const totalChecks = Object.keys(safetyChecks).length

  try {
    const checksDescription = Object.entries(safetyChecks).map(([key, val]) =>
      `- ${key.replace(/_/g, ' ')}: ${val ? 'SI Cumplido' : 'NO Cumplido'}`
    ).join('\n')

    const content = await chatCompletion([
      {
        role: 'system',
        content: `Eres un auditor de seguridad industrial HSE experto en normativa latinoamericana (OSHA, NFPA, ISO 45001).
Analiza permisos de trabajo y genera EXCLUSIVAMENTE un JSON con tu evaluación. No incluyas texto fuera del JSON.

{
  "overallScore": number entre 0 y 100,
  "riskLevel": uno de "BAJO|MEDIO|MEDIO-ALTO|ALTO|CRITICO",
  "recommendation": uno de "APROBAR|REVISAR|RECHAZAR",
  "findings": [
    {
      "severity": uno de "critical|warning|info",
      "category": uno de "checklist|safety|evidence|procedures|ppe",
      "description": "Descripcion del hallazgo en español",
      "suggestion": "Recomendacion para corregir en español"
    }
  ],
  "summary": "Resumen ejecutivo de 2-3 oraciones en español"
}

Criterios de scoring:
- 90-100: Todo cumplido, checklist completo, con fotos
- 70-89: Checklist mayormente completo, hallazgos menores
- 50-69: Hallazgos importantes que requieren atencion
- 0-49: Riesgo critico, no se recomienda aprobar

Si TODOS los checks estan cumplidos y hay fotos, el score debe ser >= 90 y recommendation "APROBAR".
Si hay checks sin cumplir, penaliza proporcionalmente.`,
      },
      {
        role: 'user',
        content: `Analiza este permiso de trabajo:

TIPO DE RIESGO: ${riskLabel} (${riskType})
DESCRIPCION DEL TRABAJO: ${workDescription}
UBICACION: ${workLocation}
TECNICO: ${technicianName}
SUPERVISOR: ${supervisorName}

LISTA DE VERIFICACION (${passedChecks.length}/${totalChecks} cumplidos):
${checksDescription}

EVIDENCIA FOTOGRAFICA: ${hasPhotos ? `Si, ${photosCount} foto(s) adjuntada(s)` : 'No se adjuntaron fotos'}`,
      },
    ], { temperature: 0.2 })

    if (!content) throw new Error('Empty AI response')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI JSON response')

    const result = JSON.parse(jsonMatch[0])

    return {
      overallScore: typeof result.overallScore === 'number' ? result.overallScore : 70,
      riskLevel: result.riskLevel || 'MEDIO',
      recommendation: result.recommendation || 'REVISAR',
      findings: Array.isArray(result.findings) ? result.findings : [],
      summary: result.summary || 'Revision completada por IA.',
      reviewedAt: new Date().toISOString(),
      aiSource: getAISource() as 'openai' | 'sdk',
    }
  } catch (error) {
    // Intelligent fallback when AI is unavailable — rule-based review
    console.warn(`[AI] reviewPermitSafety → FALLBACK to rule-based review (AI ${getAISource()})`, error instanceof Error ? error.message : error)

    let score = 100
    score -= failedChecks.length * 12
    if (!hasPhotos) score -= 10
    if (workDescription.length < 20) score -= 15
    if (riskType === 'CALIENTE' || riskType === 'ELECTRICO' || riskType === 'EXCAVACION') score -= 5
    score = Math.max(0, Math.min(100, score))

    const riskLevel = score >= 90 ? 'BAJO' : score >= 70 ? 'MEDIO' : score >= 50 ? 'MEDIO-ALTO' : score >= 30 ? 'ALTO' : 'CRITICO'
    const recommendation = score >= 85 && failedChecks.length === 0 ? 'APROBAR' : score >= 50 ? 'REVISAR' : 'RECHAZAR'

    const findings: Array<{ severity: string; category: string; description: string; suggestion: string }> = []

    for (const [key] of failedChecks) {
      findings.push({
        severity: 'warning',
        category: 'checklist',
        description: `Item "${key.replace(/_/g, ' ')}" no fue verificado`,
        suggestion: 'Este item debe ser completado antes de aprobar el permiso',
      })
    }

    if (!hasPhotos) {
      findings.push({
        severity: 'info',
        category: 'evidence',
        description: 'No se adjuntaron fotografias de evidencia',
        suggestion: 'Se recomienda documentar las condiciones del area con fotos',
      })
    }

    if (riskType === 'ALTURA' && !safetyChecks.has_harness) {
      findings.push({ severity: 'critical', category: 'ppe', description: 'Trabajo en altura sin arnés de seguridad verificado', suggestion: 'El arnés de cuerpo completo es obligatorio para trabajos en altura. No apruebe sin verificar.' })
    }
    if (riskType === 'CALIENTE' && !safetyChecks.has_fire_extinguisher) {
      findings.push({ severity: 'critical', category: 'safety', description: 'Trabajo en caliente sin extintor verificado', suggestion: 'Verifique la disponibilidad de extintores en el area antes de iniciar.' })
    }
    if (riskType === 'ELECTRICO' && !safetyChecks.has_lockout_tagout) {
      findings.push({ severity: 'critical', category: 'procedures', description: 'Trabajo eléctrico sin Lockout/Tagout verificado', suggestion: 'LOTO es obligatorio. No inicie trabajo sin desenergizar y bloquear la fuente.' })
    }
    if (riskType === 'EXCAVACION' && !safetyChecks.has_gas_detection) {
      findings.push({ severity: 'critical', category: 'safety', description: 'Excavación sin detección de gases verificado', suggestion: 'Monitoreo de gases continuo es obligatorio en excavaciones.' })
    }

    if (failedChecks.length === 0) {
      findings.push({ severity: 'info', category: 'checklist', description: `Todos los ${totalChecks} items de verificación están completados`, suggestion: 'El checklist está completo. Verifique las condiciones en campo.' })
    }

    return {
      overallScore: score,
      riskLevel,
      recommendation,
      findings,
      summary: `Revision automatica de permiso "${riskLabel}" en ${workLocation || 'ubicacion no especificada'}. ${passedChecks.length}/${totalChecks} checks completados.${hasPhotos ? ` ${photosCount} foto(s) adjuntada(s).` : ' Sin evidencia fotografica.'} ${recommendation === 'APROBAR' ? 'Permiso cumple con los requisitos minimos.' : 'Se requieren acciones correctivas antes de aprobar.'}`,
      reviewedAt: new Date().toISOString(),
      aiSource: 'fallback',
    }
  }
}

// ════════════════════════════════════════════════════════════════
// PAPERCLIP — RAG (Retrieval Augmented Generation)
// Embeddings via OpenAI + Vector search via Supabase pgvector
// ════════════════════════════════════════════════════════════════

export interface VectorSearchResult {
  id: string
  documentTitle: string
  documentType: string
  chunkContent: string
  similarity: number
  metadata?: Record<string, unknown>
}

/**
 * Generate text embeddings using OpenAI text-embedding-3-small.
 * Returns a number[] vector (1536 dimensions).
 * Falls back to null if OpenAI is not configured.
 */
export async function getEmbeddings(text: string): Promise<number[] | null> {
  const ai = await getAI()
  if (!ai || ai.type !== 'openai') {
    console.warn('[AI] getEmbeddings requires OpenAI backend — not available')
    return null
  }

  try {
    const bodyStr = JSON.stringify({
      model: 'text-embedding-3-small',
      input: String(text).substring(0, 8000), // OpenAI limit per input
    })

    console.log(`[AI] → Generating embedding (${text.length} chars)`)

    const response = await fetch(`${ai.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ai.apiKey}`,
        'Accept': 'application/json',
      },
      body: bodyStr,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      console.error(`[AI] ❌ Embedding error ${response.status}: ${errText}`)
      return null
    }

    const data = await response.json()
    const embedding: number[] = data.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.error('[AI] ❌ No embedding in response')
      return null
    }

    console.log(`[AI] ✅ Embedding generated (${embedding.length} dimensions)`)
    return embedding
  } catch (error) {
    console.error('[AI] getEmbeddings failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Perform vector similarity search on Supabase pgvector.
 * Calls the RPC function `match_documents` to find the most relevant chunks.
 *
 * Expected Supabase RPC: match_documents(query_embedding, match_threshold, match_count, company_id)
 * Returns: array of { id, document_title, document_type, chunk_content, similarity, metadata }
 */
export async function performVectorSearch(
  queryVector: number[],
  companyId: string,
  options?: { matchCount?: number; matchThreshold?: number }
): Promise<VectorSearchResult[]> {
  const { getSupabaseClient } = await import('@/lib/supabase')
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.warn('[AI] performVectorSearch — Supabase client not configured')
    return []
  }

  const matchCount = options?.matchCount ?? 5
  const matchThreshold = options?.matchThreshold ?? 0.5

  try {
    console.log(`[AI] → Vector search: companyId=${companyId}, count=${matchCount}, threshold=${matchThreshold}`)

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryVector,
      match_count: matchCount,
      match_threshold: matchThreshold,
      company_id: companyId,
    })

    if (error) {
      // RPC might not exist yet — log clearly
      console.error('[AI] ❌ Supabase RPC match_documents error:', error.message)
      console.error('[AI] → Ensure you created the match_documents RPC function in Supabase')
      return []
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.log('[AI] Vector search: no results found')
      return []
    }

    const results: VectorSearchResult[] = data.map((row: Record<string, any>) => ({
      id: String(row.id || ''),
      documentTitle: String(row.document_title || row.documentTitle || 'Documento sin titulo'),
      documentType: String(row.document_type || row.documentType || ''),
      chunkContent: String(row.chunk_content || row.chunkContent || ''),
      similarity: Number(row.similarity ?? 0),
      metadata: row.metadata || undefined,
    }))

    console.log(`[AI] ✅ Vector search: ${results.length} results found`)
    return results
  } catch (error) {
    console.error('[AI] performVectorSearch failed:', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Generate a complete RAG response:
 * 1. Embed the user query
 * 2. Search Supabase for relevant document chunks
 * 3. Build context from search results
 * 4. Generate final answer using OpenAI with the retrieved context
 */
export interface RagResponse {
  answer: string
  sources: VectorSearchResult[]
  aiSource: 'openai' | 'sdk' | 'fallback'
}

export async function generateRagResponse(
  question: string,
  companyId: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<RagResponse> {
  console.log(`[AI] → RAG pipeline: question="${question.substring(0, 80)}..."`)

  // Step 1: Embed the query
  const queryVector = await getEmbeddings(question)
  if (!queryVector) {
    console.warn('[AI] RAG → fallback: could not generate embedding')
    return {
      answer: 'No fue posible procesar tu consulta. Verifica que la clave API de OpenAI este configurada correctamente y que la extension pgvector este habilitada en Supabase.',
      sources: [],
      aiSource: 'fallback',
    }
  }

  // Step 2: Vector search
  const searchResults = await performVectorSearch(queryVector, companyId)
  if (searchResults.length === 0) {
    return {
      answer: 'No se encontraron documentos relevantes en la base de conocimiento para responder tu consulta. Intenta con una pregunta mas especifica o verifica que los documentos esten indexados en Supabase.',
      sources: [],
      aiSource: 'openai',
    }
  }

  // Step 3: Build context
  const contextChunks = searchResults
    .map((r, i) => `[Fuente ${i + 1}: ${r.documentTitle} (${r.documentType})]\n${r.chunkContent}`)
    .join('\n\n---\n\n')

  // Step 4: Generate answer with context
  const systemPrompt = `Eres un asistente experto en seguridad industrial HSE (Health, Safety & Environment) para el sector Oil & Gas.
Tu funcion es responder preguntas tecnicas basandote EXCLUSIVAMENTE en los documentos proporcionados como contexto.

Reglas estrictas:
- Responde SIEMPRE en español profesional y tecnico.
- Usa terminologia del sector Oil & Gas e HSE.
- Si la respuesta no se encuentra en los documentos, indicalo claramente: "La informacion solicitada no se encuentra en los documentos disponibles."
- NUNCA inventes informacion que no este en el contexto proporcionado.
- Cita las fuentes numeradas [Fuente N] en tu respuesta.
- Sé conciso pero completo.
- Si la pregunta es sobre normativa, menciona las referencias especificas si estan disponibles en los documentos.`

  const userPrompt = `Contexto de documentos:
${contextChunks}

---

Pregunta del usuario: ${question}

Responde basandote en el contexto proporcionado. Cita las fuentes usando [Fuente N].`

  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: userPrompt },
    ]

    const answer = await chatCompletion(messages, { temperature: 0.3 })

    if (!answer) {
      return {
        answer: 'No se pudo generar una respuesta. Intenta nuevamente.',
        sources: searchResults,
        aiSource: 'fallback',
      }
    }

    return {
      answer,
      sources: searchResults,
      aiSource: getAISource() as 'openai' | 'sdk' | 'fallback',
    }
  } catch (error) {
    console.error('[AI] RAG generateRagResponse failed:', error instanceof Error ? error.message : error)
    return {
      answer: 'Error al generar la respuesta. Por favor, intenta nuevamente.',
      sources: searchResults,
      aiSource: 'fallback',
    }
  }
}
