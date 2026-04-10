import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSensorProfileDefaults, generateSimulatedValue, type SensorType } from '@/lib/scada/engine'
import { createAuditLog } from '@/lib/audit'
import { checkSubscription } from '@/lib/subscription-guard'

const VALID_SENSOR_TYPES: SensorType[] = ['PRESION', 'TEMPERATURA', 'GAS', 'VOLTAJE']
const MAX_ROWS = 500

/**
 * Parse a single CSV row respecting basic quoted fields.
 * If a field starts with '"', reads until the closing '"'.
 */
function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field: find closing quote
      let end = line.indexOf('"', i + 1)
      if (end === -1) end = line.length - 1
      fields.push(line.substring(i + 1, end))
      i = end + 1
      // Skip comma after closing quote
      if (i < line.length && line[i] === ',') i++
    } else {
      // Unquoted field: read until comma or end
      let end = line.indexOf(',', i)
      if (end === -1) end = line.length
      fields.push(line.substring(i, end).trim())
      i = end + 1
    }
  }
  return fields
}

// POST /api/sensors/bulk-import — Bulk import sensors from CSV
export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────
  const payload = await getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── Role check ───────────────────────────────────────
  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos: solo ADMIN puede importar sensores' }, { status: 403 })
  }

  // ── Subscription check ───────────────────────────────
  const subStatus = await checkSubscription(payload.companyId)
  if (subStatus.blockAccess) {
    return NextResponse.json(
      { error: `ACCESO BLOQUEADO: ${subStatus.message}`, code: 'SUBSCRIPTION_EXPIRED' },
      { status: 403 }
    )
  }

  // ── Read CSV body ────────────────────────────────────
  const raw = await req.text()
  if (!raw.trim()) {
    return NextResponse.json({ error: 'CSV vacío' }, { status: 400 })
  }

  // Remove BOM if present
  const csv = raw.replace(/^\uFEFF/, '')

  const lines = csv.split(/\r?\n/)
  // First line is header — skip it
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0)

  if (dataLines.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ROWS} filas por importación` },
      { status: 400 }
    )
  }

  // ── Validate all rows upfront ────────────────────────
  const errors: Array<{ row: number; name: string; error: string }> = []
  const validRows: Array<{
    name: string
    type: SensorType
    locationId: string | null
    unit: string | null
    thresholdCritical: number | null
    thresholdWarning: number | null
    isSimulated: boolean
  }> = []

  for (let idx = 0; idx < dataLines.length; idx++) {
    const rowNumber = idx + 2 // 1-indexed, offset by header
    const fields = parseCsvRow(dataLines[idx])

    const name = (fields[0] || '').trim()
    const type = (fields[1] || '').trim().toUpperCase() as SensorType
    const locationId = (fields[2] || '').trim() || null
    const unit = (fields[3] || '').trim() || null
    const thresholdCritical = fields[4] ? parseFloat(fields[4]) : null
    const thresholdWarning = fields[5] ? parseFloat(fields[5]) : null
    const isSimulated = fields[6] !== undefined
      ? fields[6].trim().toLowerCase() !== 'false'
      : true

    if (!name) {
      errors.push({ row: rowNumber, name: fields[0] || '(vacío)', error: 'Nombre es requerido' })
      continue
    }

    if (!type || !VALID_SENSOR_TYPES.includes(type)) {
      errors.push({
        row: rowNumber,
        name,
        error: `Tipo inválido: "${fields[1] || '(vacío)'}". Valores permitidos: ${VALID_SENSOR_TYPES.join(', ')}`,
      })
      continue
    }

    if (thresholdCritical !== null && isNaN(thresholdCritical)) {
      errors.push({ row: rowNumber, name, error: 'thresholdCritical debe ser un número' })
      continue
    }

    if (thresholdWarning !== null && isNaN(thresholdWarning)) {
      errors.push({ row: rowNumber, name, error: 'thresholdWarning debe ser un número' })
      continue
    }

    validRows.push({
      name,
      type,
      locationId,
      unit,
      thresholdCritical,
      thresholdWarning,
      isSimulated,
    })
  }

  if (validRows.length === 0) {
    return NextResponse.json({ imported: 0, errors })
  }

  // ── Pre-validate locationIds belong to company ───────
  const locationIdsToCheck = validRows
    .map((r) => r.locationId)
    .filter((id): id is string => id !== null)

  let validLocationIds: Set<string> = new Set()
  if (locationIdsToCheck.length > 0) {
    const existingLocations = await db.workLocation.findMany({
      where: { id: { in: locationIdsToCheck }, companyId: payload.companyId },
      select: { id: true },
    })
    validLocationIds = new Set(existingLocations.map((l) => l.id))
  }

  // Filter rows with invalid locationIds into errors
  const finalRows = validRows.filter((row) => {
    if (row.locationId && !validLocationIds.has(row.locationId)) {
      errors.push({
        row: 0, // row number not available here; we'll set it below
        name: row.name,
        error: `Ubicación "${row.locationId}" no encontrada o no pertenece a la empresa`,
      })
      return false
    }
    return true
  })

  // Fix row numbers for location errors (we lost them in the filter)
  const locationErrors = errors.filter((e) => e.row === 0)
  if (locationErrors.length > 0) {
    let locErrIdx = 0
    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx]
      if (row.locationId && !validLocationIds.has(row.locationId)) {
        locationErrors[locErrIdx].row = idx + 2
        locErrIdx++
      }
    }
  }

  if (finalRows.length === 0) {
    return NextResponse.json({ imported: 0, errors })
  }

  // ── Transaction: insert all sensors ──────────────────
  const createdSensors = await db.$transaction(
    finalRows.map((row) => {
      const defaults = getSensorProfileDefaults(row.type)
      return db.sensor.create({
        data: {
          companyId: payload.companyId,
          name: row.name,
          type: row.type,
          locationId: row.locationId || null,
          unit: row.unit || defaults.unit,
          thresholdCritical: row.thresholdCritical || defaults.thresholdCritical,
          thresholdWarning: row.thresholdWarning || defaults.thresholdWarning,
          isSimulated: false,
          currentValue: generateSimulatedValue({
            id: `bulk-${row.name}`,
            type: row.type,
            thresholdCritical: row.thresholdCritical || defaults.thresholdCritical,
          } as any),
          lastReadingAt: new Date(),
        },
      })
    })
  )

  // ── Non-blocking audit log ───────────────────────────
  createAuditLog({
    companyId: payload.companyId,
    userId: payload.userId,
    action: 'BULK_IMPORT',
    entityType: 'SENSOR',
    details: { imported: createdSensors.length, errors: errors.length },
    req,
  }).catch(() => {/* non-blocking audit */})

  return NextResponse.json({ imported: createdSensors.length, errors })
}