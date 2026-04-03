import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { getPlan } from '@/lib/plans'

// GET /api/subscription/status - Lightweight check for trial/subscription status
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ blockAccess: false }, { status: 200 })
    }

    const company = await db.company.findUnique({
      where: { id: payload.companyId },
      select: {
        id: true,
        createdAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    })

    if (!company) {
      return NextResponse.json({ blockAccess: true, message: 'Empresa no encontrada' })
    }

    const plan = getPlan(company.subscriptionPlan)
    const now = new Date()
    const created = new Date(company.createdAt)
    const trialEnd = new Date(created.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    const trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    const isTrialExpired = trialDaysRemaining < 0 && company.subscriptionStatus !== 'ACTIVE'
    const isPastDue = company.subscriptionStatus === 'PAST_DUE'
    const isCancelled = company.subscriptionStatus === 'CANCELLED'
    const isSubExpired = company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < now
    const isActive = company.subscriptionStatus === 'ACTIVE' && !isSubExpired
    const isTrial = trialDaysRemaining >= 0 && company.subscriptionStatus === 'TRIAL'

    const blockAccess = (isTrialExpired || isPastDue || isCancelled || !!isSubExpired) && !isActive

    let message = ''
    if (isTrial) {
      message = `Trial: ${trialDaysRemaining} día(s) restante(s)`
    } else if (isTrialExpired) {
      message = `Trial de ${plan.trialDays} días expirado. Actualice su plan para continuar operando.`
    } else if (isPastDue) {
      message = `Pago vencido. Regularice su suscripción para reactivar el acceso.`
    } else if (isCancelled) {
      message = `Suscripción cancelada. Contacte a soporte para reactivar.`
    } else if (isSubExpired) {
      message = `Suscripción expirada. Renueve su plan para continuar.`
    }

    return NextResponse.json({
      blockAccess,
      message,
      plan: company.subscriptionPlan,
      planName: plan.name,
      status: company.subscriptionStatus,
      isTrial,
      isActive,
      trialDaysRemaining: isTrial ? trialDaysRemaining : null,
    })
  } catch {
    return NextResponse.json({ blockAccess: false }, { status: 200 })
  }
}
