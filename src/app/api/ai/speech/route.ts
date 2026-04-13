import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { cwd } from 'process'

const MAX_TTS_LENGTH = 1024

// ── Asegurar que el archivo de configuración existe en /tmp ──
let _configWritten = false

function ensureZaiConfig(): void {
  if (_configWritten) return

  // Directorio temporal de Vercel (escribible)
  const tmpDir = '/tmp'
  const configPath = join(tmpDir, '.z-ai-config')

  // Valores desde variables de entorno o fallbacks
  const config = {
    baseUrl: process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1',
    apiKey: process.env.ZAI_API_KEY || 'Z.ai',
    chatId: process.env.ZAI_CHAT_ID || 'chat-5200c261-8042-42ab-ab8c-067f81d5f418',
    token: process.env.ZAI_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2NhZDFmN2ItNzQxOS00OGM2LWEwNDItNTFhOGRkMDgwOGYxIiwiY2hhdF9pZCI6ImNoYXQtNTIwMGMyNjEtODA0Mi00MmFiLWFiOGMtMDY3ZjgxZDVmNDE4IiwicGxhdGZvcm0iOiIifQ.rSR8P0eiUQvM2M8SjLHVz-GDbdJaEKgeUbtIMwQSRFQ',
    userId: process.env.ZAI_USER_ID || 'ccad1f7b-7419-48c6-a042-51a8dd0808f1',
  }

  try {
    // Asegurar que el directorio existe
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true })
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    console.log('[TTS] Config file written to', configPath)
    _configWritten = true
  } catch (err) {
    console.error('[TTS] Failed to write config file:', err)
    throw new Error('No se pudo crear la configuración de TTS')
  }
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

// ── GET: Health check ──
export async function GET() {
  return NextResponse.json({
    status: 'TTS proxy is online',
    timestamp: new Date().toISOString(),
  })
}

// ── POST: Generate TTS audio (con archivo de configuración en /tmp) ──
const audioCache = new Map<string, { buffer: Buffer; createdAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    // 1. Asegurar que la configuración existe
    ensureZaiConfig()

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

    // 2. Importar SDK (después de tener el archivo de configuración)
    const ZAI = (await import('z-ai-web-dev-sdk')).default

    // 3. Forzar que el SDK busque en /tmp también (opcional, pero el SDK lo hace por defecto)
    // Algunas versiones del SDK buscan en el directorio actual, home y /etc.
    // Para asegurar, podemos cambiar el directorio de trabajo temporalmente (no recomendado)
    // En su lugar, creamos un enlace simbólico desde /tmp/.z-ai-config a la raíz del proyecto (no funciona en Vercel)
    // Por lo tanto, la mejor opción es escribir el archivo en /tmp y también en process.cwd() si es escribible.
    // En Vercel, process.cwd() es de solo lectura, así que confiamos en que el SDK busca en /etc, home y directorio actual.
    // Como no podemos escribir en /etc ni en home, necesitamos que el SDK soporte variable de entorno.
    // Por desgracia, la única forma confiable es usar la configuración inline si el SDK la soporta.
    // Pero vemos que no la soporta. Entonces, ¿qué hacemos?
    // Vamos a intentar escribir también en el directorio actual, si es posible (en desarrollo local sí, en producción no).
    // Para producción, el SDK debe ser parcheado o usaremos otra librería.
    // Como solución de emergencia, podemos usar el endpoint directamente con fetch a un servicio TTS real.

    // Como el SDK no coopera, implementaremos una llamada HTTP directa al servicio TTS real
    // usando la configuración que tenemos. Esto evita depender del SDK.

    // ── NUEVO: Llamada HTTP directa al servicio TTS ──
    const config = {
      baseUrl: process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1',
      apiKey: process.env.ZAI_API_KEY || 'Z.ai',
      chatId: process.env.ZAI_CHAT_ID || 'chat-5200c261-8042-42ab-ab8c-067f81d5f418',
      token: process.env.ZAI_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2NhZDFmN2ItNzQxOS00OGM2LWEwNDItNTFhOGRkMDgwOGYxIiwiY2hhdF9pZCI6ImNoYXQtNTIwMGMyNjEtODA0Mi00MmFiLWFiOGMtMDY3ZjgxZDVmNDE4IiwicGxhdGZvcm0iOiIifQ.rSR8P0eiUQvM2M8SjLHVz-GDbdJaEKgeUbtIMwQSRFQ',
      userId: process.env.ZAI_USER_ID || 'ccad1f7b-7419-48c6-a042-51a8dd0808f1',
    }

    const ttsUrl = `${config.baseUrl}/audio/tts`
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        input: text.slice(0, MAX_TTS_LENGTH),
        voice: voice,
        speed: speed,
        response_format: 'wav',
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS service responded with ${response.status}: ${errorText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(new Uint8Array(arrayBuffer))

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