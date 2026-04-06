import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
  dbAutoSynced: boolean
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
// The old cached client won't have the new models/fields.
const PRISMA_SCHEMA_VERSION = 4

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

    _syncDone = true
  } catch (error) {
    console.error('[DB] Auto-sync error:', error instanceof Error ? error.message : error)
    // Don't set _syncDone so it can retry
  } finally {
    _syncRunning = false
  }
}

// Auto-sync on module load (non-blocking, won't block server startup)
ensureSchemaColumns().catch(() => { /* non-fatal */ })

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
