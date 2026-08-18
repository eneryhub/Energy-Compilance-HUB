import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

// ── Location defaults ────────────────────────────────────
const DEFAULT_RADIUS = 100
const DEFAULT_VERIFICATION = 'GPS'
const VALID_VERIFICATION_METHODS = ['GPS', 'QR_CODE', 'BEACON']
const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR', 'MANAGER']
const MAX_LOCATIONS = 200

interface RowError {
  row: number
  message: string
}

interface ParsedRow {
  name: string
  address?: string
  latitude: number
  longitude: number
  radiusMeters: number
  verificationMethod: string
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
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol ADMIN, SUPERVISOR o MANAGER.' }, { status: 403 })
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

    if (rows.length > MAX_LOCATIONS) {
      return NextResponse.json({ error: `Máximo ${MAX_LOCATIONS} filas permitidas. Su archivo tiene ${rows.length}.` }, { status: 400 })
    }

    // ── Normalize headers ───────────────────────────────────
    const headers = Object.keys(rows[0])
    const headerMap = normalizeHeaders(headers)

    // ── Pre-load existing locations ─────────────────────────
    const existingLocations = await db.workLocation.findMany({
      where: { companyId },
      select: { id: true, name: true },
    })
    const existingMap = new Map(existingLocations.map((l) => [l.name.toLowerCase(), l.id]))

    // ── Validate and prepare rows ───────────────────────────
    const validRows: ParsedRow[] = []
    const errors: RowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // 1-indexed, header is row 1
      const row = rows[i]

      // Extract name (required)
      const name = extractField(row, headerMap, 'name', 'nombre', 'location', 'ubicacion', 'locacion', 'sitio', 'site')
      if (!name) {
        errors.push({ row: rowNum, message: 'Campo "name" (nombre) es obligatorio.' })
        continue
      }

      // Extract latitude (required)
      const rawLat = extractField(row, headerMap, 'latitude', 'lat', 'latitud')
      if (!rawLat) {
        errors.push({ row: rowNum, message: `Fila "${name}": Campo "latitude" (latitud) es obligatorio.` })
        continue
      }
      const latitude = parseFloat(rawLat)
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        errors.push({ row: rowNum, message: `Fila "${name}": Latitud inválida (${rawLat}). Debe estar entre -90 y 90.` })
        continue
      }

      // Extract longitude (required)
      const rawLng = extractField(row, headerMap, 'longitude', 'lng', 'lon', 'longitud')
      if (!rawLng) {
        errors.push({ row: rowNum, message: `Fila "${name}": Campo "longitude" (longitud) es obligatorio.` })
        continue
      }
      const longitude = parseFloat(rawLng)
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        errors.push({ row: rowNum, message: `Fila "${name}": Longitud inválida (${rawLng}). Debe estar entre -180 y 180.` })
        continue
      }

      // Extract optional address
      const address = extractField(row, headerMap, 'address', 'direccion', 'dir')

      // Extract optional radius
      const rawRadius = extractField(row, headerMap, 'radiusmeters', 'radius', 'radio', 'radiometers')
      let radiusMeters = DEFAULT_RADIUS
      if (rawRadius) {
        const parsed = parseInt(rawRadius)
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 10000) {
          radiusMeters = parsed
        } else {
          errors.push({ row: rowNum, message: `Fila "${name}": Radio inválido (${rawRadius}). Debe estar entre 10 y 10000 metros.` })
          continue
        }
      }

      // Extract optional verification method
      const rawMethod = extractField(row, headerMap, 'verificationmethod', 'verification', 'method', 'metodo', 'verificacion')
      let verificationMethod = DEFAULT_VERIFICATION
      if (rawMethod) {
        const upper = rawMethod.toUpperCase().trim()
        if (VALID_VERIFICATION_METHODS.includes(upper)) {
          verificationMethod = upper
        } else {
          errors.push({ row: rowNum, message: `Fila "${name}": Método de verificación "${rawMethod}" no válido. Use: GPS, QR_CODE, BEACON.` })
          continue
        }
      }

      validRows.push({
        name,
        address,
        latitude,
        longitude,
        radiusMeters,
        verificationMethod,
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

    // ── Upsert locations ───────────────────────────────────
    let created = 0
    let updated = 0
    const upsertErrors: RowError[] = []

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const rowNum = i + 2
      const existingId = existingMap.get(row.name.toLowerCase())

      try {
        if (existingId) {
          // ── Update existing location ─────────────────────
          await db.workLocation.update({
            where: { id: existingId },
            data: {
              address: row.address || null,
              latitude: row.latitude,
              longitude: row.longitude,
              radiusMeters: row.radiusMeters,
              verificationMethod: row.verificationMethod,
            },
          })
          updated++
        } else {
          // ── Create new location ──────────────────────────
          await db.workLocation.create({
            data: {
              companyId,
              name: row.name,
              address: row.address || null,
              latitude: row.latitude,
              longitude: row.longitude,
              radiusMeters: row.radiusMeters,
              verificationMethod: row.verificationMethod,
            },
          })
          created++
          // Track newly created for potential duplicate detection within batch
          existingMap.set(row.name.toLowerCase(), '__new__')
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
    console.error('[Import Locations] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la importación.' },
      { status: 500 }
    )
  }
}
