'use client'

import { useMemo } from 'react'
import { getUser } from '@/lib/api'
import IncidentMonitor from '@/modules/erc/incident-monitor'

/**
 * ERCMonitor — Thin wrapper around the original IncidentMonitor from src/modules/erc/
 * Extracts user context (companyId, userRole, userId, userName) from localStorage
 * and passes them to the real IncidentMonitor component.
 */
export default function ERCMonitor() {
  const user = useMemo(() => getUser(), [])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm">No se encontró la sesión del usuario</p>
      </div>
    )
  }

  return (
    <IncidentMonitor
      companyId={user.companyId}
      userRole={user.role}
      userId={user.id}
      userName={user.name}
    />
  )
}
