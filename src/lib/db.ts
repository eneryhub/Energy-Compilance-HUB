import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
  dbAutoSynced: boolean
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
const PRISMA_SCHEMA_VERSION = 6

/**
 * PATCH para serverless (Vercel, Netlify, etc.)
 * Ajusta los parámetros del pool de conexiones PostgreSQL ANTES de que Prisma los lea.
 * - connection_limit: 5 (evita saturar Supabase, suficiente para 1-2 requests concurrentes)
 * - pool_timeout: 30 segundos (tiempo máximo de espera para obtener una conexión)
 */
;(function patchConnectionPool() {
  const url = process.env.DATABASE_URL || ''
  // Detectar si es PostgreSQL (no SQLite)
  const isPg = url.startsWith('postgres://') || url.startsWith('postgresql://') || url.includes('@')
  if (isPg && !url.includes('connection_limit') && process.env.NODE_ENV === 'production') {
    const separator = url.includes('?') ? '&' : '?'
    process.env.DATABASE_URL = `${url}${separator}connection_limit=5&pool_timeout=30`
    console.log('[DB] Pool patched: connection_limit=5, pool_timeout=30')
  }
})()

let _db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  // En producción: reutilizar la instancia global
  _db = globalForPrisma.prisma ?? new PrismaClient()
  if (!globalForPrisma.prisma) globalForPrisma.prisma = _db
} else {
  // En desarrollo: validar versión del esquema
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION) {
    _db = globalForPrisma.prisma
  } else {
    _db = new PrismaClient()
    globalForPrisma.prisma = _db
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
  }
}

export const db = _db

/**
 * Detecta si la base de datos es PostgreSQL (producción) o SQLite (local)
 */
function isPostgreSQL(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://') || url.includes('@')
}

let _syncRunning = false
let _syncDone = false

// --------------------------------------------------------------
// Funciones auxiliares para auto-sync (SOLO en desarrollo)
// --------------------------------------------------------------
async function tableExists(tableName: string): Promise<boolean> {
  const pg = isPostgreSQL()
  if (pg) {
    const result = await _db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = ${tableName}
      )
    `
    return result[0]?.exists ?? false
  } else {
    const result = await _db.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`
    ) as Array<{ name: string }>
    return result.length > 0
  }
}

async function ensureTableExists(tableName: string, _sqliteSql: string, pgSql: string): Promise<void> {
  const exists = await tableExists(tableName)
  if (exists) return

  console.log(`[DB] Auto-sync: creating missing table "${tableName}"`)
  const pg = isPostgreSQL()
  const sql = pg ? pgSql : _sqliteSql

  if (pg) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try {
        await _db.$executeRawUnsafe(stmt)
      } catch (err) {
        if (err instanceof Error && !err.message.includes('already exists')) {
          throw err
        }
      }
    }
  } else {
    await _db.$executeRawUnsafe(sql)
  }
  console.log(`[DB] Auto-sync: table "${tableName}" created successfully`)
}

async function ensureColumn(
  tableName: string,
  columnName: string,
  columnDefPg: string,
  columnDefSqlite: string,
  ifNotExists: boolean = true
): Promise<boolean> {
  try {
    const pg = isPostgreSQL()
    let exists = false

    if (pg) {
      const result = await _db.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      ) as Array<{ column_name: string }>
      exists = result.length > 0
    } else {
      const result = await _db.$queryRawUnsafe(
        `PRAGMA table_info("${tableName}");`
      ) as Array<{ name: string }>
      exists = result.some(c => c.name === columnName)
    }

    if (exists) return false

    const colDef = pg ? columnDefPg : columnDefSqlite
    const sql = `ALTER TABLE "${tableName}" ADD COLUMN ${ifNotExists && pg ? 'IF NOT EXISTS ' : ''}"${columnName}" ${colDef}`
    console.log(`[DB] Auto-sync: adding missing column "${tableName}.${columnName}"`)
    await _db.$executeRawUnsafe(sql)
    console.log(`[DB] Auto-sync: column "${tableName}.${columnName}" added`)
    return true
  } catch (err) {
    console.warn(`[DB] Auto-sync: failed to add column "${tableName}.${columnName}":`,
      err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Sincronización completa del esquema (SOLO para desarrollo local con SQLite)
 * En producción (Supabase) el esquema ya está en las migraciones.
 */
export async function ensureSchemaColumns(): Promise<void> {
  if (_syncDone || _syncRunning) return
  _syncRunning = true

  try {
    const pg = isPostgreSQL()
    console.log(`[DB] Auto-sync starting (${pg ? 'PostgreSQL/Supabase' : 'SQLite'})...`)

    // ============ Company columns ============
    await ensureColumn('Company', 'scadaDemoMode',
      'BOOLEAN NOT NULL DEFAULT true',
      'BOOLEAN NOT NULL DEFAULT 1'
    )

    // ============ ApiKey table ============
    await ensureTableExists('ApiKey', `
      CREATE TABLE IF NOT EXISTS "ApiKey" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "keyPrefix" TEXT NOT NULL,
        "keyHash" TEXT NOT NULL,
        "permissions" TEXT NOT NULL DEFAULT 'sensor:ingest',
        "lastUsedAt" DATETIME,
        "expiresAt" DATETIME,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ApiKey_keyHash_key" UNIQUE ("keyHash"),
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "ApiKey_companyId_idx" ON "ApiKey"("companyId");
      CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
      CREATE INDEX IF NOT EXISTS "ApiKey_isActive_idx" ON "ApiKey"("isActive");
    `, `
      CREATE TABLE IF NOT EXISTS "ApiKey" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "keyPrefix" TEXT NOT NULL,
        "keyHash" TEXT NOT NULL,
        "permissions" TEXT NOT NULL DEFAULT 'sensor:ingest',
        "lastUsedAt" TIMESTAMPTZ,
        "expiresAt" TIMESTAMPTZ,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "ApiKey_keyHash_key" UNIQUE ("keyHash")
      );
      CREATE INDEX IF NOT EXISTS "ApiKey_companyId_idx" ON "ApiKey"("companyId");
      CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
      CREATE INDEX IF NOT EXISTS "ApiKey_isActive_idx" ON "ApiKey"("isActive");
    `)

    // ============ EmergencyAlert ============
    await ensureTableExists('EmergencyAlert', `
      CREATE TABLE IF NOT EXISTS "EmergencyAlert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "tipo" TEXT NOT NULL DEFAULT 'PANICO',
        "ubicacion" TEXT NOT NULL DEFAULT '{}',
        "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
        "prioridad" TEXT NOT NULL DEFAULT 'ALTA',
        "descripcion" TEXT,
        "photoUrl" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "attendedById" TEXT,
        "attendedByName" TEXT,
        "attendedAt" DATETIME,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_companyId_idx" ON "EmergencyAlert"("companyId");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_estado_idx" ON "EmergencyAlert"("estado");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_prioridad_idx" ON "EmergencyAlert"("prioridad");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_createdAt_idx" ON "EmergencyAlert"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "EmergencyAlert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "tipo" TEXT NOT NULL DEFAULT 'PANICO',
        "ubicacion" TEXT NOT NULL DEFAULT '{}',
        "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
        "prioridad" TEXT NOT NULL DEFAULT 'ALTA',
        "descripcion" TEXT,
        "photoUrl" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "attendedById" TEXT,
        "attendedByName" TEXT,
        "attendedAt" TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_companyId_idx" ON "EmergencyAlert"("companyId");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_estado_idx" ON "EmergencyAlert"("estado");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_prioridad_idx" ON "EmergencyAlert"("prioridad");
      CREATE INDEX IF NOT EXISTS "EmergencyAlert_createdAt_idx" ON "EmergencyAlert"("createdAt");
    `)

    await ensureColumn('EmergencyAlert', 'attendedById', 'TEXT', 'TEXT')
    await ensureColumn('EmergencyAlert', 'attendedByName', 'TEXT', 'TEXT')
    await ensureColumn('EmergencyAlert', 'attendedAt', 'TIMESTAMPTZ', 'DATETIME')

    // ============ HSEReport ============
    await ensureTableExists('HSEReport', `
      CREATE TABLE IF NOT EXISTS "HSEReport" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "descripcion" TEXT NOT NULL,
        "fotoUrl" TEXT,
        "categoria" TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA',
        "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
        "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
        "ubicacion" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "HSEReport_companyId_idx" ON "HSEReport"("companyId");
      CREATE INDEX IF NOT EXISTS "HSEReport_estado_idx" ON "HSEReport"("estado");
      CREATE INDEX IF NOT EXISTS "HSEReport_categoria_idx" ON "HSEReport"("categoria");
      CREATE INDEX IF NOT EXISTS "HSEReport_createdAt_idx" ON "HSEReport"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "HSEReport" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "descripcion" TEXT NOT NULL,
        "fotoUrl" TEXT,
        "categoria" TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA',
        "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
        "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
        "ubicacion" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "HSEReport_companyId_idx" ON "HSEReport"("companyId");
      CREATE INDEX IF NOT EXISTS "HSEReport_estado_idx" ON "HSEReport"("estado");
      CREATE INDEX IF NOT EXISTS "HSEReport_categoria_idx" ON "HSEReport"("categoria");
      CREATE INDEX IF NOT EXISTS "HSEReport_createdAt_idx" ON "HSEReport"("createdAt");
    `)

    await ensureColumn('HSEReport', 'descripcion', "TEXT NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''")
    await ensureColumn('HSEReport', 'fotoUrl', 'TEXT', 'TEXT')
    await ensureColumn('HSEReport', 'categoria', "TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA'", "TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA'")
    await ensureColumn('HSEReport', 'prioridad', "TEXT NOT NULL DEFAULT 'MEDIA'", "TEXT NOT NULL DEFAULT 'MEDIA'")
    await ensureColumn('HSEReport', 'estado', "TEXT NOT NULL DEFAULT 'ABIERTO'", "TEXT NOT NULL DEFAULT 'ABIERTO'")
    await ensureColumn('HSEReport', 'ubicacion', 'TEXT', 'TEXT')

    // ============ Sensor ============
    await ensureColumn('Sensor', 'locationId', 'TEXT', 'TEXT')
    await ensureColumn('Sensor', 'isSimulated', 'BOOLEAN NOT NULL DEFAULT true', 'BOOLEAN NOT NULL DEFAULT 1')
    await ensureColumn('Sensor', 'isActive', 'BOOLEAN NOT NULL DEFAULT true', 'BOOLEAN NOT NULL DEFAULT 1')
    await ensureColumn('SensorReading', 'status', "TEXT NOT NULL DEFAULT 'NORMAL'", "TEXT NOT NULL DEFAULT 'NORMAL'")

    // ============ SubscriptionInvoice ============
    await ensureColumn('SubscriptionInvoice', 'amount', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('SubscriptionInvoice', 'invoicePdfUrl', 'TEXT', 'TEXT')

    // ============ Permit ============
    await ensureColumn('Permit', 'workLatitude', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('Permit', 'workLongitude', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('Permit', 'workRadius', 'INTEGER NOT NULL DEFAULT 100', 'INTEGER NOT NULL DEFAULT 100')
    await ensureColumn('Permit', 'workLocationId', 'TEXT', 'TEXT')
    await ensureColumn('Permit', 'locationSource', "TEXT NOT NULL DEFAULT 'manual'", "TEXT NOT NULL DEFAULT 'manual'")
    await ensureColumn('Permit', 'isSpecialProtocol', 'BOOLEAN NOT NULL DEFAULT false', 'BOOLEAN NOT NULL DEFAULT 0')
    await ensureColumn('Permit', 'overrideJustification', 'TEXT', 'TEXT')
    await ensureColumn('Permit', 'specialApprovedById', 'TEXT', 'TEXT')
    await ensureColumn('Permit', 'approveJustification', 'TEXT', 'TEXT')
    await ensureColumn('Permit', 'photosCount', 'INTEGER NOT NULL DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0')
    await ensureColumn('Permit', 'checklistNotes', 'TEXT', 'TEXT')

    // ============ WorkLocation ============
    await ensureColumn('WorkLocation', 'qrCodeSecret', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'qrCodeData', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'beaconUuid', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'beaconMajor', 'INTEGER', 'INTEGER')
    await ensureColumn('WorkLocation', 'beaconMinor', 'INTEGER', 'INTEGER')
    await ensureColumn('WorkLocation', 'beaconRssi', 'INTEGER NOT NULL DEFAULT -70', 'INTEGER NOT NULL DEFAULT -70')

    // ============ HseDocument ============
    await ensureColumn('HseDocument', 'aiExtractedData', 'TEXT', 'TEXT')
    await ensureColumn('HseDocument', 'aiConfidence', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('HseDocument', 'tags', 'TEXT', 'TEXT')

    // ============ AuditLog ============
    await ensureColumn('AuditLog', 'userAgent', 'TEXT', 'TEXT')

    _syncDone = true
    console.log('[DB] Auto-sync completed successfully')
  } catch (error) {
    console.error('[DB] Auto-sync error:', error instanceof Error ? error.message : error)
  } finally {
    _syncRunning = false
  }
}

/**
 * Helper para formatear fechas en SQL (compatible SQLite/PostgreSQL)
 */
export function sqlDateFormat(column: string, format: 'year-month' | 'year'): string {
  const pg = isPostgreSQL()
  if (format === 'year-month') {
    return pg ? `TO_CHAR("${column}", 'YYYY-MM')` : `strftime('%Y-%m', "${column}")`
  }
  return pg ? `TO_CHAR("${column}", 'YYYY')` : `strftime('%Y', "${column}")`
}

export { isPostgreSQL }

// ⚠️ Auto-sync solo en desarrollo (para SQLite). En producción NO se ejecuta.
if (process.env.NODE_ENV !== 'production') {
  ensureSchemaColumns().catch(() => { /* non-fatal */ })
}