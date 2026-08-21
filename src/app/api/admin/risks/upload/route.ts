import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import * as XLSX from 'xlsx'

// ──────────────────────────────────────────────────────────────
// POST /api/admin/risks/upload
// Smart Sheet Ingestion: Upload PDF/Excel → AI extracts risk
// types + checklist items → atomic DB insert.
//
// Security: companyId from session ONLY (never from client body).
// Multi-tenant: all records scoped to session.companyId.
// Transactional: prisma.$transaction ensures no orphans.
//
// AI Backend: Uses z-ai-web-dev-sdk when available (Z.ai sandbox).
// On Vercel production, falls back to OpenAI-compatible API via
// ZAI_OPENAI_API_KEY / ZAI_OPENAI_BASE_URL env vars, or returns
// a clear 503 error if no AI backend is configured.
// ──────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// ── Lazy ZAI singleton (avoids import-time crash on Vercel) ──
let _zaiInstance: any = null
let _zaiInitAttempted = false
let _zaiAvailable = false

async function getZAI(): Promise<any | null> {
  if (_zaiInitAttempted) return _zaiAvailable ? _zaiInstance : null
  _zaiInitAttempted = true

  try {
    // Try z-ai-web-dev-sdk (Z.ai sandbox)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    _zaiInstance = await ZAI.create()
    _zaiAvailable = true
    console.log('[RiskIngestion] z-ai-web-dev-sdk initialized successfully')
    return _zaiInstance
  } catch (sdkErr: any) {
    console.warn('[RiskIngestion] z-ai-web-dev-sdk not available:', sdkErr?.message)

    // Fallback: try OpenAI-compatible API via env vars
    const apiKey = process.env.ZAI_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    const baseUrl = process.env.ZAI_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.ZAI_MODEL || 'gpt-4o-mini'

    if (apiKey) {
      console.log('[RiskIngestion] Using OpenAI-compatible fallback')
      _zaiInstance = { type: 'openai', apiKey, baseUrl, model }
      _zaiAvailable = true
      return _zaiInstance
    }

    console.error('[RiskIngestion] No AI backend available. Set ZAI_OPENAI_API_KEY or use Z.ai sandbox.')
    _zaiAvailable = false
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth & Role Gate ──────────────────────────────────
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Solo administradores pueden ingestar planillas' }, { status: 403 })
    }

    // ── AI Backend Check ──────────────────────────────────
    const zai = await getZAI()
    if (!zai) {
      return NextResponse.json(
        {
          error: 'Servicio de IA no disponible en este entorno.',
          hint: 'Configure la variable de entorno ZAI_OPENAI_API_KEY en Vercel para habilitar la ingesta inteligente de planillas.',
          docs: 'https://platform.openai.com/api-keys',
        },
        { status: 503 }
      )
    }

    // ── Parse FormData ────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Formato no soportado. Use: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máximo 10 MB)' }, { status: 400 })
    }

    const companyId = session.companyId // NEVER from client

    // ── Step 1: Extract raw text from document ──────────
    let rawText: string

    if (ext === 'pdf') {
      // PDF → VLM (Vision Language Model) for OCR
      rawText = await extractTextFromPdf(file, zai)
    } else {
      // Excel/CSV → xlsx library
      rawText = await extractTextFromExcel(file)
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({ error: 'No se pudo extraer suficiente texto del documento. Verifique que el archivo contenga datos legibles.' }, { status: 400 })
    }

    // ── Step 2: LLM maps raw text → structured risk data ─
    const aiResult = await mapTextToRiskTypes(rawText, zai)

    if (!aiResult.riskTypes || aiResult.riskTypes.length === 0) {
      return NextResponse.json({ error: 'La IA no pudo identificar tipos de riesgo en el documento. Verifique el formato.' }, { status: 400 })
    }

    // ── Step 3: Atomic DB insert via prisma.$transaction ─
    const created = await db.$transaction(async (tx) => {
      const results: Array<{
        id: string
        key: string
        label: string
        description: string | null
        checklistCount: number
      }> = []

      for (const risk of aiResult.riskTypes) {
        // Generate a safe key from label
        const key = generateSafeKey(risk.label)

        // Upsert: update if exists, create if new
        const riskType = await tx.riskTypeConfig.upsert({
          where: { companyId_key: { companyId, key } },
          update: {
            label: risk.label,
            description: risk.description || null,
            color: risk.color || '#6366f1',
            icon: risk.icon || 'AlertTriangle',
            isActive: true,
          },
          create: {
            companyId,
            key,
            label: risk.label,
            description: risk.description || null,
            color: risk.color || '#6366f1',
            icon: risk.icon || 'AlertTriangle',
            isActive: true,
            sortOrder: 0,
          },
        })

        let checklistCount = 0

        if (risk.checklist && risk.checklist.length > 0) {
          for (const item of risk.checklist) {
            const itemKey = generateSafeKey(item.label)
            await tx.checklistItemConfig.upsert({
              where: {
                companyId_riskTypeKey_itemKey: {
                  companyId,
                  riskTypeKey: key,
                  itemKey,
                },
              },
              update: {
                label: item.label,
                required: item.required ?? false,
                isActive: true,
              },
              create: {
                companyId,
                riskTypeKey: key,
                itemKey,
                label: item.label,
                required: item.required ?? false,
                isActive: true,
                sortOrder: 0,
              },
            })
            checklistCount++
          }
        }

        results.push({
          id: riskType.id,
          key,
          label: riskType.label,
          description: riskType.description,
          checklistCount,
        })
      }

      return results
    })

    // ── Audit Log ────────────────────────────────────────
    await createAuditLog({
      companyId,
      userId: session.userId,
      action: 'RISK_INGESTION_AI',
      entityType: 'RISK_TYPE_CONFIG',
      details: {
        fileName: file.name,
        fileSize: file.size,
        riskTypesCreated: created.length,
        totalChecklistItems: created.reduce((sum, r) => sum + r.checklistCount, 0),
        riskTypeKeys: created.map(r => r.key),
      },
    }, request)

    return NextResponse.json({
      success: true,
      message: `Se procesaron ${created.length} tipo(s) de riesgo con IA — ${aiResult.riskTypes.reduce((sum, r) => sum + (r.checklist?.length || 0), 0)} ítems de checklist extraídos`,
      riskTypes: created,
      extraction: {
        documentTitle: aiResult.documentTitle,
        documentType: aiResult.documentType,
        summary: aiResult.summary,
        generalInfo: aiResult.generalInfo,
        accessTypes: aiResult.accessTypes,
        eppRequired: aiResult.eppRequired,
        rawSections: aiResult.rawSections,
        totalChecklistItems: aiResult.riskTypes.reduce((sum, r) => sum + (r.checklist?.length || 0), 0),
        riskTypesDetail: aiResult.riskTypes,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    console.error('[RiskIngestion]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Extract text from PDF using VLM (Vision Language Model)
// Supports both z-ai-web-dev-sdk and OpenAI-compatible API
// ═══════════════════════════════════════════════════════════
async function extractTextFromPdf(file: File, zai: any): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const dataUrl = `data:application/pdf;base64,${base64}`

  const ocrPrompt = `Eres un asistente especializado en HSE (Health, Safety & Environment) y permisos de trabajo petroleros.

Analiza este documento (planilla de riesgo, ATS, ART o formato similar) y EXTRAE TODO el texto legible.
Preserva la estructura: títulos, tablas, listas de verificación, nombres de secciones.

Devuelve ÚNICAMENTE el texto extraído, sin comentarios ni explicaciones adicionales.
Si hay tablas, preserva los encabezados y filas.`

  if (zai.type === 'openai') {
    // OpenAI-compatible fallback (GPT-4o Vision)
    const response = await fetch(`${zai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zai.apiKey}`,
      },
      body: JSON.stringify({
        model: zai.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI Vision error: ${response.status} — ${err}`)
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  // Native z-ai-web-dev-sdk
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ocrPrompt },
          { type: 'file_url', file_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  return response.choices[0]?.message?.content || ''
}

// ═══════════════════════════════════════════════════════════
// HELPER: Extract text from Excel/CSV using xlsx library
// V2: Raw cell-by-cell extraction — captures EVERY non-empty cell.
// No filtering, no skipping — the AI decides what's relevant.
// Preserves row numbers so the AI can see exact document structure.
// ═══════════════════════════════════════════════════════════
async function extractTextFromExcel(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const allText: string[] = []
  let totalCells = 0
  let totalRowsWithData = 0

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

    allText.push(`=== HOJA: ${sheetName} ===`)
    allText.push(`Dimensiones: ${range.e.r - range.s.r + 1} filas x ${range.e.c - range.s.c + 1} columnas`)
    allText.push('---')

    let sheetCells = 0
    let sheetRowsWithData = 0

    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowCells: Array<{ col: number; val: string }> = []

      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[addr]
        if (cell && cell.v !== undefined && cell.v !== null) {
          // Convert any cell value to string
          let val: string
          if (cell.t === 'n') {
            // Number cell — format it, but check if it's a date serial
            if (cell.z && cell.z.toLowerCase().includes('d') && cell.v > 40000 && cell.v < 60000) {
              // Likely an Excel date serial — skip it
              continue
            }
            // Keep the number as-is (could be a checklist item number, quantity, etc.)
            val = String(cell.v)
          } else {
            val = String(cell.v).trim()
          }

          if (val === '') continue

          rowCells.push({ col: c, val })
          sheetCells++
          totalCells++
        }
      }

      if (rowCells.length === 0) continue
      sheetRowsWithData++
      totalRowsWithData++

      // Format row with line number for AI reference
      const rowNum = r - range.s.r + 1
      const cellTexts = rowCells.map(c => `[Col${c.col + 1}] ${c.val}`)
      allText.push(`Fila ${rowNum}: ${cellTexts.join(' | ')}`)
    }

    allText.push(`--- Fin hoja ${sheetName}: ${sheetCells} celdas en ${sheetRowsWithData} filas ---`)
  }

  console.log(`[RiskIngestion] Excel extraction: ${totalCells} celdas en ${totalRowsWithData} filas`)
  return allText.join('\n')
}

// ═══════════════════════════════════════════════════════════
// HELPER: LLM maps extracted text → structured risk types
// ═══════════════════════════════════════════════════════════
interface AiChecklistItem {
  label: string
  required?: boolean
  category?: string // e.g., "EPP", "PROCEDIMIENTO", "DOCUMENTACIÓN", "EQUIPO", "SEÑALIZACIÓN"
}

interface AiRiskType {
  label: string
  description?: string
  color?: string
  icon?: string
  checklist?: AiChecklistItem[]
}

interface AiExtractionResult {
  documentTitle: string
  documentType: string
  summary: string
  generalInfo: {
    proceso?: string
    version?: string
    empresaEjecutadora?: string
    actividad?: string
  }
  accessTypes?: string[]
  eppRequired?: string[]
  rawSections?: Array<{ sectionName: string; items: string[] }> // FLAT extraction of ALL sections
  riskTypes: AiRiskType[]
}

async function mapTextToRiskTypes(rawText: string, zai: any): Promise<AiExtractionResult> {
  const systemPrompt = `Eres un extractor de datos EXHAUSTIVO para documentos HSE (Health, Safety & Environment) del sector petrolero e industrial.

TU ÚNICA MISIÓN: Extraer CADA UNA de las filas con contenido del documento. NO puedes omitir, agrupar, resumir ni combinar NINGÚN item.

═══ REGLAS ABSOLUTAS (CERO EXCEPCIONES) ═══
1. CUENTA las filas del documento. Si el documento tiene 44 ítems, DEBES devolver 44 ítems exactamente.
2. NUNCA digas "ítems similares" o "entre otros" — lista CADA UNO por separado.
3. NUNCA combines dos filas del documento en un solo ítem JSON.
4. Mantén el texto EXACTO del documento (no parafrasees, no acortes).
5. Si un ítem parece repetido o similar a otro, inclúyelo de todas formas.
6. Si una sección tiene sub-ítems (a, b, c), inclúyelos TODOS como ítems separados.

═══ PASO 1: EXTRAER SECCIONES CRUDAS ═══
Primero, identifica TODAS las secciones del documento (cada título en mayúsculas o encabezado).
Luego, por cada sección, extrae CADA fila con contenido como un ítem individual.

Ejemplo de documento con 2 secciones:
Sección A: "REQUISITOS DE PLANEACIÓN" → 22 ítems → extraer los 22
Sección B: "EPP Y EQUIPO DE PROTECCIÓN" → 22 ítems → extraer los 22
Total: 44 ítems. NO 26. NO 30. EXACTAMENTE 44.

═══ PASO 2: GENERAR LISTA DE VERIFICACIÓN ═══
Cada ítem extraído del documento DEBE aparecer en la lista de verificación (checklist).
Asigna cada ítem a la sección/riesgo más relevante.
Si un ítem no encaja en ningún riesgo específico, créalo bajo "GENERAL" o "REQUISITOS GENERALES".

═══ CATEGORÍAS para cada ítem ═══
- "EPP" = Elementos de protección personal
- "DOCUMENTACIÓN" = Certificados, cursos, ARL, permisos
- "PROCEDIMIENTO" = Pasos, protocolos, análisis de trabajo
- "EQUIPO" = Herramientas, sistemas, dispositivos
- "SEÑALIZACIÓN" = Delimitación, avisos, cintas
- "CAPACITACIÓN" = Cursos, charlas, inducciones
- "EMERGENCIA" = Plan de rescate, comunicación, primeros auxilios
- "VERIFICACIÓN" = Inspecciones previas, checks de condición

═══ JSON DE RESPUESTA (sin markdown, sin backticks) ═══
{
  "documentTitle": "Título exacto del documento",
  "documentType": "PERMISO DE TRABAJO | ATS | CERTIFICADO | OTRO",
  "summary": "Resumen de 2-3 oraciones",
  "generalInfo": {
    "proceso": "Nombre del proceso",
    "version": "Versión si aparece",
    "empresaEjecutadora": "Empresa si aparece",
    "actividad": "Actividad principal"
  },
  "accessTypes": ["Tipo 1", "Tipo 2", ...],
  "eppRequired": ["EPP 1 texto completo", "EPP 2 texto completo", ...],
  "rawSections": [
    {
      "sectionName": "NOMBRE EXACTO DE LA SECCIÓN EN MAYÚSCULAS",
      "items": ["Ítem 1 texto completo", "Ítem 2 texto completo", ...]
    }
  ],
  "riskTypes": [
    {
      "label": "Nombre del Tipo de Riesgo o Sección",
      "description": "Descripción de lo que cubre esta sección",
      "color": "#hexcolor",
      "icon": "NombreIconoLucide",
      "checklist": [
        { "label": "Texto COMPLETO del ítem tal cual aparece en el documento", "required": true, "category": "DOCUMENTACIÓN" },
        { "label": "Texto COMPLETO del ítem tal cual aparece en el documento", "required": false, "category": "EPP" }
      ]
    }
  ]
}

═══ COLORES ═══
#ef4444 alto | #f59e0b eléctrico | #8b5cf6 confinado | #dc2626 caliente
#0ea5e9 izamiento | #22c55e general | #6366f1 defecto | #f97316 altura

═══ ICONOS LUCIDE ═══
ArrowUp, Zap, Box, Flame, Pickaxe, Crane, ScanLine, Droplets, Lock, FlaskConical, AlertTriangle, HardHat, Shield, Eye, ClipboardCheck

═══ VERIFICACIÓN FINAL ═══
Antes de responder, cuenta:
- Total de ítems en rawSections: debe ser IGUAL al total de filas con contenido del documento
- Total de ítems en riskTypes[].checklist: debe ser IGUAL al total de filas con contenido del documento
Si no coinciden, revisa y agrega los ítems faltantes.

REGLA DE ORO: Es mejor devolver 50 ítems que 44. Es PREFERIBLE incluir un ítem de más que omitir uno.
NUNCA devuelvas menos ítems de los que tiene el documento.`

  let content: string

  if (zai.type === 'openai') {
    // OpenAI-compatible fallback — use larger context for complex documents
    const response = await fetch(`${zai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zai.apiKey}`,
      },
      body: JSON.stringify({
        model: zai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analiza el siguiente contenido extraído de una planilla de permisos de trabajo / formato de seguridad industrial.

EXTRAE DE FORMA EXHAUSTIVA toda la información del documento. No omitas ningún ítem, EPP, requisito ni sección.

Contenido del documento:
${rawText}`,
          },
        ],
        max_tokens: 16384,
        temperature: 0.05,
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI LLM error: ${response.status} — ${err}`)
    }
    const data = await response.json()
    content = data.choices?.[0]?.message?.content || ''
    // Log token usage for monitoring
    const usage = data.usage
    if (usage) {
      console.log(`[RiskIngestion] OpenAI tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`)
    }
    // Check if response was truncated
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.warn('[RiskIngestion] ⚠️ AI response was TRUNCATED (hit max_tokens). Some items may be missing. Consider increasing max_tokens.')
    }
  } else {
    // Native z-ai-web-dev-sdk
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: `Analiza el siguiente contenido extraído de una planilla de permisos de trabajo / formato de seguridad industrial.

EXTRAE DE FORMA EXHAUSTIVA toda la información del documento. No omitas ningún ítem, EPP, requisito ni sección.
Cada fila del documento DEBE convertirse en un ítem de checklist.

Contenido del documento:
${rawText}`,
        },
      ],
      thinking: { type: 'disabled' },
    })
    content = response.choices[0]?.message?.content || ''
  }

  // ═══ LOG: Extraction statistics ═══
  console.log(`[RiskIngestion] Raw text length: ${rawText.length} chars`)

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  try {
    const parsed = JSON.parse(jsonStr) as AiExtractionResult
    if (!parsed.riskTypes || !Array.isArray(parsed.riskTypes)) {
      parsed.riskTypes = []
    }
    // Ensure required fields have defaults
    parsed.documentTitle = parsed.documentTitle || 'Documento sin título'
    parsed.documentType = parsed.documentType || 'NO IDENTIFICADO'
    parsed.summary = parsed.summary || ''
    parsed.eppRequired = parsed.eppRequired || []
    parsed.accessTypes = parsed.accessTypes || []
    parsed.generalInfo = parsed.generalInfo || {}
    parsed.rawSections = parsed.rawSections || []

    // ═══ LOG: Detailed extraction statistics ═══
    const rawSectionItems = parsed.rawSections.reduce((sum, s) => sum + s.items.length, 0)
    const checklistItems = parsed.riskTypes.reduce((sum, r) => sum + (r.checklist?.length || 0), 0)
    console.log(`[RiskIngestion] Extraction stats:`)
    console.log(`  - rawSections: ${parsed.rawSections.length} secciones, ${rawSectionItems} ítems totales`)
    console.log(`  - riskTypes: ${parsed.riskTypes.length} tipos`)
    console.log(`  - checklist items: ${checklistItems} ítems`)
    console.log(`  - eppRequired: ${parsed.eppRequired.length} ítems`)
    console.log(`  - accessTypes: ${parsed.accessTypes.length} tipos`)
    if (rawSectionItems !== checklistItems && checklistItems > 0) {
      console.warn(`[RiskIngestion] ⚠️ MISMATCH: rawSections has ${rawSectionItems} items but checklist has ${checklistItems} items. ${Math.abs(rawSectionItems - checklistItems)} items were lost in categorization!`)
    }

    return parsed
  } catch (parseErr) {
    console.error('[RiskIngestion] Failed to parse AI JSON:', parseErr)
    console.error('[RiskIngestion] Raw AI content (first 1000 chars):', content.substring(0, 1000))
    console.error('[RiskIngestion] Raw AI content (last 500 chars):', content.substring(content.length - 500))
    console.error('[RiskIngestion] Raw text sent to AI (chars):', rawText.length)
    return {
      documentTitle: 'Error en extracción',
      documentType: 'ERROR',
      summary: 'No se pudo interpretar la respuesta de la IA.',
      generalInfo: {},
      eppRequired: [],
      accessTypes: [],
      riskTypes: [],
    }
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Generate a URL-safe key from a label
// ═══════════════════════════════════════════════════════════
function generateSafeKey(label: string): string {
  return label
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'CUSTOM_RISK'
}
