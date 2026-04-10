// ============================================================
// SCADA TELEMETRY ENGINE
// Dual-mode: Real (Webhook/MQTT placeholder) + Demo (Simulation)
// ============================================================

import { db } from '@/lib/db'
import { demoModeCache } from '@/lib/demo-mode-cache'
import type { Sensor } from '@prisma/client'

// ── Types ───────────────────────────────────────────────────

export type SensorType = 'PRESION' | 'TEMPERATURA' | 'GAS' | 'VOLTAJE'
export type SensorStatus = 'NORMAL' | 'WARNING' | 'CRITICO'

export interface TelemetryPoint {
  sensorId: string
  sensorName: string
  type: SensorType
  value: number
  unit: string
  status: SensorStatus
  thresholdCritical: number
  thresholdWarning: number
  isSimulated: boolean
  timestamp: string
}

export interface SiteSafetyCheck {
  isSafe: boolean
  criticalSensors: Array<{
    id: string
    name: string
    type: string
    value: number
    unit: string
    threshold: number
  }>
  warningSensors: Array<{
    id: string
    name: string
    type: string
    value: number
    unit: string
  }>
}

// ── Sensor Configuration Profiles ───────────────────────────

interface SensorProfile {
  baseValue: number
  fluctuation: number
  unit: string
  thresholdCritical: number
  thresholdWarning: number
  // Probability of a spike toward critical (0-1)
  spikeProbability: number
  // Spike intensity (fraction of distance to critical)
  spikeIntensity: number
  // Min value (for gas, voltage can't go negative)
  minValue: number
}

const SENSOR_PROFILES: Record<SensorType, SensorProfile> = {
  PRESION: {
    baseValue: 45,
    fluctuation: 8,
    unit: 'psi',
    thresholdCritical: 100,
    thresholdWarning: 80,
    spikeProbability: 0.03,
    spikeIntensity: 0.7,
    minValue: 0,
  },
  TEMPERATURA: {
    baseValue: 65,
    fluctuation: 12,
    unit: '°C',
    thresholdCritical: 90,
    thresholdWarning: 78,
    spikeProbability: 0.04,
    spikeIntensity: 0.8,
    minValue: 15,
  },
  GAS: {
    baseValue: 1.5,
    fluctuation: 1.0,
    unit: '%LEL',
    thresholdCritical: 5.0,
    thresholdWarning: 3.5,
    spikeProbability: 0.05,
    spikeIntensity: 0.85,
    minValue: 0,
  },
  VOLTAJE: {
    baseValue: 220,
    fluctuation: 15,
    unit: 'V',
    thresholdCritical: 250,
    thresholdWarning: 240,
    spikeProbability: 0.02,
    spikeIntensity: 0.6,
    minValue: 0,
  },
}

// ── Simulation Engine ───────────────────────────────────────

// In-memory state for smoothing: stores previous values per sensor
const previousValues = new Map<string, number>()

/**
 * Generate a realistic simulated value for a sensor.
 * Uses Brownian motion with mean reversion and occasional spikes.
 */
export function generateSimulatedValue(sensor: Sensor): number {
  const profile = SENSOR_PROFILES[sensor.type as SensorType]
  if (!profile) return 0

  const prev = previousValues.get(sensor.id) ?? profile.baseValue

  // Mean reversion: gently pull back toward base value
  const meanReversion = (profile.baseValue - prev) * 0.1

  // Random walk component
  const noise = (Math.random() - 0.5) * 2 * profile.fluctuation

  // Spike simulation: occasionally jump toward critical
  let spike = 0
  if (Math.random() < profile.spikeProbability) {
    const distToCritical = profile.thresholdCritical - prev
    spike = distToCritical * profile.spikeIntensity * (0.5 + Math.random() * 0.5)
  }

  // Calculate new value with smoothing (70% previous + 30% new)
  const rawNew = prev * 0.7 + (prev + meanReversion + noise + spike) * 0.3

  // Clamp to valid range
  const newValue = Math.max(profile.minValue, Math.min(profile.thresholdCritical * 1.15, rawNew))

  previousValues.set(sensor.id, newValue)
  return Math.round(newValue * 10) / 10
}

/**
 * Determine sensor status based on current value and thresholds.
 */
export function getSensorStatus(value: number, thresholdCritical: number, thresholdWarning: number): SensorStatus {
  if (value >= thresholdCritical) return 'CRITICO'
  if (thresholdWarning > 0 && value >= thresholdWarning) return 'WARNING'
  return 'NORMAL'
}

/**
 * Get the profile defaults for a sensor type.
 */
export function getSensorProfileDefaults(type: SensorType): Omit<SensorProfile, 'spikeProbability' | 'spikeIntensity' | 'minValue'> {
  const profile = SENSOR_PROFILES[type]
  return {
    baseValue: profile.baseValue,
    fluctuation: profile.fluctuation,
    unit: profile.unit,
    thresholdCritical: profile.thresholdCritical,
    thresholdWarning: profile.thresholdWarning,
  }
}

/**
 * Get all sensor types available.
 */
export function getSensorTypes(): Array<{ value: SensorType; label: string; unit: string; icon: string }> {
  return [
    { value: 'PRESION', label: 'Presión', unit: 'psi', icon: 'Gauge' },
    { value: 'TEMPERATURA', label: 'Temperatura', unit: '°C', icon: 'Thermometer' },
    { value: 'GAS', label: 'Gas (LEL)', unit: '%LEL', icon: 'Cloud' },
    { value: 'VOLTAJE', label: 'Voltaje', unit: 'V', icon: 'Zap' },
  ]
}

// ── Interlock / Safety Gate ─────────────────────────────────

/**
 * Check if a work location is safe (no sensors in CRITICO state).
 * This is the Security Gate function.
 */
export async function isSiteSafe(locationId: string, companyId: string): Promise<SiteSafetyCheck> {
  const sensors = await db.sensor.findMany({
    where: {
      locationId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      currentValue: true,
      unit: true,
      thresholdCritical: true,
      thresholdWarning: true,
    },
  })

  const criticalSensors: SiteSafetyCheck['criticalSensors'] = []
  const warningSensors: SiteSafetyCheck['warningSensors'] = []

  for (const sensor of sensors) {
    const value = sensor.currentValue ?? 0
    const status = getSensorStatus(value, sensor.thresholdCritical, sensor.thresholdWarning)

    if (status === 'CRITICO') {
      criticalSensors.push({
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        value,
        unit: sensor.unit,
        threshold: sensor.thresholdCritical,
      })
    } else if (status === 'WARNING') {
      warningSensors.push({
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        value,
        unit: sensor.unit,
      })
    }
  }

  return {
    isSafe: criticalSensors.length === 0,
    criticalSensors,
    warningSensors,
  }
}

/**
 * Check if ANY location in the company has critical sensors.
 * Used as a global safety check.
 */
export async function isCompanySafe(companyId: string): Promise<SiteSafetyCheck> {
  const sensors = await db.sensor.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      currentValue: true,
      unit: true,
      thresholdCritical: true,
      thresholdWarning: true,
    },
  })

  const criticalSensors: SiteSafetyCheck['criticalSensors'] = []
  const warningSensors: SiteSafetyCheck['warningSensors'] = []

  for (const sensor of sensors) {
    const value = sensor.currentValue ?? 0
    const status = getSensorStatus(value, sensor.thresholdCritical, sensor.thresholdWarning)

    if (status === 'CRITICO') {
      criticalSensors.push({
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        value,
        unit: sensor.unit,
        threshold: sensor.thresholdCritical,
      })
    } else if (status === 'WARNING') {
      warningSensors.push({
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        value,
        unit: sensor.unit,
      })
    }
  }

  return {
    isSafe: criticalSensors.length === 0,
    criticalSensors,
    warningSensors,
  }
}

// ── Webhook Receiver (Real Mode Placeholder) ────────────────

/**
 * Receive sensor data from external sources (Webhook/MQTT).
 * In production, this would be called by an MQTT subscriber or webhook handler.
 */
export async function ingestSensorData(
  sensorId: string,
  value: number,
  source: 'webhook' | 'mqtt' | 'manual' = 'webhook',
  companyId?: string | null
): Promise<TelemetryPoint | { blocked: true; reason: string } | null> {
  // ── Find sensor with optional multi-tenant guard ───────
  const sensor = await db.sensor.findFirst({
    where: {
      id: sensorId,
      ...(companyId ? { companyId } : {}),
      isActive: true,
    },
  })

  if (!sensor) {
    console.error(
      `[Ingest] Sensor not found or inactive`,
      { sensorId, companyId: companyId || '(none)', source }
    )
    return null
  }

  // If companyId was provided, verify ownership
  if (companyId && sensor.companyId !== companyId) {
    console.error(
      `[Ingest] SECURITY: Sensor ${sensorId} belongs to company ${sensor.companyId}, not ${companyId}`
    )
    return null
  }

  // ── Block external data for simulated sensors ───────────
  if (sensor.isSimulated) {
    console.warn(
      `[Ingest] BLOCKED: Sensor ${sensorId} is in demo/simulation mode — external telemetry rejected`
    )
    return { blocked: true, reason: 'Sensor en modo demostración: no se acepta telemetría externa' }
  }

  const status = getSensorStatus(value, sensor.thresholdCritical, sensor.thresholdWarning)

  // Update current value
  await db.sensor.update({
    where: { id: sensor.id },
    data: {
      currentValue: value,
      lastReadingAt: new Date(),
    },
  })

  // Store reading
  await db.sensorReading.create({
    data: {
      sensorId: sensor.id,
      value,
      status,
    },
  })

  // Cleanup old readings (keep last 200 per sensor)
  const oldReadings = await db.sensorReading.findMany({
    where: { sensorId: sensor.id },
    orderBy: { timestamp: 'asc' },
    take: 50,
    select: { id: true },
  })
  if (oldReadings.length >= 50) {
    await db.sensorReading.deleteMany({
      where: { id: { in: oldReadings.map(r => r.id) } },
    })
  }

  return {
    sensorId: sensor.id,
    sensorName: sensor.name,
    type: sensor.type as SensorType,
    value,
    unit: sensor.unit,
    status,
    thresholdCritical: sensor.thresholdCritical,
    thresholdWarning: sensor.thresholdWarning,
    isSimulated: sensor.isSimulated,
    timestamp: new Date().toISOString(),
  }
}

// ── Simulation Mode: Run All Active Simulated Sensors ───────

/**
 * Run simulation tick for all active simulated sensors of a company.
 * Returns telemetry points for all sensors.
 */
export async function runSimulationTick(companyId: string): Promise<TelemetryPoint[]> {
  const sensors = await db.sensor.findMany({
    where: {
      companyId,
      isActive: true,
      isSimulated: true,
    },
  })

  const results: TelemetryPoint[] = []

  for (const sensor of sensors) {
    const newValue = generateSimulatedValue(sensor)
    const status = getSensorStatus(newValue, sensor.thresholdCritical, sensor.thresholdWarning)
    const now = new Date()

    // Update sensor
    await db.sensor.update({
      where: { id: sensor.id },
      data: {
        currentValue: newValue,
        lastReadingAt: now,
      },
    })

    // Store reading
    await db.sensorReading.create({
      data: {
        sensorId: sensor.id,
        value: newValue,
        status,
      },
    })

    results.push({
      sensorId: sensor.id,
      sensorName: sensor.name,
      type: sensor.type as SensorType,
      value: newValue,
      unit: sensor.unit,
      status,
      thresholdCritical: sensor.thresholdCritical,
      thresholdWarning: sensor.thresholdWarning,
      isSimulated: true,
      timestamp: now.toISOString(),
    })
  }

  // Cleanup old readings for each sensor
  for (const sensor of sensors) {
    const count = await db.sensorReading.count({ where: { sensorId: sensor.id } })
    if (count > 200) {
      const oldReadings = await db.sensorReading.findMany({
        where: { sensorId: sensor.id },
        orderBy: { timestamp: 'asc' },
        take: count - 150,
        select: { id: true },
      })
      if (oldReadings.length > 0) {
        await db.sensorReading.deleteMany({
          where: { id: { in: oldReadings.map(r => r.id) } },
        })
      }
    }
  }

  return results
}

/**
 * Get telemetry data for all sensors of a company.
 * If simulation is enabled, runs a simulation tick first.
 */
export async function getTelemetry(companyId: string, runSimulation: boolean): Promise<{
  points: TelemetryPoint[]
  siteSafety: SiteSafetyCheck
}> {
  let points: TelemetryPoint[] = []

  if (runSimulation) {
    points = await runSimulationTick(companyId)
  } else {
    // Return current values for all active sensors
    const sensors = await db.sensor.findMany({
      where: { companyId, isActive: true },
    })
    points = sensors.map(sensor => ({
      sensorId: sensor.id,
      sensorName: sensor.name,
      type: sensor.type as SensorType,
      value: sensor.currentValue ?? 0,
      unit: sensor.unit,
      status: getSensorStatus(sensor.currentValue ?? 0, sensor.thresholdCritical, sensor.thresholdWarning),
      thresholdCritical: sensor.thresholdCritical,
      thresholdWarning: sensor.thresholdWarning,
      isSimulated: sensor.isSimulated,
      timestamp: sensor.lastReadingAt?.toISOString() ?? new Date().toISOString(),
    }))
  }

  const siteSafety = await isCompanySafe(companyId)

  return { points, siteSafety }
}

/**
 * Get historical readings for a specific sensor.
 */
export async function getSensorReadings(
  sensorId: string,
  companyId: string,
  limit: number = 60
): Promise<Array<{ value: number; status: string; timestamp: string }>> {
  const sensor = await db.sensor.findUnique({
    where: { id: sensorId },
    select: { companyId: true },
  })

  if (!sensor || sensor.companyId !== companyId) return []

  const readings = await db.sensorReading.findMany({
    where: { sensorId },
    orderBy: { timestamp: 'asc' },
    take: limit,
  })

  return readings.map(r => ({
    value: r.value,
    status: r.status,
    timestamp: r.timestamp.toISOString(),
  }))
}

// ── Demo Mode State (persisted in database per company) ───

/**
 * Check if demo/simulation mode is enabled for a company.
 * DB is the PRIMARY source of truth. Cache is a secondary fast path.
 */
export async function isDemoMode(companyId: string): Promise<boolean> {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { scadaDemoMode: true },
    })
    const dbValue = company?.scadaDemoMode ?? true

    // Update cache with the authoritative DB value
    demoModeCache.set(companyId, dbValue)
    return dbValue
  } catch (error) {
    console.error('[SCADA] isDemoMode DB read failed, using cache:', error instanceof Error ? error.message : error)
    // DB failed — check cache as fallback
    const cached = demoModeCache.get(companyId)
    if (cached !== undefined) return cached
    // No cache either — safest default is demo mode ON
    return true
  }
}

/**
 * Set demo/simulation mode for a company.
 * Persists to DB FIRST (primary), then updates cache (secondary).
 */
export async function setDemoMode(companyId: string, enabled: boolean): Promise<boolean> {
  try {
    // 1) Persist to DB — this is the source of truth
    const company = await db.company.update({
      where: { id: companyId },
      data: { scadaDemoMode: enabled },
      select: { scadaDemoMode: true },
    })
    const confirmedValue = company.scadaDemoMode

    // 2) Update cache to stay in sync
    demoModeCache.set(companyId, confirmedValue)

    return confirmedValue
  } catch (error) {
    console.error('[SCADA] setDemoMode DB write failed, using cache:', error instanceof Error ? error.message : error)
    // DB failed — still update cache so current instance works
    demoModeCache.set(companyId, enabled)
    return enabled
  }
}
