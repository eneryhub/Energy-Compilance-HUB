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
// Uses raw cell-by-cell extraction to capture EVERY cell (including
// headers, merged cells, and sparse rows that sheet_to_json skips)
// ═══════════════════════════════════════════════════════════
async function extractTextFromExcel(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const allText: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

    allText.push(`=== HOJA: ${sheetName} ===`)
    allText.push(`Rango: ${range.e.r - range.s.r + 1} filas x ${range.e.c - range.s.c + 1} columnas`)
    allText.push('---')

    // Section tracking
    let currentSection = 'GENERAL'

    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowCells: string[] = []

      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[addr]
        if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
          const val = String(cell.v).trim()
          // Skip pure numbers that are Excel date serials
          if (/^\d{4,5}$/.test(val) && c > 3) continue
          rowCells.push(val)
        }
      }

      if (rowCells.length === 0) continue

      const line = rowCells.join(' | ')

      // Detect section headers (ALL CAPS or short bold-like lines)
      const firstCell = rowCells[0].toUpperCase().trim()
      if (
        firstCell === firstCell && // already uppercase
        firstCell.length > 4 &&
        firstCell.length < 80 &&
        !firstCell.includes('MARQUE') &&
        !firstCell.includes('NOMBRE') &&
        !firstCell.includes('COMO') &&
        !firstCell.includes('FIRMA') &&
        !firstCell.includes('PERSONAL') &&
        !firstCell.includes('LOS ') &&
        !firstCell.includes('EL ') &&
        !firstCell.includes('LA ') &&
        !firstCell.includes('SE ') &&
        !firstCell.includes('EN CASO')
      ) {
        currentSection = firstCell
        allText.push(`\n[SECCIÓN: ${firstCell}]`)
      }

      allText.push(line)
    }
  }

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
  documentType: string // e.g., "PERMISO DE TRABAJO EN ALTURAS", "ATS", "ANÁLISIS DE TRABAJO SEGURO"
  summary: string // Brief paragraph summarizing the document
  generalInfo: {
    proceso?: string
    version?: string
    empresaEjecutadora?: string
    actividad?: string
  }
  accessTypes?: string[] // e.g., ["ESCALERA PORTÁTIL", "ANDAMIOS", "MANLIFT"]
  eppRequired?: string[] // All EPP items extracted
  riskTypes: AiRiskType[]
}

async function mapTextToRiskTypes(rawText: string, zai: any): Promise<AiExtractionResult> {
  const systemPrompt = `Eres un experto en HSE (Health, Safety & Environment) del sector petrolero e industrial venezolano y latinoamericano.

Tu trabajo es analizar planillas de permisos de trabajo, ATS, certificados de apoyo y formatos de seguridad industrial, y extraer de forma EXHAUSTIVA y COMPLETA:

1. **Título y tipo de documento** (permiso de trabajo, ATS, certificado, etc.)
2. **Información general** del documento (proceso, versión, empresa, actividad)
3. **Todos los tipos de acceso** mencionados (escalera, andamios, manlift, cuerdas, grúa, etc.)
4. **TODOS los EPP y equipos de protección** listados (sin omitir ninguno)
5. **TIPOS DE RIESGO** identificados en el documento, cada uno con su **LISTA DE VERIFICACIÓN COMPLETA**

REGLAS CRÍTICAS DE EXTRACCIÓN:
- EXTRAER TODOS los ítems de cada sección — NO resumir ni agrupar
- Si el documento tiene 20 ítems de EPP, extraer los 20
- Si hay 15 requisitos de planeación, extraer los 15
- Si hay 8 tipos de acceso, listar los 8
- Mantener el texto original de cada ítem (no parafrasear)
- Clasificar cada ítem de checklist en una categoría: "EPP", "DOCUMENTACIÓN", "PROCEDIMIENTO", "EQUIPO", "SEÑALIZACIÓN", "CAPACITACIÓN", "EMERGENCIA", "VERIFICACIÓN"

TIPOS DE RIESGO COMUNES en el sector:
- Trabajo en Altura
- Riesgo Eléctrico
- Espacio Confinado
- Trabajo en Caliente
- Excavación
- Izamiento / Montaje
- Radiografía Industrial
- Trabajo en Superficies Mojadas
- Bloqueo y Etiquetado (Lockout/Tagout)
- Manejo de Sustancias Peligrosas

Para cada TIPO DE RIESGO, generar una lista de verificación que incluya:
- Todos los ítems de EPP específicos para ese riesgo
- Todos los requisitos de documentación (certificados, ARL, cursos)
- Todos los requisitos de procedimiento (análisis de trabajo, señalización, rescate)
- Todos los requisitos de verificación previa al trabajo

Responde SIEMPRE en JSON válido con esta estructura EXACTA (sin markdown, sin backticks):
{
  "documentTitle": "Título del documento",
  "documentType": "PERMISO DE TRABAJO | ATS | CERTIFICADO | OTRO",
  "summary": "Resumen de 2-3 oraciones describiendo el propósito y alcance del documento",
  "generalInfo": {
    "proceso": "Nombre del proceso",
    "version": "Versión si aparece",
    "empresaEjecutadora": "Empresa mencionada si aparece",
    "actividad": "Actividad principal descrita"
  },
  "accessTypes": ["Tipo 1", "Tipo 2"],
  "eppRequired": ["EPP 1 completo", "EPP 2 completo"],
  "riskTypes": [
    {
      "label": "Nombre del Tipo de Riesgo",
      "description": "Descripción detallada de 2-3 oraciones sobre este tipo de riesgo según el documento",
      "color": "#hexcolor",
      "icon": "NombreIconoLucide",
      "checklist": [
        { "label": "Ítem de verificación 1 (texto completo del documento)", "required": true, "category": "DOCUMENTACIÓN" },
        { "label": "Ítem de verificación 2 (texto completo del documento)", "required": false, "category": "PROCEDIMIENTO" }
      ]
    }
  ]
}

COLORES sugeridos (usa hex):
- #ef4444 (rojo) para riesgos altos
- #f59e0b (ámbar) para riesgos eléctricos
- #8b5cf6 (violeta) para espacios confinados
- #dc2626 (rojo oscuro) para trabajo en caliente
- #0ea5e9 (azul) para izamiento
- #22c55e (verde) para General
- #6366f1 (indigo) por defecto
- #f97316 (naranja) para trabajo en altura

ICONOS sugeridos (nombre de Lucide icon):
- ArrowUp, Zap, Box, Flame, Pickaxe, Crane, ScanLine, Droplets, Lock, FlaskConical, AlertTriangle, HardHat, Shield, Eye

CATEGORÍAS de checklist:
- "EPP" = Elementos de protección personal
- "DOCUMENTACIÓN" = Certificados, cursos, ARL, permisos
- "PROCEDIMIENTO" = Pasos, protocolos, análisis de trabajo
- "EQUIPO" = Herramientas, sistemas, dispositivos
- "SEÑALIZACIÓN" = Delimitación, avisos, cintas
- "CAPACITACIÓN" = Cursos, charlas, inducciones
- "EMERGENCIA" = Plan de rescate, comunicación, primeros auxilios
- "VERIFICACIÓN" = Inspecciones previas, checklist de condición

Reglas para "required":
- "required": true para ítems de seguridad CRÍTICOS (EPP lifesaving, certificados obligatorios, análisis de trabajo, plan de rescate)
- "required": false para ítems de buena práctica o referencia
- Mínimo 5 ítems de checklist por tipo de riesgo (EXTRAER TODOS los que aparezcan en el documento)
- Si no puedes identificar ningún tipo de riesgo, devuelve { "riskTypes": [] }`

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
        max_tokens: 8192,
        temperature: 0.05,
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI LLM error: ${response.status} — ${err}`)
    }
    const data = await response.json()
    content = data.choices?.[0]?.message?.content || ''
  } else {
    // Native z-ai-web-dev-sdk
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: `Analiza el siguiente contenido extraído de una planilla de permisos de trabajo / formato de seguridad industrial.

EXTRAE DE FORMA EXHAUSTIVA toda la información del documento. No omitas ningún ítem, EPP, requisito ni sección.

Contenido del documento:
${rawText}`,
        },
      ],
      thinking: { type: 'disabled' },
    })
    content = response.choices[0]?.message?.content || ''
  }

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
    return parsed
  } catch (parseErr) {
    console.error('[RiskIngestion] Failed to parse AI JSON:', parseErr)
    console.error('[RiskIngestion] Raw content:', content.substring(0, 500))
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
