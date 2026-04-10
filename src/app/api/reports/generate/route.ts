import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import {
  format, parseISO, startOfMonth, endOfMonth, subMonths, subDays,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters,
  differenceInHours,
} from 'date-fns'
import { es } from 'date-fns/locale'

// ══════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════

type DatePreset =
  | 'today' | 'last_7' | 'this_month' | 'last_30' | 'last_month'
  | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

interface ReportRequestBody {
  dateFrom?: string
  dateTo?: string
  preset?: DatePreset
  riskType?: string
  status?: string
  location?: string
  sensorType?: string
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
  monthlyTrend: Array<{
    month: string
    permits: number
    approved: number
    movingAvg?: number
  }>
  sensorTrend: Array<{
    date: string
    criticalCount: number
    warningCount: number
    avgValue?: number
  }>
}

export interface ExecutiveKPIs {
  uptimePercent: number
  totalCriticalAlerts: number
  operationalEfficiency: number
  approvalRateDelta: number
  previousApprovalRate: number
  currentApprovalRate: number
  riskScore: number
  locations: string[]
  sensorTypes: string[]
}

export interface ReportData {
  summary: ReportSummary
  permits: ReportPermit[]
  documents: ReportDocument[]
  sensorAlerts: SensorAlert[]
  charts: ReportCharts
  kpis: ExecutiveKPIs
  generatedAt: string
  generatedBy: string
  periodFrom: string
  periodTo: string
}

// ══════════════════════════════════════════════════════════════
//  DATE HELPERS
// ══════════════════════════════════════════════════════════════

function resolveDateRange(dateFrom?: string, dateTo?: string, preset?: DatePreset): { from: Date; to: Date } {
  if (dateFrom && dateTo) return { from: parseISO(dateFrom), to: parseISO(dateTo) }
  const now = new Date()
  switch (preset) {
    case 'today':         return { from: new Date(now.setHours(0,0,0,0)), to: new Date() }
    case 'last_7':        return { from: subDays(now, 7), to: now }
    case 'this_month':    return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_30':       return { from: subDays(now, 30), to: now }
    case 'last_month':    return { from: startOfMonth(subMonths(now,1)), to: endOfMonth(subMonths(now,1)) }
    case 'this_quarter':  return { from: startOfQuarter(now), to: endOfQuarter(now) }
    case 'last_quarter':  return { from: startOfQuarter(subQuarters(now,1)), to: endOfQuarter(subQuarters(now,1)) }
    case 'this_year':     return { from: startOfYear(now), to: endOfYear(now) }
    default:              return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}

function getPeriodLabel(from: Date, to: Date): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const fromLbl = format(from, 'MMMM yyyy', { locale: es })
  const toLbl   = format(to,   'MMMM yyyy', { locale: es })
  return fromLbl === toLbl ? cap(fromLbl) : `${cap(fromLbl)} – ${cap(toLbl)}`
}

// ══════════════════════════════════════════════════════════════
//  CHART BUILDERS
// ══════════════════════════════════════════════════════════════

function buildMonthlyTrend(
  permits: Array<{ createdAt: Date; status: string }>,
  from: Date, to: Date,
): ReportCharts['monthlyTrend'] {
  const countMap: Record<string,number>    = {}
  const approvedMap: Record<string,number> = {}
  for (const p of permits) {
    const k = format(p.createdAt, 'yyyy-MM')
    countMap[k]    = (countMap[k]    || 0) + 1
    if (p.status === 'APPROVED') approvedMap[k] = (approvedMap[k] || 0) + 1
  }
  const mn = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const trend: ReportCharts['monthlyTrend'] = []
  let cur = startOfMonth(subMonths(from, 6))
  while (cur <= endOfMonth(to)) {
    const k = format(cur, 'yyyy-MM')
    trend.push({ month: `${mn[cur.getMonth()]} ${cur.getFullYear()}`, permits: countMap[k]||0, approved: approvedMap[k]||0 })
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
  }
  // 3-month moving average
  return trend.map((pt, i) => {
    const win = trend.slice(Math.max(0,i-2), i+1)
    return { ...pt, movingAvg: Math.round(win.reduce((s,p)=>s+p.permits,0)/win.length*10)/10 }
  })
}

function buildSensorTrend(
  readings: Array<{ timestamp: Date; status: string; value: number }>,
  from: Date, to: Date,
): ReportCharts['sensorTrend'] {
  const dayMap: Record<string,{critical:number;warning:number;values:number[]}> = {}
  for (const r of readings) {
    const d = format(r.timestamp, 'yyyy-MM-dd')
    if (!dayMap[d]) dayMap[d]={critical:0,warning:0,values:[]}
    if (r.status==='CRITICO') dayMap[d].critical++
    if (r.status==='WARNING')  dayMap[d].warning++
    dayMap[d].values.push(r.value)
  }
  const result: ReportCharts['sensorTrend'] = []
  let cur = new Date(from)
  while (cur<=to) {
    const d = format(cur,'yyyy-MM-dd')
    const s = dayMap[d]
    result.push({
      date:          format(cur,'dd/MM'),
      criticalCount: s?.critical||0,
      warningCount:  s?.warning||0,
      avgValue:      s ? Math.round(s.values.reduce((a,b)=>a+b,0)/s.values.length) : undefined,
    })
    cur = new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+1)
  }
  return result
}

// ══════════════════════════════════════════════════════════════
//  EXECUTIVE KPI COMPUTATION (100% server-side)
// ══════════════════════════════════════════════════════════════

function computeKPIs(params: {
  from: Date; to: Date
  permits:        Array<{status:string;workLocation:string}>
  prevPermits:    Array<{status:string}>
  sensorReadings: Array<{status:string;timestamp:Date;value:number}>
  sensorTypes:    string[]
  locations:      string[]
}): ExecutiveKPIs {
  const { from, to, permits, prevPermits, sensorReadings, sensorTypes, locations } = params

  // Uptime: % hours with no critical alert active
  const totalHours       = differenceInHours(to, from) || 1
  const criticals        = sensorReadings.filter(r => r.status==='CRITICO')
  const criticalHourSet  = new Set(criticals.map(r => format(r.timestamp,'yyyy-MM-dd-HH')))
  const uptimePercent    = Math.max(0, Math.round(((totalHours-criticalHourSet.size)/totalHours)*1000)/10)

  // Operational efficiency: weighted avg approval rate by location
  const locMap: Record<string,{total:number;approved:number}> = {}
  for (const p of permits) {
    const loc = p.workLocation||'N/A'
    if (!locMap[loc]) locMap[loc]={total:0,approved:0}
    locMap[loc].total++
    if (p.status==='APPROVED') locMap[loc].approved++
  }
  const locRates = Object.values(locMap).map(l=>l.approved/Math.max(l.total,1))
  const operationalEfficiency = locRates.length>0
    ? Math.round(locRates.reduce((a,b)=>a+b,0)/locRates.length*1000)/10 : 0

  // Period-over-period delta
  const currentApprovalRate  = permits.length>0
    ? Math.round(permits.filter(p=>p.status==='APPROVED').length/permits.length*1000)/10 : 0
  const previousApprovalRate = prevPermits.length>0
    ? Math.round(prevPermits.filter(p=>p.status==='APPROVED').length/prevPermits.length*1000)/10 : 0
  const approvalRateDelta    = Math.round((currentApprovalRate-previousApprovalRate)*10)/10

  const HIGH_RISK = new Set(['CONFINADO','CALIENTE','ELECTRICO'])
  const highRiskCount = permits.filter(p=>HIGH_RISK.has(p.status)).length
  const riskScore = permits.length>0 ? Math.round((1-highRiskCount/permits.length)*100) : 100

  return {
    uptimePercent,
    totalCriticalAlerts: criticals.length,
    operationalEfficiency,
    approvalRateDelta,
    previousApprovalRate,
    currentApprovalRate,
    riskScore,
    locations,
    sensorTypes,
  }
}

// ══════════════════════════════════════════════════════════════
//  POST HANDLER
// ══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const session = await getTokenPayload(request)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMIN','SUPERVISOR','MANAGER'].includes(session.role))
      return NextResponse.json({ error: 'Sin permisos suficientes' }, { status: 403 })

    const body: ReportRequestBody = await request.json()
    const { dateFrom, dateTo, preset, riskType, status, location, sensorType, format: fmt } = body

    const { from, to } = resolveDateRange(dateFrom, dateTo, preset)
    const periodLabel  = getPeriodLabel(from, to)
    const companyId    = session.companyId

    // Previous period for delta KPIs
    const periodLenMs = to.getTime()-from.getTime()
    const prevTo      = new Date(from.getTime()-1)
    const prevFrom    = new Date(prevTo.getTime()-periodLenMs)

    // Filters — all scoped to companyId (multi-tenancy guarantee)
    const permitWhere: Record<string,unknown> = {
      companyId,
      createdAt: { gte: from, lte: to },
    }
    if (riskType) permitWhere.riskType = riskType
    if (status)   permitWhere.status   = status
    if (location) permitWhere.workLocation = { contains: location }

    const sensorReadingWhere: Record<string,unknown> = {
      timestamp: { gte: from, lte: to },
      sensor: sensorType ? { companyId, type: sensorType } : { companyId },
      status: { in: ['WARNING','CRITICO'] },
    }

    const [
      permits, permitsByStatusGrouped, permitsByRiskGrouped,
      documents, sensors, sensorAlertReadings,
      monthlyPermitsForTrend, prevPeriodPermits,
      allLocations, allSensorTypes,
    ] = await Promise.all([
      db.permit.findMany({
        where: permitWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id:true, permitNumber:true, riskType:true, status:true,
          technicianName:true, supervisorName:true, workLocation:true,
          workDescription:true, createdAt:true, approvedAt:true, rejectedAt:true,
        },
      }),
      db.permit.groupBy({
        by: ['status'],
        where: { companyId, createdAt: { gte: from, lte: to } },
        _count: { status: true },
      }),
      db.permit.groupBy({
        by: ['riskType'],
        where: { companyId, createdAt: { gte: from, lte: to } },
        _count: { riskType: true },
      }),
      db.hseDocument.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        select: {
          id:true, title:true, documentType:true, category:true,
          criticality:true, status:true, issueDate:true, expiryDate:true, holderName:true,
        },
      }),
      db.sensor.findMany({
        where: { companyId, isActive: true },
        select: { id:true, name:true, type:true, unit:true, thresholdWarning:true, thresholdCritical:true, currentValue:true },
      }),
      db.sensorReading.findMany({
        where: sensorReadingWhere,
        orderBy: { timestamp: 'desc' },
        take: 500,
        include: {
          sensor: { select: { name:true, type:true, unit:true, thresholdWarning:true, thresholdCritical:true } },
        },
      }),
      db.permit.findMany({
        where: { companyId, createdAt: { gte: subMonths(from,6), lte: to } },
        select: { createdAt:true, status:true },
      }),
      db.permit.findMany({
        where: { companyId, createdAt: { gte: prevFrom, lte: prevTo } },
        select: { status:true },
      }),
      db.permit.findMany({
        where: { companyId },
        select: { workLocation:true },
        distinct: ['workLocation'],
        take: 50,
      }),
      db.sensor.findMany({
        where: { companyId },
        select: { type:true },
        distinct: ['type'],
      }),
    ])

    // Build summary
    const statusMap: Record<string,number> = {}
    for (const item of permitsByStatusGrouped) statusMap[item.status] = item._count.status

    const totalPermits    = permits.length
    const approvedPermits = statusMap['APPROVED']  || 0
    const rejectedPermits = statusMap['REJECTED']  || 0
    const pendingPermits  = statusMap['PENDING']   || 0
    const safetyIndex     = totalPermits>0 ? Math.round((approvedPermits/totalPermits)*100) : 0

    const documentsActive          = documents.filter(d=>d.status==='ACTIVE').length
    const documentsExpired         = documents.filter(d=>d.status==='EXPIRED').length
    const documentsCriticalExpired = documents.filter(d=>d.criticality==='CRITICAL'&&d.status==='EXPIRED').length
    const sensorsWithAlerts        = sensors.filter(s=>{
      if (s.currentValue==null) return false
      return (s.thresholdCritical>0&&s.currentValue>=s.thresholdCritical)||(s.thresholdWarning>0&&s.currentValue>=s.thresholdWarning)
    }).length

    const summary: ReportSummary = {
      totalPermits, approvedPermits, rejectedPermits, pendingPermits,
      safetyIndex, documentsActive, documentsExpired, documentsCriticalExpired,
      sensorsWithAlerts, periodLabel,
    }

    const permitsByStatus = {
      APPROVED: statusMap['APPROVED']||0, REJECTED: statusMap['REJECTED']||0,
      PENDING:  statusMap['PENDING'] ||0, CANCELLED: statusMap['CANCELLED']||0,
    }
    const permitsByRisk: Record<string,number> = {}
    for (const item of permitsByRiskGrouped) permitsByRisk[item.riskType] = item._count.riskType
    const documentsByCategory: Record<string,number> = {}
    for (const doc of documents) documentsByCategory[doc.category] = (documentsByCategory[doc.category]||0)+1

    const charts: ReportCharts = {
      permitsByStatus, permitsByRisk, documentsByCategory,
      monthlyTrend: buildMonthlyTrend(monthlyPermitsForTrend, from, to),
      sensorTrend:  buildSensorTrend(
        sensorAlertReadings.map(r=>({timestamp:r.timestamp,status:r.status,value:r.value})),
        from, to
      ),
    }

    const kpis = computeKPIs({
      from, to,
      permits:        permits.map(p=>({status:p.status,workLocation:p.workLocation})),
      prevPermits:    prevPeriodPermits,
      sensorReadings: sensorAlertReadings.map(r=>({status:r.status,timestamp:r.timestamp,value:r.value})),
      sensorTypes:    allSensorTypes.map(s=>s.type),
      locations:      allLocations.map(l=>l.workLocation).filter(Boolean),
    })

    const reportData: ReportData = {
      summary,
      permits: permits.map(p=>({
        id:p.id, permitNumber:p.permitNumber, riskType:p.riskType, status:p.status,
        technicianName:p.technicianName, supervisorName:p.supervisorName,
        workLocation:p.workLocation, workDescription:p.workDescription,
        createdAt:p.createdAt.toISOString(),
        approvedAt:p.approvedAt?.toISOString()||null,
        rejectedAt:p.rejectedAt?.toISOString()||null,
      })),
      documents: documents.map(d=>({
        id:d.id, title:d.title, documentType:d.documentType, category:d.category,
        criticality:d.criticality, status:d.status,
        issueDate:d.issueDate?.toISOString()||null,
        expiryDate:d.expiryDate?.toISOString()||null,
        holderName:d.holderName||null,
      })),
      sensorAlerts: sensorAlertReadings.map(r=>({
        id:r.id, sensorName:r.sensor.name, sensorType:r.sensor.type,
        value:r.value, unit:r.sensor.unit, status:r.status,
        timestamp:r.timestamp.toISOString(),
        thresholdWarning:r.sensor.thresholdWarning,
        thresholdCritical:r.sensor.thresholdCritical,
      })),
      charts, kpis,
      generatedAt: new Date().toISOString(),
      generatedBy: session.name || session.email || 'Sistema',
      periodFrom:  from.toISOString(),
      periodTo:    to.toISOString(),
    }

    if (fmt==='pdf')  return await generatePDF(reportData, session.name||'Empresa')
    if (fmt==='xlsx') return await generateXLSX(reportData)
    return NextResponse.json(reportData)

  } catch (error: unknown) {
    console.error('[Reports] Generation error:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
//  PDF — Corporate Executive Format
// ══════════════════════════════════════════════════════════════

async function generatePDF(data: ReportData, companyName: string): Promise<NextResponse> {
  const PDFDocument = (await import('pdfkit')).default
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: 'A4', bufferPages: true,
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `Reporte Gerencial — ${data.summary.periodLabel}`,
        Author: data.generatedBy,
        Subject: 'Reporte Ejecutivo HSE — Energy-Compliance Hub',
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const pw = doc.page.width - doc.page.margins.left - doc.page.margins.right
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start+range.count; i++) {
        doc.switchToPage(i)
        doc.rect(0, doc.page.height-36, doc.page.width, 36).fill('#0B1F3A')
        doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
        doc.text(
          `Energy-Compliance Hub  ·  Reporte Gerencial HSE  ·  DOCUMENTO CONFIDENCIAL  ·  ${format(parseISO(data.generatedAt),"dd/MM/yyyy HH:mm")}`,
          doc.page.margins.left, doc.page.height-24, { width: pw*0.75 }
        )
        doc.fillColor('#E8A000').fontSize(7).font('Helvetica-Bold')
        doc.text(`Pág. ${i+1} / ${range.count}`, doc.page.margins.left, doc.page.height-24, { width: pw, align: 'right' })
      }
      resolve(new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reporte-gerencial-${data.summary.periodLabel.replace(/\s+/g,'_')}.pdf"`,
          'Content-Length': buffer.length.toString(),
        },
      }))
    })

    const pw = doc.page.width - doc.page.margins.left - doc.page.margins.right
    // Cover band
    doc.rect(0,0,doc.page.width,90).fill('#0B1F3A')
    doc.rect(0,88,doc.page.width,4).fill('#E8A000')
    doc.fillColor('#E8A000').fontSize(7.5).font('Helvetica-Bold')
    doc.text('ENERGY-COMPLIANCE HUB', doc.page.margins.left, 18, {width:pw})
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
    doc.text('REPORTE GERENCIAL HSE', doc.page.margins.left, 30, {width:pw})
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
    doc.text(`${companyName}  ·  Periodo: ${data.summary.periodLabel}  ·  Generado por: ${data.generatedBy}`, doc.page.margins.left, 64, {width:pw})

    let y = 105

    // Executive summary narrative
    const eff = data.kpis.operationalEfficiency
    const narrative = [
      `Durante el periodo ${data.summary.periodLabel}, la operación procesó`,
      `${data.summary.totalPermits} permisos de trabajo con una tasa de aprobación del ${data.summary.safetyIndex}%`,
      `(${data.kpis.approvalRateDelta>=0?'+':''}${data.kpis.approvalRateDelta}pp vs. periodo anterior).`,
      `El sistema registró ${data.kpis.totalCriticalAlerts} alertas críticas de sensores,`,
      `manteniendo un uptime operacional del ${data.kpis.uptimePercent}%.`,
      `La eficiencia operativa promedio fue del ${eff}%.`,
      data.summary.documentsCriticalExpired>0
        ? `⚠ ATENCIÓN: ${data.summary.documentsCriticalExpired} documentos de criticidad ALTA se encuentran vencidos.`
        : '✓ Todos los documentos críticos se encuentran vigentes.',
    ].join(' ')

    doc.rect(doc.page.margins.left,y,pw,1.5).fill('#0B1F3A')
    y+=6
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold')
    doc.text('RESUMEN EJECUTIVO', doc.page.margins.left, y)
    y+=10
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
    doc.text(narrative, doc.page.margins.left, y, {width:pw,lineGap:3,align:'justify'})
    y+=54

    // KPI boxes
    doc.fillColor('#0B1F3A').fontSize(8.5).font('Helvetica-Bold')
    doc.text('INDICADORES CLAVE DE GESTIÓN', doc.page.margins.left, y)
    y+=10
    const kpiW = (pw-12)/4
    const kpis = [
      { label:'UPTIME OPERACIONAL', value:`${data.kpis.uptimePercent}%`, sub:'sin alertas críticas', color:'#166534' },
      { label:'ALERTAS CRÍTICAS', value:data.kpis.totalCriticalAlerts.toString(), sub:'en el periodo', color:'#991B1B' },
      { label:'EFICIENCIA OPERATIVA', value:`${data.kpis.operationalEfficiency}%`, sub:'por ubicación', color:'#1A3A5C' },
      { label:'Δ TASA APROBACIÓN', value:`${data.kpis.approvalRateDelta>=0?'+':''}${data.kpis.approvalRateDelta}pp`, sub:'vs periodo anterior', color: data.kpis.approvalRateDelta>=0?'#166534':'#991B1B' },
    ]
    for (let i=0; i<kpis.length; i++) {
      const kx = doc.page.margins.left + i*(kpiW+4)
      doc.rect(kx,y,kpiW,52).fill('#f8fafc')
      doc.rect(kx,y,4,52).fill(kpis[i].color)
      doc.fillColor(kpis[i].color).fontSize(16).font('Helvetica-Bold')
      doc.text(kpis[i].value, kx+10, y+10, {width:kpiW-14})
      doc.fillColor('#64748b').fontSize(5.5).font('Helvetica-Bold')
      doc.text(kpis[i].label, kx+10, y+32, {width:kpiW-14})
      doc.fillColor('#94a3b8').fontSize(5.5).font('Helvetica')
      doc.text(kpis[i].sub, kx+10, y+40, {width:kpiW-14})
    }
    y+=64

    // Tables helper
    const sectionHeader = (title: string) => {
      if (y > doc.page.height-100) { doc.addPage(); y=doc.page.margins.top }
      doc.rect(doc.page.margins.left,y,pw,18).fill('#0B1F3A')
      doc.rect(doc.page.margins.left,y,4,18).fill('#E8A000')
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
      doc.text(title, doc.page.margins.left+10, y+5, {width:pw-10})
      y+=22
    }

    const tableHead = (cols:string[], widths:number[]) => {
      doc.rect(doc.page.margins.left,y,pw,14).fill('#1A3A5C')
      doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold')
      let cx=doc.page.margins.left+4
      for(let i=0;i<cols.length;i++){ doc.text(cols[i],cx,y+4,{width:widths[i]}); cx+=widths[i] }
      y+=14
    }

    const tableRow = (vals:string[], widths:number[], idx:number) => {
      if (y>doc.page.height-70) { doc.addPage(); y=doc.page.margins.top }
      doc.rect(doc.page.margins.left,y,pw,12).fill(idx%2===0?'#ffffff':'#f8fafc')
      doc.fillColor('#334155').fontSize(6).font('Helvetica')
      let cx=doc.page.margins.left+4
      for(let i=0;i<vals.length;i++){ doc.text(vals[i],cx,y+3,{width:widths[i],ellipsis:true}); cx+=widths[i] }
      doc.rect(doc.page.margins.left,y+12,pw,0.3).fill('#e2e8f0')
      y+=12
    }

    // Permits table
    sectionHeader(`Permisos de Trabajo (${data.permits.length})`)
    const pCols=['N°','Número','Riesgo','Estado','Técnico','Ubicación','Fecha']
    const pW=[22,80,62,58,88,92,pw-402]
    tableHead(pCols,pW)
    data.permits.slice(0,40).forEach((p,i)=>tableRow([
      (i+1).toString(),p.permitNumber,p.riskType,p.status,
      p.technicianName,p.workLocation,format(parseISO(p.createdAt),'dd/MM/yyyy'),
    ],pW,i))
    if (data.permits.length>40) {
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Oblique')
      doc.text(`… y ${data.permits.length-40} registros adicionales en el sistema`, doc.page.margins.left, y+4)
      y+=14
    }
    y+=12

    // Documents table
    sectionHeader(`Documentos HSE (${data.documents.length})`)
    const dCols=['N°','Título','Categoría','Criticidad','Estado','Titular','Vencimiento']
    const dW=[22,128,62,58,58,78,pw-406]
    tableHead(dCols,dW)
    data.documents.slice(0,30).forEach((d,i)=>tableRow([
      (i+1).toString(),d.title,d.category,d.criticality,d.status,
      d.holderName||'—',d.expiryDate?format(parseISO(d.expiryDate),'dd/MM/yyyy'):'—',
    ],dW,i))
    y+=12

    // Sensor alerts table
    sectionHeader(`Alertas de Sensores (${data.sensorAlerts.length})`)
    const sCols=['N°','Sensor','Tipo','Valor','Estado','Adv.','Crít.','Fecha/Hora']
    const sW=[22,108,68,52,52,38,38,pw-378]
    tableHead(sCols,sW)
    data.sensorAlerts.slice(0,30).forEach((a,i)=>tableRow([
      (i+1).toString(),a.sensorName,a.sensorType,
      `${a.value} ${a.unit}`,a.status,
      `${a.thresholdWarning}`,`${a.thresholdCritical}`,
      format(parseISO(a.timestamp),'dd/MM/yy HH:mm'),
    ],sW,i))

    doc.end()
  })
}

// ══════════════════════════════════════════════════════════════
//  XLSX — Enterprise Multi-Sheet
// ══════════════════════════════════════════════════════════════

async function generateXLSX(data: ReportData): Promise<NextResponse> {
  const XLSX = await import('xlsx')
  const wb   = XLSX.utils.book_new()

  const append = (rows: unknown[][], name: string, colWidths: {wch:number}[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  // Sheet 1: Executive Summary
  append([
    ['ENERGY-COMPLIANCE HUB — REPORTE GERENCIAL HSE'],
    [`Generado por: ${data.generatedBy}`],
    [`Periodo: ${data.summary.periodLabel}`],
    [`Fecha generación: ${format(parseISO(data.generatedAt),'dd/MM/yyyy HH:mm')}`],
    [],
    ['KPI EJECUTIVO','Valor','Referencia'],
    ['Uptime Operacional (%)',       data.kpis.uptimePercent,         '≥ 95% objetivo'],
    ['Alertas Críticas (total)',     data.kpis.totalCriticalAlerts,   '0 = óptimo'],
    ['Eficiencia Operativa (%)',     data.kpis.operationalEfficiency, '≥ 80% objetivo'],
    ['Δ Tasa Aprobación (pp)',       data.kpis.approvalRateDelta,     'vs periodo anterior'],
    ['Tasa Aprobación Actual (%)',   data.kpis.currentApprovalRate,   ''],
    ['Tasa Aprobación Anterior (%)', data.kpis.previousApprovalRate,  ''],
    [],
    ['PERMISOS','Valor'],
    ['Total',              data.summary.totalPermits],
    ['Aprobados',          data.summary.approvedPermits],
    ['Rechazados',         data.summary.rejectedPermits],
    ['Pendientes',         data.summary.pendingPermits],
    ['Índice Seguridad (%)', data.summary.safetyIndex],
    [],
    ['DOCUMENTOS','Valor'],
    ['Activos',            data.summary.documentsActive],
    ['Expirados',          data.summary.documentsExpired],
    ['Críticos Expirados', data.summary.documentsCriticalExpired],
    [],
    ['SENSORES','Valor'],
    ['Sensores con Alerta', data.summary.sensorsWithAlerts],
    ['Total Lecturas',      data.sensorAlerts.length],
  ], 'Resumen Ejecutivo', [{wch:36},{wch:16},{wch:26}])

  // Sheet 2: Permits
  if (data.permits.length>0) append([
    ['N°','Número','Riesgo','Estado','Técnico','Supervisor','Ubicación','Descripción','Creación','Aprobación','Rechazo'],
    ...data.permits.map((p,i)=>[
      i+1,p.permitNumber,p.riskType,p.status,p.technicianName,p.supervisorName,
      p.workLocation,p.workDescription,
      format(parseISO(p.createdAt),'dd/MM/yyyy'),
      p.approvedAt?format(parseISO(p.approvedAt),'dd/MM/yyyy'):'',
      p.rejectedAt?format(parseISO(p.rejectedAt),'dd/MM/yyyy'):'',
    ]),
  ], 'Permisos', [{wch:5},{wch:18},{wch:14},{wch:12},{wch:22},{wch:22},{wch:28},{wch:32},{wch:12},{wch:12},{wch:12}])

  // Sheet 3: Documents
  if (data.documents.length>0) append([
    ['N°','Título','Tipo','Categoría','Criticidad','Estado','Titular','Emisión','Vencimiento'],
    ...data.documents.map((d,i)=>[
      i+1,d.title,d.documentType,d.category,d.criticality,d.status,d.holderName||'',
      d.issueDate?format(parseISO(d.issueDate),'dd/MM/yyyy'):'',
      d.expiryDate?format(parseISO(d.expiryDate),'dd/MM/yyyy'):'',
    ]),
  ], 'Documentos HSE', [{wch:5},{wch:32},{wch:24},{wch:14},{wch:12},{wch:14},{wch:22},{wch:12},{wch:12}])

  // Sheet 4: Sensor alerts
  if (data.sensorAlerts.length>0) append([
    ['N°','Sensor','Tipo','Valor','Unidad','Estado','Umbral Adv.','Umbral Crít.','Fecha/Hora'],
    ...data.sensorAlerts.map((a,i)=>[
      i+1,a.sensorName,a.sensorType,a.value,a.unit,a.status,
      a.thresholdWarning,a.thresholdCritical,
      format(parseISO(a.timestamp),'dd/MM/yyyy HH:mm'),
    ]),
  ], 'Alertas Sensores', [{wch:5},{wch:22},{wch:16},{wch:10},{wch:8},{wch:12},{wch:14},{wch:14},{wch:18}])

  // Sheet 5: Monthly trend
  append([
    ['Mes','Total Permisos','Aprobados','Promedio Móvil 3m'],
    ...data.charts.monthlyTrend.map(m=>[m.month,m.permits,m.approved,m.movingAvg??'']),
  ], 'Tendencia Mensual', [{wch:16},{wch:16},{wch:14},{wch:22}])

  const buffer = XLSX.write(wb, { type:'buffer', bookType:'xlsx' })
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-gerencial-${data.summary.periodLabel.replace(/\s+/g,'_')}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
