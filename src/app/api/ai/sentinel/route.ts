import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatCompletion } from '@/lib/ai'

// ── Response types ──────────────────────────────────────────────────────────

interface CriticalSensor {
  id: string
  name: string
  type: string
  value: number
  unit: string
  thresholdCritical: number
}

interface ExpiringDocument {
  id: string
  title: string
  documentType: string
  expiryDate: string | null
  holderName: string | null
}

interface ActiveEmergency {
  id: string
  tipo: string
  descripcion: string | null
  createdAt: string
  userName: string
}

interface StalePermit {
  id: string
  permitNumber: string
  riskType: string
  technicianName: string
  createdAt: string
}

interface SentinelFindings {
  criticalSensors: CriticalSensor[]
  expiringDocuments: ExpiringDocument[]
  activeEmergencies: ActiveEmergency[]
  stalePermits: StalePermit[]
}

interface SentinelResponse {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  findings: SentinelFindings
  aiMessage: string | null
  totalRisks: number
  timestamp: string
}

// ── Safe query wrapper (prevents one DB error from killing the whole scan) ──

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error('[Sentinel] Query failed (non-fatal):', err instanceof Error ? err.message : err)
    return fallback
  }
}

// ── Empty response (used on errors) ─────────────────────────────────────────

const EMPTY_RESPONSE: SentinelResponse = {
  status: 'NORMAL',
  findings: {
    criticalSensors: [],
    expiringDocuments: [],
    activeEmergencies: [],
    stalePermits: [],
  },
  aiMessage: null,
  totalRisks: 0,
  timestamp: new Date().toISOString(),
}

// ── GET /api/ai/sentinel ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication — any authenticated user can call this
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId
    const now = new Date()

    // 2. Fire-and-forget SystemAlert creation for critical sensors
    //    (will be populated after the query)
    let criticalSensors: CriticalSensor[] = []

    // 3. Read-only queries — each wrapped in safeQuery so one failure
    //    doesn't kill the entire sentinel scan (graceful degradation).
    //    Uses optional chaining (?.) as guard against stale Prisma client.
    const sensors = await safeQuery(() => db.sensor.findMany({
      where: { companyId, isActive: true, currentValue: { gte: 0 } },
      select: { id: true, name: true, type: true, currentValue: true, unit: true, thresholdCritical: true },
    }), [])

    const expiringDocs = await safeQuery(() => db.hseDocument.findMany({
      where: { companyId, status: 'ACTIVE', expiryDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
      select: { id: true, title: true, documentType: true, expiryDate: true, holderName: true },
    }), [])

    const emergencies = await safeQuery(() => db.emergencyAlert.findMany({
      where: { companyId, estado: 'ACTIVA' },
      select: { id: true, tipo: true, descripcion: true, createdAt: true, user: { select: { name: true } } },
    }), [])

    const stalePermits = await safeQuery(() => db.permit.findMany({
      where: { companyId, status: 'PENDING', createdAt: { lte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
      select: { id: true, permitNumber: true, riskType: true, technicianName: true, createdAt: true },
    }), [])

    // 3a continued: Filter sensors where currentValue >= thresholdCritical
    // Defensive: guard against undefined db models in case of stale Prisma client
    criticalSensors = (Array.isArray(sensors) ? sensors : [])
      .filter((s: typeof sensors[number]) => s.currentValue !== null && s.currentValue >= s.thresholdCritical)
      .map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        value: s.currentValue!,
        unit: s.unit,
        thresholdCritical: s.thresholdCritical,
      }))

    // Map other findings — defensive Array.isArray guards
    const expiringDocuments: ExpiringDocument[] = (Array.isArray(expiringDocs) ? expiringDocs : []).map(d => ({
      id: d.id,
      title: d.title,
      documentType: d.documentType,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      holderName: d.holderName,
    }))

    const activeEmergencies: ActiveEmergency[] = emergencies
      .filter(e => e.user != null)
      .map(e => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        createdAt: e.createdAt.toISOString(),
        userName: e.user!.name,
      }))

    const stalePermitsOut: StalePermit[] = (Array.isArray(stalePermits) ? stalePermits : []).map(p => ({
      id: p.id,
      permitNumber: p.permitNumber,
      riskType: p.riskType,
      technicianName: p.technicianName,
      createdAt: p.createdAt.toISOString(),
    }))

    const findings: SentinelFindings = {
      criticalSensors,
      expiringDocuments,
      activeEmergencies,
      stalePermits: stalePermitsOut,
    }

    // 4. Auto-create SystemAlert entries (fire-and-forget, non-blocking)
    if (criticalSensors.length > 0) {
      // Use setImmediate / no-await to avoid blocking the response
      createCriticalSensorAlerts(companyId, criticalSensors).catch(err => {
        console.error('[Sentinel] Failed to create system alerts:', err instanceof Error ? err.message : err)
      })
    }

    // 5. Determine status
    const hasCritical = criticalSensors.length > 0 || activeEmergencies.length > 0
    const hasWarning = expiringDocuments.length > 0 || stalePermitsOut.length > 0

    let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL'
    if (hasCritical) status = 'CRITICAL'
    else if (hasWarning) status = 'WARNING'

    const totalRisks = criticalSensors.length + expiringDocuments.length + activeEmergencies.length + stalePermitsOut.length

    // 6. AI Integration — only call if there are findings
    let aiMessage: string | null = null

    if (totalRisks > 0) {
      try {
        const summary = buildFindingsSummary(findings)
        aiMessage = await chatCompletion(
          [
            {
              role: 'system',
              content:
                'Eres Sentinel-AI, supervisor de seguridad industrial. Analiza estos datos y genera UNA instrucción de seguridad corta y directa (máximo 2 oraciones, español). Sé específico sobre la acción requerida.',
            },
            {
              role: 'user',
              content: summary,
            },
          ],
          { temperature: 0.4 },
        )

        // Trim and cap length
        if (aiMessage) {
          aiMessage = aiMessage.trim().substring(0, 300)
        }
      } catch (err) {
        console.error(
          '[Sentinel] AI generation failed:',
          err instanceof Error ? err.message : err,
        )
        aiMessage = null
      }
    }

    // 7. Return response
    return NextResponse.json({
      status,
      findings,
      aiMessage,
      totalRisks,
      timestamp: now.toISOString(),
    } satisfies SentinelResponse)
  } catch (error) {
    console.error(
      '[Sentinel] Unhandled error:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { ...EMPTY_RESPONSE, timestamp: new Date().toISOString() },
      { status: 200 },
    )
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: create SystemAlert entries for critical sensors.
 * Only creates an alert if no duplicate exists in the last 30 minutes.
 */
async function createCriticalSensorAlerts(
  companyId: string,
  sensors: CriticalSensor[],
): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  for (const sensor of sensors) {
    try {
      // Check for duplicate alert in last 30 minutes
      const existing = await db.systemAlert.findFirst({
        where: {
          companyId,
          type: 'SENSOR_CRITICAL',
          relatedEntityId: sensor.id,
          createdAt: { gte: thirtyMinutesAgo },
        },
      })

      if (existing) continue

      // Create the alert
      await db.systemAlert.create({
        data: {
          companyId,
          type: 'SENSOR_CRITICAL',
          severity: 'CRITICAL',
          title: `Sensor CRÍTICO: ${sensor.name}`,
          message: `${sensor.type}: ${sensor.value} ${sensor.unit} (umbral: ${sensor.thresholdCritical} ${sensor.unit})`,
          relatedEntityId: sensor.id,
          relatedEntityType: 'SENSOR',
          metadata: JSON.stringify({
            sensorId: sensor.id,
            sensorName: sensor.name,
            sensorType: sensor.type,
            value: sensor.value,
            unit: sensor.unit,
            thresholdCritical: sensor.thresholdCritical,
            detectedAt: new Date().toISOString(),
          }),
        },
      })
    } catch (err) {
      // Log but don't throw — fire-and-forget per sensor
      console.error(
        `[Sentinel] Failed to create alert for sensor ${sensor.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

/**
 * Build a human-readable summary of findings for the AI prompt.
 */
function buildFindingsSummary(findings: SentinelFindings): string {
  const parts: string[] = []

  if (findings.criticalSensors.length > 0) {
    parts.push(
      `SENSORES CRÍTICOS (${findings.criticalSensors.length}):\n` +
        findings.criticalSensors
          .map(s => `- ${s.name} (${s.type}): ${s.value} ${s.unit} [umbral: ${s.thresholdCritical} ${s.unit}]`)
          .join('\n'),
    )
  }

  if (findings.activeEmergencies.length > 0) {
    parts.push(
      `EMERGENCIAS ACTIVAS (${findings.activeEmergencies.length}):\n` +
        findings.activeEmergencies
          .map(e => `- ${e.tipo}: ${e.descripcion || 'Sin descripción'} — ${e.userName} (${e.createdAt})`)
          .join('\n'),
    )
  }

  if (findings.expiringDocuments.length > 0) {
    parts.push(
      `DOCUMENTOS POR VENCER (${findings.expiringDocuments.length}):\n` +
        findings.expiringDocuments
          .map(d => `- ${d.title} (${d.documentType})${d.holderName ? ` — ${d.holderName}` : ''}: ${d.expiryDate ?? 'sin fecha'}`)
          .join('\n'),
    )
  }

  if (findings.stalePermits.length > 0) {
    parts.push(
      `PERMISOS PENDIENTES >2h (${findings.stalePermits.length}):\n` +
        findings.stalePermits
          .map(p => `- ${p.permitNumber} (${p.riskType}): ${p.technicianName} — ${p.createdAt}`)
          .join('\n'),
    )
  }

  return `ANÁLISIS DE MONITOREO PROACTIVO:\n\n${parts.join('\n\n')}`
}
