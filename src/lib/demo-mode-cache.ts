// ============================================================
// IN-MEMORY DEMO MODE CACHE
// Used as fallback for Vercel serverless where SQLite may be ephemeral.
// In development/standard servers, the DB is the primary source of truth.
// ============================================================

/**
 * In-memory Map: companyId → boolean (true = demo mode ON)
 * Stored on globalThis to survive HMR in development.
 */
const globalCache = globalThis as unknown as {
  __demoModeCache: Map<string, boolean> | undefined
}

export const demoModeCache: Map<string, boolean> =
  globalCache.__demoModeCache ?? new Map<string, boolean>()

if (!globalCache.__demoModeCache) {
  globalCache.__demoModeCache = demoModeCache
}
