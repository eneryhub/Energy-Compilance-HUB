/**
 * Next.js Instrumentation — runs once at server startup (Node.js runtime only).
 * Ensures schema columns exist (supports both SQLite and PostgreSQL).
 * This prevents "column does not exist" errors on fresh deployments.
 */

export async function register() {
  // Only run on server-side, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureSchemaColumns } = await import('@/lib/db')
      await ensureSchemaColumns()
      console.log('[instrumentation] DB schema auto-sync completed')
    } catch (error) {
      console.error('[instrumentation] DB schema sync failed (non-fatal):', error instanceof Error ? error.message : error)
    }
  }
}
