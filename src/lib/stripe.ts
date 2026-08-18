// Energy-Compliance Hub - Stripe Service
// Handles subscription creation, management, and webhooks

import Stripe from 'stripe'
import { getPlan, isDemoMode } from './plans'

let stripe: Stripe | null = null

function getStripe(): Stripe | null {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('placeholder')) return null
  stripe = new Stripe(key, { apiVersion: '2025-06-30.basil' })
  return stripe
}

export function isStripeConfigured(): boolean {
  return !isDemoMode()
}

// ============ Demo Mode Simulation ============

export async function createDemoSubscription(companyId: string, planKey: string) {
  const plan = getPlan(planKey)
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  return {
    subscriptionId: `demo_sub_${companyId.slice(0, 8)}`,
    customerId: `demo_cus_${companyId.slice(0, 8)}`,
    status: 'active' as const,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    amount: plan.price,
    currency: 'usd',
    planName: plan.name,
  }
}

// ============ Real Stripe Operations ============

export async function createStripeCheckoutSession(
  companyId: string,
  companyEmail: string,
  companyName: string,
  planKey: string
) {
  const client = getStripe()
  if (!client) throw new Error('Stripe no está configurado')

  const plan = getPlan(planKey)
  const priceId = process.env[`STRIPE_${planKey.toUpperCase()}_PRICE_ID`]
  if (!priceId || priceId.includes('placeholder')) {
    throw new Error(`Price ID no configurado para plan ${planKey}`)
  }

  // Create or retrieve customer
  const { db } = await import('./db')
  const company = await db.company.findUnique({ where: { id: companyId } })

  let customerId = company?.stripeCustomerId

  if (!customerId) {
    const customer = await client.customers.create({
      email: companyEmail,
      name: companyName,
      metadata: { companyId },
    })
    customerId = customer.id
    await db.company.update({
      where: { id: companyId },
      data: { stripeCustomerId: customerId, billingEmail: companyEmail },
    })
  }

  const session = await client.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?canceled=true`,
    metadata: { companyId, planKey },
    subscription_data: {
      metadata: { companyId, planKey },
      trial_period_days: company?.subscriptionStatus === 'TRIAL' ? undefined : undefined,
    },
  })

  return { sessionId: session.id, url: session.url }
}

export async function createStripePortalSession(customerId: string) {
  const client = getStripe()
  if (!client) throw new Error('Stripe no está configurado')

  const session = await client.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`,
  })

  return { url: session.url }
}

export async function handleStripeWebhook(payload: string, sig: string) {
  const client = getStripe()
  if (!client) throw new Error('Stripe no está configurado')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || webhookSecret.includes('placeholder')) {
    throw new Error('Webhook secret no configurado')
  }

  const event = client.webhooks.constructEvent(payload, sig, webhookSecret)
  const { db } = await import('./db')

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = session.metadata?.companyId
      const planKey = session.metadata?.planKey
      const plan = getPlan(planKey || 'starter')

      await db.company.update({
        where: { id: companyId },
        data: {
          subscriptionPlan: planKey || 'starter',
          subscriptionStatus: 'ACTIVE',
          maxUsers: plan.maxUsers,
          maxPermitsPerMonth: plan.maxPermitsPerMonth,
          stripeSubscriptionId: session.subscription as string,
          stripePriceId: process.env[`STRIPE_${(planKey || 'STARTER').toUpperCase()}_PRICE_ID`],
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const companyId = sub.metadata?.companyId

      if (sub.status === 'active') {
        const planKey = sub.metadata?.planKey || 'starter'
        const plan = getPlan(planKey)
        await db.company.update({
          where: { id: companyId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionPlan: planKey,
            maxUsers: plan.maxUsers,
            maxPermitsPerMonth: plan.maxPermitsPerMonth,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        })
      } else if (sub.status === 'past_due') {
        await db.company.update({
          where: { id: companyId },
          data: { subscriptionStatus: 'PAST_DUE' },
        })
      } else if (sub.status === 'canceled') {
        await db.company.update({
          where: { id: companyId },
          data: { subscriptionStatus: 'CANCELLED' },
        })
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const companyId = invoice.metadata?.companyId
      if (!companyId) break

      const sub = invoice.subscription as string
      const planKey = (await db.company.findUnique({ where: { id: companyId }, select: { subscriptionPlan: true } }))?.subscriptionPlan || 'starter'
      const plan = getPlan(planKey)

      await db.subscriptionInvoice.create({
        data: {
          companyId,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          status: 'paid',
          planName: plan.name,
          description: `Factura ${plan.name} - ${invoice.period_start ? new Date(invoice.period_start * 1000).toLocaleDateString('es') : ''}`,
          invoicePdfUrl: invoice.invoice_pdf || undefined,
          paidAt: new Date(),
        },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const companyId = invoice.metadata?.companyId
      if (!companyId) break

      const planKey = (await db.company.findUnique({ where: { id: companyId }, select: { subscriptionPlan: true } }))?.subscriptionPlan || 'starter'
      const plan = getPlan(planKey)

      await db.subscriptionInvoice.create({
        data: {
          companyId,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          status: 'failed',
          planName: plan.name,
          description: `Pago fallido ${plan.name}`,
        },
      })

      await db.company.update({
        where: { id: companyId },
        data: { subscriptionStatus: 'PAST_DUE' },
      })
      break
    }

    default:
      break
  }

  return { received: true, type: event.type }
}

// ============ Subscription Cancellation ============

export async function cancelSubscription(companyId: string) {
  const { db } = await import('./db')
  const company = await db.company.findUnique({ where: { id: companyId } })

  if (company?.stripeSubscriptionId && !isDemoMode()) {
    const client = getStripe()
    if (client) {
      await client.subscriptions.cancel(company.stripeSubscriptionId)
    }
  }

  await db.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus: 'CANCELLED',
      subscriptionPlan: 'starter',
      maxUsers: 10,
      maxPermitsPerMonth: 200,
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  })

  return { success: true }
}
