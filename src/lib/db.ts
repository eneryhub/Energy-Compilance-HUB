import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
  dbAutoSynced: boolean
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
// The old cached client won't have the new models/fields.
const PRISMA_SCHEMA_VERSION = 6

/**
 * Build PrismaClient options optimised for the current runtime.
 *
 * On Vercel serverless (or any serverless provider) each function
 * invocation is an isolated container that holds at most 1-2 concurrent
 * requests.  The default pool (5 connections, 10 s timeout) leads to
 * P2024 "Timed out fetching a new connection" because the pool never
 * shrinks fast enough between cold starts.
 *
 * Strategy:
 *  – connection_limit  = 1   (one connection per lambda)
 *  – pool_timeout     = 8   (fail fast instead of hanging 10+ s)
 *
 * For local dev (SQLite) we keep defaults.
 */
function buildPrismaOptions(): { datasource?: { db: { url: string } } } {
  const url = process.env.DATABASE_URL || ''
  const pg = url.startsWith('postgres://') || url.startsWith('postgresql://') || url.includes('@') || !url.startsWith('file:')

  if (pg) {
    // PostgreSQL (Vercel / Neon / Supabase / Railway …)
    const sep = url.includes('?') ? '&' : '?'
    const poolUrl = `${url}${sep}connection_limit=1&pool_timeout=8`
    return { datasource: { db: { url: poolUrl } } }
  }

  // SQLite local dev — keep defaults
  return {}
}

const _prismaOpts = buildPrismaOptions()

let _db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  // In production, create once and reuse
  _db = globalForPrisma.prisma ?? new PrismaClient(_prismaOpts)
  if (!globalForPrisma.prisma) globalForPrisma.prisma = _db
} else {
  // In development, check schema version to detect model changes
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION) {
    _db = globalForPrisma.prisma
  } else {
    _db = new PrismaClient(_prismaOpts)
    globalForPrisma.prisma = _db
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
  }
}

export const db = _db

/**
 * Detect if the database is PostgreSQL (Vercel/Supabase) or SQLite (local dev).
 * Now defaults to PostgreSQL since schema uses "postgresql" provider.
 */
function isPostgreSQL(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://') || url.includes('@') || !url.startsWith('file:')
}

let _syncRunning = false
let _syncDone = false

/**
 * Check if a table exists in the database
 */
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

/**
 * Ensure a table exists — creates it with the provided SQL if missing.
 */
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

/**
 * Ensure a column exists in a table. Adds it if missing.
 * Works for both SQLite and PostgreSQL.
 */
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
 * Comprehensive schema sync — ensures all tables and columns exist.
 * Safe to call multiple times (idempotent).
 * Handles both SQLite (local) and PostgreSQL (Supabase production).
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

    // ============ Ensure ApiKey table ============
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

    // ============ Ensure EmergencyAlert table + columns ============
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

    // EmergencyAlert: ensure all columns exist (in case table was created with older schema)
    await ensureColumn('EmergencyAlert', 'attendedById', 'TEXT', 'TEXT')
    await ensureColumn('EmergencyAlert', 'attendedByName', 'TEXT', 'TEXT')
    await ensureColumn('EmergencyAlert', 'attendedAt', 'TIMESTAMPTZ', 'DATETIME')

    // ============ Ensure HSEReport table + columns ============
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

    // HSEReport: ensure ALL columns exist (critical for Supabase sync)
    await ensureColumn('HSEReport', 'descripcion',
      'TEXT NOT NULL DEFAULT \'\'',
      'TEXT NOT NULL DEFAULT \'\''
    )
    await ensureColumn('HSEReport', 'fotoUrl',
      'TEXT',
      'TEXT'
    )
    await ensureColumn('HSEReport', 'categoria',
      "TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA'",
      "TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA'"
    )
    await ensureColumn('HSEReport', 'prioridad',
      "TEXT NOT NULL DEFAULT 'MEDIA'",
      "TEXT NOT NULL DEFAULT 'MEDIA'"
    )
    await ensureColumn('HSEReport', 'estado',
      "TEXT NOT NULL DEFAULT 'ABIERTO'",
      "TEXT NOT NULL DEFAULT 'ABIERTO'"
    )
    await ensureColumn('HSEReport', 'ubicacion',
      'TEXT',
      'TEXT'
    )

    // ============ Ensure Sensor table + columns ============
    await ensureColumn('Sensor', 'locationId', 'TEXT', 'TEXT')
    await ensureColumn('Sensor', 'isSimulated', 'BOOLEAN NOT NULL DEFAULT true', 'BOOLEAN NOT NULL DEFAULT 1')
    await ensureColumn('Sensor', 'isActive', 'BOOLEAN NOT NULL DEFAULT true', 'BOOLEAN NOT NULL DEFAULT 1')

    // ============ Ensure SensorReading table ============
    await ensureColumn('SensorReading', 'status',
      "TEXT NOT NULL DEFAULT 'NORMAL'",
      "TEXT NOT NULL DEFAULT 'NORMAL'"
    )

    // ============ Ensure SubscriptionInvoice table + columns ============
    await ensureColumn('SubscriptionInvoice', 'amount', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('SubscriptionInvoice', 'invoicePdfUrl', 'TEXT', 'TEXT')

    // ============ Ensure Permit columns (GPS/geofence) ============
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

    // ============ Ensure WorkLocation columns (QR/Beacon) ============
    await ensureColumn('WorkLocation', 'qrCodeSecret', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'qrCodeData', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'beaconUuid', 'TEXT', 'TEXT')
    await ensureColumn('WorkLocation', 'beaconMajor', 'INTEGER', 'INTEGER')
    await ensureColumn('WorkLocation', 'beaconMinor', 'INTEGER', 'INTEGER')
    await ensureColumn('WorkLocation', 'beaconRssi', 'INTEGER NOT NULL DEFAULT -70', 'INTEGER NOT NULL DEFAULT -70')

    // ============ Ensure HseDocument columns (AI extraction) ============
    await ensureColumn('HseDocument', 'aiExtractedData', 'TEXT', 'TEXT')
    await ensureColumn('HseDocument', 'aiConfidence', 'DOUBLE PRECISION', 'REAL')
    await ensureColumn('HseDocument', 'tags', 'TEXT', 'TEXT')

    // ============ Ensure AuditLog columns ============
    await ensureColumn('AuditLog', 'userAgent', 'TEXT', 'TEXT')

    _syncDone = true
    console.log('[DB] Auto-sync completed successfully')
  } catch (error) {
    console.error('[DB] Auto-sync error:', error instanceof Error ? error.message : error)
    // Don't set _syncDone so it can retry
  } finally {
    _syncRunning = false
  }
}

/**
 * Helper to format dates in SQL queries — works for both SQLite and PostgreSQL.
 */
export function sqlDateFormat(column: string, format: 'year-month' | 'year'): string {
  const pg = isPostgreSQL()
  if (format === 'year-month') {
    return pg ? `TO_CHAR("${column}", 'YYYY-MM')` : `strftime('%Y-%m', "${column}")`
  }
  return pg ? `TO_CHAR("${column}", 'YYYY')` : `strftime('%Y', "${column}")`
}

/**
 * Exported isPostgreSQL for use in route handlers that need DB-agnostic raw queries.
 */
export { isPostgreSQL }

// Auto-sync on module load (non-blocking, won't block server startup)
ensureSchemaColumns().catch(() => { /* non-fatal */ })
