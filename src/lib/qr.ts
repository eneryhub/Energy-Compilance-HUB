// Energy-Compliance Hub — QR Code Utilities
// Handles QR code secret generation, payload building, and validation
// Uses Web Crypto API with Math.random fallback for Node.js compatibility

/**
 * Generate a cryptographically random 32-character hex string for QR code identification.
 */
export function generateQrSecret(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // Fallback to Math.random (less secure but functional)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * QR Payload structure stored as JSON in the database.
 */
export interface QrPayload {
  lid: string   // locationId
  s: string     // secret
  c: string     // companyId
  t: number     // timestamp (ms since epoch)
  exp: number   // expiration timestamp (ms since epoch, 24h from creation)
}

/**
 * Build a QR payload JSON for a work location.
 * The payload encodes locationId, secret, companyId, creation time, and expiration (24h).
 */
export function buildQrPayload(
  locationId: string,
  secret: string,
  companyId: string
): QrPayload {
  const now = Date.now()
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

  return {
    lid: locationId,
    s: secret,
    c: companyId,
    t: now,
    exp: now + TWENTY_FOUR_HOURS_MS,
  }
}

/**
 * Validation result for a scanned QR code.
 */
export interface QrValidationResult {
  valid: boolean
  locationId: string | null
  companyId: string | null
  message: string
}

/**
 * Validate a QR payload against a stored secret.
 * Checks:
 *  1. Payload structure is correct
 *  2. Secret matches
 *  3. Payload has not expired
 */
export function validateQrPayload(
  payload: unknown,
  secret: string
): QrValidationResult {
  // Check payload is an object
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'Formato de payload inválido',
    }
  }

  const p = payload as Record<string, unknown>

  // Check required fields
  if (typeof p.lid !== 'string' || !p.lid) {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'ID de ubicación faltante en el payload',
    }
  }

  if (typeof p.s !== 'string' || !p.s) {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'Secreto faltante en el payload',
    }
  }

  if (typeof p.c !== 'string' || !p.c) {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'ID de empresa faltante en el payload',
    }
  }

  // Check secret matches
  if (p.s !== secret) {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'Secreto QR no coincide — código no válido para esta ubicación',
    }
  }

  // Check expiration
  if (typeof p.exp === 'number') {
    const now = Date.now()
    if (now > p.exp) {
      return {
        valid: false,
        locationId: null,
        companyId: null,
        message: 'Código QR ha expirado (vigencia: 24 horas)',
      }
    }
  } else {
    return {
      valid: false,
      locationId: null,
      companyId: null,
      message: 'Campo de expiración faltante en el payload',
    }
  }

  // All checks passed
  return {
    valid: true,
    locationId: p.lid,
    companyId: p.c,
    message: 'Código QR válido',
  }
}

/**
 * Encode a QR payload to a compact base64 string for scanning.
 * This is the actual string that gets printed/scanned.
 */
export function encodeQrPayloadToString(payload: QrPayload): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json, 'utf-8').toString('base64')
}

/**
 * Decode a scanned QR string back to a payload object.
 */
export function decodeQrPayloadFromString(encoded: string): unknown {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    // If base64 decode fails, try parsing as raw JSON
    try {
      return JSON.parse(encoded)
    } catch {
      return null
    }
  }
}
