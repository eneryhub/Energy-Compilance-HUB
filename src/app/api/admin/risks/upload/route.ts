import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import ZAI from 'z-ai-web-dev-sdk'
import * as XLSX from 'xlsx'

// ──────────────────────────────────────────────────────────────
// POST /api/admin/risks/upload
// Smart Sheet Ingestion: Upload PDF/Excel → AI extracts risk
// types + checklist items → atomic DB insert.
//
// Security: companyId from session ONLY (never from client body).
// Multi-tenant: all records scoped to session.companyId.
// Transactional: prisma.$transaction ensures no orphans.
// ──────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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
      rawText = await extractTextFromPdf(file)
    } else {
      // Excel/CSV → xlsx library
      rawText = await extractTextFromExcel(file)
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({ error: 'No se pudo extraer suficiente texto del documento. Verifique que el archivo contenga datos legibles.' }, { status: 400 })
    }

    // ── Step 2: LLM maps raw text → structured risk data ─
    const aiResult = await mapTextToRiskTypes(rawText)

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
      message: `Se procesaron ${created.length} tipo(s) de riesgo con IA`,
      riskTypes: created,
      rawExtraction: aiResult,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    console.error('[RiskIngestion]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Extract text from PDF using VLM (Vision Language Model)
// ═══════════════════════════════════════════════════════════
async function extractTextFromPdf(file: File): Promise<string> {
  const zai = await ZAI.create()

  // Convert File to base64 for VLM
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const dataUrl = `data:application/pdf;base64,${base64}`

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Eres un asistente especializado en HSE (Health, Safety & Environment) y permisos de trabajo petroleros.

Analiza este documento (planilla de riesgo, ATS, ART o formato similar) y EXTRAE TODO el texto legible.
Preserva la estructura: títulos, tablas, listas de verificación, nombres de secciones.

Devuelve ÚNICAMENTE el texto extraído, sin comentarios ni explicaciones adicionales.
Si hay tablas, preserva los encabezados y filas.`
              },
          {
            type: 'file_url',
            file_url: { url: dataUrl },
          },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  return response.choices[0]?.message?.content || ''
}

// ═══════════════════════════════════════════════════════════
// HELPER: Extract text from Excel/CSV using xlsx library
// ═══════════════════════════════════════════════════════════
async function extractTextFromExcel(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const allText: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    allText.push(`--- Hoja: ${sheetName} ---`)
    for (const row of data) {
      const cells = Object.values(row)
        .map(v => String(v).trim())
        .filter(v => v.length > 0)
        .join(' | ')
      if (cells.length > 0) {
        allText.push(cells)
      }
    }
  }

  return allText.join('\n')
}

// ═══════════════════════════════════════════════════════════
// HELPER: LLM maps extracted text → structured risk types
// ═══════════════════════════════════════════════════════════
interface AiRiskType {
  label: string
  description?: string
  color?: string
  icon?: string
  checklist?: Array<{
    label: string
    required?: boolean
  }>
}

interface AiExtractionResult {
  riskTypes: AiRiskType[]
}

async function mapTextToRiskTypes(rawText: string): Promise<AiExtractionResult> {
  const zai = await ZAI.create()

  const systemPrompt = `Eres un experto en HSE (Health, Safety & Environment) del sector petrolero venezolano.
Tu trabajo es analizar planillas de permisos de trabajo y extraer TIPOS DE RIESGO con sus LISTAS DE VERIFICACIÓN.

TIPOS DE RIESGO COMUNES en el sector petrolero:
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

Responde SIEMPRE en JSON válido con esta estructura EXACTA (sin markdown, sin backticks):
{
  "riskTypes": [
    {
      "label": "Nombre del Tipo de Riesgo",
      "description": "Breve descripción de 1-2 oraciones sobre este tipo de riesgo",
      "color": "#hexcolor",
      "icon": "NombreIconoLucide",
      "checklist": [
        { "label": "Ítem de verificación 1", "required": true },
        { "label": "Ítem de verificación 2", "required": false }
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

ICONOS sugeridos (nombre de Lucide icon):
- ArrowUp, Zap, Box, Flame, Pickaxe, Crane, ScanLine, Droplets, Lock, FlaskConical, AlertTriangle

Reglas:
- "required": true para ítems de seguridad CRÍTICOS (EPP, lifesaving)
- "required": false para ítems de buena práctica
- Mínimo 2 ítems de checklist por tipo de riesgo
- Si el documento no tiene checklist, genera los ítems de verificación estándar HSE para ese tipo de riesgo
- Si no puedes identificar ningún tipo de riesgo, devuelve { "riskTypes": [] }`

  const response = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      {
        role: 'user',
        content: `Analiza el siguiente contenido extraído de una planilla de permisos de trabajo y extrae los tipos de riesgo con sus listas de verificación:\n\n${rawText}`,
      },
    ],
    thinking: { type: 'disabled' },
  })

  const content = response.choices[0]?.message?.content || ''

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  try {
    const parsed = JSON.parse(jsonStr) as AiExtractionResult
    if (!parsed.riskTypes || !Array.isArray(parsed.riskTypes)) {
      return { riskTypes: [] }
    }
    return parsed
  } catch {
    return { riskTypes: [] }
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
