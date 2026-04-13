// ═══════════════════════════════════════════════════════════════
// AI Speech TTS Proxy — Backend-only route
// Uses z-ai-web-dev-sdk to generate speech via TTS model.
// Client-side components call POST /api/ai/speech to get audio.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Text max length per TTS API constraint
const MAX_TTS_LENGTH = 1024

// ── Ensure .z-ai-config exists at runtime ──
// The SDK reads this file to find baseUrl / apiKey. On Vercel:
//   - /var/task (process.cwd()) is READ-ONLY → write fails silently
//   - /etc is also read-only
//   - /tmp IS writable → write there and point HOME to /tmp
// The SDK checks os.homedir() which uses the HOME env var.
let _configEnsured = false

function ensureZaiConfig(): void {
  if (_configEnsured) return

  // First: check if already exists in standard locations
  const checkPaths = [
    join(process.cwd(), '.z-ai-config'),
    '/etc/.z-ai-config',
    join(process.env.HOME || '', '.z-ai-config'),
  ]
  for (const p of checkPaths) {
    if (p && existsSync(p)) {
      _configEnsured = true
      console.log(`[TTS] .z-ai-config found at ${p}`)
      return
    }
  }

  // Build config from environment or hardcoded defaults (dev sandbox)
  const config = JSON.stringify({
    baseUrl: process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1',
    apiKey: process.env.ZAI_API_KEY || 'Z.ai',
    chatId: process.env.ZAI_CHAT_ID || 'chat-5200c261-8042-42ab-ab8c-067f81d5f418',
    token: process.env.ZAI_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2NhZDFmN2ItNzQxOS00OGM2LWEwNDItNTFhOGRkMDgwOGYxIiwiY2hhdF9pZCI6ImNoYXQtNTIwMGMyNjEtODA0Mi00MmFiLWFiOGMtMDY3ZjgxZDVmNDE4IiwicGxhdGZvcm0iOiIifQ.rSR8P0eiUQvM2M8SjLHVz-GDbdJaEKgeUbtIMwQSRFQ',
    userId: process.env.ZAI_USER_ID || 'ccad1f7b-7419-48c6-a042-51a8dd0808f1',
  })

  // Try multiple writable locations (Vercel → /tmp, local dev → cwd)
  const writeAttempts = [
    { path: join(process.cwd(), '.z-ai-config'), label: 'project root' },
    { path: '/tmp/.z-ai-config', label: '/tmp' },
  ]

  for (const attempt of writeAttempts) {
    try {
      writeFileSync(attempt.path, config, 'utf-8')
      console.log(`[TTS] .z-ai-config written to ${attempt.label}: ${attempt.path}`)

      // If we wrote to /tmp, point HOME there so the SDK finds it
      if (attempt.path.startsWith('/tmp')) {
        process.env.HOME = '/tmp'
        console.log('[TTS] Set HOME=/tmp for SDK config lookup')
      }
      _configEnsured = true
      return
    } catch {
      // Try next location
    }
  }

  console.error('[TTS] Failed to write .z-ai-config to any location')
  _configEnsured = true
}

function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
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

function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `${hash}`
}

// ── GET: Health check / diagnostics ──
// Call GET /api/ai/speech in browser to see if SDK works on Vercel
export async function GET() {
  const diagnostics: Record<string, string | number | boolean> = {
    timestamp: new Date().toISOString(),
    platform: process.platform || 'unknown',
    nodeVersion: process.version || 'unknown',
    runtime: typeof EdgeRuntime !== 'undefined' ? 'edge' : 'nodejs',
    env: process.env.NODE_ENV || 'unknown',
  }

  try {
    ensureZaiConfig()

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    diagnostics.sdkLoaded = true
    diagnostics.sdkType = typeof zai
    diagnostics.audioModule = typeof zai?.audio
    diagnostics.ttsModule = typeof zai?.audio?.tts
    diagnostics.createFn = typeof zai?.audio?.tts?.create

    // Quick test with minimal text
    const testResponse = await zai.audio.tts.create({
      input: 'Test',
      voice: 'kazi',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    })
    const testBuffer = await testResponse.arrayBuffer()
    diagnostics.testAudioBytes = testBuffer.byteLength
    diagnostics.status = 'OK'

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    diagnostics.sdkLoaded = false
    diagnostics.status = 'FAILED'
    const msg = error instanceof Error
      ? `${error.message} | stack: ${error.stack?.slice(0, 500)}`
      : String(error)
    diagnostics.error = msg

    return NextResponse.json(diagnostics, { status: 500 })
  }
}

// ── POST: Generate TTS audio ──
// In-memory cache (evicts on serverless cold start — acceptable for guide descriptions)
const audioCache = new Map<string, { buffer: Buffer; createdAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    // Ensure config file exists before SDK init
    ensureZaiConfig()

    const body = await req.json()
    const text = body.text?.trim()
    const voice = body.voice || 'kazi'
    const speed = body.speed || 1.0

    if (!text) {
      return NextResponse.json({ error: 'El texto es requerido.' }, { status: 400 })
    }

    if (text.length > 2048) {
      return NextResponse.json({ error: 'Texto excede 2048 caracteres.' }, { status: 400 })
    }

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

    // Generate TTS — create fresh instance each call (serverless-safe)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

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
    if (audioCache.size > 30) {
      const oldestKey = audioCache.keys().next().value
      if (oldestKey) audioCache.delete(oldestKey)
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.length),
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[TTS API Error]', msg, stack)
    return NextResponse.json(
      { error: `TTS Error: ${msg}`, stack: stack?.slice(0, 1000) },
      { status: 500 }
    )
  }
}
