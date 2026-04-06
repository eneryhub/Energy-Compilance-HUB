import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/risk-heatmap — aggregated risk data for heat map visualization
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = payload.companyId

    // 1. Permits by location and risk type
    const permitsByLocationRisk = await db.permit.groupBy({
      by: ['workLocation', 'riskType'],
      where: { companyId },
      _count: { id: true },
    })

    // Count rejected permits per group
    const rejectedByLocationRisk = await db.permit.groupBy({
      by: ['workLocation', 'riskType'],
      where: { companyId, status: 'REJECTED' },
      _count: { id: true },
    })

    const rejectedMap = new Map<string, number>()
    for (const r of rejectedByLocationRisk) {
      rejectedMap.set(`${r.workLocation}::${r.riskType}`, r._count.id)
    }

    // 2. Expired documents
    const now = new Date()
    const expiredDocs = await db.hseDocument.groupBy({
      by: ['category'],
      where: { companyId, status: 'EXPIRED' },
      _count: { id: true },
    })

    // Expiring soon (next 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expiringDocs = await db.hseDocument.groupBy({
      by: ['category'],
      where: {
        companyId,
        status: 'ACTIVE',
        expiryDate: { lte: thirtyDaysFromNow },
      },
      _count: { id: true },
    })

    const expiringMap = new Map<string, number>()
    for (const e of expiringDocs) {
      expiringMap.set(e.category, e._count.id)
    }

    // 3. Sensor alerts by location
    const sensorAlerts = await db.sensor.findMany({
      where: { companyId, isActive: true, locationId: { not: null } },
      include: {
        location: { select: { name: true } },
      },
      select: {
        name: true,
        type: true,
        currentValue: true,
        thresholdCritical: true,
        thresholdWarning: true,
        location: { select: { name: true } },
      },
    })

    // 4. Build location list and risk matrix
    const locationSet = new Set<string>()
    for (const p of permitsByLocationRisk) {
      locationSet.add(p.workLocation)
    }
    for (const s of sensorAlerts) {
      if (s.location) locationSet.add(s.location.name)
    }

    const locations = Array.from(locationSet).sort()
    const riskTypes = ['ALTURA', 'ELECTRICO', 'CONFINADO', 'CALIENTE']

    // Build matrix: location x riskType
    const matrix: Array<{
      location: string
      riskType: string
      permits: number
      rejected: number
      level: 'low' | 'medium' | 'high' | 'critical'
    }> = []

    for (const loc of locations) {
      for (const rt of riskTypes) {
        const found = permitsByLocationRisk.find(
          (p) => p.workLocation === loc && p.riskType === rt
        )
        const count = found ? found._count.id : 0
        const rejected = rejectedMap.get(`${loc}::${rt}`) || 0

        let level: 'low' | 'medium' | 'high' | 'critical' = 'low'
        if (count >= 20 || rejected >= 5) level = 'critical'
        else if (count >= 10 || rejected >= 3) level = 'high'
        else if (count >= 5 || rejected >= 1) level = 'medium'

        matrix.push({ location: loc, riskType: rt, permits: count, rejected, level })
      }
    }

    // 5. Sensor risk data per location
    const sensorRiskByLocation: Array<{
      location: string
      sensors: number
      critical: number
      warning: number
    }> = []

    const sensorByLoc = new Map<string, { total: number; critical: number; warning: number }>()
    for (const s of sensorAlerts) {
      if (!s.location) continue
      const loc = s.location.name
      const existing = sensorByLoc.get(loc) || { total: 0, critical: 0, warning: 0 }
      existing.total++
      if (s.currentValue !== null && s.currentValue >= s.thresholdCritical) existing.critical++
      else if (s.currentValue !== null && s.currentValue >= s.thresholdWarning) existing.warning++
      sensorByLoc.set(loc, existing)
    }

    for (const [loc, data] of sensorByLoc) {
      sensorRiskByLocation.push({ location: loc, ...data })
    }

    // 6. Document expiry summary
    const documentRisk: Array<{
      category: string
      expired: number
      expiring: number
      level: 'low' | 'medium' | 'high' | 'critical'
    }> = []

    const allCategories = ['PERSONAL', 'EQUIPOS', 'LEGAL', 'AMBIENTAL']
    const catLabels: Record<string, string> = {
      PERSONAL: 'Personal',
      EQUIPOS: 'Equipos',
      LEGAL: 'Legal',
      AMBIENTAL: 'Ambiental',
    }

    for (const cat of allCategories) {
      const expired = expiredDocs.find((d) => d.category === cat)?._count.id || 0
      const expiring = expiringMap.get(cat) || 0

      let level: 'low' | 'medium' | 'high' | 'critical' = 'low'
      if (expired >= 3) level = 'critical'
      else if (expired >= 1 || expiring >= 3) level = 'high'
      else if (expiring >= 1) level = 'medium'

      documentRisk.push({ category: catLabels[cat] || cat, expired, expiring, level })
    }

    // 7. Summary
    const totalPermits = permitsByLocationRisk.reduce((sum, p) => sum + p._count.id, 0)
    const totalRejected = rejectedByLocationRisk.reduce((sum, p) => sum + p._count.id, 0)
    const totalExpired = expiredDocs.reduce((sum, d) => sum + d._count.id, 0)
    const totalCriticalSensors = sensorAlerts.filter(
      (s) => s.currentValue !== null && s.currentValue >= s.thresholdCritical
    ).length

    const highRiskLocations = matrix.filter(
      (m) => m.level === 'critical' || m.level === 'high'
    ).length

    return NextResponse.json({
      matrix,
      locations,
      riskTypes,
      sensorRisk: sensorRiskByLocation,
      documentRisk,
      summary: {
        totalPermits,
        totalRejected,
        totalExpired,
        totalCriticalSensors,
        totalLocations: locations.length,
        highRiskLocations,
        overallLevel: highRiskLocations >= 3 ? 'critical' : highRiskLocations >= 1 ? 'high' : totalExpired >= 1 ? 'medium' : 'low',
      },
    })
  } catch (error) {
    console.error('Risk heatmap error:', error)
    return NextResponse.json({ error: 'Error al generar mapa de riesgo' }, { status: 500 })
  }
}
