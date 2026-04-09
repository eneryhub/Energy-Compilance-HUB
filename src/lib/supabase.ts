// Energy-Compliance Hub — Supabase Client
// Used for pgvector RAG queries (document embeddings search)
//
// ENV VARS (set in Vercel):
//   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//
// Uses DYNAMIC import to prevent top-level crash if package isn't available.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null
let _initAttempted = false
let _initFailed = false

/**
 * Returns a Supabase client instance, or null if not configured.
 * Uses dynamic import so it never crashes the host module.
 */
export async function getSupabaseClient(): Promise<ReturnType<typeof import('@supabase/supabase-js').createClient> | null> {
  // Already initialized successfully
  if (_supabase) return _supabase

  // Already tried and failed — don't retry (avoid repeated console noise)
  if (_initFailed) return null

  // First attempt — initialize
  if (!_initAttempted) {
    _initAttempted = true

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
      _initFailed = true
      return null
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false, // We use our own JWT auth
        },
      })
      console.log('[Supabase] Client initialized successfully')
      return _supabase
    } catch (err) {
      console.error('[Supabase] Failed to initialize Supabase client:', err instanceof Error ? err.message : err)
      _initFailed = true
      return null
    }
  }

  return _supabase
}

/**
 * Synchronous check — returns true if Supabase env vars are set.
 * Does NOT guarantee the client is functional.
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey)
}

