export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface GeofenceResult {
  isWithinRadius: boolean
  distanceMeters: number
  centerLatitude: number
  centerLongitude: number
  radiusMeters: number
}

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistance(coord1: GPSCoordinates, coord2: GPSCoordinates): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(coord2.latitude - coord1.latitude)
  const dLon = toRad(coord2.longitude - coord1.longitude)

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) * Math.cos(toRad(coord2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Check if a coordinate is within a geofence radius.
 */
export function checkGeofence(
  point: GPSCoordinates,
  center: GPSCoordinates,
  radiusMeters: number
): GeofenceResult {
  const distance = calculateDistance(point, center)
  return {
    isWithinRadius: distance <= radiusMeters,
    distanceMeters: Math.round(distance * 100) / 100,
    centerLatitude: center.latitude,
    centerLongitude: center.longitude,
    radiusMeters
  }
}

/**
 * Get GPS coordinates from the browser (client-side only).
 */
export function getCurrentPosition(): Promise<GPSCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por este navegador'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Permiso de ubicación denegado. Active la geolocalización.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Ubicación no disponible. Verifique su GPS.'))
            break
          case error.TIMEOUT:
            reject(new Error('Tiempo de espera agotado al obtener ubicación.'))
            break
          default:
            reject(new Error('Error desconocido al obtener ubicación.'))
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

/**
 * Generate a SHA-256 hash for signature integrity verification.
 */
export async function hashSignature(signatureData: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(signatureData + Date.now().toString())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
