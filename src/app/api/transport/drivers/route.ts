import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// GET /api/transport/drivers — List drivers
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { companyId: session.companyId }

    if (status) where.status = status
    if (search) {
      where.OR = [
        { licenseNumber: { contains: search } },
        { user: { name: { contains: search } } },
      ]
    }

    const drivers = await db.transportDriver.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    // Flatten user data into driver response for easier frontend consumption
    const flatDrivers = drivers.map(d => ({
      ...d,
      name: d.user?.name || '',
      phone: d.user?.phone || null,
    }))

    return NextResponse.json({
      drivers: flatDrivers,
    })
  } catch (error: unknown) {
    console.error('[Transport API] GET drivers error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transport/drivers — Register driver with certification (ADMIN, SUPERVISOR, MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPERVISOR', 'MANAGER']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos para registrar conductores' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, licenseNumber, licenseType, licenseExpiry, certificationData, medicalExpiry, emergencyContact } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'El ID del usuario es requerido' }, { status: 400 })
    }

    if (!licenseNumber || typeof licenseNumber !== 'string' || licenseNumber.trim().length === 0) {
      return NextResponse.json({ error: 'El número de licencia es requerido' }, { status: 400 })
    }

    if (!licenseType || typeof licenseType !== 'string') {
      return NextResponse.json({ error: 'El tipo de licencia es requerido' }, { status: 400 })
    }

    // Check user belongs to same company
    const user = await db.user.findFirst({
      where: { id: userId, companyId: session.companyId },
    })
    if (!user) {
      return NextResponse.json({ error: 'El usuario no pertenece a la empresa' }, { status: 400 })
    }

    // Check uniqueness (one driver profile per user)
    const existing = await db.transportDriver.findFirst({
      where: { companyId: session.companyId, userId },
    })
    if (existing) {
      return NextResponse.json({ error: 'Este usuario ya tiene un perfil de conductor registrado' }, { status: 409 })
    }

    const driver = await db.transportDriver.create({
      data: {
        companyId: session.companyId,
        userId,
        licenseNumber: licenseNumber.trim(),
        licenseType: licenseType.trim().toUpperCase(),
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        certificationData: certificationData ? JSON.stringify(certificationData) : undefined,
        medicalExpiry: medicalExpiry ? new Date(medicalExpiry) : null,
        emergencyContact: emergencyContact ? JSON.stringify(emergencyContact) : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'TRANSPORT_DRIVER',
      entityId: driver.id,
      details: { driverName: user.name, licenseNumber: driver.licenseNumber, licenseType: driver.licenseType },
    }, request)

    return NextResponse.json(driver, { status: 201 })
  } catch (error: unknown) {
    console.error('[Transport API] POST driver error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
