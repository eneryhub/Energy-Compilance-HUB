import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: number
}

// Increment this when the Prisma schema changes to force client regeneration in dev.
// The old cached client won't have the new models/fields.
const PRISMA_SCHEMA_VERSION = 3

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
