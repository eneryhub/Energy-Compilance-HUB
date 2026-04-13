import { NextRequest, NextResponse } from 'next/server'

const MAX_TTS_LENGTH = 1024

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

// ── GET: Health check (opcional) ──
export async function GET() {
  return NextResponse.json({
    status: 'TTS proxy is online',
    timestamp: new Date().toISOString(),
  })
}

// ── POST: Generate TTS audio (sin archivo de configuración) ──
const audioCache = new Map<string, { buffer: Buffer; createdAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = body.text?.trim()
    const voice = body.voice || 'kazi'
    const speed = Math.max(0.5, Math.min(2.0, Number(body.speed) || 1.0))

    if (!text) {
      return NextResponse.json({ error: 'El texto es requerido.' }, { status: 400 })
    }
    if (text.length > 2048) {
      return NextResponse.json({ error: 'Texto excede 2048 caracteres.' }, { status: 400 })
    }

    const cacheKey = `${hashText(text)}_${voice}_${speed}`
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

    // Import SDK y crear instancia con configuración inline
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create({
      baseUrl: process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1',
      apiKey: process.env.ZAI_API_KEY || 'Z.ai',
      chatId: process.env.ZAI_CHAT_ID || 'chat-5200c261-8042-42ab-ab8c-067f81d5f418',
      token: process.env.ZAI_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2NhZDFmN2ItNzQxOS00OGM2LWEwNDItNTFhOGRkMDgwOGYxIiwiY2hhdF9pZCI6ImNoYXQtNTIwMGMyNjEtODA0Mi00MmFiLWFiOGMtMDY3ZjgxZDVmNDE4IiwicGxhdGZvcm0iOiIifQ.rSR8P0eiUQvM2M8SjLHVz-GDbdJaEKgeUbtIMwQSRFQ',
      userId: process.env.ZAI_USER_ID || 'ccad1f7b-7419-48c6-a042-51a8dd0808f1',
    })

    let audioBuffer: Buffer

    if (text.length <= MAX_TTS_LENGTH) {
      const response = await zai.audio.tts.create({
        input: text,
        voice,
        speed,
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
          speed,
          response_format: 'wav',
          stream: false,
        })
        const arrayBuffer = await response.arrayBuffer()
        buffers.push(Buffer.from(new Uint8Array(arrayBuffer)))
      }
      audioBuffer = Buffer.concat(buffers)
    }

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
    console.error('[TTS API Error]', msg)
    return NextResponse.json({ error: `TTS Error: ${msg}` }, { status: 500 })
  }
}