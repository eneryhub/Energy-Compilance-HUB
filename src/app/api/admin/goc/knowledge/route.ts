import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'

// GET /api/admin/goc/knowledge — Search knowledge base entries
export async function GET(request: NextRequest) {
  try {
    const payload = await getTokenPayload(request)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol SUPER_ADMIN.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || undefined
    const category = searchParams.get('category') || undefined
    const code = searchParams.get('code') || undefined

    // Build where clause
    const where: Record<string, unknown> = {}
    if (q) {
      // Search across errorCode, title, rootCause, appliedSolution
      where.OR = [
        { errorCode: { contains: q } },
        { title: { contains: q } },
        { rootCause: { contains: q } },
        { appliedSolution: { contains: q } },
      ]
    } else if (code) {
      where.errorCode = code
    }
    if (category) {
      where.category = category
    }

    // If exact code match, increment timesUsed
    if (code) {
      try {
        await db.knowledgeBase.updateMany({
          where: { errorCode: code },
          data: { timesUsed: { increment: 1 } },
        })
      } catch {
        // Non-blocking: don't fail the GET if increment fails
      }
    }

    const entries = await db.knowledgeBase.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { timesUsed: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      entries: entries.map(e => ({
        id: e.id,
        errorCode: e.errorCode,
        category: e.category,
        title: e.title,
        rootCause: e.rootCause,
        appliedSolution: e.appliedSolution,
        severity: e.severity,
        referenceUrl: e.referenceUrl,
        timesUsed: e.timesUsed,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      total: entries.length,
    })
  } catch (error: unknown) {
    console.error('[GOC Knowledge GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/admin/goc/knowledge — Create new knowledge base entry
export async function POST(request: NextRequest) {
  try {
    const payload = await getTokenPayload(request)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol SUPER_ADMIN.' }, { status: 403 })
    }

    const body = await request.json()
    const { errorCode, category, title, rootCause, appliedSolution, severity } = body

    if (!errorCode || !category || !title || !rootCause || !appliedSolution) {
      return NextResponse.json(
        { error: 'Campos requeridos: errorCode, category, title, rootCause, appliedSolution.' },
        { status: 400 }
      )
    }

    // Check for duplicate errorCode
    const existing = await db.knowledgeBase.findUnique({ where: { errorCode } })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una entrada con errorCode "${errorCode}".`, existingId: existing.id },
        { status: 409 }
      )
    }

    const entry = await db.knowledgeBase.create({
      data: {
        errorCode,
        category,
        title,
        rootCause,
        appliedSolution,
        severity: severity || 'MEDIUM',
      },
    })

    return NextResponse.json({
      id: entry.id,
      errorCode: entry.errorCode,
      category: entry.category,
      title: entry.title,
      rootCause: entry.rootCause,
      appliedSolution: entry.appliedSolution,
      severity: entry.severity,
      referenceUrl: entry.referenceUrl,
      timesUsed: entry.timesUsed,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[GOC Knowledge POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
