import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
  dbAutoSynced: boolean
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
// The old cached client won't have the new models/fields.
const PRISMA_SCHEMA_VERSION = 5

let _db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  // In production, create once and reuse
  _db = globalForPrisma.prisma ?? new PrismaClient()
  if (!globalForPrisma.prisma) globalForPrisma.prisma = _db
} else {
  // In development, check schema version to detect model changes
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
 * Detect if the database is PostgreSQL (Vercel/Neon/etc) or SQLite (local dev).
 */
function isPostgreSQL(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://') || url.includes('@')
}

/**
 * Ensure critical columns exist in the Company table.
 * Works for both SQLite (local dev) and PostgreSQL (Vercel production).
 * Runs once per process. Safe to call multiple times (no-op after first success).
 */
let _syncRunning = false
let _syncDone = false

/**
 * Check if a table exists in the database (SQLite or PostgreSQL)
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
 * Pass separate SQL for PostgreSQL and SQLite.
 */
async function ensureTableExists(tableName: string, _sqliteSql: string, pgSql: string): Promise<void> {
  const exists = await tableExists(tableName)
  if (exists) return

  console.log(`[DB] Auto-sync: creating missing table "${tableName}"`)
  const pg = isPostgreSQL()
  const sql = pg ? pgSql : _sqliteSql

  if (pg) {
    // Execute potentially multi-statement SQL for PostgreSQL
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try {
        await _db.$executeRawUnsafe(stmt)
      } catch (err) {
        // Ignore "already exists" errors (race condition safe)
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

export async function ensureSchemaColumns(): Promise<void> {
  if (_syncDone || _syncRunning) return
  _syncRunning = true

  try {
    const pg = isPostgreSQL()

    if (pg) {
      // PostgreSQL: use information_schema
      const columns = await _db.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'scadaDemoMode'
      `

      if (columns.length === 0) {
        console.log('[DB] Auto-sync: adding missing column Company.scadaDemoMode (PostgreSQL)')
        await _db.$executeRaw`
          ALTER TABLE "Company" ADD COLUMN "scadaDemoMode" BOOLEAN NOT NULL DEFAULT true
        `
        console.log('[DB] Auto-sync: column added successfully')
      }
    } else {
      // SQLite: use PRAGMA
      const columns = await _db.$queryRawUnsafe(
        `PRAGMA table_info("Company");`
      ) as Array<{ name: string }>

      const columnNames = columns.map(c => c.name)

      if (!columnNames.includes('scadaDemoMode')) {
        console.log('[DB] Auto-sync: adding missing column Company.scadaDemoMode (SQLite)')
        await _db.$executeRawUnsafe(
          `ALTER TABLE "Company" ADD COLUMN "scadaDemoMode" BOOLEAN NOT NULL DEFAULT true;`
        )
        console.log('[DB] Auto-sync: column added successfully')
      }
    }

    // Ensure ApiKey table exists (added after initial schema)
    const apiKeyPgSql = `
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
    `
    const apiKeySqliteSql = `
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
    `
    await ensureTableExists('ApiKey', apiKeySqliteSql, apiKeyPgSql)

    // Ensure ERC tables exist (EmergencyAlert, HSEReport)
    const emergencyAlertPgSql = `
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
    `
    const emergencyAlertSqliteSql = `
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
    `
    await ensureTableExists('EmergencyAlert', emergencyAlertSqliteSql, emergencyAlertPgSql)

    const hseReportPgSql = `
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
    `
    const hseReportSqliteSql = `
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
    `
    await ensureTableExists('HSEReport', hseReportSqliteSql, hseReportPgSql)

    _syncDone = true
  } catch (error) {
    console.error('[DB] Auto-sync error:', error instanceof Error ? error.message : error)
    // Don't set _syncDone so it can retry
  } finally {
    _syncRunning = false
  }
}

/**
 * Helper to format dates in SQL queries — works for both SQLite and PostgreSQL.
 * Returns the raw SQL expression (not parameterized) for date grouping.
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
