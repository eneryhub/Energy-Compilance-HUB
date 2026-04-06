import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// ============ Types ============

interface ParsedRiskType {
  rowNumber: number
  key: string
  label: string
  color: string
  icon: string
  description: string | null
  checklist: string[]
}

interface ImportResult {
  success: boolean
  created: number
  updated: number
  errors: string[]
  skipped: number
}

// ============ Helpers ============

const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR']

function normalizeKey(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function normalizeItemKey(raw: string, index: number): string {
  if (!raw || !raw.trim()) return `item_${index + 1}`
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

// Column name aliases for auto-mapping
const KEY_ALIASES = ['key', 'clave', 'tipo', 'type', 'codigo', 'risk_key', 'riskkey']
const LABEL_ALIASES = ['label', 'nombre', 'name', 'descripcion', 'titulo', 'title', 'risk_label', 'risklabel']
const COLOR_ALIASES = ['color', 'colour', 'hex', 'hex_color', 'hexcolor']
const ICON_ALIASES = ['icon', 'icono', 'icon_name', 'iconname']
const DESCRIPTION_ALIASES = ['description', 'descripción', 'desc', 'detalle', 'details']

function findColumnAlias(header: string, aliases: string[]): boolean {
  const normalized = header.toLowerCase().trim().replace(/[\s_-]+/g, '')
  return aliases.some((a) => normalized === a.replace(/[\s_-]+/g, ''))
}

function parseChecklistFromRow(
  row: Record<string, unknown>,
  headers: string[],
  columnMap: { checklistCol?: string; itemColumns: string[] }
): string[] {
  const items: string[] = []

  // Strategy 1: single column with semicolon-separated items
  if (columnMap.checklistCol) {
    const raw = String(row[columnMap.checklistCol] || '')
    if (raw.trim()) {
      raw.split(/[;\n|]/).forEach((s) => {
        const trimmed = s.trim()
        if (trimmed) items.push(trimmed)
      })
    }
  }

  // Strategy 2: item_1, item_2, item_3... columns
  columnMap.itemColumns.forEach((col) => {
    const val = String(row[col] || '').trim()
    if (val) items.push(val)
  })

  return items
}

function extractColumnMap(headers: string[]): {
  keyCol?: string
  labelCol?: string
  colorCol?: string
  iconCol?: string
  descCol?: string
  checklistCol?: string
  itemColumns: string[]
} {
  const map: {
    keyCol?: string
    labelCol?: string
    colorCol?: string
    iconCol?: string
    descCol?: string
    checklistCol?: string
    itemColumns: string[]
  } = { itemColumns: [] }

  headers.forEach((h) => {
    if (!map.keyCol && findColumnAlias(h, KEY_ALIASES)) map.keyCol = h
    else if (!map.labelCol && findColumnAlias(h, LABEL_ALIASES)) map.labelCol = h
    else if (!map.colorCol && findColumnAlias(h, COLOR_ALIASES)) map.colorCol = h
    else if (!map.iconCol && findColumnAlias(h, ICON_ALIASES)) map.iconCol = h
    else if (!map.descCol && findColumnAlias(h, DESCRIPTION_ALIASES)) map.descCol = h
    else if (!map.checklistCol && (h.toLowerCase().includes('checklist') || h.toLowerCase().includes('items') || h.toLowerCase().includes('checklist_items'))) {
      map.checklistCol = h
    }
    else if (/^item[_\-]?\d+$/i.test(h) || /^checklist[_\-]?\d+$/i.test(h)) {
      map.itemColumns.push(h)
    }
  })

  return map
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const payload = await getTokenPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos. Se requiere rol ADMIN o SUPERVISOR.' }, { status: 403 })
    }

    // Verify company exists
    const companyExists = await db.company.count({ where: { id: payload.companyId } })
    if (companyExists === 0) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 401 })
    }

    // Determine content type
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(request, payload)
    }

    // Default: JSON body
    return handleJsonImport(request, payload)
  } catch (error: unknown) {
    console.error('[POST /api/v1/import/permits]', error)
    const message = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============ File Upload Handler ============

async function handleFileUpload(request: NextRequest, payload: NonNullable<Awaited<ReturnType<typeof getTokenPayload>>>): Promise<NextResponse> {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
    return NextResponse.json({ error: 'Formato no soportado. Use CSV o Excel (.xlsx/.xls)' }, { status: 400 })
  }

  // Size limit: 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo excede el límite de 5MB' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'El archivo está vacío o no tiene hojas' }, { status: 400 })
    }

    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    })

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json({ error: 'El archivo no contiene datos' }, { status: 400 })
    }

    if (jsonData.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 filas permitidas por importación' }, { status: 400 })
    }

    const headers = Object.keys(jsonData[0])
    const columnMap = extractColumnMap(headers)

    // Validate required columns
    if (!columnMap.keyCol && !columnMap.labelCol) {
      return NextResponse.json({
        error: 'No se encontraron las columnas requeridas. Se necesita al menos "key" (o "Tipo") y "label" (o "Nombre").',
        detectedColumns: headers,
      }, { status: 400 })
    }

    // Parse rows
    const parsed: ParsedRiskType[] = []
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      const key = columnMap.keyCol ? normalizeKey(String(row[columnMap.keyCol] || '')) : ''
      const label = columnMap.labelCol ? String(row[columnMap.labelCol] || '').trim() : ''
      const color = columnMap.colorCol ? String(row[columnMap.colorCol] || '').trim() : '#6366f1'
      const icon = columnMap.iconCol ? String(row[columnMap.iconCol] || '').trim() : 'AlertTriangle'
      const description = columnMap.descCol ? String(row[columnMap.descCol] || '').trim() || null : null
      const checklist = parseChecklistFromRow(row, headers, columnMap)

      parsed.push({
        rowNumber: i + 2, // +2 because row 1 is header, +1 for 1-indexed
        key,
        label,
        color: isValidColor(color) ? color : '#6366f1',
        icon: icon || 'AlertTriangle',
        description,
        checklist,
      })
    }

    const result = await importRiskTypes(parsed, payload.companyId)

    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'IMPORT',
      entityType: 'RISK_TYPE',
      details: {
        source: 'file_upload',
        fileName: file.name,
        fileSize: file.size,
        created: result.created,
        updated: result.updated,
        errors: result.errors.length,
        skipped: result.skipped,
      },
    }, request)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('[File upload parse error]', error)
    const message = error instanceof Error ? error.message : 'Error al procesar el archivo'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ============ JSON Import Handler ============

async function handleJsonImport(request: NextRequest, payload: NonNullable<Awaited<ReturnType<typeof getTokenPayload>>>): Promise<NextResponse> {
  const body = await request.json()
  const { items } = body as { items?: Array<{
    key?: string
    label?: string
    color?: string
    icon?: string
    description?: string
    checklist?: string[]
  }> }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Se requiere un array "items" no vacío' }, { status: 400 })
  }

  if (items.length > 500) {
    return NextResponse.json({ error: 'Máximo 500 elementos permitidos por importación' }, { status: 400 })
  }

  const parsed: ParsedRiskType[] = items.map((item, i) => ({
    rowNumber: i + 1,
    key: normalizeKey(String(item.key || '')),
    label: String(item.label || '').trim(),
    color: isValidColor(item.color || '') ? item.color || '' : '#6366f1',
    icon: item.icon || 'AlertTriangle',
    description: item.description || null,
    checklist: Array.isArray(item.checklist) ? item.checklist.map(String) : [],
  }))

  const result = await importRiskTypes(parsed, payload.companyId)

  await createAuditLog({
    companyId: payload.companyId,
    userId: payload.userId,
    action: 'IMPORT',
    entityType: 'RISK_TYPE',
    details: {
      source: 'json_api',
      created: result.created,
      updated: result.updated,
      errors: result.errors.length,
      skipped: result.skipped,
    },
  }, request)

  return NextResponse.json(result)
}

// ============ Core Import Logic ============

async function importRiskTypes(
  parsed: ParsedRiskType[],
  companyId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    created: 0,
    updated: 0,
    errors: [],
    skipped: 0,
  }

  for (const item of parsed) {
    try {
      // Validate required fields
      if (!item.key) {
        result.errors.push(`Fila ${item.rowNumber}: La columna "key" está vacía`)
        result.skipped++
        continue
      }
      if (!item.label) {
        result.errors.push(`Fila ${item.rowNumber}: La columna "label" está vacía`)
        result.skipped++
        continue
      }

      // Check if risk type already exists for this company
      const existing = await db.riskTypeConfig.findUnique({
        where: {
          companyId_key: { companyId, key: item.key },
        },
        include: { checklist: true },
      })

      if (existing) {
        // UPDATE (upsert)
        await db.$transaction(async (tx) => {
          // Update risk type config
          await tx.riskTypeConfig.update({
            where: { id: existing.id },
            data: {
              label: item.label,
              color: item.color,
              icon: item.icon,
              description: item.description,
              isActive: true,
            },
          })

          // Delete old checklist items
          if (existing.checklist.length > 0) {
            await tx.checklistItemConfig.deleteMany({
              where: { companyId, riskTypeKey: item.key },
            })
          }

          // Create new checklist items
          if (item.checklist.length > 0) {
            for (let ci = 0; ci < item.checklist.length; ci++) {
              const clItem = item.checklist[ci]
              await tx.checklistItemConfig.create({
                data: {
                  companyId,
                  riskTypeKey: item.key,
                  itemKey: normalizeItemKey(clItem, ci),
                  label: clItem,
                  required: false,
                  sortOrder: ci,
                  isActive: true,
                },
              })
            }
          }
        })
        result.updated++
      } else {
        // CREATE
        await db.$transaction(async (tx) => {
          await tx.riskTypeConfig.create({
            data: {
              companyId,
              key: item.key,
              label: item.label,
              color: item.color,
              icon: item.icon,
              description: item.description,
              isActive: true,
            },
          })

          if (item.checklist.length > 0) {
            for (let ci = 0; ci < item.checklist.length; ci++) {
              const clItem = item.checklist[ci]
              await tx.checklistItemConfig.create({
                data: {
                  companyId,
                  riskTypeKey: item.key,
                  itemKey: normalizeItemKey(clItem, ci),
                  label: clItem,
                  required: false,
                  sortOrder: ci,
                  isActive: true,
                },
              })
            }
          }
        })
        result.created++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      result.errors.push(`Fila ${item.rowNumber} (${item.key || 'sin clave'}): ${message}`)
      result.skipped++
    }
  }

  return result
}

// ============ Utility ============

function isValidColor(color: string): boolean {
  if (!color || color.trim() === '') return false
  // Accept hex (#RRGGBB or #RGB) and named CSS colors (basic check)
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim())) return true
  // Named CSS colors - allow common ones
  const namedColors = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white',
    'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime', 'teal', 'navy', 'maroon',
    'olive', 'aqua', 'fuchsia', 'silver', 'emerald', 'amber', 'slate', 'rose',
    'indigo', 'violet', 'sky', 'stone', 'zinc', 'neutral',
  ]
  return namedColors.includes(color.trim().toLowerCase())
}
