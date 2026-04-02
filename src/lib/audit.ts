// Energy-Compliance Hub - Audit Log Helper
// Centralized audit logging with IP and User-Agent capture

import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

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
  return db.auditLog.create({
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
}
