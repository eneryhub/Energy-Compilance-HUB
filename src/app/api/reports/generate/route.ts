import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from 'date-fns'
import { es } from 'date-fns/locale'

// ============ Types ============

interface ReportRequestBody {
  dateFrom?: string
  dateTo?: string
  riskType?: string
  status?: string
  format?: 'json' | 'pdf' | 'xlsx'
}

interface ReportSummary {
  totalPermits: number
  approvedPermits: number
  rejectedPermits: number
  pendingPermits: number
  safetyIndex: number
  documentsActive: number
  documentsExpired: number
  documentsCriticalExpired: number
  sensorsWithAlerts: number
  periodLabel: string
}

interface ReportPermit {
  id: string
  permitNumber: string
  riskType: string
  status: string
  technicianName: string
  supervisorName: string
  workLocation: string
  workDescription: string
  createdAt: string
  approvedAt?: string | null
  rejectedAt?: string | null
}

interface ReportDocument {
  id: string
  title: string
  documentType: string
  category: string
  criticality: string
  status: string
  issueDate?: string | null
  expiryDate?: string | null
  holderName?: string | null
}

interface SensorAlert {
  id: string
  sensorName: string
  sensorType: string
  value: number
  unit: string
  status: string
  timestamp: string
  thresholdWarning: number
  thresholdCritical: number
}

interface ReportCharts {
  permitsByStatus: { APPROVED: number; REJECTED: number; PENDING: number; CANCELLED: number }
  permitsByRisk: Record<string, number>
  documentsByCategory: Record<string, number>
  monthlyTrend: Array<{ month: string; permits: number; approved: number }>
}

interface ReportData {
  summary: ReportSummary
  permits: ReportPermit[]
  documents: ReportDocument[]
  sensorAlerts: SensorAlert[]
  charts: ReportCharts
}

// ============ Helpers ============

function getPeriodLabel(dateFrom: Date, dateTo: Date): string {
  const fromMonth = format(dateFrom, 'MMMM yyyy', { locale: es })
  const toMonth = format(dateTo, 'MMMM yyyy', { locale: es })
  if (fromMonth === toMonth) {
    return fromMonth.charAt(0).toUpperCase() + fromMonth.slice(1)
  }
  return `${fromMonth.charAt(0).toUpperCase() + fromMonth.slice(1)} - ${toMonth.charAt(0).toUpperCase() + toMonth.slice(1)}`
}

function resolveDateRange(dateFrom?: string, dateTo?: string, preset?: string): { from: Date; to: Date } {
  if (dateFrom && dateTo) {
    return { from: parseISO(dateFrom), to: parseISO(dateTo) }
  }
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_30_days':
      return { from: subDays(now, 30), to: now }
    case 'this_year':
      return { from: startOfYear(now), to: endOfMonth(now) }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}

/** Group permits by month in JavaScript — works for any database engine. */
function groupPermitsByMonth(
  permits: Array<{ createdAt: Date; status: string }>,
  from: Date,
  to: Date,
): Array<{ month: string; permits: number; approved: number }> {
  const monthlyPermitsMap: Record<string, number> = {}
  const monthlyApprovedMap: Record<string, number> = {}

  for (const p of permits) {
    const key = format(p.createdAt, 'yyyy-MM')
    monthlyPermitsMap[key] = (monthlyPermitsMap[key] || 0) + 1
    if (p.status === 'APPROVED') {
      monthlyApprovedMap[key] = (monthlyApprovedMap[key] || 0) + 1
    }
  }

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const trend: Array<{ month: string; permits: number; approved: number }> = []
  const startM = subMonths(from, 6)
  let current = startOfMonth(startM)
  while (current <= endOfMonth(to)) {
    const key = format(current, 'yyyy-MM')
    const label = `${monthNames[current.getMonth()]} ${current.getFullYear()}`
    trend.push({
      month: label,
      permits: monthlyPermitsMap[key] || 0,
      approved: monthlyApprovedMap[key] || 0,
    })
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  return trend
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPERVISOR', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Sin permisos suficientes' }, { status: 403 })
    }

    const body: ReportRequestBody = await request.json()
    const { dateFrom, dateTo, riskType, status, format } = body

    const { from, to } = resolveDateRange(dateFrom, dateTo)
    const periodLabel = getPeriodLabel(from, to)
    const companyId = session.companyId

    // Build permit filter
    const permitWhere: Record<string, unknown> = {
      companyId,
      createdAt: { gte: from, lte: to },
    }
    if (riskType) permitWhere.riskType = riskType
    if (status) permitWhere.status = status

    // Build document filter
    const docWhere: Record<string, unknown> = {
      companyId,
    }
    if (dateFrom) {
      docWhere.createdAt = { gte: from }
    }
    if (dateTo) {
      docWhere.createdAt = { ...(docWhere.createdAt as Record<string, unknown> || {}), lte: to }
    }

    // Fetch all data in parallel — NO raw SQL, pure Prisma ORM (works on SQLite & PostgreSQL)
    const [
      permits,
      permitsByStatusGrouped,
      permitsByRiskGrouped,
      documents,
      sensors,
      sensorAlertReadings,
      monthlyPermitsForTrend,
    ] = await Promise.all([
      // All permits in range
      db.permit.findMany({
        where: permitWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          permitNumber: true,
          riskType: true,
          status: true,
          technicianName: true,
          supervisorName: true,
          workLocation: true,
          workDescription: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
        },
      }),

      // Permits grouped by status
      db.permit.groupBy({
        by: ['status'],
        where: { companyId, createdAt: { gte: from, lte: to } },
        _count: { status: true },
      }),

      // Permits grouped by risk type
      db.permit.groupBy({
        by: ['riskType'],
        where: { companyId, createdAt: { gte: from, lte: to } },
        _count: { riskType: true },
      }),

      // Documents
      db.hseDocument.findMany({
        where: docWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          documentType: true,
          category: true,
          criticality: true,
          status: true,
          issueDate: true,
          expiryDate: true,
          holderName: true,
        },
      }),

      // Sensors with alerts (WARNING or CRITICO)
      db.sensor.findMany({
        where: {
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
          unit: true,
          thresholdWarning: true,
          thresholdCritical: true,
          currentValue: true,
        },
      }),

      // Recent sensor readings with alerts
      db.sensorReading.findMany({
        where: {
          timestamp: { gte: from, lte: to },
          sensor: { companyId },
          status: { in: ['WARNING', 'CRITICO'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: {
          sensor: {
            select: { name: true, type: true, unit: true, thresholdWarning: true, thresholdCritical: true },
          },
        },
      }),

      // Monthly trend: fetch permits for extended range (6 months before from → to)
      // Grouping is done in JavaScript — no raw SQL needed
      db.permit.findMany({
        where: { companyId, createdAt: { gte: subMonths(from, 6), lte: to } },
        select: { createdAt: true, status: true },
      }),
    ])

    // Build summary
    const statusMap: Record<string, number> = {}
    for (const item of permitsByStatusGrouped) {
      statusMap[item.status] = item._count.status
    }

    const totalPermits = permits.length
    const approvedPermits = statusMap['APPROVED'] || 0
    const rejectedPermits = statusMap['REJECTED'] || 0
    const pendingPermits = statusMap['PENDING'] || 0
    const safetyIndex = totalPermits > 0 ? Math.round((approvedPermits / totalPermits) * 100) : 0

    const documentsActive = documents.filter(d => d.status === 'ACTIVE').length
    const documentsExpired = documents.filter(d => d.status === 'EXPIRED').length
    const documentsCriticalExpired = documents.filter(d => d.criticality === 'CRITICAL' && d.status === 'EXPIRED').length

    const sensorsWithAlerts = sensors.filter(s => {
      if (s.currentValue == null) return false
      if (s.thresholdCritical > 0 && s.currentValue >= s.thresholdCritical) return true
      if (s.thresholdWarning > 0 && s.currentValue >= s.thresholdWarning) return true
      return false
    }).length

    const summary: ReportSummary = {
      totalPermits,
      approvedPermits,
      rejectedPermits,
      pendingPermits,
      safetyIndex,
      documentsActive,
      documentsExpired,
      documentsCriticalExpired,
      sensorsWithAlerts,
      periodLabel,
    }

    // Build charts data
    const permitsByStatus = {
      APPROVED: statusMap['APPROVED'] || 0,
      REJECTED: statusMap['REJECTED'] || 0,
      PENDING: statusMap['PENDING'] || 0,
      CANCELLED: statusMap['CANCELLED'] || 0,
    }

    const permitsByRisk: Record<string, number> = {}
    for (const item of permitsByRiskGrouped) {
      permitsByRisk[item.riskType] = item._count.riskType
    }

    const documentsByCategory: Record<string, number> = {}
    for (const doc of documents) {
      documentsByCategory[doc.category] = (documentsByCategory[doc.category] || 0) + 1
    }

    // Monthly trend — grouped in JavaScript, no raw SQL
    const monthlyTrend = groupPermitsByMonth(monthlyPermitsForTrend, from, to)

    const charts: ReportCharts = {
      permitsByStatus,
      permitsByRisk,
      documentsByCategory,
      monthlyTrend,
    }

    // Format permits for report
    const reportPermits: ReportPermit[] = permits.map(p => ({
      id: p.id,
      permitNumber: p.permitNumber,
      riskType: p.riskType,
      status: p.status,
      technicianName: p.technicianName,
      supervisorName: p.supervisorName,
      workLocation: p.workLocation,
      workDescription: p.workDescription,
      createdAt: p.createdAt.toISOString(),
      approvedAt: p.approvedAt?.toISOString() || null,
      rejectedAt: p.rejectedAt?.toISOString() || null,
    }))

    // Format documents for report
    const reportDocuments: ReportDocument[] = documents.map(d => ({
      id: d.id,
      title: d.title,
      documentType: d.documentType,
      category: d.category,
      criticality: d.criticality,
      status: d.status,
      issueDate: d.issueDate?.toISOString() || null,
      expiryDate: d.expiryDate?.toISOString() || null,
      holderName: d.holderName || null,
    }))

    // Format sensor alerts
    const sensorAlerts: SensorAlert[] = sensorAlertReadings.map(r => ({
      id: r.id,
      sensorName: r.sensor.name,
      sensorType: r.sensor.type,
      value: r.value,
      unit: r.sensor.unit,
      status: r.status,
      timestamp: r.timestamp.toISOString(),
      thresholdWarning: r.sensor.thresholdWarning,
      thresholdCritical: r.sensor.thresholdCritical,
    }))

    const reportData: ReportData = {
      summary,
      permits: reportPermits,
      documents: reportDocuments,
      sensorAlerts,
      charts,
    }

    // Handle different export formats
    if (format === 'pdf') {
      return await generatePDF(reportData, session.name || 'Empresa')
    }

    if (format === 'xlsx') {
      return await generateXLSX(reportData)
    }

    // Default: return JSON
    return NextResponse.json(reportData)
  } catch (error: unknown) {
    console.error('[Reports] Generation error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============ PDF Generation ============

async function generatePDF(data: ReportData, companyName: string): Promise<NextResponse> {
  // Dynamic import for pdfkit (server-only)
  const PDFDocument = (await import('pdfkit')).default

  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Reporte de Cumplimiento - ${data.summary.periodLabel}`,
        Author: 'Energy-Compliance Hub',
        Subject: 'Reporte profesional de cumplimiento HSE',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const response = new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reporte-${data.summary.periodLabel.replace(/\s+/g, '_')}.pdf"`,
          'Content-Length': buffer.length.toString(),
        },
      })
      resolve(response)
    })

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    let y = doc.page.margins.top

    // ---- Header ----
    doc.rect(0, 0, doc.page.width, 80).fill('#059669') // emerald-600
    doc.fillColor('#ffffff')
    doc.fontSize(22).font('Helvetica-Bold')
    doc.text('ENERGY-COMPLIANCE HUB', doc.page.margins.left, 20, { width: pageWidth })
    doc.fontSize(10).font('Helvetica')
    doc.text(companyName, doc.page.margins.left, 48, { width: pageWidth })
    doc.text(`Generado: ${format(new Date(), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}`, doc.page.margins.left, 62, { width: pageWidth })

    y = 100

    // ---- Title ----
    doc.fillColor('#1e293b')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text('Reporte de Cumplimiento HSE', doc.page.margins.left, y, { width: pageWidth })
    y += 25

    doc.fontSize(12).font('Helvetica')
    doc.fillColor('#64748b')
    doc.text(`Periodo: ${data.summary.periodLabel}`, doc.page.margins.left, y, { width: pageWidth })
    y += 30

    // ---- Executive Summary ----
    doc.fillColor('#059669')
    doc.fontSize(14).font('Helvetica-Bold')
    doc.text('Resumen Ejecutivo', doc.page.margins.left, y, { width: pageWidth })
    y += 5
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).strokeColor('#d1d5db').lineWidth(1).stroke()
    y += 10

    const summaryItems = [
      { label: 'Total Permisos', value: data.summary.totalPermits.toString() },
      { label: 'Permisos Aprobados', value: data.summary.approvedPermits.toString() },
      { label: 'Permisos Rechazados', value: data.summary.rejectedPermits.toString() },
      { label: 'Permisos Pendientes', value: data.summary.pendingPermits.toString() },
      { label: 'Indice de Seguridad', value: `${data.summary.safetyIndex}%` },
      { label: 'Documentos Activos', value: data.summary.documentsActive.toString() },
      { label: 'Documentos Expirados', value: data.summary.documentsExpired.toString() },
      { label: 'Sensores con Alertas', value: data.summary.sensorsWithAlerts.toString() },
    ]

    const colWidth = pageWidth / 2
    for (let i = 0; i < summaryItems.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = doc.page.margins.left + col * colWidth
      const itemY = y + row * 20

      if (itemY > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        y = doc.page.margins.top
      }

      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      doc.text(summaryItems[i].label, x, itemY, { width: colWidth - 20, continued: true })
      doc.fillColor('#1e293b').font('Helvetica-Bold').text(`  ${summaryItems[i].value}`)
    }

    y += Math.ceil(summaryItems.length / 2) * 20 + 20

    // ---- Permits Table ----
    if (y > doc.page.height - 200) {
      doc.addPage()
      y = doc.page.margins.top
    }

    doc.fillColor('#059669')
    doc.fontSize(14).font('Helvetica-Bold')
    doc.text(`Permisos (${data.permits.length})`, doc.page.margins.left, y, { width: pageWidth })
    y += 5
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).strokeColor('#d1d5db').lineWidth(1).stroke()
    y += 5

    if (data.permits.length > 0) {
      // Table header
      doc.rect(doc.page.margins.left, y, pageWidth, 18).fill('#f1f5f9')
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
      const headers = ['#', 'Numero', 'Tipo Riesgo', 'Estado', 'Tecnico', 'Ubicacion', 'Fecha']
      const headerWidths = [25, 80, 70, 65, 85, 100, pageWidth - 425]
      let hx = doc.page.margins.left + 5
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], hx, y + 4, { width: headerWidths[i] })
        hx += headerWidths[i]
      }
      y += 18

      // Table rows
      const displayPermits = data.permits.slice(0, 30)
      for (let i = 0; i < displayPermits.length; i++) {
        const p = displayPermits[i]
        if (y > doc.page.height - doc.page.margins.bottom) {
          doc.addPage()
          y = doc.page.margins.top
        }
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc'
        doc.rect(doc.page.margins.left, y, pageWidth, 16).fill(bgColor)
        doc.fillColor('#475569').fontSize(7).font('Helvetica')
        let rx = doc.page.margins.left + 5
        const rows = [
          (i + 1).toString(),
          p.permitNumber,
          p.riskType,
          p.status,
          p.technicianName,
          p.workLocation,
          format(parseISO(p.createdAt), 'dd/MM/yyyy'),
        ]
        for (let j = 0; j < rows.length; j++) {
          doc.text(rows[j], rx, y + 4, { width: headerWidths[j] })
          rx += headerWidths[j]
        }
        y += 16
      }
      if (data.permits.length > 30) {
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique')
        doc.text(`... y ${data.permits.length - 30} permisos mas`, doc.page.margins.left, y + 5)
        y += 15
      }
    } else {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      doc.text('No se encontraron permisos en este periodo.', doc.page.margins.left, y + 5)
      y += 25
    }

    y += 20

    // ---- Documents Table ----
    if (y > doc.page.height - 200) {
      doc.addPage()
      y = doc.page.margins.top
    }

    doc.fillColor('#059669')
    doc.fontSize(14).font('Helvetica-Bold')
    doc.text(`Documentos HSE (${data.documents.length})`, doc.page.margins.left, y, { width: pageWidth })
    y += 5
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).strokeColor('#d1d5db').lineWidth(1).stroke()
    y += 5

    if (data.documents.length > 0) {
      doc.rect(doc.page.margins.left, y, pageWidth, 18).fill('#f1f5f9')
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
      const docHeaders = ['#', 'Titulo', 'Tipo', 'Categoria', 'Estado', 'Titular', 'Vencimiento']
      const docHeaderWidths = [25, 120, 80, 65, 60, 80, pageWidth - 430]
      let dx = doc.page.margins.left + 5
      for (let i = 0; i < docHeaders.length; i++) {
        doc.text(docHeaders[i], dx, y + 4, { width: docHeaderWidths[i] })
        dx += docHeaderWidths[i]
      }
      y += 18

      const displayDocs = data.documents.slice(0, 30)
      for (let i = 0; i < displayDocs.length; i++) {
        const d = displayDocs[i]
        if (y > doc.page.height - doc.page.margins.bottom) {
          doc.addPage()
          y = doc.page.margins.top
        }
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc'
        doc.rect(doc.page.margins.left, y, pageWidth, 16).fill(bgColor)
        doc.fillColor('#475569').fontSize(7).font('Helvetica')
        let rx = doc.page.margins.left + 5
        const rows = [
          (i + 1).toString(),
          d.title,
          d.documentType,
          d.category,
          d.status,
          d.holderName || '-',
          d.expiryDate ? format(parseISO(d.expiryDate), 'dd/MM/yyyy') : '-',
        ]
        for (let j = 0; j < rows.length; j++) {
          doc.text(rows[j], rx, y + 4, { width: docHeaderWidths[j] })
          rx += docHeaderWidths[j]
        }
        y += 16
      }
      if (data.documents.length > 30) {
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique')
        doc.text(`... y ${data.documents.length - 30} documentos mas`, doc.page.margins.left, y + 5)
        y += 15
      }
    } else {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      doc.text('No se encontraron documentos en este periodo.', doc.page.margins.left, y + 5)
      y += 25
    }

    y += 20

    // ---- Sensor Alerts Table ----
    if (y > doc.page.height - 200) {
      doc.addPage()
      y = doc.page.margins.top
    }

    doc.fillColor('#059669')
    doc.fontSize(14).font('Helvetica-Bold')
    doc.text(`Alertas de Sensores (${data.sensorAlerts.length})`, doc.page.margins.left, y, { width: pageWidth })
    y += 5
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).strokeColor('#d1d5db').lineWidth(1).stroke()
    y += 5

    if (data.sensorAlerts.length > 0) {
      doc.rect(doc.page.margins.left, y, pageWidth, 18).fill('#f1f5f9')
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
      const sHeaders = ['#', 'Sensor', 'Tipo', 'Valor', 'Estado', 'Fecha']
      const sWidths = [25, 120, 70, 70, 65, pageWidth - 350]
      let sx = doc.page.margins.left + 5
      for (let i = 0; i < sHeaders.length; i++) {
        doc.text(sHeaders[i], sx, y + 4, { width: sWidths[i] })
        sx += sWidths[i]
      }
      y += 18

      const displayAlerts = data.sensorAlerts.slice(0, 30)
      for (let i = 0; i < displayAlerts.length; i++) {
        const a = displayAlerts[i]
        if (y > doc.page.height - doc.page.margins.bottom) {
          doc.addPage()
          y = doc.page.margins.top
        }
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc'
        doc.rect(doc.page.margins.left, y, pageWidth, 16).fill(bgColor)
        doc.fillColor('#475569').fontSize(7).font('Helvetica')
        let rx = doc.page.margins.left + 5
        const rows = [
          (i + 1).toString(),
          a.sensorName,
          a.sensorType,
          `${a.value} ${a.unit}`,
          a.status,
          format(parseISO(a.timestamp), 'dd/MM/yyyy HH:mm'),
        ]
        for (let j = 0; j < rows.length; j++) {
          doc.text(rows[j], rx, y + 4, { width: sWidths[j] })
          rx += sWidths[j]
        }
        y += 16
      }
    } else {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
      doc.text('No se encontraron alertas de sensores en este periodo.', doc.page.margins.left, y + 5)
    }

    // ---- Footer on each page ----
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      doc.text(
        `Energy-Compliance Hub | Pagina ${i + 1} de ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 30,
        { width: pageWidth, align: 'center' }
      )
    }

    doc.end()
  })
}

// ============ XLSX Generation ============

async function generateXLSX(data: ReportData): Promise<NextResponse> {
  // Dynamic import for xlsx (server-only)
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // ---- Sheet 1: Resumen ----
  const summaryData = [
    ['REPORTE DE CUMPLIMIENTO HSE'],
    [`Periodo: ${data.summary.periodLabel}`],
    [`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
    ['Indicador', 'Valor'],
    ['Total Permisos', data.summary.totalPermits],
    ['Permisos Aprobados', data.summary.approvedPermits],
    ['Permisos Rechazados', data.summary.rejectedPermits],
    ['Permisos Pendientes', data.summary.pendingPermits],
    ['Indice de Seguridad', `${data.summary.safetyIndex}%`],
    ['Documentos Activos', data.summary.documentsActive],
    ['Documentos Expirados', data.summary.documentsExpired],
    ['Documentos Criticos Expirados', data.summary.documentsCriticalExpired],
    ['Sensores con Alertas', data.summary.sensorsWithAlerts],
    [],
    ['Permisos por Estado'],
    ['Estado', 'Cantidad'],
    ['Aprobados', data.charts.permitsByStatus.APPROVED],
    ['Rechazados', data.charts.permitsByStatus.REJECTED],
    ['Pendientes', data.charts.permitsByStatus.PENDING],
    ['Cancelados', data.charts.permitsByStatus.CANCELLED],
    [],
    ['Permisos por Tipo de Riesgo'],
    ['Tipo Riesgo', 'Cantidad'],
    ...Object.entries(data.charts.permitsByRisk).map(([k, v]) => [k, v]),
    [],
    ['Documentos por Categoria'],
    ['Categoria', 'Cantidad'],
    ...Object.entries(data.charts.documentsByCategory).map(([k, v]) => [k, v]),
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen')

  // ---- Sheet 2: Permisos ----
  if (data.permits.length > 0) {
    const permitRows = [
      ['Numero', 'Tipo Riesgo', 'Estado', 'Tecnico', 'Supervisor', 'Ubicacion', 'Descripcion', 'Fecha Creacion', 'Fecha Aprobacion', 'Fecha Rechazo'],
      ...data.permits.map(p => [
        p.permitNumber,
        p.riskType,
        p.status,
        p.technicianName,
        p.supervisorName,
        p.workLocation,
        p.workDescription,
        format(parseISO(p.createdAt), 'dd/MM/yyyy'),
        p.approvedAt ? format(parseISO(p.approvedAt), 'dd/MM/yyyy') : '',
        p.rejectedAt ? format(parseISO(p.rejectedAt), 'dd/MM/yyyy') : '',
      ]),
    ]
    const permitSheet = XLSX.utils.aoa_to_sheet(permitRows)
    permitSheet['!cols'] = [
      { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
      { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, permitSheet, 'Permisos')
  }

  // ---- Sheet 3: Documentos ----
  if (data.documents.length > 0) {
    const docRows = [
      ['Titulo', 'Tipo Documento', 'Categoria', 'Criticidad', 'Estado', 'Titular', 'Fecha Emision', 'Fecha Vencimiento'],
      ...data.documents.map(d => [
        d.title,
        d.documentType,
        d.category,
        d.criticality,
        d.status,
        d.holderName || '',
        d.issueDate ? format(parseISO(d.issueDate), 'dd/MM/yyyy') : '',
        d.expiryDate ? format(parseISO(d.expiryDate), 'dd/MM/yyyy') : '',
      ]),
    ]
    const docSheet = XLSX.utils.aoa_to_sheet(docRows)
    docSheet['!cols'] = [
      { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 20 }, { wch: 15 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, docSheet, 'Documentos')
  }

  // ---- Sheet 4: Sensores ----
  if (data.sensorAlerts.length > 0) {
    const sensorRows = [
      ['Sensor', 'Tipo', 'Valor', 'Unidad', 'Estado', 'Umbral Advertencia', 'Umbral Critico', 'Fecha/Hora'],
      ...data.sensorAlerts.map(a => [
        a.sensorName,
        a.sensorType,
        a.value,
        a.unit,
        a.status,
        a.thresholdWarning,
        a.thresholdCritical,
        format(parseISO(a.timestamp), 'dd/MM/yyyy HH:mm'),
      ]),
    ]
    const sensorSheet = XLSX.utils.aoa_to_sheet(sensorRows)
    sensorSheet['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
      { wch: 18 }, { wch: 18 }, { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(wb, sensorSheet, 'Sensores')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const response = new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-${data.summary.periodLabel.replace(/\s+/g, '_')}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    },
  })
  return response
}
