// Energy-Compliance Hub — Risk Validation Layer
// Pre-trip risk validation for Transport module
// Validates vehicle, driver, and route conditions before authorizing a trip

import { db } from '@/lib/db'

export interface TripValidationData {
  vehicleId: string
  driverId: string
  routeId: string
  companyId: string
}

export interface ValidationCheck {
  check: string
  passed: boolean
  message: string
}

export interface ValidationResult {
  authorized: boolean
  checks: ValidationCheck[]
  blockingReason?: string
}

/**
 * Validates whether a trip can be started based on vehicle, driver, and route conditions.
 * Returns a detailed result with individual check status.
 */
export async function validateTripStart(tripData: TripValidationData): Promise<ValidationResult> {
  const checks: ValidationCheck[] = []
  let authorized = true

  // 1. Check vehicle status must be DISPONIBLE
  try {
    const vehicle = await db.transportVehicle.findFirst({
      where: { id: tripData.vehicleId, companyId: tripData.companyId },
    })

    if (!vehicle) {
      checks.push({
        check: 'vehiculo_existencia',
        passed: false,
        message: 'El vehículo no existe o no pertenece a la empresa.',
      })
      authorized = false
    } else if (!vehicle.isActive) {
      checks.push({
        check: 'vehiculo_activo',
        passed: false,
        message: `El vehículo ${vehicle.plate} está marcado como inactivo.`,
      })
      authorized = false
    } else if (vehicle.status !== 'DISPONIBLE') {
      checks.push({
        check: 'vehiculo_estado',
        passed: false,
        message: `El vehículo ${vehicle.plate} no está disponible. Estado actual: ${vehicle.status}.`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'vehiculo_estado',
        passed: true,
        message: `Vehículo ${vehicle.plate} disponible.`,
      })
    }
  } catch (err) {
    checks.push({
      check: 'vehiculo_estado',
      passed: false,
      message: 'Error al verificar estado del vehículo.',
    })
    authorized = false
  }

  // 2. Check no active BLOQUEADO trips for this vehicle
  try {
    const blockedTrips = await db.transportTrip.findFirst({
      where: {
        vehicleId: tripData.vehicleId,
        companyId: tripData.companyId,
        status: 'BLOQUEADO',
      },
    })

    if (blockedTrips) {
      checks.push({
        check: 'vehiculo_viaje_bloqueado',
        passed: false,
        message: `El vehículo tiene un viaje bloqueado activo (ID: ${blockedTrips.id}).`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'vehiculo_viaje_bloqueado',
        passed: true,
        message: 'No hay viajes bloqueados para el vehículo.',
      })
    }
  } catch (err) {
    checks.push({
      check: 'vehiculo_viaje_bloqueado',
      passed: false,
      message: 'Error al verificar viajes bloqueados del vehículo.',
    })
    authorized = false
  }

  // 3. Check driver license not expired
  try {
    const driver = await db.transportDriver.findFirst({
      where: { id: tripData.driverId, companyId: tripData.companyId },
    })

    if (!driver) {
      checks.push({
        check: 'conductor_existencia',
        passed: false,
        message: 'El conductor no existe o no pertenece a la empresa.',
      })
      authorized = false
    } else if (driver.status !== 'ACTIVO') {
      checks.push({
        check: 'conductor_estado',
        passed: false,
        message: `El conductor no está activo. Estado actual: ${driver.status}.`,
      })
      authorized = false
    } else if (driver.licenseExpiry && driver.licenseExpiry < new Date()) {
      checks.push({
        check: 'conductor_licencia_vencida',
        passed: false,
        message: `La licencia del conductor venció el ${driver.licenseExpiry.toISOString().split('T')[0]}.`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'conductor_estado',
        passed: true,
        message: driver.licenseExpiry
          ? `Conductor activo. Licencia válida hasta ${driver.licenseExpiry.toISOString().split('T')[0]}.`
          : 'Conductor activo (sin fecha de vencimiento de licencia registrada).',
      })
    }
  } catch (err) {
    checks.push({
      check: 'conductor_estado',
      passed: false,
      message: 'Error al verificar datos del conductor.',
    })
    authorized = false
  }

  // 4. Check no active CRITICO driver events in last 24 hours
  try {
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const criticalEvents = await db.transportDriverEvent.findFirst({
      where: {
        driverId: tripData.driverId,
        companyId: tripData.companyId,
        riskLevel: 'CRITICO',
        timestamp: { gte: twentyFourHoursAgo },
      },
    })

    if (criticalEvents) {
      checks.push({
        check: 'conductor_eventos_criticos',
        passed: false,
        message: `El conductor tiene un evento de riesgo CRÍTICO en las últimas 24 horas (${criticalEvents.eventType} a las ${criticalEvents.timestamp.toISOString()}).`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'conductor_eventos_criticos',
        passed: true,
        message: 'Sin eventos críticos del conductor en las últimas 24 horas.',
      })
    }
  } catch (err) {
    checks.push({
      check: 'conductor_eventos_criticos',
      passed: false,
      message: 'Error al verificar eventos del conductor.',
    })
    authorized = false
  }

  // 5. Check route is active
  try {
    const route = await db.transportRoute.findFirst({
      where: { id: tripData.routeId, companyId: tripData.companyId },
    })

    if (!route) {
      checks.push({
        check: 'ruta_existencia',
        passed: false,
        message: 'La ruta no existe o no pertenece a la empresa.',
      })
      authorized = false
    } else if (!route.isActive) {
      checks.push({
        check: 'ruta_estado',
        passed: false,
        message: `La ruta "${route.name}" está inactiva.`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'ruta_estado',
        passed: true,
        message: `Ruta "${route.name}" activa (${route.distanceKm} km).`,
      })
    }
  } catch (err) {
    checks.push({
      check: 'ruta_estado',
      passed: false,
      message: 'Error al verificar estado de la ruta.',
    })
    authorized = false
  }

  // 6. Check cumulative driving hours fatigue (CRITICAL — blocks trip)
  try {
    const MAX_DRIVING_HOURS = 8
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const recentTrips = await db.transportTrip.findMany({
      where: {
        driverId: tripData.driverId,
        companyId: tripData.companyId,
        status: { in: ['EN_TRANSITO', 'COMPLETADO'] },
        startDate: { gte: twentyFourHoursAgo },
      },
      select: { startDate: true, endDate: true },
    })

    let totalDrivingMs = 0
    const now = new Date()
    for (const trip of recentTrips) {
      if (trip.endDate) {
        totalDrivingMs += trip.endDate.getTime() - trip.startDate.getTime()
      } else {
        // Trip still EN_TRANSITO — use now as end time
        totalDrivingMs += now.getTime() - trip.startDate.getTime()
      }
    }

    const totalDrivingHours = totalDrivingMs / (1000 * 60 * 60)

    if (totalDrivingHours >= MAX_DRIVING_HOURS) {
      checks.push({
        check: 'conductor_fatiga_horas',
        passed: false,
        message: `El conductor acumula ${totalDrivingHours.toFixed(1)} horas de manejo en las últimas 24hs (máximo permitido: ${MAX_DRIVING_HOURS}hs). Debe cumplir descanso obligatorio.`,
      })
      authorized = false
    } else {
      checks.push({
        check: 'conductor_fatiga_horas',
        passed: true,
        message: `El conductor acumula ${totalDrivingHours.toFixed(1)} horas de manejo en las últimas 24hs (máximo permitido: ${MAX_DRIVING_HOURS}hs).`,
      })
    }
  } catch (err) {
    checks.push({
      check: 'conductor_fatiga_horas',
      passed: false,
      message: 'Error al verificar horas acumuladas de manejo del conductor.',
    })
    authorized = false
  }

  // 7. Check pending rest requirement (WARNING — does NOT block trip)
  try {
    const REST_WINDOW_HOURS = 8
    const restWindowAgo = new Date()
    restWindowAgo.setHours(restWindowAgo.getHours() - REST_WINDOW_HOURS)

    const recentCompletedTrips = await db.transportTrip.findFirst({
      where: {
        driverId: tripData.driverId,
        companyId: tripData.companyId,
        status: 'COMPLETADO',
        endDate: { gte: restWindowAgo },
      },
    })

    if (recentCompletedTrips) {
      checks.push({
        check: 'conductor_descanso_pendiente',
        passed: false,
        message: `El conductor completó un viaje hace menos de ${REST_WINDOW_HOURS} horas (finalizó: ${recentCompletedTrips.endDate!.toISOString()}). Se recomienda verificar cumplimiento de descanso obligatorio.`,
      })
      // This is a WARNING check — it does NOT block the trip (authorized stays as-is)
    } else {
      checks.push({
        check: 'conductor_descanso_pendiente',
        passed: true,
        message: 'Sin descanso pendiente. El conductor no completó viajes en las últimas 8 horas.',
      })
    }
  } catch (err) {
    checks.push({
      check: 'conductor_descanso_pendiente',
      passed: false,
      message: 'Error al verificar descanso pendiente del conductor.',
    })
    // This is a WARNING check — it does NOT block the trip
  }

  // Build blocking reason from failed checks
  const failedChecks = checks.filter(c => !c.passed)
  const blockingReason = authorized
    ? undefined
    : failedChecks.map(c => `- ${c.message}`).join('\n')

  return {
    authorized,
    checks,
    blockingReason,
  }
}
