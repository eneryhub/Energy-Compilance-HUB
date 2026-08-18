import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import {
  generateQrSecret,
  buildQrPayload,
  validateQrPayload,
  decodeQrPayloadFromString,
  encodeQrPayloadToString,
  type QrPayload,
} from '@/lib/qr'

// GET /api/locations/[id]/qr — Generate a real scannable QR code (PNG) for a location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Fetch the location
    let location
    try {
      location = await db.workLocation.findFirst({
        where: {
          id,
          companyId: session.companyId,
        },
      })
    } catch (dbErr) {
      console.error('[GET /api/locations/[id]/qr] DB query failed:', dbErr)
      return NextResponse.json(
        { error: 'Error al consultar la ubicación. La base de datos puede necesitar una migración de esquema.' },
        { status: 500 }
      )
    }

    if (!location) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      )
    }

    // Check verification method
    if (location.verificationMethod && location.verificationMethod !== 'QR_CODE') {
      return NextResponse.json(
        { error: 'Esta ubicación no usa verificación por código QR' },
        { status: 400 }
      )
    }

    // If no QR secret/data exists, generate them now
    let secret = (location as Record<string, unknown>).qrCodeSecret as string | null | undefined
    let payload: QrPayload

    if (!secret) {
      secret = generateQrSecret()
      payload = buildQrPayload(location.id, secret, session.companyId)

      try {
        await db.workLocation.update({
          where: { id: location.id },
          data: {
            qrCodeSecret: secret,
            qrCodeData: JSON.stringify(payload),
          },
        })
      } catch (updateErr) {
        console.warn('[GET /api/locations/[id]/qr] Could not persist QR data:', updateErr)
      }

      createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'WORK_LOCATION',
        entityId: location.id,
        details: { action: 'qr_generated' },
      }, request).catch(() => {/* non-blocking */})
    } else {
      // Parse existing QR data, or rebuild if missing/expired
      const rawQrData = (location as Record<string, unknown>).qrCodeData as string | null | undefined
      try {
        const parsed = JSON.parse(rawQrData || '{}') as QrPayload
        if (parsed.exp && Date.now() > parsed.exp) {
          payload = buildQrPayload(location.id, secret, session.companyId)
          try {
            await db.workLocation.update({
              where: { id: location.id },
              data: { qrCodeData: JSON.stringify(payload) },
            })
          } catch {
            // Continue anyway
          }
        } else {
          payload = parsed
        }
      } catch {
        payload = buildQrPayload(location.id, secret, session.companyId)
        try {
          await db.workLocation.update({
            where: { id: location.id },
            data: { qrCodeData: JSON.stringify(payload) },
          })
        } catch {
          // Continue anyway
        }
      }
    }

    // Encode the payload as a compact base64 string (this is what the QR will contain)
    const qrStringData = encodeQrPayloadToString(payload)

    // Generate a REAL scannable QR code as PNG data URL
    try {
      const qrPngDataUrl = await QRCode.toDataURL(qrStringData, {
        type: 'image/png',
        width: 400,
        margin: 2,
        color: {
          dark: '#1e293b',  // Dark slate
          light: '#ffffff',  // White background
        },
        errorCorrectionLevel: 'M',
      })

      return NextResponse.json({
        qrUrl: qrPngDataUrl,
        secret,
        payload,
      })
    } catch (qrErr) {
      console.error('[GET /api/locations/[id]/qr] QR generation failed:', qrErr)
      return NextResponse.json(
        { error: 'Error al generar la imagen del código QR' },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    console.error('[GET /api/locations/[id]/qr] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/locations/[id]/qr — Validate a scanned QR code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Fetch the location with QR secret
    let location
    try {
      location = await db.workLocation.findFirst({
        where: {
          id,
          companyId: session.companyId,
          verificationMethod: 'QR_CODE',
        },
      })
    } catch (dbErr) {
      console.error('[POST /api/locations/[id]/qr] DB query failed:', dbErr)
      return NextResponse.json(
        { error: 'Error al consultar la ubicación QR' },
        { status: 500 }
      )
    }

    if (!location) {
      return NextResponse.json(
        { error: 'Ubicación QR no encontrada' },
        { status: 404 }
      )
    }

    const qrCodeSecret = (location as Record<string, unknown>).qrCodeSecret as string | null | undefined

    if (!qrCodeSecret) {
      return NextResponse.json(
        { error: 'Esta ubicación no tiene un código QR configurado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere el campo "code" con el contenido escaneado del QR' },
        { status: 400 }
      )
    }

    // Decode the scanned string (could be base64-encoded or raw JSON)
    const decodedPayload = decodeQrPayloadFromString(code.trim())

    if (!decodedPayload) {
      createAuditLog({
        companyId: session.companyId,
        userId: session.userId,
        action: 'VIEW',
        entityType: 'WORK_LOCATION',
        entityId: id,
        details: { action: 'qr_validation_failed', reason: 'invalid_format' },
      }, request).catch(() => {/* non-blocking */})

      return NextResponse.json({
        valid: false,
        locationId: null,
        message: 'Formato de código QR no reconocido',
      })
    }

    // Validate against the stored secret
    const result = validateQrPayload(decodedPayload, qrCodeSecret)

    createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: result.valid ? 'UPDATE' : 'VIEW',
      entityType: 'WORK_LOCATION',
      entityId: id,
      details: {
        action: 'qr_scan',
        valid: result.valid,
        reason: result.valid ? 'scan_success' : result.message,
      },
    }, request).catch(() => {/* non-blocking */})

    if (result.valid) {
      try {
        await db.workLocation.update({
          where: { id },
          data: { verifiedAt: new Date() },
        })
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      valid: result.valid,
      locationId: result.locationId,
      message: result.message,
    })
  } catch (error: unknown) {
    console.error('[POST /api/locations/[id]/qr] Error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
