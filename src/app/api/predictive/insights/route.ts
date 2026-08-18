import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { chatCompletion, getAISource } from '@/lib/ai'

// ============ In-memory cache ============
const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ============ Types ============

interface SensorPrediction {
  sensorId: string
  sensorName: string
  type: string
  currentValue: number
  unit: string
  trend: 'rising' | 'falling' | 'stable'
  failureProbability: number
  maintenanceDays: number
  recommendation: string
}

interface PredictiveResponse {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  sensors: SensorPrediction[]
  analyzedAt: string
  aiSource: 'openai' | 'sdk' | 'fallback'
}

// ============ Helper: calculate trend from readings ============

function calculateTrend(readings: { value: number }[]): 'rising' | 'falling' | 'stable' {
  if (readings.length < 10) return 'stable'
  // Compare first half average vs second half average
  const half = Math.floor(readings.length / 2)
  const firstHalf = readings.slice(0, half)
  const secondHalf = readings.slice(half)
  const avgFirst = firstHalf.reduce((s, r) => s + r.value, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, r) => s + r.value, 0) / secondHalf.length
  const diff = avgSecond - avgFirst
  const pctChange = Math.abs(diff / (avgFirst || 1)) * 100
  if (pctChange < 3) return 'stable'
  return diff > 0 ? 'rising' : 'falling'
}

// ============ Helper: generate mock predictions from sensor data ============

function generateMockPredictions(
  sensors: {
    id: string
    name: string
    type: string
    currentValue: number | null
    unit: string
    thresholdCritical: number
    thresholdWarning: number
    readings: { value: number; status: string }[]
  }[]
): PredictiveResponse {
  const predictions: SensorPrediction[] = []
  let totalRisk = 0

  for (const sensor of sensors) {
    const current = sensor.currentValue ?? 0
    const readings = sensor.readings || []
    const trend = calculateTrend(readings)

    // Calculate failure probability based on thresholds
    let prob = 5
    if (sensor.thresholdWarning > 0) {
      const warningRatio = current / sensor.thresholdWarning
      if (warningRatio > 0.8) prob = 35
      if (warningRatio > 0.9) prob = 55
      if (warningRatio > 1.0) prob = 75
    }
    if (sensor.thresholdCritical > 0) {
      const criticalRatio = current / sensor.thresholdCritical
      if (criticalRatio > 0.7) prob = Math.max(prob, 60)
      if (criticalRatio > 0.85) prob = Math.max(prob, 80)
      if (criticalRatio > 0.95) prob = Math.max(prob, 95)
    }
    // Trend increases risk
    if (trend === 'rising') prob = Math.min(100, prob + 15)
    if (trend === 'falling') prob = Math.max(0, prob - 10)

    // Clamp
    prob = Math.max(0, Math.min(100, Math.round(prob)))

    // Maintenance days inversely proportional to risk
    let days = prob < 25 ? 90 : prob < 50 ? 45 : prob < 75 ? 14 : prob < 90 ? 5 : 1
    if (trend === 'rising') days = Math.max(1, Math.round(days * 0.7))

    // Recommendations
    const recommendations: Record<string, string[]> = {
      PRESION: [
        'Se recomienda calibrar el transmisor de presión y verificar las válvulas de alivio.',
        'Programar inspección de las líneas de presión y conexiones.',
        'Verificar la integridad del sensor y cables de conexión.',
      ],
      TEMPERATURA: [
        'Revisar el sistema de refrigeración y ventilación en la zona del sensor.',
        'Programar mantenimiento del sensor y verificar aislamiento térmico.',
        'Monitorear tendencias de temperatura para detectar anomalías.',
      ],
      GAS: [
        'Inspeccionar inmediatamente las zonas de posible fuga y ventilar el área.',
        'Verificar los detectores de gas y reemplazar los sensores según calendario.',
        'Revisar el sistema de extracción de gases y alarmas.',
      ],
      VOLTAJE: [
        'Inspeccionar el sistema eléctrico y verificar las protecciones.',
        'Programar mantenimiento preventivo del transformador y tableros.',
        'Verificar las conexiones y el estado de los interruptores.',
      ],
    }
    const typeRecs = recommendations[sensor.type] || [
      'Programar inspección general del sensor y sistemas asociados.',
    ]
    const rec = typeRecs[Math.floor(Math.random() * typeRecs.length)]

    predictions.push({
      sensorId: sensor.id,
      sensorName: sensor.name,
      type: sensor.type,
      currentValue: current,
      unit: sensor.unit,
      trend,
      failureProbability: prob,
      maintenanceDays: days,
      recommendation: rec,
    })

    totalRisk += prob
  }

  const avgRisk = predictions.length > 0 ? totalRisk / predictions.length : 0
  let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
  if (avgRisk >= 70) overallRisk = 'CRITICAL'
  else if (avgRisk >= 50) overallRisk = 'HIGH'
  else if (avgRisk >= 25) overallRisk = 'MEDIUM'

  const summaries: Record<string, string> = {
    LOW: 'Todos los sensores operan dentro de parámetros normales. No se requieren acciones inmediatas de mantenimiento preventivo.',
    MEDIUM: 'Algunos sensores muestran tendencias que requieren atención. Se recomienda programar mantenimiento preventivo en los próximos 30 días.',
    HIGH: 'Varios sensores presentan valores cercanos a umbrales críticos. Se requiere acción inmediata para prevenir fallos en los equipos.',
    CRITICAL: 'La situación requiere intervención inmediata. Múltiples sensores indican alto riesgo de fallo. Detener operaciones si es necesario.',
  }

  return {
    overallRisk,
    summary: summaries[overallRisk],
    sensors: predictions,
    analyzedAt: new Date().toISOString(),
  }
}

// ============ GET Handler ============

export async function GET(req: NextRequest) {
  try {
    // Authenticate
    const session = await getTokenPayload(req)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Check cache
    const cacheKey = `predictive_${session.companyId}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    // Fetch sensors with last 100 readings
    const sensors = await db.sensor.findMany({
      where: { companyId: session.companyId, isActive: true },
      include: {
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    })

    // If no sensors, return empty response
    if (sensors.length === 0) {
      const emptyResponse: PredictiveResponse = {
        overallRisk: 'LOW',
        summary: 'No hay sensores activos para analizar.',
        sensors: [],
        analyzedAt: new Date().toISOString(),
        aiSource: 'fallback',
      }
      return NextResponse.json(emptyResponse)
    }

    // Filter sensors that have readings
    const sensorsWithData = sensors.filter((s) => s.readings.length > 0)

    if (sensorsWithData.length === 0) {
      const emptyResponse: PredictiveResponse = {
        overallRisk: 'LOW',
        summary: 'Los sensores activos no tienen suficientes datos de telemetría para generar predicciones.',
        sensors: [],
        analyzedAt: new Date().toISOString(),
        aiSource: 'fallback',
      }
      return NextResponse.json(emptyResponse)
    }

    // Build prompt for AI (OpenAI on Vercel, SDK in sandbox)
    const sensorDataText = sensorsWithData
      .map((s) => {
        const readingsText = s.readings
          .map((r) => `  - valor: ${r.value}, estado: ${r.status}`)
          .join('\n')
        return `Sensor: ${s.name} (ID: ${s.id})
  Tipo: ${s.type}
  Valor actual: ${s.currentValue ?? 'N/A'} ${s.unit}
  Umbral advertencia: ${s.thresholdWarning} ${s.unit}
  Umbral crítico: ${s.thresholdCritical} ${s.unit}
  Registros de telemetría (${s.readings.length} más recientes):
${readingsText}`
      })
      .join('\n\n')

    const systemPrompt = `Eres un experto en mantenimiento industrial predictivo. Analiza los datos de telemetría de sensores industriales y genera predicciones de mantenimiento preventivo.

Debes responder SIEMPRE en formato JSON válido con esta estructura exacta:
{
  "overallRisk": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "Resumen breve de 2 frases sobre el estado general de riesgo",
  "sensors": [
    {
      "sensorId": "id del sensor",
      "sensorName": "nombre del sensor",
      "type": "tipo del sensor",
      "currentValue": valor_actual_numérico,
      "unit": "unidad de medida",
      "trend": "rising|falling|stable",
      "failureProbability": número_0_a_100,
      "maintenanceDays": días_recomendados_para_mantenimiento,
      "recommendation": "Breve recomendación de mantenimiento en español"
    }
  ]
}

Reglas:
- overallRisk se basa en el peor sensor y el promedio general
- failureProbability debe ser realista basado en los datos (no inventes números al azar)
- maintenanceDays debe ser inversamente proporcional al riesgo
- Las recomendaciones deben ser específicas al tipo de sensor y su estado actual
- Responde SOLO con el JSON, sin texto adicional`

    const userPrompt = `Analiza los siguientes datos de telemetría y genera predicciones de mantenimiento preventivo:

${sensorDataText}

Genera el análisis predictivo para cada sensor.`

    let result: PredictiveResponse

    // Try AI via centralized chatCompletion (OpenAI on Vercel)
    try {
      const content = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { temperature: 0.3 })

      if (!content) {
        throw new Error('Empty response from AI')
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in AI response')

      const parsed = JSON.parse(jsonMatch[0]) as PredictiveResponse

      // Validate structure minimally
      if (!parsed.overallRisk || !Array.isArray(parsed.sensors)) {
        throw new Error('Invalid AI response structure')
      }

      const source = getAISource() as 'openai' | 'sdk'
      console.log(`[AI] ✅ Predictive insights generated via ${source} for ${sensorsWithData.length} sensors`)

      result = {
        overallRisk: parsed.overallRisk,
        summary: parsed.summary || 'Análisis completado por IA.',
        sensors: parsed.sensors.map((s) => ({
          sensorId: s.sensorId || '',
          sensorName: s.sensorName || 'Desconocido',
          type: s.type || 'UNKNOWN',
          currentValue: Number(s.currentValue) || 0,
          unit: s.unit || '',
          trend: ['rising', 'falling', 'stable'].includes(s.trend) ? s.trend : 'stable',
          failureProbability: Math.max(0, Math.min(100, Number(s.failureProbability) || 0)),
          maintenanceDays: Math.max(0, Math.round(Number(s.maintenanceDays) || 0)),
          recommendation: s.recommendation || 'Sin recomendación disponible.',
        })),
        analyzedAt: new Date().toISOString(),
        aiSource: source,
      }
    } catch (aiError) {
      // Fall back to mock data if AI fails
      console.warn('[AI] ⚠️ Predictive insights → FALLBACK to mock data', aiError instanceof Error ? aiError.message : aiError)
      result = generateMockPredictions(sensorsWithData)
      result.aiSource = 'fallback'
    }

    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Predictive insights error:', error)
    return NextResponse.json(
      { error: 'Error al generar análisis predictivo' },
      { status: 500 }
    )
  }
}
