import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/subscription/contact
// Logs enterprise contact requests. In production, integrate with CRM/email.
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { planKey, name, email, phone, message } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    // Audit log the enterprise interest
    await createAuditLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'CREATE',
      entityType: 'COMPANY',
      entityId: payload.companyId,
      details: {
        event: 'enterprise_interest',
        planKey: planKey || 'enterprise',
        contactName: name,
        contactEmail: email,
        contactPhone: phone || null,
        contactMessage: message || null,
      },
    }, req)

    // In production, you would:
    // 1. Send email to sales team (via SendGrid, AWS SES, etc.)
    // 2. Create a lead in CRM (HubSpot, Salesforce, etc.)
    // 3. Send confirmation email to the user
    console.log('🏢 Enterprise interest:', { companyId: payload.companyId, name, email, planKey })

    return NextResponse.json({
      success: true,
      message: 'Solicitud recibida. Nuestro equipo comercial se comunicará contigo pronto.',
    })
  } catch (error: unknown) {
    console.error('Contact form error:', error)
    const message = error instanceof Error ? error.message : 'Error al enviar solicitud'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
