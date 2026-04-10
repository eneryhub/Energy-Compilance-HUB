// ══════════════════════════════════════════════════════════════════════════════
//  next.config.js — Configuración recomendada para ingesta de PDFs masivos
// ══════════════════════════════════════════════════════════════════════════════
//
//  Agrega esto a tu next.config.js existente:
//

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite bodies JSON grandes (base64 de PDF puede ser ~70 MB para un doc de 50 MB)
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  // Límite de body para API routes estándar (aplica a /api/*)
  // En Vercel Pro/Enterprise esto funciona; en Hobby el límite es 4.5 MB.
  async headers() {
    return [
      {
        source: '/api/ai/paperclip/ingest',
        headers: [
          // Desactiva el timeout del proxy de Vercel para esta ruta específica
          { key: 'x-vercel-no-timeout', value: '1' },
        ],
      },
    ]
  },
}

module.exports = nextConfig


// ══════════════════════════════════════════════════════════════════════════════
//  EJEMPLO DE USO EN UN COMPONENTE REACT
//  (archivo: components/PdfIngestButton.tsx)
// ══════════════════════════════════════════════════════════════════════════════

/*
'use client'

import { useState, useRef } from 'react'
import { uploadPdfForIngestion, type IngestProgress } from '@/lib/api'

export function PdfIngestButton() {
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const abortRef                = useRef<AbortController | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    abortRef.current = new AbortController()

    try {
      const gen = uploadPdfForIngestion(
        file,
        { title: file.name.replace('.pdf', ''), documentType: 'manual-hse' },
        abortRef.current.signal,
      )

      // Iterar el generador para recibir actualizaciones de progreso
      let result
      for await (const step of gen) {
        setProgress(step)
        // El generador retorna el IngestResult en la última iteración
        // pero TypeScript lo tipea como void dentro del loop.
        // Capturamos el valor de retorno con .return()
      }

      // Alternativa: capturar resultado final
      // const { value: result } = await gen.next()  // done === true aquí

    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err.message)
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setProgress(null)
  }

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFile} />

      {progress && (
        <div>
          <div style={{ width: `${progress.percent}%`, background: 'blue', height: 8 }} />
          <p>{progress.message}</p>
          {progress.phase !== 'done' && progress.phase !== 'error' && (
            <button onClick={handleCancel}>Cancelar</button>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  )
}
*/


// ══════════════════════════════════════════════════════════════════════════════
//  DEPENDENCIAS A INSTALAR
// ══════════════════════════════════════════════════════════════════════════════
//
//  npm install pdf-parse-fork
//
//  Alternativas (en orden de preferencia):
//    npm install pdf-parse         # popular pero sin soporte página-a-página nativo
//    npm install pdfjs-dist        # más robusto, más pesado (~10 MB)
//
//  El route.ts prueba las tres en orden y usa la primera disponible.
//
// ══════════════════════════════════════════════════════════════════════════════
//  MIGRACIÓN SQL EN SUPABASE (si no la tienes ya)
// ══════════════════════════════════════════════════════════════════════════════
//
//  -- Habilitar pgvector
//  CREATE EXTENSION IF NOT EXISTS vector;
//
//  -- Tabla de chunks
//  CREATE TABLE IF NOT EXISTS document_chunks (
//    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//    company_id      text        NOT NULL,
//    document_title  text        NOT NULL,
//    document_type   text        NOT NULL DEFAULT 'documento',
//    chunk_content   text        NOT NULL,
//    embedding       vector(1536),
//    chunk_index     integer     NOT NULL DEFAULT 0,
//    metadata        jsonb,
//    created_at      timestamptz NOT NULL DEFAULT now()
//  );
//
//  -- Índice vectorial para búsqueda rápida
//  CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
//    ON document_chunks
//    USING ivfflat (embedding vector_cosine_ops)
//    WITH (lists = 100);
//
//  -- RPC para búsqueda semántica
//  CREATE OR REPLACE FUNCTION match_documents(
//    query_embedding  vector(1536),
//    match_threshold  float,
//    match_count      int,
//    company_id       text
//  )
//  RETURNS TABLE (
//    id              uuid,
//    document_title  text,
//    document_type   text,
//    chunk_content   text,
//    similarity      float,
//    metadata        jsonb
//  )
//  LANGUAGE sql STABLE AS $$
//    SELECT
//      id,
//      document_title,
//      document_type,
//      chunk_content,
//      1 - (embedding <=> query_embedding) AS similarity,
//      metadata
//    FROM document_chunks
//    WHERE document_chunks.company_id = match_documents.company_id
//      AND 1 - (embedding <=> query_embedding) > match_threshold
//    ORDER BY embedding <=> query_embedding
//    LIMIT match_count;
//  $$;