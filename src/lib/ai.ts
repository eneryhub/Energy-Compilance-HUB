const AI_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'
const AI_API_KEY = process.env.DEEPSEEK_API_KEY || ''

export interface DocumentExtraction {
  documentType: string
  category: 'PERSONAL' | 'EQUIPOS' | 'LEGAL' | 'AMBIENTAL'
  expiryDate: string | null
  issueDate: string | null
  holderName: string | null
  confidence: number
  summary: string
  keywords: string[]
}

/**
 * Extract information from a document using AI
 */
export async function extractDocumentData(text: string): Promise<DocumentExtraction | null> {
  if (!AI_API_KEY) {
    return null
  }

  try {
    const response = await fetch(`${AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en análisis de documentos de seguridad industrial HSE para Latinoamérica.
Extrae información estructurada. Responde ÚNICAMENTE con JSON válido:
{
  "documentType": "string",
  "category": "PERSONAL|EQUIPOS|LEGAL|AMBIENTAL",
  "expiryDate": "YYYY-MM-DD|null",
  "issueDate": "YYYY-MM-DD|null",
  "holderName": "string|null",
  "confidence": 0.0-1.0,
  "summary": "string",
  "keywords": ["string"]
}`,
          },
          {
            role: 'user',
            content: `Analiza este documento:\n\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

/**
 * Generate AI-powered alert message for expiring documents
 */
export async function generateAlertMessage(params: {
  documentTitle: string
  documentType: string
  expiryDate: string
  daysRemaining: number
  holderName?: string
}): Promise<string> {
  const { documentTitle, documentType, expiryDate, daysRemaining, holderName } = params

  if (!AI_API_KEY) {
    if (daysRemaining <= 0) {
      return `ALERTA URGENTE: ${documentType} "${documentTitle}" ${holderName ? `de ${holderName}` : ''} ha VENCIDO (${expiryDate}). Renueve inmediatamente.`
    }
    if (daysRemaining === 1) {
      return `ALERTA: ${documentType} "${documentTitle}" ${holderName ? `de ${holderName}` : ''} vence MANANA (${expiryDate}).`
    }
    return `Recordatorio: ${documentType} "${documentTitle}" ${holderName ? `de ${holderName}` : ''} vence en ${daysRemaining} dias (${expiryDate}).`
  }

  try {
    const response = await fetch(`${AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Genera mensajes de alerta claros y concisos en español para seguridad industrial. Maximo 160 caracteres.',
          },
          {
            role: 'user',
            content: `Genera alerta para documento: ${documentType} "${documentTitle}" de ${holderName || 'N/A'}, vence en ${daysRemaining} dias.`,
          },
        ],
        temperature: 0.5,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      return `${documentType} "${documentTitle}" vence en ${daysRemaining} dias.`
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || `${documentType} "${documentTitle}" vence en ${daysRemaining} dias.`
  } catch {
    return `${documentType} "${documentTitle}" vence en ${daysRemaining} dias.`
  }
}

export interface PermitReviewResult {
  overallScore: number
  riskLevel: string
  recommendation: string
  findings: Array<{
    severity: string
    category: string
    description: string
    suggestion: string
  }>
  summary: string
  reviewedAt: string
}

/**
 * Review a work permit for safety compliance using DeepSeek AI.
 * Returns a structured assessment with recommendations.
 */
export async function reviewPermitSafety(params: {
  riskType: string
  riskLabel: string
  workDescription: string
  workLocation: string
  safetyChecks: Record<string, boolean>
  technicianName: string
  supervisorName: string
  hasPhotos: boolean
  photosCount: number
}): Promise<PermitReviewResult> {
  const { riskType, riskLabel, workDescription, workLocation, safetyChecks, technicianName, supervisorName, hasPhotos, photosCount } = params

  if (!AI_API_KEY) {
    // Fallback: basic rule-based review
    const failedChecks = Object.entries(safetyChecks).filter(([, val]) => !val).map(([key]) => key)
    const allRequiredPass = true // can't determine without AI
    return {
      overallScore: failedChecks.length === 0 ? 85 : 60,
      riskLevel: riskType === 'CALIENTE' || riskType === 'ELECTRICO' ? 'ALTO' : riskType === 'ALTURA' ? 'MEDIO-ALTO' : 'MEDIO',
      recommendation: failedChecks.length === 0 ? 'APROBAR' : 'REVISAR',
      findings: [
        ...failedChecks.map(key => ({
          severity: 'warning' as const,
          category: 'checklist',
          description: `Item de verificación "${key}" no marcado`,
          suggestion: 'Verifique que este item esté cumplido antes de aprobar',
        })),
        ...(hasPhotos ? [] : [{
          severity: 'info' as const,
          category: 'evidence',
          description: 'No se adjuntaron fotos de evidencia',
          suggestion: 'Se recomienda adjuntar fotos del área de trabajo y condiciones',
        }]),
      ],
      summary: `Permisos de ${riskLabel} en ${workLocation}. ${failedChecks.length === 0 ? 'Todos los items de verificación completados.' : `${failedChecks.length} item(s) pendiente(s).`} ${hasPhotos ? `${photosCount} foto(s) adjuntada(s).` : 'Sin evidencia fotográfica.'}`,
      reviewedAt: new Date().toISOString(),
    }
  }

  try {
    const checksDescription = Object.entries(safetyChecks).map(([key, val]) =>
      `- ${key.replace(/_/g, ' ')}: ${val ? '✅ Cumplido' : '❌ No cumplido'}`
    ).join('\n')

    const response = await fetch(`${AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Eres un auditor de seguridad industrial HSE experto en normativa latinoamericana.
Analiza permisos de trabajo y genera un JSON con tu evaluación.

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "overallScore": 0-100,
  "riskLevel": "BAJO|MEDIO|MEDIO-ALTO|ALTO|CRITICO",
  "recommendation": "APROBAR|REVISAR|RECHAZAR",
  "findings": [
    {
      "severity": "critical|warning|info",
      "category": "checklist|safety|evidence|procedures|ppe",
      "description": "Descripción del hallazgo",
      "suggestion": "Recomendación para corregir"
    }
  ],
  "summary": "Resumen ejecutivo de 2-3 oraciones"
}

Criterios de scoring:
- 90-100: Todo cumplido, con fotos, checklist completo
- 70-89: Checklist mayormente completo, puede tener hallazgos menores
- 50-69: Hallazgos importantes que requieren atención
- 0-49: Riesgo crítico, no se recomienda aprobar`,
          },
          {
            role: 'user',
            content: `Analiza este permiso de trabajo:

TIPO DE RIESGO: ${riskLabel} (${riskType})
DESCRIPCIÓN: ${workDescription}
UBICACIÓN: ${workLocation}
TÉCNICO: ${technicianName}
SUPERVISOR: ${supervisorName}

LISTA DE VERIFICACIÓN:
${checksDescription}

EVIDENCIA FOTOGRÁFICA: ${hasPhotos ? `Sí, ${photosCount} foto(s)` : 'No se adjuntaron fotos'}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty AI response')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI JSON response')

    const result = JSON.parse(jsonMatch[0])
    return {
      ...result,
      reviewedAt: new Date().toISOString(),
    }
  } catch (error) {
    // Fallback on error
    const failedChecks = Object.entries(safetyChecks).filter(([, val]) => !val)
    return {
      overallScore: 70,
      riskLevel: 'MEDIO',
      recommendation: 'REVISAR',
      findings: [{
        severity: 'warning',
        category: 'system',
        description: 'No se pudo completar la revisión IA. Verificación manual requerida.',
        suggestion: 'Revise manualmente el checklist y las condiciones del trabajo.',
      }],
      summary: `Revisión IA no disponible. ${failedChecks.length} item(s) pendiente(s) en checklist.`,
      reviewedAt: new Date().toISOString(),
    }
  }
}
