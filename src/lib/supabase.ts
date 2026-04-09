// Energy-Compliance Hub — Supabase Client
// Used for pgvector RAG queries (document embeddings search)
//
// ENV VARS (set in Vercel):
//   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _supabase: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (_supabase) return _supabase

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
    return null
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // We use our own JWT auth
    },
  })

  console.log('[Supabase] Client initialized')
  return _supabase
}
