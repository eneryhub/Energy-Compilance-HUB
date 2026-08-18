import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/dashboard/stats - Dashboard stats formatted for frontend
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const companyId = session.companyId
    const now = new Date()

    const [
      totalPermits,
      permitsByStatus,
      totalDocuments,
      expiredCriticalDocs,
      recentAuditLogs,
      recentPermits,
    ] = await Promise.all([
      db.permit.count({ where: { companyId } }),
      db.permit.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { status: true },
      }),
      db.hseDocument.count({ where: { companyId, status: 'ACTIVE' } }),
      db.hseDocument.count({
        where: {
          companyId,
          criticality: 'CRITICAL',
          expiryDate: { lt: now },
        },
      }),
      db.auditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      }),
      db.permit.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const statusMap: Record<string, number> = {}
    for (const item of permitsByStatus) {
      statusMap[item.status] = item._count.status
    }

    // Build recent activity from audit logs and permits
    const recentActivity = []

    for (const log of recentAuditLogs.slice(0, 7)) {
      let description = ''
      let action = log.action
      switch (log.action) {
        case 'LOGIN':
          description = `${log.user?.name || 'Usuario'} inicio sesion`
          break
        case 'LOGOUT':
          description = `${log.user?.name || 'Usuario'} cerro sesion`
          break
        case 'CREATE':
          description = `Permiso creado por ${log.user?.name || 'Usuario'}`
          action = 'PERMIT_CREATED'
          break
        case 'APPROVE':
          description = `Permiso aprobado por ${log.user?.name || 'Usuario'}`
          action = 'PERMIT_APPROVED'
          break
        case 'REJECT':
          description = `Permiso rechazado por ${log.user?.name || 'Usuario'}`
          action = 'PERMIT_REJECTED'
          break
        default:
          description = `${log.action} por ${log.user?.name || 'Usuario'}`
      }
      recentActivity.push({
        id: log.id,
        action,
        description,
        timestamp: log.createdAt.toISOString(),
      })
    }

    // Add recent permits as activity
    for (const permit of recentPermits.slice(0, 3)) {
      const actionMap: Record<string, string> = {
        PENDING: 'PERMIT_CREATED',
        APPROVED: 'PERMIT_APPROVED',
        REJECTED: 'PERMIT_REJECTED',
      }
      recentActivity.push({
        id: permit.id + '_permit',
        action: actionMap[permit.status] || 'PERMIT_CREATED',
        description: `Permiso ${permit.permitNumber} - ${permit.technicianName} (${permit.workLocation})`,
        timestamp: permit.createdAt.toISOString(),
      })
    }

    // Sort by timestamp and take top 8
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      totalPermits,
      pendingApprovals: statusMap['PENDING'] || 0,
      approvedPermits: statusMap['APPROVED'] || 0,
      rejectedPermits: statusMap['REJECTED'] || 0,
      activeDocuments: totalDocuments,
      expiredDocuments: expiredCriticalDocs,
      complianceStatus: expiredCriticalDocs > 0 ? 'NON_COMPLIANT' as const : 'COMPLIANT' as const,
      recentActivity: recentActivity.slice(0, 8),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
