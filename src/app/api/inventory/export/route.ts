import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
// @ts-expect-error — PDFKit is a CommonJS module
import PDFDocument from 'pdfkit'
import * as XLSX from 'xlsx'

// GET /api/inventory/export?locationId=xxx&format=pdf|xlsx
export async function GET(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const format = searchParams.get('format') || 'pdf'

    if (!locationId) {
      return NextResponse.json({ error: 'locationId es requerido' }, { status: 400 })
    }

    if (format !== 'pdf' && format !== 'xlsx') {
      return NextResponse.json({ error: 'Formato no soportado. Use pdf o xlsx' }, { status: 400 })
    }

    // ── Fetch data ──
    const location = await db.inventoryLocation.findFirst({
      where: { id: locationId, companyId: session.companyId },
    })
    if (!location) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 })
    }

    const [
      stockRecords,
      devices,
      audits,
      statsAggregate,
    ] = await Promise.all([
      db.smartInventory.findMany({
        where: { companyId: session.companyId, locationId },
        include: {
          item: { select: { id: true, name: true, sku: true, category: true, unit: true, thresholdMin: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.inventoryDevice.findMany({
        where: { companyId: session.companyId, locationId },
        orderBy: { type: 'asc' },
      }),
      db.inventoryAudit.findMany({
        where: { companyId: session.companyId, locationId },
        include: {
          device: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.smartInventory.aggregate({
        where: { companyId: session.companyId, locationId },
        _sum: { quantity: true },
        _count: true,
      }),
    ])

    // Low stock count
    let lowStockCount = 0
    if (Array.isArray(stockRecords)) {
      lowStockCount = stockRecords.filter(
        (s) => s.quantity <= (s.item?.thresholdMin ?? 999999)
      ).length
    }
    const totalStock = statsAggregate._sum.quantity ?? 0
    const totalItems = statsAggregate._count ?? 0
    const discrepancyCount = stockRecords.filter((s) => s.discrepancy).length
    const devicesOnline = devices.filter((d) => d.status === 'ONLINE').length
    const totalDevices = devices.length

    // Company info
    const company = await db.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    })

    const now = new Date()
    const periodStr = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const companyName = company?.name || 'Energy-Compliance Hub'

    // ── Generate export ──
    if (format === 'xlsx') {
      return generateXlsx({
        companyName, location, stockRecords, devices, audits,
        totalStock, totalItems, lowStockCount, discrepancyCount, devicesOnline, totalDevices,
        periodStr, dateStr,
      })
    }

    return await generatePdf({
      companyName, location, stockRecords, devices, audits,
      totalStock, totalItems, lowStockCount, discrepancyCount, devicesOnline, totalDevices,
      periodStr, dateStr,
    })
  } catch (error: unknown) {
    console.error('[Inventory API] GET export error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// PDF GENERATION (PDFKit) — matching "Reporte Gerencial" template
// ═══════════════════════════════════════════════════════════════

function generatePdf(ctx: {
  companyName: string
  location: { id: string; name: string; province: string | null; city: string | null; address: string | null }
  stockRecords: any[]
  devices: any[]
  audits: any[]
  totalStock: number
  totalItems: number
  lowStockCount: number
  discrepancyCount: number
  devicesOnline: number
  totalDevices: number
  periodStr: string
  dateStr: string
}): Promise<NextResponse> {
  return new Promise((resolve, reject) => {
  const PDFDoc = PDFDocument
  const buffers: Buffer[] = []
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
  })

  doc.on('data', (chunk: Buffer) => buffers.push(chunk))
  doc.on('end', () => {
    resolve(new NextResponse(Buffer.concat(buffers), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="reporte-inventario-${ctx.location.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
      },
    }))
  })
  doc.on('error', reject)

  const W = 595.28 // A4 width in points
  const H = 841.89 // A4 height in points
  const ML = 40     // left margin
  const MR = 40     // right margin
  const CW = W - ML - MR // content width
  let y = 0

  // ── Colors ──
  const C = {
    navy: '#0A2647',
    blue: '#1A365D',
    orange: '#FFA500',
    orangeDark: '#E69500',
    green: '#2E8B57',
    red: '#B22222',
    gray: '#F5F5F5',
    grayDark: '#666666',
    grayMed: '#999999',
    grayBorder: '#CCCCCC',
    white: '#FFFFFF',
    black: '#333333',
  }

  // ── 1) HEADER BAR ──
  doc.rect(0, 0, W, 90).fill(C.navy)
  doc.rect(0, 90, W, 4).fill(C.orange)

  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.orange)
  doc.text(ctx.companyName.toUpperCase(), ML, 18, { width: CW })

  doc.font('Helvetica-Bold').fontSize(22).fillColor(C.white)
  doc.text('REPORTE DE INVENTARIO INTELIGENTE', ML, 36, { width: CW })

  doc.font('Helvetica').fontSize(9).fillColor(C.grayMed)
  const subtitle = `${ctx.location.name}${ctx.location.province ? ' • ' + ctx.location.province : ''} • Periodo: ${ctx.periodStr} • ${ctx.dateStr}`
  doc.text(subtitle, ML, 68, { width: CW })

  y = 110

  // ── 2) KPI CARDS ROW ──
  const kpis = [
    { value: ctx.totalStock.toLocaleString('es-AR'), label: 'TOTAL EN STOCK', color: C.blue, borderColor: C.blue },
    { value: String(ctx.totalItems), label: 'ARTICULOS REGISTRADOS', color: C.blue, borderColor: C.blue },
    { value: String(ctx.lowStockCount), label: 'ALERTAS STOCK BAJO', color: ctx.lowStockCount > 0 ? C.red : C.green, borderColor: ctx.lowStockCount > 0 ? C.red : C.green },
    { value: String(ctx.discrepancyCount), label: 'DISCREPANCIAS ACTIVAS', color: ctx.discrepancyCount > 0 ? C.orange : C.green, borderColor: ctx.discrepancyCount > 0 ? C.orange : C.green },
  ]

  const kpiW = (CW - 30) / 4 // 30 = 3 gaps of 10
  kpis.forEach((kpi, i) => {
    const kx = ML + i * (kpiW + 10)
    doc.rect(kx, y, kpiW, 52).lineWidth(1).strokeColor(C.grayBorder).stroke()
    doc.rect(kx, y, 4, 52).fill(kpi.borderColor)
    doc.font('Helvetica-Bold').fontSize(20).fillColor(kpi.color)
    doc.text(kpi.value, kx + 14, y + 8, { width: kpiW - 20, height: 28 })
    doc.font('Helvetica').fontSize(7).fillColor(C.grayDark)
    doc.text(kpi.label, kx + 14, y + 36, { width: kpiW - 20 })
  })
  y += 72

  // ── 3) DEVICES TABLE ──
  y = drawSectionTitle(doc, ML, y, CW, C, `DISPOSITIVOS (${ctx.totalDevices} equipos, ${ctx.devicesOnline} en linea)`)

  if (ctx.devices.length > 0) {
    const devCols = [30, 180, 90, 70, 120] // widths
    const devHeaders = ['N°', 'Nombre', 'Tipo', 'Estado', 'Info']
    y = drawTableHeader(doc, ML, y, CW, devCols, devHeaders, C)

    ctx.devices.forEach((dev: any, i: number) => {
      if (y > H - 60) {
        doc.addPage()
        y = 40
        y = drawTableHeader(doc, ML, y, CW, devCols, devHeaders, C)
      }
      const rowBg = i % 2 === 1 ? C.gray : C.white
      doc.rect(ML, y, CW, 20).fill(rowBg)
      const typeLabel = dev.type === 'CAMERA' ? 'Camara' : 'Gateway BLE'
      const statusColor = dev.status === 'ONLINE' ? C.green : dev.status === 'OFFLINE' ? C.red : C.orange
      const info = dev.type === 'CAMERA' ? (dev.ipAddress || '—') : (dev.beaconUuid ? `${dev.beaconUuid.substring(0, 18)}...` : '—')

      let cx = ML
      doc.font('Helvetica').fontSize(8).fillColor(C.black)
      doc.text(String(i + 1), cx, y + 5, { width: devCols[0], align: 'center' }); cx += devCols[0]
      doc.text(dev.name || '—', cx + 4, y + 5, { width: devCols[1] - 8 }); cx += devCols[1]
      doc.font('Helvetica').fontSize(8).fillColor(C.grayDark)
      doc.text(typeLabel, cx, y + 5, { width: devCols[2] }); cx += devCols[2]
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(8)
      doc.text(dev.status, cx, y + 5, { width: devCols[3] }); cx += devCols[3]
      doc.fillColor(C.grayDark).font('Helvetica').fontSize(7)
      doc.text(info, cx, y + 5, { width: devCols[4] - 4 })
      y += 20
    })
    y += 6
  } else {
    doc.font('Helvetica').fontSize(9).fillColor(C.grayDark)
    doc.text('Sin dispositivos vinculados a esta ubicacion.', ML + 4, y + 4)
    y += 24
  }

  // ── 4) STOCK TABLE ──
  y = drawSectionTitle(doc, ML, y, CW, C, `INVENTARIO DE STOCK (${ctx.totalItems} articulos)`)

  if (ctx.stockRecords.length > 0) {
    const stCols = [26, 155, 60, 48, 55, 55, 45, 55] // widths
    const stHeaders = ['N°', 'Articulo', 'Categoria', 'Cantidad', 'Cant. IA', 'Cant. BLE', 'Estado', 'Ult. Recuento']
    y = drawTableHeader(doc, ML, y, CW, stCols, stHeaders, C)

    ctx.stockRecords.forEach((rec: any, i: number) => {
      if (y > H - 60) {
        doc.addPage()
        y = 40
        y = drawTableHeader(doc, ML, y, CW, stCols, stHeaders, C)
      }
      const rowBg = i % 2 === 1 ? C.gray : C.white
      doc.rect(ML, y, CW, 20).fill(rowBg)

      const itemName = rec.item?.name || 'Desconocido'
      const category = rec.item?.category || '—'
      const qty = rec.quantity
      const threshold = rec.item?.thresholdMin ?? 999999
      const status = qty <= threshold ? (qty <= Math.floor(threshold * 0.5) ? 'CRITICO' : 'BAJO') : 'OK'
      const statusColor = status === 'CRITICO' ? C.red : status === 'BAJO' ? C.orange : C.green
      const camCount = rec.cameraCount ?? '—'
      const beaconCount = rec.beaconCount ?? '—'
      const lastCounted = rec.lastCountedAt
        ? new Date(rec.lastCountedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—'

      let cx = ML
      doc.font('Helvetica').fontSize(8).fillColor(C.black)
      doc.text(String(i + 1), cx, y + 5, { width: stCols[0], align: 'center' }); cx += stCols[0]
      doc.text(itemName, cx + 4, y + 5, { width: stCols[1] - 8 }); cx += stCols[1]
      doc.fillColor(C.grayDark).fontSize(7)
      doc.text(category, cx, y + 5, { width: stCols[2] }); cx += stCols[2]
      doc.fillColor(C.black).fontSize(8)
      doc.text(String(qty), cx, y + 5, { width: stCols[3], align: 'center' }); cx += stCols[3]
      doc.fillColor(C.grayDark).fontSize(8)
      doc.text(String(camCount), cx, y + 5, { width: stCols[4], align: 'center' }); cx += stCols[4]
      doc.text(String(beaconCount), cx, y + 5, { width: stCols[5], align: 'center' }); cx += stCols[5]
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(8)
      doc.text(status, cx, y + 5, { width: stCols[6], align: 'center' }); cx += stCols[6]
      doc.fillColor(C.grayDark).font('Helvetica').fontSize(7)
      doc.text(lastCounted, cx, y + 5, { width: stCols[7] - 4 })
      y += 20
    })
    y += 6
  } else {
    doc.font('Helvetica').fontSize(9).fillColor(C.grayDark)
    doc.text('Sin articulos registrados en esta ubicacion.', ML + 4, y + 4)
    y += 24
  }

  // ── 5) AUDIT LOG TABLE ──
  y = drawSectionTitle(doc, ML, y, CW, C, `HISTORIAL DE ESCANEOS IA (ultimos ${ctx.audits.length})`)

  if (ctx.audits.length > 0) {
    const auCols = [26, 150, 50, 50, 50, 55, 70, 100] // widths
    const auHeaders = ['N°', 'Articulo', 'Conteo IA', 'Conteo BLE', 'Confianza', 'Discrep.', 'Dispositivo', 'Fecha']
    y = drawTableHeader(doc, ML, y, CW, auCols, auHeaders, C)

    ctx.audits.forEach((audit: any, i: number) => {
      if (y > H - 60) {
        doc.addPage()
        y = 40
        y = drawTableHeader(doc, ML, y, CW, auCols, auHeaders, C)
      }
      const rowBg = i % 2 === 1 ? C.gray : C.white
      doc.rect(ML, y, CW, 20).fill(rowBg)

      const conf = audit.confidence != null ? `${Math.round(audit.confidence * 100)}%` : '—'
      const discColor = audit.discrepancy ? C.red : C.green
      const discLabel = audit.discrepancy ? 'SI' : 'NO'
      const deviceName = audit.device?.name || '—'
      const dateVal = audit.createdAt
        ? new Date(audit.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '—'

      let cx = ML
      doc.font('Helvetica').fontSize(8).fillColor(C.black)
      doc.text(String(i + 1), cx, y + 5, { width: auCols[0], align: 'center' }); cx += auCols[0]
      doc.text(audit.itemName || '—', cx + 4, y + 5, { width: auCols[1] - 8 }); cx += auCols[1]
      doc.text(String(audit.itemCount ?? 0), cx, y + 5, { width: auCols[2], align: 'center' }); cx += auCols[2]
      doc.text(audit.beaconCount != null ? String(audit.beaconCount) : '—', cx, y + 5, { width: auCols[3], align: 'center' }); cx += auCols[3]
      doc.fillColor(C.grayDark).fontSize(8)
      doc.text(conf, cx, y + 5, { width: auCols[4], align: 'center' }); cx += auCols[4]
      doc.fillColor(discColor).font('Helvetica-Bold').fontSize(8)
      doc.text(discLabel, cx, y + 5, { width: auCols[5], align: 'center' }); cx += auCols[5]
      doc.fillColor(C.grayDark).font('Helvetica').fontSize(7)
      doc.text(deviceName, cx + 4, y + 5, { width: auCols[6] - 8 }); cx += auCols[6]
      doc.text(dateVal, cx, y + 5, { width: auCols[7] - 4 })
      y += 20
    })
    y += 6
  } else {
    doc.font('Helvetica').fontSize(9).fillColor(C.grayDark)
    doc.text('Sin escaneos registrados.', ML + 4, y + 4)
    y += 24
  }

  // ── 6) FOOTER (every page) ──
  const totalPages = doc.bufferedPageRange().count
  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p)
    const pageH = H
    doc.rect(0, pageH - 30, W, 30).fill(C.navy)
    doc.font('Helvetica').fontSize(7).fillColor(C.grayMed)
    doc.text(`${ctx.companyName} • Reporte de Inventario Inteligente • ${ctx.dateStr}`, ML, pageH - 20, { width: CW / 2 })
    doc.text(`Pagina ${p + 1} de ${totalPages}`, ML + CW / 2, pageH - 20, { width: CW / 2, align: 'right' })
  }

  doc.end()
  }) // end Promise
}

// ── Helper: Section Title ──
function drawSectionTitle(doc: any, x: number, y: number, w: number, C: Record<string, string>, text: string): number {
  // Ensure room for title + at least some table rows
  if (y > 760) {
    doc.addPage()
    y = 40
  }
  doc.rect(x, y, 4, 16).fill(C.orange)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.blue)
  doc.text(text, x + 12, y + 2, { width: w - 12 })
  doc.moveTo(x, y + 20).lineTo(x + w, y + 20).lineWidth(0.5).strokeColor(C.grayBorder).stroke()
  return y + 26
}

// ── Helper: Table Header ──
function drawTableHeader(doc: any, x: number, y: number, totalW: number, colWidths: number[], headers: string[], C: Record<string, string>): number {
  if (y > 770) {
    doc.addPage()
    y = 40
  }
  doc.rect(x, y, totalW, 20).fill(C.blue)
  let cx = x
  colWidths.forEach((w, i) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
    doc.text(headers[i], cx + 4, y + 5, { width: w - 8 })
    cx += w
  })
  return y + 20
}

// ═══════════════════════════════════════════════════════════════
// XLSX GENERATION (SheetJS / xlsx)
// ═══════════════════════════════════════════════════════════════

async function generateXlsx(ctx: {
  companyName: string
  location: { id: string; name: string; province: string | null; city: string | null; address: string | null }
  stockRecords: any[]
  devices: any[]
  audits: any[]
  totalStock: number
  totalItems: number
  lowStockCount: number
  discrepancyCount: number
  devicesOnline: number
  totalDevices: number
  periodStr: string
  dateStr: string
}) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Inventario ──
  const invHeaders = ['N°', 'Articulo', 'SKU', 'Categoria', 'Unidad', 'Cantidad', 'Conteo IA', 'Conteo BLE', 'Umbral Min', 'Estado', 'Discrepancia', 'Ult. Recuento']
  const invData = ctx.stockRecords.map((rec: any, i: number) => {
    const qty = rec.quantity
    const threshold = rec.item?.thresholdMin ?? 999999
    const status = qty <= threshold ? (qty <= Math.floor(threshold * 0.5) ? 'CRITICO' : 'BAJO') : 'OK'
    return [
      i + 1,
      rec.item?.name || 'Desconocido',
      rec.item?.sku || '—',
      rec.item?.category || '—',
      rec.item?.unit || '—',
      qty,
      rec.cameraCount ?? '—',
      rec.beaconCount ?? '—',
      rec.item?.thresholdMin ?? '—',
      status,
      rec.discrepancy ? 'SI' : 'NO',
      rec.lastCountedAt ? new Date(rec.lastCountedAt).toLocaleDateString('es-AR') : '—',
    ]
  })
  const ws1 = XLSX.utils.aoa_to_sheet([invHeaders, ...invData])
  // Set column widths
  ws1['!cols'] = [
    { wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Inventario')

  // ── Sheet 2: Dispositivos ──
  const devHeaders = ['N°', 'Nombre', 'Tipo', 'Estado', 'IP / UUID', 'Major', 'Minor', 'RSSI', 'Ult. Vista']
  const devData = ctx.devices.map((dev: any, i: number) => {
    const typeLabel = dev.type === 'CAMERA' ? 'Camara' : 'Gateway BLE'
    const info = dev.type === 'CAMERA' ? (dev.ipAddress || '') : (dev.beaconUuid || '')
    return [
      i + 1,
      dev.name,
      typeLabel,
      dev.status,
      info,
      dev.beaconMajor ?? '',
      dev.beaconMinor ?? '',
      dev.beaconRssi ?? '',
      dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleDateString('es-AR') : '',
    ]
  })
  const ws2 = XLSX.utils.aoa_to_sheet([devHeaders, ...devData])
  ws2['!cols'] = [
    { wch: 5 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 36 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Dispositivos')

  // ── Sheet 3: Auditoria IA ──
  const audHeaders = ['N°', 'Articulo', 'Conteo IA', 'Conteo BLE', 'Confianza', 'Discrepancia', 'Dispositivo', 'Tipo Disp.', 'Fecha']
  const audData = ctx.audits.map((audit: any, i: number) => [
    i + 1,
    audit.itemName || '—',
    audit.itemCount ?? 0,
    audit.beaconCount ?? '—',
    audit.confidence != null ? `${Math.round(audit.confidence * 100)}%` : '—',
    audit.discrepancy ? 'SI' : 'NO',
    audit.device?.name || '—',
    audit.device?.type || '—',
    audit.createdAt ? new Date(audit.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—',
  ])
  const ws3 = XLSX.utils.aoa_to_sheet([audHeaders, ...audData])
  ws3['!cols'] = [
    { wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, ws3, 'Auditoria IA')

  // ── Write buffer ──
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `inline; filename="inventario-${ctx.location.name.replace(/\s+/g, '-').toLowerCase()}.xlsx"`,
    },
  })
}
