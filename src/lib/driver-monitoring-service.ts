// Energy-Compliance Hub — AI Driver Monitoring Service
// VLM-powered driver behavior analysis for DMS (Driver Monitoring System)
// Uses chatCompletion with vision support to detect fatigue, distraction, seatbelt, etc.

import { chatCompletion, type ContentPart, type MessageContent } from '@/lib/ai'

// ============ Types ============

export interface DriverAnalysisContext {
  companyId: string
  tripId?: string
  driverId?: string
  vehicleId?: string
  driverName?: string
  timestamp?: string
}

export interface DriverAnalysisResult {
  eventType: string
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  confidence: number
  observations: string[]
  recommendations: string[]
  rawAnalysis?: string
}

// ============ System Prompt ============

const DRIVER_MONITORING_PROMPT = `Eres un sistema avanzado de monitoreo de conductor (DMS - Driver Monitoring System) para vehículos industriales y de transporte pesado en operaciones Oil & Gas.

Tu función es analizar imágenes de la cabina del vehículo y detectar comportamientos de riesgo del conductor.

DETECTA Y CLASIFICA los siguientes comportamientos:

1. FATIGA / SOMNOLENCIA:
   - Ojos cerrados o párpados caídos (micro-sueños)
   - Bostezos frecuentes
   - Cabeza inclinada o balanceándose
   - Mirada fija y perdida (desconexión visual)

2. DISTRACCIÓN:
   - Uso de teléfono celular en mano
   - Manipulación de objetos en el tablero
   - Mirar hacia fuera del área de conducción (excesivo)
   - Interacción con pasajeros excesiva

3. SIN CINTURÓN DE SEGURIDAD:
   - Cinturón de seguridad no visible o no colocado correctamente

4. CONDUCCIÓN AGRESIVA:
   - Expresión facial tensa / enojada
   - Manos apretando excesivamente el volante (si visible)
   - Movimientos bruscos de cabeza (agresividad)

5. ESTADO NORMAL:
   - Conductor atento, mirando al frente
   - Manos en el volante, postura correcta
   - Cinturón colocado
   - Sin indicios de fatiga ni distracción

RESPONDE ÚNICAMENTE con un JSON válido (sin markdown, sin backticks):

{
  "eventType": "NORMAL|FATIGA|DISTRACCION_CELULAR|DISTRACCION_OBJETO|SOMNOLENCIA|SIN_CINTURON|CONDUCCION_AGRESIVA",
  "riskScore": 0.0-1.0,
  "observations": ["observación 1", "observación 2"],
  "recommendations": ["recomendación 1", "recomendación 2"]
}

Reglas de puntuación de riesgo:
- NORMAL: 0.0-0.1
- Distracción menor (cinturón mal colocado, mirada breve): 0.15-0.35
- Fatiga leve (bostezo, ojos pesados): 0.35-0.55
- Distracción moderada (teléfono visible): 0.55-0.70
- Fatiga severa (micro-sueños): 0.70-0.85
- Conducción agresiva: 0.60-0.85
- Sin cinturón + fatiga: 0.75-0.90
- Estado crítico (sueño profundo, teléfono activo + fatiga): 0.85-1.0

Sé preciso y conservador. Cuando no esté seguro, reporta el nivel más bajo de confianza.
Todas las observaciones y recomendaciones deben estar en español.`

// ============ Helper: Determine risk level from score ============

function scoreToRiskLevel(score: number): 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
  if (score <= 0.3) return 'BAJO'
  if (score <= 0.6) return 'MEDIO'
  if (score <= 0.85) return 'ALTO'
  return 'CRITICO'
}

// ============ Main Analysis Function ============

/**
 * Analyze a driver frame image using VLM to detect risky behavior.
 * Returns structured result with event type, risk level, confidence, observations, and recommendations.
 */
export async function analyzeDriverFrame(
  imageBase64: string,
  context: DriverAnalysisContext
): Promise<DriverAnalysisResult> {
  const fallbackResult: DriverAnalysisResult = {
    eventType: 'NORMAL',
    riskLevel: 'BAJO',
    confidence: 0,
    observations: ['No se pudo completar el análisis de la imagen.'],
    recommendations: ['Verifique la conexión del sistema de monitoreo.'],
  }

  if (!imageBase64 || imageBase64.trim().length === 0) {
    return {
      ...fallbackResult,
      observations: ['No se recibió imagen para analizar.'],
      recommendations: ['Verifique que la cámara esté funcionando correctamente.'],
    }
  }

  try {
    // Build the image URL for the VLM (base64 data URI)
    const dataUri = `data:image/jpeg;base64,${imageBase64.replace(/^data:image\/\w+;base64,/, '')}`

    const contentParts: ContentPart[] = [
      {
        type: 'text',
        text: `Analiza esta imagen de la cabina del vehículo${context.driverName ? ` del conductor ${context.driverName}` : ''}.\nTimestamp: ${context.timestamp || new Date().toISOString()}\nTrip ID: ${context.tripId || 'N/A'}\n\nDetecta comportamientos de riesgo y responde con el JSON solicitado.`,
      },
      {
        type: 'image_url',
        image_url: {
          url: dataUri,
          detail: 'high',
        },
      },
    ]

    const messages: Array<{ role: string; content: MessageContent }> = [
      {
        role: 'system',
        content: DRIVER_MONITORING_PROMPT,
      },
      {
        role: 'user',
        content: contentParts,
      },
    ]

    console.log(`[DMS] Analyzing driver frame for company=${context.companyId}, trip=${context.tripId || 'N/A'}`)

    const response = await chatCompletion(messages, { temperature: 0.1 })

    if (!response || response.trim().length === 0) {
      console.warn('[DMS] Empty AI response — returning fallback')
      return {
        ...fallbackResult,
        rawAnalysis: 'Empty response from AI model',
      }
    }

    console.log(`[DMS] AI response received (${response.length} chars)`)

    // Parse JSON from response (handle markdown wrapping)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[DMS] No JSON found in AI response — returning fallback')
      return {
        ...fallbackResult,
        rawAnalysis: response.substring(0, 500),
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Map the result to our standard format
    const eventType = parsed.eventType || 'NORMAL'
    const riskScore = typeof parsed.riskScore === 'number'
      ? Math.min(1, Math.max(0, parsed.riskScore))
      : 0.1

    const result: DriverAnalysisResult = {
      eventType,
      riskLevel: scoreToRiskLevel(riskScore),
      confidence: riskScore,
      observations: Array.isArray(parsed.observations) ? parsed.observations.map(String) : ['Análisis completado.'],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
      rawAnalysis: response.substring(0, 1000),
    }

    console.log(`[DMS] Analysis complete: type=${eventType}, risk=${result.riskLevel} (${riskScore.toFixed(2)}), observations=${result.observations.length}`)

    return result
  } catch (err) {
    console.error('[DMS] analyzeDriverFrame error:', err instanceof Error ? err.message : err)
    return {
      ...fallbackResult,
      rawAnalysis: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
