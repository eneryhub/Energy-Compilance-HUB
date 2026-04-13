/**
 * Next.js Instrumentation — runs once at server startup (Node.js runtime only).
 * Ensures schema columns exist (supports both SQLite and PostgreSQL).
 * This prevents "column does not exist" errors on fresh deployments.
 *
 * IMPORTANT: Only runs in development (SQLite). In production (Supabase)
 * the schema is already synced. Running ~40 sequential queries on every
 * serverless cold start exhausts the connection pool, causing P2024
 * timeouts that block ALL database requests (login, sensors, etc.).
 */

export async function register() {
  // Only run on server-side during development (SQLite).
  // In production (Supabase/Vercel) the schema is already in sync.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
    try {
      const { ensureSchemaColumns } = await import('@/lib/db')
      await ensureSchemaColumns()
      console.log('[instrumentation] DB schema auto-sync completed')
    } catch (error) {
      console.error('[instrumentation] DB schema sync failed (non-fatal):', error instanceof Error ? error.message : error)
    }
  }
}
