// ============================================================
// GOC ALERT ENGINE — Global Operations Center
// Centralized alert emission: persist to DB + push via WebSocket
// ============================================================

import { db } from '@/lib/db'
import { pushToGOC } from '@/lib/goc-socket'

export type AlertType = 'SENSOR_CRITICAL' | 'GEOFENCE_BREACH' | 'SYSTEM_ERROR' | 'SECURITY_BREACH' | 'SUBSCRIPTION_ALERT'
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface GOCAlertPayload {
  companyId: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
  relatedEntityId?: string
  relatedEntityType?: string
  errorCode?: string // e.g. ERR_GPS_01, ERR_SENSOR_CRITICO
}

export interface GOCAlertRecord {
  id: string
  companyId: string
  companyName?: string
  type: string
  severity: string
  title: string
  message: string
  metadata: string | null
  isAcknowledged: boolean
  acknowledgedById: string | null
  acknowledgedAt: string | null
  relatedEntityId: string | null
  relatedEntityType: string | null
  createdAt: string
}

/**
 * Emit a GOC alert: persist to SystemAlert table + push via WebSocket.
 * This is the single entry point for all GOC alerts across the system.
 */
export async function emitGOCAlert(payload: GOCAlertPayload): Promise<GOCAlertRecord | null> {
  try {
    // 1) Persist to database
    const alert = await db.systemAlert.create({
      data: {
        companyId: payload.companyId,
        type: payload.type,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        relatedEntityId: payload.relatedEntityId,
        relatedEntityType: payload.relatedEntityType,
      },
      include: {
        company: { select: { name: true, subscriptionPlan: true } },
      },
    })

    const record: GOCAlertRecord = {
      id: alert.id,
      companyId: alert.companyId,
      companyName: alert.company.name,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      isAcknowledged: alert.isAcknowledged,
      acknowledgedById: alert.acknowledgedById,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      relatedEntityId: alert.relatedEntityId,
      relatedEntityType: alert.relatedEntityType,
      createdAt: alert.createdAt.toISOString(),
    }

    // 2) Push via WebSocket (fire-and-forget, non-blocking)
    const wsPayload = {
      ...record,
      isEnterprise: alert.company.subscriptionPlan === 'enterprise',
      errorCode: payload.errorCode,
    }

    // Non-blocking push — don't await, don't throw
    pushToGOC(wsPayload).catch(() => {
      // WebSocket service may not be running, that's OK
    })

    return record
  } catch (error) {
    console.error('[GOC] Failed to emit alert:', error)
    return null
  }
}
