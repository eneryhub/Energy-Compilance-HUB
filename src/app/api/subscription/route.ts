import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPlan, isDemoMode } from '@/lib/plans'
import { createStripeCheckoutSession, cancelSubscription, isStripeConfigured } from '@/lib/stripe'
import { getTokenPayload, createSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/subscription - Get current subscription details
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const company = await db.company.findUnique({
      where: { id: payload.companyId },
      include: {
        _count: { select: { users: true } },
        invoices: { orderBy: { paidAt: 'desc' }, take: 12 },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const plan = getPlan(company.subscriptionPlan)
    const currentMonthStart = new Date()
    currentMonthStart.setDate(1)
    currentMonthStart.setHours(0, 0, 0, 0)

    let permitsThisMonth = 0
    try {
      permitsThisMonth = await db.permit.count({
        where: {
          companyId: company.id,
          createdAt: { gte: currentMonthStart },
        },
      })
    } catch (err) {
      console.error('Error counting permits:', err)
    }

    const maxUsers = company.maxUsers || 10
    const maxPermits = company.maxPermitsPerMonth || 200
    const userCount = company._count?.users || 0

    const usagePercentUsers = maxUsers > 0 ? Math.round((userCount / maxUsers) * 100) : 0
    const usagePercentPermits = maxPermits > 0 ? Math.round((permitsThisMonth / maxPermits) * 100) : 0

    return NextResponse.json({
      subscription: {
        plan: company.subscriptionPlan || 'starter',
        planName: plan.name,
        status: company.subscriptionStatus || 'TRIAL',
        price: plan.price,
        expiresAt: company.subscriptionExpiresAt,
        currentPeriodStart: company.currentPeriodStart,
        currentPeriodEnd: company.currentPeriodEnd,
        trialEndsAt: company.trialEndsAt,
      },
      limits: {
        users: { current: userCount, max: maxUsers, percent: usagePercentUsers },
        permits: { current: permitsThisMonth, max: maxPermits, percent: usagePercentPermits },
      },
      plans: {
        starter: { ...getPlan('starter'), features: Object.values(getPlan('starter').featureLabels) },
        business: { ...getPlan('business'), features: Object.values(getPlan('business').featureLabels) },
        enterprise: { ...getPlan('enterprise'), features: Object.values(getPlan('enterprise').featureLabels) },
      },
      stripe: {
        configured: isStripeConfigured(),
        hasCustomer: !!company.stripeCustomerId,
        billingEmail: company.billingEmail,
      },
      invoices: (company.invoices || []).map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        planName: inv.planName,
        description: inv.description,
        paidAt: inv.paidAt,
      })),
      isDemoMode: isDemoMode(),
    })
  } catch (error) {
    console.error('Get subscription error:', error)
    return NextResponse.json({ error: 'Error al obtener suscripción' }, { status: 500 })
  }
}

// POST /api/subscription - Upgrade plan
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden cambiar planes' }, { status: 403 })
    }

    const body = await req.json()
    const { planKey } = body

    // Enterprise plan must go through contact sales form, not API
    if (planKey === 'enterprise') {
      return NextResponse.json(
        { error: 'El plan Enterprise requiere contacto comercial. Usa el formulario de contacto.' },
        { status: 400 }
      )
    }

    if (!planKey || !['starter', 'business'].includes(planKey)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const company = await db.company.findUnique({ where: { id: payload.companyId } })
    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    if (company.subscriptionPlan === planKey) {
      return NextResponse.json({ error: 'Ya tienes este plan' }, { status: 400 })
    }

    const plan = getPlan(planKey)
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    // ============ DEMO MODE: instant activation (no Stripe) ============
    if (isDemoMode()) {
      // Demo mode: instant upgrade
      await db.company.update({
        where: { id: payload.companyId },
        data: {
          subscriptionPlan: planKey,
          subscriptionStatus: 'ACTIVE',
          maxUsers: plan.maxUsers,
          maxPermitsPerMonth: plan.maxPermitsPerMonth,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      })

      // Create demo invoice (skip for Enterprise which has no price)
      if (plan.price != null && plan.price > 0) {
        await db.subscriptionInvoice.create({
          data: {
            companyId: payload.companyId,
            amount: plan.price,
            status: 'paid',
            planName: plan.name,
            description: `Upgrade a plan ${plan.name} (Demo)`,
          },
        })
      }

      // Audit log
      await createAuditLog({
        companyId: payload.companyId,
        userId: payload.userId,
        action: 'UPDATE',
        entityType: 'COMPANY',
        entityId: payload.companyId,
        details: { field: 'subscriptionPlan', from: company.subscriptionPlan, to: planKey },
      }, req)

      // Generate new JWT with updated plan so modules unlock instantly
      const newToken = await createSession({
        id: payload.userId,
        companyId: payload.companyId,
        role: payload.role,
        email: payload.email,
        name: payload.name,
        subscriptionPlan: planKey,
      })

      return NextResponse.json({
        success: true,
        message: `Plan actualizado a ${plan.name} (Modo Demo)`,
        plan: planKey,
        planName: plan.name,
        demo: true,
        newToken, // Client should replace stored token with this
      })
    }

    // ============ PRODUCTION MODE: redirect to Stripe Checkout ============
    const result = await createStripeCheckoutSession(
      payload.companyId,
      company.email,
      company.name,
      planKey
    )

    return NextResponse.json({
      success: true,
      checkoutUrl: result.url,
      sessionId: result.sessionId,
      message: `Redirigiendo a Stripe para completar el pago de ${plan.name}`,
      plan: planKey,
      planName: plan.name,
      demo: false,
    })
  } catch (error: unknown) {
    console.error('Upgrade subscription error:', error)
    const message = error instanceof Error ? error.message : 'Error al actualizar suscripción'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/subscription - Cancel subscription
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden cancelar' }, { status: 403 })
    }

    await cancelSubscription(payload.companyId)

    // Audit log
    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'UPDATE',
      entityType: 'COMPANY',
      entityId: payload.companyId,
      details: { field: 'subscriptionStatus', action: 'cancelled' },
    }, req)

    return NextResponse.json({ success: true, message: 'Suscripción cancelada' })
  } catch (error: unknown) {
    console.error('Cancel subscription error:', error)
    const message = error instanceof Error ? error.message : 'Error al cancelar suscripción'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
