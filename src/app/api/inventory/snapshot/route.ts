import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { chatCompletion, type ContentPart } from '@/lib/ai'

// ==================== FUZZY MATCHING ====================

/**
 * Normalize a string for fuzzy comparison:
 * - Lowercase
 * - Remove accents/diacritics
 * - Remove extra spaces
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute simple token overlap similarity between two strings.
 * Returns 0.0–1.0 where 1.0 = perfect match.
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(' ').filter(Boolean))
  const tokensB = new Set(normalize(b).split(' ').filter(Boolean))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
    // partial match: check if any token in B starts with this token or vice versa
    for (const tb of tokensB) {
      if (t.length >= 3 && tb.length >= 3 && (tb.startsWith(t) || t.startsWith(tb))) {
        overlap += 0.5
      }
    }
  }

  const maxTokens = Math.max(tokensA.size, tokensB.size)
  return Math.min(1, overlap / maxTokens)
}

/**
 * Find the best matching InventoryItem for a detected item name.
 * Uses fuzzy token-based matching with a 0.35 threshold.
 */
async function findMatchingItem(
  companyId: string,
  detectedItem: string
): Promise<{ id: string; name: string; similarity: number } | null> {
  const allItems = await db.inventoryItem.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
  })

  if (!Array.isArray(allItems) || allItems.length === 0) return null

  let bestMatch: { id: string; name: string; similarity: number } | null = null

  for (const item of allItems) {
    const sim = tokenSimilarity(item.name, detectedItem)
    if (sim >= 0.35 && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = { id: item.id, name: item.name, similarity: sim }
    }
  }

  return bestMatch
}

// POST /api/inventory/snapshot — Autonomous object detection with VLM
export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { image, imageUrl, locationId, deviceId, itemId, itemName: userItemName } = body

    if (!locationId) {
      return NextResponse.json({ error: 'locationId es requerido' }, { status: 400 })
    }

    if (!image && !imageUrl) {
      return NextResponse.json(
        { error: 'Se requiere una imagen (base64 o URL)' },
        { status: 400 }
      )
    }

    // Verify location belongs to company
    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, companyId: session.companyId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    // Verify device if provided
    let device = null
    if (deviceId) {
      device = await db.inventoryDevice.findFirst({
        where: { id: deviceId, companyId: session.companyId },
      })
      if (!device) {
        return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
      }
    }

    // Resolve user-selected item name if itemId was provided
    let userSelectedName: string | null = userItemName || null
    if (!userSelectedName && itemId) {
      const selectedItem = await db.inventoryItem.findFirst({
        where: { id: itemId, companyId: session.companyId, isActive: true },
        select: { name: true },
      })
      if (selectedItem) userSelectedName = selectedItem.name
    }

    // Build image URL for VLM
    const imageUrlForVLM = imageUrl
      ? imageUrl
      : image
        ? (image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`)
        : null

    if (!imageUrlForVLM) {
      return NextResponse.json({ error: 'No se pudo procesar la imagen' }, { status: 400 })
    }

    // ── AUTONOMOUS DETECTION PROMPT (Systematic Grid Count v3) ──
    const systemPrompt = `Eres un auditor de inventario industrial con experiencia en conteo visual preciso. Sigue ESTRICTAMENTE este protocolo:

PASO 1 — IDENTIFICACIÓN:
Identifica el tipo de artículo industrial predominante (ej. Baterías, Cascos, Válvulas, etc.).

PASO 2 — CONTEO SISTEMÁTICO (CRÍTICO — NO te saltes este paso):
- Divide la imagen en secciones: filas horizontales (de arriba hacia abajo) y columnas (de izquierda a derecha).
- Para cada fila, cuenta cada unidad individual que puedas ver. Si hay objetos en un estante o repisa, cuenta TODOS los del estante.
- NO te saltes ninguna sección de la imagen. Revisa la imagen completa de arriba a abajo.
- Si ves múltiples repisas/niveles/estantes, cuenta CADA nivel por separado y luego suma.
- NO asumas objetos ocultos. Cuenta solo lo que ves.
- Si hay un espacio vacío o hueco, NO lo cuentes.

PASO 3 — VERIFICACIÓN:
- Vuelve a contar usando la disposición por filas y columnas. Multiplica filas × columnas de cada sección.
- Si el conteo por filas × columnas no coincide con tu conteo individual, usa el de filas × columnas.

PASO 4 — CONFIANZA:
- confidence ≥ 0.9: Solo si pudiste contar individualmente cada unidad y verificar por filas × columnas.
- confidence 0.7-0.89: Si algunos objetos están parcialmente ocultos pero puedes estimar con seguridad.
- confidence < 0.7: Si hay mucha ambigüedad, objetos muy apilados, o baja nitidez.

${userSelectedName ? `NOTA: El usuario espera ver "${userSelectedName}". Si la imagen muestra algo distinto, reporta lo que realmente ves.` : ''}

Responde EXCLUSIVAMENTE en JSON puro (sin markdown):
{"detected_item": "tipo de artículo", "count": número_total, "confidence": 0.0-1.0, "observations": "descripción de la disposición (ej. 4 estantes: 4+3+3+5=15 unidades. Todas visibles, sin espacios vacíos)"}

Si no hay objetos claros:
{"detected_item": null, "count": 0, "confidence": 0.0, "observations": "No se pudieron identificar objetos"}`

    // First pass: detect + count
    const firstPassMessages: Array<{ role: string; content: string | ContentPart[] }> = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza esta imagen de inventario. Identifica los artículos, cuéntalos sistemáticamente por filas y columnas, y verifica tu conteo antes de responder.' },
          { type: 'image_url', image_url: { url: imageUrlForVLM, detail: 'high' } },
        ],
      },
    ]

    const firstPassResponse = await chatCompletion(firstPassMessages, { temperature: 0.05 })

    // Second pass: verification — ask the model to double-check
    let aiResponse = firstPassResponse
    let verificationNotes = ''

    if (firstPassResponse) {
      try {
        const jsonMatch = firstPassResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const firstParsed = JSON.parse(jsonMatch[0])
          const firstCount = typeof firstParsed.count === 'number' ? firstParsed.count : '?'

          const verifyMessages: Array<{ role: string; content: string | ContentPart[] }> = [
            {
              role: 'system',
              content: 'Eres un verificador de inventario. Tu ÚNICA tarea es verificar un conteo previo. Analiza la imagen nuevamente y confirma o corrige el número. Responde SOLO en JSON: {"count": número, "confidence": 0.0-1.0, "notes": "explicación breve de la verificación"}. Si el conteo previo fue incorrecto, da el número correcto.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Un sistema contó ${firstCount} unidades en esta imagen. Verifica este conteo contando nuevamente por filas y columnas, de arriba a abajo. ¿Es correcto o hay un error?` },
                { type: 'image_url', image_url: { url: imageUrlForVLM, detail: 'high' } },
              ],
            },
          ]

          const verifyResponse = await chatCompletion(verifyMessages, { temperature: 0.05 })

          if (verifyResponse) {
            try {
              const verifyJsonMatch = verifyResponse.match(/\{[\s\S]*\}/)
              if (verifyJsonMatch) {
                const verifyParsed = JSON.parse(verifyJsonMatch[0])
                const verifiedCount = typeof verifyParsed.count === 'number' ? verifyParsed.count : firstCount
                verificationNotes = typeof verifyParsed.notes === 'string' ? verifyParsed.notes : ''

                // Use verified count if it differs (the second pass is specifically for verification)
                if (verifiedCount !== firstCount) {
                  console.log(`[Inventory Snapshot] Count adjusted: first pass=${firstCount} → verified=${verifiedCount}`)
                  // Update the response with verified count
                  const updatedResponse = firstPassResponse.replace(
                    `"count":\s*${firstCount}`,
                    `"count": ${verifiedCount}`
                  )
                  aiResponse = updatedResponse
                }
              }
            } catch {
              // If verification parse fails, keep first pass result
              console.warn('[Inventory Snapshot] Failed to parse verification response, keeping first pass')
            }
          }
        }
      } catch {
        // If first pass parse fails, we'll try to parse the raw response below
      }
    }

    // ── PARSE AI RESPONSE ──
    let detectedItem: string | null = null
    let aiCount = 0
    let aiConfidence = 0
    let observations: string = ''

    if (aiResponse) {
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          detectedItem = typeof parsed.detected_item === 'string' ? parsed.detected_item.trim() : null
          aiCount = typeof parsed.count === 'number' ? Math.max(0, Math.round(parsed.count)) : 0
          aiConfidence = typeof parsed.confidence === 'number'
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0
          observations = typeof parsed.observations === 'string' ? parsed.observations.trim() : ''
        }
      } catch {
        console.warn('[Inventory API] Failed to parse VLM JSON response, attempting fallback extraction')
        // Fallback: try to extract any meaningful number from the response
        const countMatch = aiResponse.match(/"count"\s*:\s*(\d+)/)
        if (countMatch) {
          aiCount = Math.max(0, parseInt(countMatch[1], 10))
        }
        aiConfidence = 0.3 // Low confidence since we couldn't parse properly
        observations = 'Análisis parcial — no se pudo interpretar completamente la respuesta de la IA'
      }
    }

    // Append verification notes to observations if present
    if (verificationNotes) {
      observations = observations ? `${observations} [Verificación: ${verificationNotes}]` : verificationNotes
    }

    // ── FUZZY MATCHING: Find matching item in database ──
    let matchedItem = null
    let isExactMatch = false
    let isUserMismatch = false

    if (detectedItem) {
      matchedItem = await findMatchingItem(session.companyId, detectedItem)

      if (matchedItem) {
        isExactMatch = normalize(matchedItem.name) === normalize(detectedItem)
      }

      // Check if AI detected something different from what user expected
      if (userSelectedName && detectedItem) {
        const userSim = tokenSimilarity(userSelectedName, detectedItem)
        isUserMismatch = userSim < 0.35
      }
    }

    // ── DISCREPANCY CHECK ──
    let hasDiscrepancy = false
    let beaconCountForAudit: number | null = null
    let updatedStockId: string | null = null

    // Use matched item or fall back to user-selected item for stock lookup
    const targetItemName = matchedItem ? matchedItem.name : userSelectedName

    if (targetItemName) {
      const stockRecords = await db.smartInventory.findMany({
        where: { companyId: session.companyId, locationId },
        include: { item: true },
      })

      if (Array.isArray(stockRecords)) {
        // Find stock record with best match
        const matchingStock = stockRecords.find(
          (s) => s.item && normalize(s.item.name) === normalize(targetItemName)
        ) || stockRecords.find(
          (s) => s.item && tokenSimilarity(s.item.name, targetItemName) >= 0.5
        )

        if (matchingStock) {
          beaconCountForAudit = matchingStock.beaconCount
          hasDiscrepancy = matchingStock.beaconCount !== null && matchingStock.beaconCount !== aiCount
          updatedStockId = matchingStock.id

          // Update stock record with camera count
          await db.smartInventory.update({
            where: { id: matchingStock.id },
            data: {
              cameraCount: aiCount,
              lastCountedAt: new Date(),
              discrepancy: hasDiscrepancy,
            },
          })
        }
      }
    }

    // ── CREATE AUDIT RECORD ──
    const audit = await db.inventoryAudit.create({
      data: {
        companyId: session.companyId,
        locationId,
        deviceId: deviceId || null,
        itemName: detectedItem || targetItemName || null,
        itemCount: aiCount,
        beaconCount: beaconCountForAudit,
        confidence: aiConfidence,
        rawImageUrl: imageUrlForVLM.length > 2000 ? null : imageUrlForVLM,
        discrepancy: hasDiscrepancy,
        notes: observations || null,
        metadata: JSON.stringify({
          detectedItem,
          matchedItemId: matchedItem?.id || null,
          matchedItemName: matchedItem?.name || null,
          isExactMatch,
          isUserMismatch,
          userExpectedItem: userSelectedName || null,
          observations,
          model: 'vlm-autonomous-v3',
          twoPass: true,
          verificationNotes: verificationNotes || null,
        }),
      },
      include: {
        location: { select: { id: true, name: true } },
        device: { select: { id: true, name: true, type: true } },
      },
    })

    // ── AUDIT LOG ──
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'CREATE',
      entityType: 'INVENTORY_SNAPSHOT',
      entityId: audit.id,
      details: {
        locationId,
        locationName: location.name,
        deviceId: deviceId || null,
        detectedItem,
        matchedItem: matchedItem?.name || null,
        isExactMatch,
        isUserMismatch,
        userExpected: userSelectedName || null,
        aiCount,
        beaconCount: beaconCountForAudit,
        confidence: aiConfidence,
        discrepancy: hasDiscrepancy,
        observations,
      },
    }, request)

    // ── RESPONSE ──
    return NextResponse.json({
      audit,
      analysis: {
        detectedItem,
        count: aiCount,
        confidence: aiConfidence,
        observations,
        detected: detectedItem ? [detectedItem] : [],
        discrepancy: hasDiscrepancy,
        beaconCount: beaconCountForAudit,
        matchedItem: matchedItem ? { id: matchedItem.id, name: matchedItem.name } : null,
        isExactMatch,
        isUserMismatch,
        lowConfidence: aiConfidence > 0 && aiConfidence < 0.7,
      },
    })
  } catch (error: unknown) {
    console.error('[Inventory API] POST snapshot error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
