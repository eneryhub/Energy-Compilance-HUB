// ═══════════════════════════════════════════════════════════════
// AI Speech TTS Proxy — Backend-only route
// Uses z-ai-web-dev-sdk to generate speech via TTS model.
// Client-side components call POST /api/ai/speech to get audio.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// Text max length per TTS API constraint
const MAX_TTS_LENGTH = 1024

function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  const chunks: string[] = []
  // Split by sentences for natural breaks
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
      // If single sentence exceeds maxLength, split by commas
      if (sentence.length > maxLength) {
        const parts = sentence.split(/[,;:]/)
        let subChunk = ''
        for (const part of parts) {
          if ((subChunk + part).length <= maxLength) {
            subChunk += part + ','
          } else {
            if (subChunk) chunks.push(subChunk.trim().replace(/,$/, ''))
            subChunk = part + ','
          }
        }
        if (subChunk) currentChunk = subChunk
      } else {
        currentChunk = sentence
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim().replace(/,$/, ''))

  return chunks.filter(c => c.length > 0)
}

// Simple in-memory cache: text hash → audio buffer (avoids re-generating the same description)
const audioCache = new Map<string, { buffer: Buffer; createdAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `${hash}`
}

// SDK singleton (safe in serverless — recreates on error)
let zaiInstance: Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = body.text?.trim()
    const voice = body.voice || 'kazi' // kazi = clear standard, good for Spanish
    const speed = body.speed || 1.0

    // Validate input
    if (!text) {
      return NextResponse.json(
        { error: 'El texto es requerido.' },
        { status: 400 }
      )
    }

    if (text.length > 2048) {
      return NextResponse.json(
        { error: 'El texto excede el límite máximo de 2048 caracteres.' },
        { status: 400 }
      )
    }

    // Clamp speed to valid range
    const clampedSpeed = Math.max(0.5, Math.min(2.0, Number(speed)))

    // Check cache
    const cacheKey = `${hashText(text)}_${voice}_${clampedSpeed}`
    const cached = audioCache.get(cacheKey)
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return new NextResponse(cached.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': String(cached.buffer.length),
          'X-Cache': 'HIT',
        },
      })
    }

    // Generate TTS
    const zai = await getZAI()

    // If text is within single-chunk limit, generate directly
    let audioBuffer: Buffer

    if (text.length <= MAX_TTS_LENGTH) {
      const response = await zai.audio.tts.create({
        input: text,
        voice,
        speed: clampedSpeed,
        response_format: 'wav',
        stream: false,
      })
      const arrayBuffer = await response.arrayBuffer()
      audioBuffer = Buffer.from(new Uint8Array(arrayBuffer))
    } else {
      // Split into chunks and concatenate
      const chunks = splitTextIntoChunks(text)
      const buffers: Buffer[] = []

      for (const chunk of chunks) {
        const response = await zai.audio.tts.create({
          input: chunk,
          voice,
          speed: clampedSpeed,
          response_format: 'wav',
          stream: false,
        })
        const arrayBuffer = await response.arrayBuffer()
        buffers.push(Buffer.from(new Uint8Array(arrayBuffer)))
      }

      audioBuffer = Buffer.concat(buffers)
    }

    // Store in cache
    audioCache.set(cacheKey, { buffer: audioBuffer, createdAt: Date.now() })

    // Cleanup old cache entries (prevent memory leak)
    if (audioCache.size > 50) {
      const now = Date.now()
      for (const [key, value] of audioCache) {
        if (now - value.createdAt > CACHE_TTL_MS) {
          audioCache.delete(key)
        }
      }
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[TTS API Error]', msg, error)
    // Reset singleton on failure (could be stale in serverless)
    zaiInstance = null
    return NextResponse.json(
      { error: `Error al generar el audio: ${msg}` },
      { status: 500 }
    )
  }
}
