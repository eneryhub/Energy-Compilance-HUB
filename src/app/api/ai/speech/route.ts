import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_TTS_LENGTH = 4096;
const CACHE_TTL_MS = 10 * 60 * 1000;
const audioCache = new Map<string, { buffer: Buffer; createdAt: number }>();

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'ash', 'sage', 'coral'];
const DEFAULT_VOICE = 'nova';

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      if (sentence.length > maxLength) {
        const parts = sentence.split(/[,;:]/);
        let subChunk = '';
        for (const part of parts) {
          if ((subChunk + part).length <= maxLength) {
            subChunk += part + ',';
          } else {
            if (subChunk) chunks.push(subChunk.trim().replace(/,$/, ''));
            subChunk = part + ',';
          }
        }
        if (subChunk) currentChunk = subChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim().replace(/,$/, ''));
  return chunks.filter(c => c.length > 0);
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${hash}`;
}

export async function GET() {
  return NextResponse.json({ status: 'TTS proxy online' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text?.trim();
    let voice = body.voice || DEFAULT_VOICE;
    const speed = Math.max(0.5, Math.min(2.0, Number(body.speed) || 1.0));

    if (!text) {
      return NextResponse.json({ error: 'El texto es requerido.' }, { status: 400 });
    }

    // Validar voz
    if (!VALID_VOICES.includes(voice)) {
      console.warn(`[TTS] Voz no soportada: ${voice}, usando ${DEFAULT_VOICE}`);
      voice = DEFAULT_VOICE;
    }

    const cacheKey = `${hashText(text)}_${voice}_${speed}`;
    const cached = audioCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return new NextResponse(cached.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'X-Cache': 'HIT' },
      });
    }

    let audioBuffer: Buffer;
    if (text.length <= MAX_TTS_LENGTH) {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: text,
        speed,
      });
      audioBuffer = Buffer.from(await mp3.arrayBuffer());
    } else {
      const chunks = splitTextIntoChunks(text, MAX_TTS_LENGTH);
      const buffers = [];
      for (const chunk of chunks) {
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voice as any,
          input: chunk,
          speed,
        });
        buffers.push(Buffer.from(await mp3.arrayBuffer()));
      }
      audioBuffer = Buffer.concat(buffers);
    }

    audioCache.set(cacheKey, { buffer: audioBuffer, createdAt: Date.now() });
    if (audioCache.size > 50) {
      const oldestKey = audioCache.keys().next().value;
      if (oldestKey) audioCache.delete(oldestKey);
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[TTS API Error]', error);
    return NextResponse.json(
      { error: `Error generando audio: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}