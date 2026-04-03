// Energy-Compliance Hub - Subscription Trial Guard
// Enforces trial period and subscription status for all operations

import { db } from '@/lib/db'
import { getPlan } from './plans'

export interface SubscriptionStatus {
  isActive: boolean
  isTrial: boolean
  isExpired: boolean
  trialDaysRemaining: number | null
  plan: string
  planName: string
  status: string
  message: string
  blockAccess: boolean
}

/**
 * Check subscription status for a company.
 * Uses company.createdAt to calculate trial period (7 days from registration).
 * If now() > createdAt + 7 days AND subscriptionStatus !== 'ACTIVE', block access.
 */
export async function checkSubscription(companyId: string): Promise<SubscriptionStatus> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
    },
  })

  if (!company) {
    return {
      isActive: false,
      isTrial: false,
      isExpired: true,
      trialDaysRemaining: null,
      plan: 'none',
      planName: 'N/A',
      status: 'NO_COMPANY',
      message: 'Empresa no encontrada',
      blockAccess: true,
    }
  }

  const plan = getPlan(company.subscriptionPlan)
  const now = new Date()
  const created = new Date(company.createdAt)
  const trialEnd = new Date(created.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)

  // Calculate trial days remaining
  const trialMsRemaining = trialEnd.getTime() - now.getTime()
  const trialDaysRemaining = Math.ceil(trialMsRemaining / (24 * 60 * 60 * 1000))

  // Check if trial is expired (past trial period AND not actively paying)
  const isTrialExpired = trialDaysRemaining < 0 && company.subscriptionStatus !== 'ACTIVE'
  const isSubscriptionExpired = company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < now && company.subscriptionStatus === 'ACTIVE'
  const isPastDue = company.subscriptionStatus === 'PAST_DUE'
  const isCancelled = company.subscriptionStatus === 'CANCELLED'

  const isActive = company.subscriptionStatus === 'ACTIVE' && !isSubscriptionExpired
  const isTrial = trialDaysRemaining >= 0 && company.subscriptionStatus === 'TRIAL'
  const isExpired = isTrialExpired || isPastDue || isCancelled || !!isSubscriptionExpired

  // Block conditions:
  // 1. Trial expired (past trialDays and not ACTIVE)
  // 2. Subscription past due
  // 3. Subscription cancelled
  // 4. Subscription expired (past expiry date)
  const blockAccess = isExpired && !isActive

  let message = ''
  if (isActive) {
    message = `Plan ${plan.name} activo`
  } else if (isTrial) {
    message = `Trial: ${trialDaysRemaining} día(s) restante(s)`
  } else if (isTrialExpired) {
    message = `Trial expirado. Actualice su plan para continuar.`
  } else if (isPastDue) {
    message = `Pago vencido. Regularice su suscripción.`
  } else if (isCancelled) {
    message = `Suscripción cancelada. Contacte a soporte.`
  } else if (isSubscriptionExpired) {
    message = `Suscripción expirada. Renueve su plan.`
  }

  return {
    isActive,
    isTrial,
    isExpired,
    trialDaysRemaining: isTrial ? trialDaysRemaining : null,
    plan: company.subscriptionPlan,
    planName: plan.name,
    status: company.subscriptionStatus,
    message,
    blockAccess,
  }
}

/**
 * Enforce active subscription. Throws if access should be blocked.
 * Use this in API routes that require an active subscription.
 */
export async function enforceSubscription(companyId: string): Promise<SubscriptionStatus> {
  const status = await checkSubscription(companyId)
  if (status.blockAccess) {
    throw new Error(`ACCESO BLOQUEADO: ${status.message}. Suscripción: ${status.planName} (${status.status}). Actualice su plan en la sección de Suscripción.`)
  }
  return status
}
