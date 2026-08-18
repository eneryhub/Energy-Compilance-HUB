import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe'
import { isDemoMode } from '@/lib/plans'

// POST /api/subscription/webhook - Stripe webhook endpoint
export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Stripe no está configurado (Modo Demo)' }, { status: 400 })
    }

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      return NextResponse.json({ error: 'Firma de Stripe no encontrada' }, { status: 400 })
    }

    const result = await handleStripeWebhook(body, sig)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Stripe webhook error:', error)
    if (error.type === 'StripeSignatureVerificationError') {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Error en webhook' }, { status: 500 })
  }
}
