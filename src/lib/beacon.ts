// Energy-Compliance Hub — iBeacon Utilities
// Handles beacon UUID validation, generation, and proximity checking

// iBeacon UUID format: 8-4-4-4-12 hex characters (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Validate whether a string is a properly formatted iBeacon UUID.
 * Expected format: 8-4-4-4-12 hex segments (e.g., "A1B2C3D4-E5F6-7890-ABCD-EF1234567890").
 */
export function isValidBeaconUuid(uuid: string): boolean {
  return UUID_REGEX.test(uuid)
}

/**
 * Generate a random valid iBeacon UUID (uppercase, 8-4-4-4-12 format).
 * Uses crypto.getRandomValues for better randomness, with Math.random fallback.
 */
export function generateBeaconUuid(): string {
  const hex = (count: number): string => {
    const bytes = new Uint8Array(count)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
    }
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }

  return `${hex(4)}-${hex(2)}-${hex(2)}-${hex(2)}-${hex(6)}`
}

/**
 * Beacon proximity validation result.
 */
export interface BeaconProximityResult {
  inRange: boolean
  distanceEstimate: string
  message: string
}

/**
 * Validate whether a detected beacon RSSI falls within acceptable proximity range.
 * 
 * Logic: detectedRssi must be >= (configuredRssi - 15)
 * - A weaker signal (more negative RSSI) means the device is further away
 * - We allow a 15 dBm tolerance from the configured reference RSSI
 * 
 * RSSI ranges (approximate):
 *  -30 to -40: Very close (< 1m)
 *  -40 to -60: Near (1-3m)
 *  -60 to -80: Far (3-10m)
 *  -80 to -100: Very far (> 10m)
 */
export function validateBeaconProximity(
  detectedRssi: number,
  configRssi: number
): BeaconProximityResult {
  const MIN_RSSI_THRESHOLD = configRssi - 15

  if (detectedRssi >= MIN_RSSI_THRESHOLD) {
    // Determine rough distance category
    let distanceEstimate: string
    if (detectedRssi >= -40) {
      distanceEstimate = 'Muy cerca (< 1m)'
    } else if (detectedRssi >= -60) {
      distanceEstimate = 'Cerca (1-3m)'
    } else if (detectedRssi >= -75) {
      distanceEstimate = 'Moderado (3-8m)'
    } else {
      distanceEstimate = 'Lejano (8-15m)'
    }

    return {
      inRange: true,
      distanceEstimate,
      message: `Beacon detectado en rango — ${distanceEstimate} (RSSI: ${detectedRssi} dBm, umbral: ${MIN_RSSI_THRESHOLD} dBm)`,
    }
  }

  return {
    inRange: false,
    distanceEstimate: 'Fuera de rango',
    message: `Beacon fuera de rango — señal demasiado débil (RSSI detectado: ${detectedRssi} dBm, umbral mínimo: ${MIN_RSSI_THRESHOLD} dBm)`,
  }
}
