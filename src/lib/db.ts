import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
  dbAutoSynced: boolean
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
// The old cached client won't have the new models/fields.
const PRISMA_SCHEMA_VERSION = 12

// ─────────────────────────────────────────────────────────────────
// PRODUCTION CONNECTION POOL LIMITER
// On Vercel serverless, each function instance creates a PrismaClient.
// Without limits, Prisma uses num_cpus*2+1 connections per instance.
// Supabase PgBouncer (free tier) has ~20 total connections.
// 3 concurrent requests per function prevents pool exhaustion.
// ─────────────────────────────────────────────────────────────────
if (
  process.env.NODE_ENV === 'production' &&
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
) {
  const url = process.env.DATABASE_URL
  // Only inject if not already present
  if (!url.includes('connection_limit=')) {
    const sep = url.includes('?') ? '&' : '?'
    process.env.DATABASE_URL = `${url}${sep}connection_limit=3&pool_timeout=20&connect_timeout=30`
    console.log('[DB] Production: injected pool limits (connection_limit=3, pool_timeout=20, connect_timeout=30)')
  }
}

let _db: PrismaClient | undefined

try {
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
} catch (err) {
  console.error('[DB] CRITICAL: Failed to initialize PrismaClient:', err instanceof Error ? err.message : err)
  _db = undefined
}

export const db = _db

/**
 * Runtime guard — ensures db is available before any query.
 * Returns a 500 response if db is not initialized (e.g. Supabase connection failed).
 */
export function requireDb(): PrismaClient {
  if (!_db) {
    throw new Error('Database not initialized. Check DATABASE_URL and Supabase connection.')
  }
  return _db
}

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

    // ============ Ensure SystemAlert table (GOC) ============
    await ensureTableExists('SystemAlert', `
      CREATE TABLE IF NOT EXISTS "SystemAlert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "metadata" TEXT,
        "isAcknowledged" BOOLEAN NOT NULL DEFAULT 0,
        "acknowledgedById" TEXT,
        "acknowledgedAt" DATETIME,
        "relatedEntityId" TEXT,
        "relatedEntityType" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "SystemAlert_companyId_idx" ON "SystemAlert"("companyId");
      CREATE INDEX IF NOT EXISTS "SystemAlert_isAcknowledged_idx" ON "SystemAlert"("isAcknowledged");
      CREATE INDEX IF NOT EXISTS "SystemAlert_type_idx" ON "SystemAlert"("type");
      CREATE INDEX IF NOT EXISTS "SystemAlert_severity_idx" ON "SystemAlert"("severity");
      CREATE INDEX IF NOT EXISTS "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "SystemAlert" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "metadata" TEXT,
        "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
        "acknowledgedById" TEXT,
        "acknowledgedAt" TIMESTAMPTZ,
        "relatedEntityId" TEXT,
        "relatedEntityType" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "SystemAlert_companyId_idx" ON "SystemAlert"("companyId");
      CREATE INDEX IF NOT EXISTS "SystemAlert_isAcknowledged_idx" ON "SystemAlert"("isAcknowledged");
      CREATE INDEX IF NOT EXISTS "SystemAlert_type_idx" ON "SystemAlert"("type");
      CREATE INDEX IF NOT EXISTS "SystemAlert_severity_idx" ON "SystemAlert"("severity");
      CREATE INDEX IF NOT EXISTS "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");
    `)

    // ============ Ensure KnowledgeBase table (GOC) ============
    await ensureTableExists('KnowledgeBase', `
      CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "errorCode" TEXT NOT NULL UNIQUE,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "rootCause" TEXT NOT NULL,
        "appliedSolution" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "referenceUrl" TEXT,
        "timesUsed" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `, `
      CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "errorCode" TEXT NOT NULL UNIQUE,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "rootCause" TEXT NOT NULL,
        "appliedSolution" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "referenceUrl" TEXT,
        "timesUsed" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ============ Ensure SupportMessage table (In-App Chat) ============
    await ensureTableExists('SupportMessage', `
      CREATE TABLE IF NOT EXISTS "SupportMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT,
        "userName" TEXT,
        "message" TEXT NOT NULL,
        "senderType" TEXT NOT NULL DEFAULT 'USER',
        "isRead" BOOLEAN NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "SupportMessage_companyId_idx" ON "SupportMessage"("companyId");
      CREATE INDEX IF NOT EXISTS "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "SupportMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT,
        "userName" TEXT,
        "message" TEXT NOT NULL,
        "senderType" TEXT NOT NULL DEFAULT 'USER',
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "SupportMessage_companyId_idx" ON "SupportMessage"("companyId");
      CREATE INDEX IF NOT EXISTS "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");
    `)

    // ============ Ensure InventoryLocation table ============
    await ensureTableExists('InventoryLocation', `
      CREATE TABLE IF NOT EXISTS "InventoryLocation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "province" TEXT,
        "city" TEXT,
        "address" TEXT,
        "latitude" REAL,
        "longitude" REAL,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "InventoryLocation_companyId_idx" ON "InventoryLocation"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");
      CREATE INDEX IF NOT EXISTS "InventoryLocation_province_idx" ON "InventoryLocation"("province");
    `, `
      CREATE TABLE IF NOT EXISTS "InventoryLocation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "province" TEXT,
        "city" TEXT,
        "address" TEXT,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "InventoryLocation_companyId_idx" ON "InventoryLocation"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");
      CREATE INDEX IF NOT EXISTS "InventoryLocation_province_idx" ON "InventoryLocation"("province");
    `)

    // ============ Ensure InventoryItem table ============
    await ensureTableExists('InventoryItem', `
      CREATE TABLE IF NOT EXISTS "InventoryItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "sku" TEXT,
        "category" TEXT NOT NULL DEFAULT 'GENERAL',
        "unit" TEXT NOT NULL DEFAULT 'unidad',
        "thumbnailUrl" TEXT,
        "thresholdMin" INTEGER NOT NULL DEFAULT 5,
        "thresholdMax" INTEGER,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InventoryItem_companyId_sku_key" UNIQUE ("companyId", "sku"),
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryItem_category_idx" ON "InventoryItem"("category");
      CREATE INDEX IF NOT EXISTS "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");
    `, `
      CREATE TABLE IF NOT EXISTS "InventoryItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "sku" TEXT,
        "category" TEXT NOT NULL DEFAULT 'GENERAL',
        "unit" TEXT NOT NULL DEFAULT 'unidad',
        "thumbnailUrl" TEXT,
        "thresholdMin" INTEGER NOT NULL DEFAULT 5,
        "thresholdMax" INTEGER,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "InventoryItem_companyId_sku_key" UNIQUE ("companyId", "sku")
      );
      CREATE INDEX IF NOT EXISTS "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryItem_category_idx" ON "InventoryItem"("category");
      CREATE INDEX IF NOT EXISTS "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");
    `)

    // ============ Ensure InventoryDevice table ============
    await ensureTableExists('InventoryDevice', `
      CREATE TABLE IF NOT EXISTS "InventoryDevice" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'CAMERA',
        "ipAddress" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ONLINE',
        "lastSeenAt" DATETIME,
        "metadata" TEXT,
        "beaconUuid" TEXT,
        "beaconMajor" INTEGER,
        "beaconMinor" INTEGER,
        "beaconRssi" INTEGER NOT NULL DEFAULT -70,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "InventoryDevice_companyId_idx" ON "InventoryDevice"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_locationId_idx" ON "InventoryDevice"("locationId");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_type_idx" ON "InventoryDevice"("type");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_status_idx" ON "InventoryDevice"("status");
    `, `
      CREATE TABLE IF NOT EXISTS "InventoryDevice" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'CAMERA',
        "ipAddress" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ONLINE',
        "lastSeenAt" TIMESTAMPTZ,
        "metadata" TEXT,
        "beaconUuid" TEXT,
        "beaconMajor" INTEGER,
        "beaconMinor" INTEGER,
        "beaconRssi" INTEGER NOT NULL DEFAULT -70,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "InventoryDevice_companyId_idx" ON "InventoryDevice"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_locationId_idx" ON "InventoryDevice"("locationId");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_type_idx" ON "InventoryDevice"("type");
      CREATE INDEX IF NOT EXISTS "InventoryDevice_status_idx" ON "InventoryDevice"("status");
    `)

    // ============ Ensure InventoryDevice BLE columns ============
    await ensureColumn('InventoryDevice', 'beaconUuid', 'TEXT', 'TEXT')
    await ensureColumn('InventoryDevice', 'beaconMajor', 'INTEGER', 'INTEGER')
    await ensureColumn('InventoryDevice', 'beaconMinor', 'INTEGER', 'INTEGER')
    await ensureColumn('InventoryDevice', 'beaconRssi', 'INTEGER NOT NULL DEFAULT -70', 'INTEGER NOT NULL DEFAULT -70')

    // Drop old global unique index on beaconUuid (was @unique, now @@unique([companyId, beaconUuid]))
    try {
      await _db.$executeRawUnsafe(`DROP INDEX IF EXISTS "InventoryDevice_beaconUuid_key"`)
    } catch { /* index may not exist */ }

    // Create compound unique index on (companyId, beaconUuid)
    try {
      await _db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "InventoryDevice_companyId_beaconUuid_key" ON "InventoryDevice"("companyId", "beaconUuid")`)
    } catch { /* may already exist */ }

    // ============ Ensure SmartInventory table ============
    await ensureTableExists('SmartInventory', `
      CREATE TABLE IF NOT EXISTS "SmartInventory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "beaconId" TEXT,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "cameraCount" INTEGER,
        "beaconCount" INTEGER,
        "lastCountedAt" DATETIME,
        "lastSyncAt" DATETIME,
        "discrepancy" BOOLEAN NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SmartInventory_itemId_locationId_key" UNIQUE ("itemId", "locationId"),
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "SmartInventory_companyId_idx" ON "SmartInventory"("companyId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_locationId_idx" ON "SmartInventory"("locationId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_itemId_idx" ON "SmartInventory"("itemId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_discrepancy_idx" ON "SmartInventory"("discrepancy");
    `, `
      CREATE TABLE IF NOT EXISTS "SmartInventory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "beaconId" TEXT,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "cameraCount" INTEGER,
        "beaconCount" INTEGER,
        "lastCountedAt" TIMESTAMPTZ,
        "lastSyncAt" TIMESTAMPTZ,
        "discrepancy" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "SmartInventory_itemId_locationId_key" UNIQUE ("itemId", "locationId")
      );
      CREATE INDEX IF NOT EXISTS "SmartInventory_companyId_idx" ON "SmartInventory"("companyId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_locationId_idx" ON "SmartInventory"("locationId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_itemId_idx" ON "SmartInventory"("itemId");
      CREATE INDEX IF NOT EXISTS "SmartInventory_discrepancy_idx" ON "SmartInventory"("discrepancy");
    `)

    // ============ Ensure InventoryAudit table ============
    await ensureTableExists('InventoryAudit', `
      CREATE TABLE IF NOT EXISTS "InventoryAudit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "deviceId" TEXT,
        "itemName" TEXT,
        "itemCount" INTEGER NOT NULL DEFAULT 0,
        "beaconCount" INTEGER,
        "confidence" REAL,
        "snapshotUrl" TEXT,
        "rawImageUrl" TEXT,
        "discrepancy" BOOLEAN NOT NULL DEFAULT 0,
        "resolvedAt" DATETIME,
        "resolvedById" TEXT,
        "notes" TEXT,
        "metadata" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("deviceId") REFERENCES "InventoryDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "InventoryAudit_companyId_idx" ON "InventoryAudit"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_locationId_idx" ON "InventoryAudit"("locationId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_deviceId_idx" ON "InventoryAudit"("deviceId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_createdAt_idx" ON "InventoryAudit"("createdAt");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_discrepancy_idx" ON "InventoryAudit"("discrepancy");
    `, `
      CREATE TABLE IF NOT EXISTS "InventoryAudit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "deviceId" TEXT,
        "itemName" TEXT,
        "itemCount" INTEGER NOT NULL DEFAULT 0,
        "beaconCount" INTEGER,
        "confidence" DOUBLE PRECISION,
        "snapshotUrl" TEXT,
        "rawImageUrl" TEXT,
        "discrepancy" BOOLEAN NOT NULL DEFAULT false,
        "resolvedAt" TIMESTAMPTZ,
        "resolvedById" TEXT,
        "notes" TEXT,
        "metadata" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "InventoryAudit_companyId_idx" ON "InventoryAudit"("companyId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_locationId_idx" ON "InventoryAudit"("locationId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_deviceId_idx" ON "InventoryAudit"("deviceId");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_createdAt_idx" ON "InventoryAudit"("createdAt");
      CREATE INDEX IF NOT EXISTS "InventoryAudit_discrepancy_idx" ON "InventoryAudit"("discrepancy");
    `)

    // ============ Ensure TransportVehicle table ============
    await ensureTableExists('TransportVehicle', `
      CREATE TABLE IF NOT EXISTS "TransportVehicle" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "plate" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "brand" TEXT,
        "model" TEXT,
        "year" INTEGER,
        "capacityKg" REAL,
        "vin" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
        "lastInspectionAt" DATETIME,
        "currentDriverId" TEXT,
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TransportVehicle_companyId_plate_key" UNIQUE ("companyId", "plate"),
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("currentDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportVehicle_companyId_idx" ON "TransportVehicle"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportVehicle_status_idx" ON "TransportVehicle"("status");
      CREATE INDEX IF NOT EXISTS "TransportVehicle_isActive_idx" ON "TransportVehicle"("isActive");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportVehicle" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "plate" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "brand" TEXT,
        "model" TEXT,
        "year" INTEGER,
        "capacityKg" DOUBLE PRECISION,
        "vin" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
        "lastInspectionAt" TIMESTAMPTZ,
        "currentDriverId" TEXT,
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "TransportVehicle_companyId_plate_key" UNIQUE ("companyId", "plate")
      );
      CREATE INDEX IF NOT EXISTS "TransportVehicle_companyId_idx" ON "TransportVehicle"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportVehicle_status_idx" ON "TransportVehicle"("status");
      CREATE INDEX IF NOT EXISTS "TransportVehicle_isActive_idx" ON "TransportVehicle"("isActive");
    `)

    // ============ Ensure TransportDriver table ============
    await ensureTableExists('TransportDriver', `
      CREATE TABLE IF NOT EXISTS "TransportDriver" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "licenseNumber" TEXT NOT NULL,
        "licenseType" TEXT NOT NULL,
        "licenseExpiry" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'ACTIVO',
        "fatigueScore" REAL NOT NULL DEFAULT 0,
        "totalTrips" INTEGER NOT NULL DEFAULT 0,
        "certificationData" TEXT NOT NULL DEFAULT '{}',
        "medicalExpiry" DATETIME,
        "emergencyContact" TEXT NOT NULL DEFAULT '{}',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TransportDriver_companyId_userId_key" UNIQUE ("companyId", "userId"),
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportDriver_companyId_idx" ON "TransportDriver"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportDriver_status_idx" ON "TransportDriver"("status");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportDriver" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "licenseNumber" TEXT NOT NULL,
        "licenseType" TEXT NOT NULL,
        "licenseExpiry" TIMESTAMPTZ,
        "status" TEXT NOT NULL DEFAULT 'ACTIVO',
        "fatigueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalTrips" INTEGER NOT NULL DEFAULT 0,
        "certificationData" TEXT NOT NULL DEFAULT '{}',
        "medicalExpiry" TIMESTAMPTZ,
        "emergencyContact" TEXT NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "TransportDriver_companyId_userId_key" UNIQUE ("companyId", "userId")
      );
      CREATE INDEX IF NOT EXISTS "TransportDriver_companyId_idx" ON "TransportDriver"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportDriver_status_idx" ON "TransportDriver"("status");
    `)

    // ============ Ensure TransportRoute table ============
    await ensureTableExists('TransportRoute', `
      CREATE TABLE IF NOT EXISTS "TransportRoute" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "origin" TEXT NOT NULL,
        "destination" TEXT NOT NULL,
        "distanceKm" REAL NOT NULL,
        "estimatedDurationMin" INTEGER NOT NULL,
        "waypoints" TEXT NOT NULL DEFAULT '[]',
        "riskLevel" TEXT NOT NULL DEFAULT 'MEDIO',
        "hasHSECheckpoints" BOOLEAN NOT NULL DEFAULT 0,
        "checkpointConfig" TEXT NOT NULL DEFAULT '{}',
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportRoute_companyId_idx" ON "TransportRoute"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportRoute_isActive_idx" ON "TransportRoute"("isActive");
      CREATE INDEX IF NOT EXISTS "TransportRoute_riskLevel_idx" ON "TransportRoute"("riskLevel");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportRoute" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "origin" TEXT NOT NULL,
        "destination" TEXT NOT NULL,
        "distanceKm" DOUBLE PRECISION NOT NULL,
        "estimatedDurationMin" INTEGER NOT NULL,
        "waypoints" TEXT NOT NULL DEFAULT '[]',
        "riskLevel" TEXT NOT NULL DEFAULT 'MEDIO',
        "hasHSECheckpoints" BOOLEAN NOT NULL DEFAULT false,
        "checkpointConfig" TEXT NOT NULL DEFAULT '{}',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "TransportRoute_companyId_idx" ON "TransportRoute"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportRoute_isActive_idx" ON "TransportRoute"("isActive");
      CREATE INDEX IF NOT EXISTS "TransportRoute_riskLevel_idx" ON "TransportRoute"("riskLevel");
    `)

    // ============ Ensure TransportTrip table ============
    await ensureTableExists('TransportTrip', `
      CREATE TABLE IF NOT EXISTS "TransportTrip" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "driverId" TEXT NOT NULL,
        "routeId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PLANIFICADO',
        "startDate" DATETIME NOT NULL,
        "endDate" DATETIME,
        "startOdometerKm" REAL,
        "endOdometerKm" REAL,
        "fuelConsumed" REAL,
        "riskValidationResult" TEXT NOT NULL DEFAULT '{}',
        "inspectionResult" TEXT NOT NULL DEFAULT '{}',
        "blockingReason" TEXT,
        "blockedById" TEXT,
        "blockedAt" DATETIME,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportTrip_companyId_idx" ON "TransportTrip"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_vehicleId_idx" ON "TransportTrip"("vehicleId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_driverId_idx" ON "TransportTrip"("driverId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_routeId_idx" ON "TransportTrip"("routeId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_status_idx" ON "TransportTrip"("status");
      CREATE INDEX IF NOT EXISTS "TransportTrip_startDate_idx" ON "TransportTrip"("startDate");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportTrip" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "driverId" TEXT NOT NULL,
        "routeId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PLANIFICADO',
        "startDate" TIMESTAMPTZ NOT NULL,
        "endDate" TIMESTAMPTZ,
        "startOdometerKm" DOUBLE PRECISION,
        "endOdometerKm" DOUBLE PRECISION,
        "fuelConsumed" DOUBLE PRECISION,
        "riskValidationResult" TEXT NOT NULL DEFAULT '{}',
        "inspectionResult" TEXT NOT NULL DEFAULT '{}',
        "blockingReason" TEXT,
        "blockedById" TEXT,
        "blockedAt" TIMESTAMPTZ,
        "notes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "TransportTrip_companyId_idx" ON "TransportTrip"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_vehicleId_idx" ON "TransportTrip"("vehicleId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_driverId_idx" ON "TransportTrip"("driverId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_routeId_idx" ON "TransportTrip"("routeId");
      CREATE INDEX IF NOT EXISTS "TransportTrip_status_idx" ON "TransportTrip"("status");
      CREATE INDEX IF NOT EXISTS "TransportTrip_startDate_idx" ON "TransportTrip"("startDate");
    `)

    // ============ Ensure TransportInspection table ============
    await ensureTableExists('TransportInspection', `
      CREATE TABLE IF NOT EXISTS "TransportInspection" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "tripId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "inspectorId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "checklistResult" TEXT NOT NULL DEFAULT '{}',
        "passed" BOOLEAN NOT NULL,
        "issues" TEXT NOT NULL DEFAULT '[]',
        "photos" TEXT NOT NULL DEFAULT '[]',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportInspection_companyId_idx" ON "TransportInspection"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_tripId_idx" ON "TransportInspection"("tripId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_vehicleId_idx" ON "TransportInspection"("vehicleId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_inspectorId_idx" ON "TransportInspection"("inspectorId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_createdAt_idx" ON "TransportInspection"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportInspection" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "tripId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "inspectorId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "checklistResult" TEXT NOT NULL DEFAULT '{}',
        "passed" BOOLEAN NOT NULL,
        "issues" TEXT NOT NULL DEFAULT '[]',
        "photos" TEXT NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "TransportInspection_companyId_idx" ON "TransportInspection"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_tripId_idx" ON "TransportInspection"("tripId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_vehicleId_idx" ON "TransportInspection"("vehicleId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_inspectorId_idx" ON "TransportInspection"("inspectorId");
      CREATE INDEX IF NOT EXISTS "TransportInspection_createdAt_idx" ON "TransportInspection"("createdAt");
    `)

    // ============ Ensure TransportDriverEvent table ============
    await ensureTableExists('TransportDriverEvent', `
      CREATE TABLE IF NOT EXISTS "TransportDriverEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "tripId" TEXT NOT NULL,
        "driverId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "riskLevel" TEXT NOT NULL,
        "confidence" REAL NOT NULL,
        "snapshotUrl" TEXT,
        "aiAnalysis" TEXT NOT NULL DEFAULT '{}',
        "gpsLocation" TEXT NOT NULL DEFAULT '{}',
        "timestamp" DATETIME NOT NULL,
        "isResolved" BOOLEAN NOT NULL DEFAULT 0,
        "resolvedAt" DATETIME,
        "actionTaken" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_companyId_idx" ON "TransportDriverEvent"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_tripId_idx" ON "TransportDriverEvent"("tripId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_driverId_idx" ON "TransportDriverEvent"("driverId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_eventType_idx" ON "TransportDriverEvent"("eventType");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_timestamp_idx" ON "TransportDriverEvent"("timestamp");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_riskLevel_idx" ON "TransportDriverEvent"("riskLevel");
    `, `
      CREATE TABLE IF NOT EXISTS "TransportDriverEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "tripId" TEXT NOT NULL,
        "driverId" TEXT NOT NULL,
        "vehicleId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "riskLevel" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION NOT NULL,
        "snapshotUrl" TEXT,
        "aiAnalysis" TEXT NOT NULL DEFAULT '{}',
        "gpsLocation" TEXT NOT NULL DEFAULT '{}',
        "timestamp" TIMESTAMPTZ NOT NULL,
        "isResolved" BOOLEAN NOT NULL DEFAULT false,
        "resolvedAt" TIMESTAMPTZ,
        "actionTaken" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_companyId_idx" ON "TransportDriverEvent"("companyId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_tripId_idx" ON "TransportDriverEvent"("tripId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_driverId_idx" ON "TransportDriverEvent"("driverId");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_eventType_idx" ON "TransportDriverEvent"("eventType");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_timestamp_idx" ON "TransportDriverEvent"("timestamp");
      CREATE INDEX IF NOT EXISTS "TransportDriverEvent_riskLevel_idx" ON "TransportDriverEvent"("riskLevel");
    `)

    // ============ Ensure EnvironmentalIncident table ============
    await ensureTableExists('EnvironmentalIncident', `
      CREATE TABLE IF NOT EXISTS "EnvironmentalIncident" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "reportedById" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "sourceId" TEXT,
        "sourceType" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "location" TEXT NOT NULL DEFAULT '{}',
        "estimatedImpact" TEXT NOT NULL DEFAULT '{}',
        "photos" TEXT NOT NULL DEFAULT '[]',
        "status" TEXT NOT NULL DEFAULT 'REPORTADO',
        "containmentMeasures" TEXT NOT NULL DEFAULT '[]',
        "remediationPlan" TEXT,
        "remediationDate" DATETIME,
        "closedById" TEXT,
        "closedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_companyId_idx" ON "EnvironmentalIncident"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_type_idx" ON "EnvironmentalIncident"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_severity_idx" ON "EnvironmentalIncident"("severity");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_status_idx" ON "EnvironmentalIncident"("status");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_sourceType_idx" ON "EnvironmentalIncident"("sourceType");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_createdAt_idx" ON "EnvironmentalIncident"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "EnvironmentalIncident" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "reportedById" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "sourceId" TEXT,
        "sourceType" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "location" TEXT NOT NULL DEFAULT '{}',
        "estimatedImpact" TEXT NOT NULL DEFAULT '{}',
        "photos" TEXT NOT NULL DEFAULT '[]',
        "status" TEXT NOT NULL DEFAULT 'REPORTADO',
        "containmentMeasures" TEXT NOT NULL DEFAULT '[]',
        "remediationPlan" TEXT,
        "remediationDate" TIMESTAMPTZ,
        "closedById" TEXT,
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_companyId_idx" ON "EnvironmentalIncident"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_type_idx" ON "EnvironmentalIncident"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_severity_idx" ON "EnvironmentalIncident"("severity");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_status_idx" ON "EnvironmentalIncident"("status");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_sourceType_idx" ON "EnvironmentalIncident"("sourceType");
      CREATE INDEX IF NOT EXISTS "EnvironmentalIncident_createdAt_idx" ON "EnvironmentalIncident"("createdAt");
    `)

    // ============ Ensure EnvironmentalAssessment table ============
    await ensureTableExists('EnvironmentalAssessment', `
      CREATE TABLE IF NOT EXISTS "EnvironmentalAssessment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'BORRADOR',
        "description" TEXT,
        "location" TEXT NOT NULL DEFAULT '{}',
        "scope" TEXT NOT NULL DEFAULT '{}',
        "findings" TEXT NOT NULL DEFAULT '[]',
        "recommendations" TEXT NOT NULL DEFAULT '[]',
        "approvedById" TEXT,
        "approvedAt" DATETIME,
        "nextReviewDate" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_companyId_idx" ON "EnvironmentalAssessment"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_type_idx" ON "EnvironmentalAssessment"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_status_idx" ON "EnvironmentalAssessment"("status");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_nextReviewDate_idx" ON "EnvironmentalAssessment"("nextReviewDate");
    `, `
      CREATE TABLE IF NOT EXISTS "EnvironmentalAssessment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'BORRADOR',
        "description" TEXT,
        "location" TEXT NOT NULL DEFAULT '{}',
        "scope" TEXT NOT NULL DEFAULT '{}',
        "findings" TEXT NOT NULL DEFAULT '[]',
        "recommendations" TEXT NOT NULL DEFAULT '[]',
        "approvedById" TEXT,
        "approvedAt" TIMESTAMPTZ,
        "nextReviewDate" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_companyId_idx" ON "EnvironmentalAssessment"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_type_idx" ON "EnvironmentalAssessment"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_status_idx" ON "EnvironmentalAssessment"("status");
      CREATE INDEX IF NOT EXISTS "EnvironmentalAssessment_nextReviewDate_idx" ON "EnvironmentalAssessment"("nextReviewDate");
    `)

    // ============ Ensure EnvironmentalMetric table ============
    await ensureTableExists('EnvironmentalMetric', `
      CREATE TABLE IF NOT EXISTS "EnvironmentalMetric" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "unit" TEXT NOT NULL,
        "currentValue" REAL,
        "thresholdWarning" REAL NOT NULL,
        "thresholdCritical" REAL NOT NULL,
        "measurementDate" DATETIME NOT NULL,
        "source" TEXT NOT NULL,
        "sensorId" TEXT,
        "locationId" TEXT,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_companyId_idx" ON "EnvironmentalMetric"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_type_idx" ON "EnvironmentalMetric"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_measurementDate_idx" ON "EnvironmentalMetric"("measurementDate");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_source_idx" ON "EnvironmentalMetric"("source");
    `, `
      CREATE TABLE IF NOT EXISTS "EnvironmentalMetric" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "unit" TEXT NOT NULL,
        "currentValue" DOUBLE PRECISION,
        "thresholdWarning" DOUBLE PRECISION NOT NULL,
        "thresholdCritical" DOUBLE PRECISION NOT NULL,
        "measurementDate" TIMESTAMPTZ NOT NULL,
        "source" TEXT NOT NULL,
        "sensorId" TEXT,
        "locationId" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_companyId_idx" ON "EnvironmentalMetric"("companyId");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_type_idx" ON "EnvironmentalMetric"("type");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_measurementDate_idx" ON "EnvironmentalMetric"("measurementDate");
      CREATE INDEX IF NOT EXISTS "EnvironmentalMetric_source_idx" ON "EnvironmentalMetric"("source");
    `)

    // ============ Ensure HSEEventLog table ============
    await ensureTableExists('HSEEventLog', `
      CREATE TABLE IF NOT EXISTS "HSEEventLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "eventId" TEXT NOT NULL UNIQUE,
        "sourceModule" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "actorId" TEXT,
        "actorName" TEXT,
        "relatedEntityId" TEXT,
        "relatedEntityType" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "HSEEventLog_companyId_idx" ON "HSEEventLog"("companyId");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_sourceModule_idx" ON "HSEEventLog"("sourceModule");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_eventType_idx" ON "HSEEventLog"("eventType");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_severity_idx" ON "HSEEventLog"("severity");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_relatedEntityId_idx" ON "HSEEventLog"("relatedEntityId");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_createdAt_idx" ON "HSEEventLog"("createdAt");
    `, `
      CREATE TABLE IF NOT EXISTS "HSEEventLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "eventId" TEXT NOT NULL UNIQUE,
        "sourceModule" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "severity" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "actorId" TEXT,
        "actorName" TEXT,
        "relatedEntityId" TEXT,
        "relatedEntityType" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "HSEEventLog_companyId_idx" ON "HSEEventLog"("companyId");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_sourceModule_idx" ON "HSEEventLog"("sourceModule");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_eventType_idx" ON "HSEEventLog"("eventType");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_severity_idx" ON "HSEEventLog"("severity");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_relatedEntityId_idx" ON "HSEEventLog"("relatedEntityId");
      CREATE INDEX IF NOT EXISTS "HSEEventLog_createdAt_idx" ON "HSEEventLog"("createdAt");
    `)

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

// Auto-sync on module load — ONLY in development (SQLite).
// In production (Supabase) the schema is already in sync via migrations.
// Running ~40 sequential queries on every cold start exhausts the
// connection pool on serverless, causing P2024 timeouts for real requests.
if (process.env.NODE_ENV !== 'production') {
  ensureSchemaColumns().catch(() => { /* non-fatal */ })
}
