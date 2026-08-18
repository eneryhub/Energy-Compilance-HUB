import { db } from '@/lib/db'

export interface ComplianceCheckResult {
  isCompliant: boolean
  expiredCriticalDocuments: Array<{
    id: string
    title: string
    documentType: string
    criticality: string
    expiryDate: string | null
    holderName: string | null
    daysOverdue: number
  }>
  expiringSoonDocuments: Array<{
    id: string
    title: string
    documentType: string
    criticality: string
    expiryDate: string | null
    holderName: string | null
    daysRemaining: number
  }>
  totalDocuments: number
  expiredCount: number
  criticalExpiredCount: number
}

/**
 * Check if a user has any expired CRITICAL documents in the HSE module.
 * Returns compliance status. If isCompliant is false, operations MUST be blocked.
 */
export async function checkUserCompliance(userId: string, companyId: string): Promise<ComplianceCheckResult> {
  const now = new Date()

  const documents = await db.hseDocument.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      expiryDate: { not: null }
    }
  })

  // If assigned to user, also filter by userId
  const userDocs = documents.filter(d => !d.userId || d.userId === userId)

  const expiredCritical = userDocs
    .filter(d => d.expiryDate && new Date(d.expiryDate) < now && d.criticality === 'CRITICAL')
    .map(d => ({
      id: d.id,
      title: d.title,
      documentType: d.documentType,
      criticality: d.criticality,
      expiryDate: d.expiryDate?.toISOString() || null,
      holderName: d.holderName,
      daysOverdue: Math.floor((now.getTime() - new Date(d.expiryDate!).getTime()) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  const expiringSoon = userDocs
    .filter(d => {
      if (!d.expiryDate) return false
      const daysRemaining = Math.floor((new Date(d.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysRemaining >= 0 && daysRemaining <= 30 && d.criticality === 'CRITICAL'
    })
    .map(d => ({
      id: d.id,
      title: d.title,
      documentType: d.documentType,
      criticality: d.criticality,
      expiryDate: d.expiryDate?.toISOString() || null,
      holderName: d.holderName,
      daysRemaining: Math.floor((new Date(d.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  const allExpired = userDocs.filter(d => d.expiryDate && new Date(d.expiryDate) < now)

  return {
    isCompliant: expiredCritical.length === 0,
    expiredCriticalDocuments: expiredCritical,
    expiringSoonDocuments: expiringSoon,
    totalDocuments: userDocs.length,
    expiredCount: allExpired.length,
    criticalExpiredCount: expiredCritical.length
  }
}

/**
 * Block operation if user has expired critical documents.
 * Throws an error with details if non-compliant.
 */
export async function enforceCompliance(userId: string, companyId: string): Promise<void> {
  const check = await checkUserCompliance(userId, companyId)
  if (!check.isCompliant) {
    const docNames = check.expiredCriticalDocuments.map(d => `"${d.title}" (${d.daysOverdue} días vencido)`).join(', ')
    throw new Error(`BLOQUEADO POR CUMPLIMIENTO HSE: El usuario tiene ${check.criticalExpiredCount} documento(s) crítico(s) vencido(s): ${docNames}. Renueve los documentos antes de continuar.`)
  }
}
