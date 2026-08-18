import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

// ── Sensor profiles: defaults per type ──────────────────────
const SENSOR_PROFILES: Record<string, { unit: string; thresholdCritical: number; thresholdWarning: number }> = {
  PRESION:     { unit: 'psi',  thresholdCritical: 100, thresholdWarning: 80 },
  TEMPERATURA: { unit: '°C',   thresholdCritical: 90,  thresholdWarning: 78 },
  GAS:         { unit: '%LEL', thresholdCritical: 5.0, thresholdWarning: 3.5 },
  VOLTAJE:     { unit: 'V',    thresholdCritical: 250, thresholdWarning: 240 },
}

const VALID_TYPES = Object.keys(SENSOR_PROFILES)
const ALLOWED_ROLES = ['ADMIN']

interface RowError {
  row: number
  message: string
}

interface ParsedRow {
  name: string
  type: string
  location?: string
  unit?: string
  thresholdCritical?: number
  thresholdWarning?: number
}

function normalizeHeaders(headers: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of headers) {
    const key = h.trim().toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '')
    map.set(key, h)
  }
  return map
}

function extractField(row: Record<string, any>, headerMap: Map<string, string>, ...aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const normalized = alias.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '')
    const originalKey = headerMap.get(normalized)
    if (originalKey && row[originalKey] !== undefined && row[originalKey] !== null && String(row[originalKey]).trim() !== '') {
      return String(row[originalKey]).trim()
    }
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Acceso denegado. Solo ADMIN puede importar sensores.' }, { status: 403 })
    }

    const companyId = payload.companyId

    // ── Parse multipart form data ───────────────────────────
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo.' }, { status: 400 })
    }

    const validExtensions = ['.csv', '.xlsx', '.xls']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Formato de archivo no soportado. Use CSV o XLSX.' }, { status: 400 })
    }

    // ── Read file buffer ────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── Parse file (XLSX for both xlsx and csv) ─────────────
    let rows: Record<string, any>[]
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        return NextResponse.json({ error: 'El archivo está vacío o no tiene hojas.' }, { status: 400 })
      }
      const sheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    } catch {
      return NextResponse.json({ error: 'Error al parsear el archivo. Verifique que sea un CSV/XLSX válido.' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo no contiene filas de datos.' }, { status: 400 })
    }

    // ── Normalize headers ───────────────────────────────────
    const headers = Object.keys(rows[0])
    const headerMap = normalizeHeaders(headers)

    // ── Pre-load existing sensors and locations ─────────────
    const existingSensors = await db.sensor.findMany({
      where: { companyId },
      select: { id: true, name: true },
    })
    const existingSensorMap = new Map(existingSensors.map((s) => [s.name.toLowerCase(), s.id]))

    const locations = await db.workLocation.findMany({
      where: { companyId },
      select: { id: true, name: true },
    })
    const locationMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]))

    // ── Validate and prepare rows ───────────────────────────
    const validRows: ParsedRow[] = []
    const errors: RowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // 1-indexed, header is row 1
      const row = rows[i]

      // Extract name
      const name = extractField(row, headerMap, 'name', 'nombre', 'sensor', 'sensorname')
      if (!name) {
        errors.push({ row: rowNum, message: 'Campo "name" (nombre) es obligatorio.' })
        continue
      }

      // Extract type
      const rawType = extractField(row, headerMap, 'type', 'tipo')
      if (!rawType) {
        errors.push({ row: rowNum, message: `Fila "${name}": Campo "type" es obligatorio.` })
        continue
      }
      const type = rawType.toUpperCase().trim()
      if (!VALID_TYPES.includes(type)) {
        errors.push({ row: rowNum, message: `Fila "${name}": Tipo "${rawType}" no válido. Use: ${VALID_TYPES.join(', ')}.` })
        continue
      }

      // Extract optional location
      const location = extractField(row, headerMap, 'location', 'ubicacion', 'locacion', 'loc')

      // Validate location match
      if (location) {
        if (!locationMap.has(location.toLowerCase())) {
          errors.push({ row: rowNum, message: `Fila "${name}": Ubicación "${location}" no encontrada para esta empresa.` })
          continue
        }
      }

      // Extract optional unit
      const rawUnit = extractField(row, headerMap, 'unit', 'unidad')

      // Extract optional thresholds
      const rawCritical = extractField(row, headerMap, 'thresholdcritical', 'criticalthreshold', 'umbralcritico', 'critico', 'threshold_critical')
      const rawWarning = extractField(row, headerMap, 'thresholdwarning', 'warningthreshold', 'umbralwarning', 'warning', 'threshold_warning')

      const thresholdCritical = rawCritical ? parseFloat(rawCritical) : undefined
      const thresholdWarning = rawWarning ? parseFloat(rawWarning) : undefined

      if (rawCritical !== undefined && (isNaN(thresholdCritical!) || thresholdCritical! <= 0)) {
        errors.push({ row: rowNum, message: `Fila "${name}": thresholdCritical debe ser un número positivo.` })
        continue
      }
      if (rawWarning !== undefined && (isNaN(thresholdWarning!) || thresholdWarning! < 0)) {
        errors.push({ row: rowNum, message: `Fila "${name}": thresholdWarning debe ser un número >= 0.` })
        continue
      }

      validRows.push({
        name,
        type,
        location,
        unit: rawUnit || undefined,
        thresholdCritical,
        thresholdWarning,
      })
    }

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        errors,
      })
    }

    // ── Upsert sensors ──────────────────────────────────────
    let created = 0
    let updated = 0
    const upsertErrors: RowError[] = []

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const rowNum = i + 2
      const profile = SENSOR_PROFILES[row.type]

      const unit = row.unit || profile.unit
      const thresholdCritical = row.thresholdCritical || profile.thresholdCritical
      const thresholdWarning = row.thresholdWarning ?? profile.thresholdWarning
      const locationId = row.location ? locationMap.get(row.location.toLowerCase()) || null : null

      const existingId = existingSensorMap.get(row.name.toLowerCase())

      try {
        if (existingId) {
          // ── Update existing sensor ─────────────────────────
          await db.sensor.update({
            where: { id: existingId },
            data: {
              type: row.type,
              unit,
              thresholdCritical,
              thresholdWarning,
              locationId,
            },
          })
          updated++
        } else {
          // ── Create new sensor ──────────────────────────────
          await db.sensor.create({
            data: {
              companyId,
              name: row.name,
              type: row.type,
              unit,
              thresholdCritical,
              thresholdWarning,
              locationId,
              isSimulated: false,
              isActive: true,
            },
          })
          created++
          // Track newly created for potential duplicate detection within batch
          existingSensorMap.set(row.name.toLowerCase(), '__new__')
        }
      } catch (err: any) {
        upsertErrors.push({
          row: rowNum,
          message: `Error al guardar "${row.name}": ${err.message || 'Error desconocido'}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped: 0,
      errors: [...errors, ...upsertErrors],
    })
  } catch (err: any) {
    console.error('[Import Sensors] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la importación.' },
      { status: 500 }
    )
  }
}
