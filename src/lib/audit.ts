// Energy-Compliance Hub - Audit Log Helper
// Centralized audit logging with IP and User-Agent capture

import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { emitGOCAlert } from '@/lib/goc-alerts'

export interface AuditParams {
  companyId: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  details?: object
}

/**
 * Create an audit log entry with automatic IP and User-Agent capture.
 * Use this instead of raw db.auditLog.create() for consistent tracking.
 */
export async function createAuditLog(params: AuditParams, request?: NextRequest) {
  const log = await db.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ? JSON.stringify(params.details) : undefined,
      ipAddress: request
        ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
        : null,
      userAgent: request
        ? request.headers.get('user-agent') || null
        : null,
    },
  })

  // ── GOC Side Effect: Auto-emit GOC alert for critical actions ──
  if (params.action === 'SYSTEM_ERROR' || params.action === 'SECURITY_BREACH') {
    try {
      emitGOCAlert({
        companyId: params.companyId,
        type: params.action === 'SECURITY_BREACH' ? 'SECURITY_BREACH' : 'SYSTEM_ERROR',
        severity: params.action === 'SECURITY_BREACH' ? 'CRITICAL' : 'HIGH',
        title: params.action === 'SECURITY_BREACH'
          ? `Violación de Seguridad Detectada — ${params.entityType}`
          : `Error del Sistema Detectado — ${params.entityType}`,
        message: params.details
          ? JSON.stringify(params.details).slice(0, 500)
          : `Acción ${params.action} registrada para entidad ${params.entityType}`,
        metadata: params.details as Record<string, unknown> | undefined,
        relatedEntityId: params.entityId,
        relatedEntityType: params.entityType,
      })
    } catch {
      // Fire-and-forget: don't block the audit log if GOC alert fails
    }
  }

  return log
}
