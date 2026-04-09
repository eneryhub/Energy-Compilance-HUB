import PDFDocument from 'pdfkit'

// ══════════════════════════════════════════════════════════════
//  INTERFACES
// ══════════════════════════════════════════════════════════════
export interface SignatureBlock {
  signerName?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; accuracy?: number }
  signatureData?: string
  is_within_geofence?: boolean
  distance_to_work_meters?: number
}

export interface PermitPDFData {
  permitNumber: string
  status: string
  riskType: string
  createdAt: string
  technicianName: string
  supervisorName: string
  approvedByName?: string
  workLocation: string
  workDescription: string
  safetyChecks: Record<string, boolean>
  checklistNotes?: Record<string, string>
  technicianSignature?: SignatureBlock | null
  supervisorSignature?: SignatureBlock | null
  photos?: Array<{ data?: string; caption?: string }> | null
  workLatitude?: number | null
  workLongitude?: number | null
  workRadius?: number
  rejectionReason?: string | null
  approveJustification?: string
}

// ══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM — Industrial / Oil & Gas Enterprise
// ══════════════════════════════════════════════════════════════
const C = {
  // Primary: Deep Navy (authority, industrial)
  navy:         '#0B1F3A',
  navyMid:      '#1A3A5C',
  navyLight:    '#2A5298',
  navyTint:     '#EBF0F8',

  // Accent: Safety Amber (industry standard)
  amber:        '#E8A000',
  amberLight:   '#FFF8E6',
  amberDark:    '#B07800',

  // Steel: Neutral industrial greys
  steel900:     '#1C2530',
  steel700:     '#374151',
  steel500:     '#6B7280',
  steel300:     '#D1D5DB',
  steel100:     '#F3F4F6',
  steel50:      '#F9FAFB',

  // Status
  safeGreen:    '#166534',
  safeGreenBg:  '#F0FDF4',
  safeGreenAccent: '#22C55E',
  dangerRed:    '#991B1B',
  dangerRedBg:  '#FEF2F2',
  dangerRedAccent: '#EF4444',
  warnYellow:   '#92400E',
  warnYellowBg: '#FFFBEB',
  warnYellowAccent: '#F59E0B',
  mutedGray:    '#4B5563',
  mutedGrayBg:  '#F9FAFB',

  // Risk type overrides
  riskAltura:   '#7F1D1D',
  riskElectrico:'#78350F',
  riskConfinado:'#4C1D95',
  riskCaliente: '#7C2D12',
  riskDefault:  '#1A3A5C',

  white: '#FFFFFF',
  black: '#000000',
} as const

// Risk configuration
const RISK_CFG: Record<string, { label: string; color: string; tagline: string }> = {
  ALTURA:     { label: 'TRABAJO EN ALTURA',    color: C.riskAltura,    tagline: 'Height Work · Fall Protection Required' },
  ELECTRICO:  { label: 'RIESGO ELÉCTRICO',     color: C.riskElectrico, tagline: 'Electrical Hazard · LOTO Required' },
  CONFINADO:  { label: 'ESPACIO CONFINADO',    color: C.riskConfinado, tagline: 'Confined Space · Atmospheric Testing Required' },
  CALIENTE:   { label: 'TRABAJO EN CALIENTE',  color: C.riskCaliente,  tagline: 'Hot Work · Fire Watch Required' },
}

// Status configuration
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  APPROVED:  { label: 'AUTORIZADO',              color: C.safeGreen,    bg: C.safeGreenBg,    accent: C.safeGreenAccent  },
  REJECTED:  { label: 'RECHAZADO',               color: C.dangerRed,    bg: C.dangerRedBg,    accent: C.dangerRedAccent  },
  PENDING:   { label: 'PENDIENTE DE APROBACIÓN', color: C.warnYellow,   bg: C.warnYellowBg,   accent: C.warnYellowAccent },
  CANCELLED: { label: 'CANCELADO',               color: C.mutedGray,    bg: C.mutedGrayBg,    accent: C.steel300         },
}

// ── Page constants ──────────────────────────────────────────
const PW   = 595.28  // A4 width
const PH   = 841.89  // A4 height
const ML   = 36      // margin left/right
const MT   = 36      // margin top
const CW   = PW - ML * 2  // content width

// ══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtCoord(val: number, decimals = 6): string {
  return Number(val).toFixed(decimals)
}

function parseBase64Image(data: string): Buffer {
  const clean = data.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(clean, 'base64')
}

function labelCase(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ══════════════════════════════════════════════════════════════
//  DRAWING PRIMITIVES
// ══════════════════════════════════════════════════════════════
interface BoxOpts {
  fill?:   string
  stroke?: string
  lw?:     number
  radius?: number
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, o: BoxOpts = {}) {
  doc.save()
  const shape = o.radius ? doc.roundedRect(x, y, w, h, o.radius) : doc.rect(x, y, w, h)
  if (o.fill && o.stroke) {
    shape.fillAndStroke(o.fill, o.stroke)
    if (o.lw) doc.lineWidth(o.lw)
  } else if (o.fill) {
    shape.fill(o.fill)
  } else if (o.stroke) {
    doc.lineWidth(o.lw ?? 0.5).strokeColor(o.stroke).stroke()
  }
  doc.restore()
}

function hline(doc: PDFKit.PDFDocument, y: number, x1 = ML, x2 = PW - ML, color = C.steel300, lw = 0.5) {
  doc.save()
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke()
  doc.restore()
}

function dashedLine(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number, color = C.steel300) {
  doc.save()
  doc.dash(3, { space: 3 }).moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(0.5).stroke()
  doc.undash()
  doc.restore()
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, footerH = 52) {
  if (doc.y + needed > PH - ML - footerH) {
    doc.addPage()
    drawBg(doc)
    doc.y = MT + 8
  }
}

// ══════════════════════════════════════════════════════════════
//  PAGE CHROME
// ══════════════════════════════════════════════════════════════

/** Full-bleed header band (navy + amber stripe) */
function drawBg(doc: PDFKit.PDFDocument) {
  // Top navy bar
  box(doc, 0, 0, PW, 5, { fill: C.navy })
  // Safety amber accent strip
  box(doc, 0, 5, PW, 2, { fill: C.amber })
}

/** Diagonal watermark CONFIDENCIAL on each page */
function drawWatermark(doc: PDFKit.PDFDocument) {
  doc.save()
  doc.opacity(0.04)
  doc.fontSize(60).fillColor(C.navy).font('Helvetica-Bold')
  const cx = PW / 2
  const cy = PH / 2
  doc.rotate(-40, { origin: [cx, cy] })
  doc.text('CONFIDENCIAL', cx - 160, cy - 30, { width: 320, align: 'center' })
  doc.rotate(40, { origin: [cx, cy] })
  doc.opacity(1)
  doc.restore()
}

/** Full-bleed footer */
function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number, permitNumber: string) {
  const fy = PH - 30
  hline(doc, fy - 4, 0, PW, C.navy, 1)
  box(doc, 0, fy - 4, PW, 34, { fill: C.navy })

  doc.fontSize(5.5).fillColor(C.steel300).font('Helvetica')
  doc.text(
    'PERMISO DE TRABAJO SEGURO  ·  Sistema ATS — Gestión de Cumplimiento HSE  ·  DOCUMENTO CONTROLADO — NO DUPLICAR',
    ML, fy + 2, { width: CW * 0.65, align: 'left' }
  )

  // Page number — right side
  doc.fontSize(5.5).fillColor(C.amber).font('Helvetica-Bold')
  doc.text(`PÁGINA ${pageNum} DE ${totalPages}`, ML, fy + 2, { width: CW, align: 'right' })

  // Verification code on last page
  if (pageNum === totalPages) {
    const code = permitNumber.split('-').pop() || permitNumber
    doc.fontSize(5).fillColor(C.steel500).font('Helvetica')
    doc.text(`VER: ${code}  ·  ${fmtDateTime(new Date().toISOString())}`, ML, fy + 12, { width: CW, align: 'right' })
  }
}

// ══════════════════════════════════════════════════════════════
//  SECTION TITLE
// ══════════════════════════════════════════════════════════════
interface SectionOpts {
  number?: string
  color?:  string
  icon?:   string
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, opts: SectionOpts = {}) {
  const color = opts.color || C.navy
  ensureSpace(doc, 28)
  doc.y += 8

  const ty = doc.y

  // Left accent pill
  box(doc, ML, ty, 4, 18, { fill: color, radius: 2 })

  // Section number badge
  if (opts.number) {
    box(doc, ML + 8, ty + 1, 16, 16, { fill: color, radius: 3 })
    doc.fontSize(7.5).fillColor(C.white).font('Helvetica-Bold')
    doc.text(opts.number, ML + 8, ty + 4, { width: 16, align: 'center' })
  }

  const textX = ML + (opts.number ? 30 : 12)
  doc.fontSize(8.5).fillColor(color).font('Helvetica-Bold')
  doc.text(title, textX, ty + 4)

  doc.y = ty + 22
  hline(doc, doc.y, ML, PW - ML, color + '30', 0.75)
  doc.y += 6
}

// ══════════════════════════════════════════════════════════════
//  INFO ROW (label + value inside a cell)
// ══════════════════════════════════════════════════════════════
function infoRow(
  doc: PDFKit.PDFDocument,
  label: string, value: string,
  x: number, y: number, w: number,
  opts: { labelColor?: string; valueColor?: string; boldValue?: boolean } = {}
) {
  // Label
  doc.fontSize(6).fillColor(opts.labelColor ?? C.steel500).font('Helvetica')
  doc.text(label.toUpperCase(), x, y, { width: w })

  // Value
  doc.fontSize(8).fillColor(opts.valueColor ?? C.navy).font(opts.boldValue ? 'Helvetica-Bold' : 'Helvetica')
  doc.text(value || '—', x, y + 8, { width: w })
}

// ══════════════════════════════════════════════════════════════
//  GPS BADGE
// ══════════════════════════════════════════════════════════════
function gpsBadge(doc: PDFKit.PDFDocument, x: number, y: number, w: number, lat: number, lng: number, inFence?: boolean, dist?: number, accuracy?: number) {
  const bg = inFence === false ? C.dangerRedBg : C.safeGreenBg
  const border = inFence === false ? C.dangerRed : C.safeGreen
  const icon = inFence === false ? '⚠' : '✓'
  const iconColor = inFence === false ? C.dangerRed : C.safeGreen

  box(doc, x, y, w, accuracy != null ? 38 : 30, { fill: bg, stroke: border + '50', radius: 3, lw: 0.5 })

  doc.fontSize(6.5).fillColor(iconColor).font('Helvetica-Bold')
  doc.text(`${icon} GPS`, x + 6, y + 4, { continued: true })
  doc.fillColor(C.steel500).font('Helvetica')
  doc.text(`  ${fmtCoord(lat)}, ${fmtCoord(lng)}`, { width: w - 12 })

  doc.fontSize(6).fillColor(C.steel500).font('Helvetica')
  if (dist != null) {
    doc.text(`Distancia al punto de trabajo: ${Math.round(dist)} m`, x + 6, y + 14, { width: w - 12 })
  }
  if (accuracy != null) {
    doc.text(`Precisión GPS: ±${Math.round(accuracy)} m`, x + 6, y + (dist != null ? 23 : 14), { width: w - 12 })
  }
}

// ══════════════════════════════════════════════════════════════
//  SIGNATURE BLOCK
// ══════════════════════════════════════════════════════════════
function signatureBlock(
  doc: PDFKit.PDFDocument,
  sig: SignatureBlock | null | undefined,
  role: string, fallbackName: string,
  x: number, y: number, w: number,
  accentColor: string,
  isPending = false
) {
  const HEADER_H = 18
  const BLOCK_OUTER_H = 160

  // Outer border
  box(doc, x, y, w, BLOCK_OUTER_H, { stroke: accentColor + '60', radius: 4, lw: 0.75 })

  // Header band
  box(doc, x, y, w, HEADER_H, { fill: accentColor, radius: 4 })
  // Square off bottom corners of header
  box(doc, x, y + HEADER_H / 2, w, HEADER_H / 2, { fill: accentColor })

  doc.fontSize(7).fillColor(C.white).font('Helvetica-Bold')
  doc.text(`  ${role}`, x + 4, y + 5, { width: w - 8 })

  if (sig) {
    const cy = y + HEADER_H + 6

    // Signer name
    doc.fontSize(8).fillColor(C.navy).font('Helvetica-Bold')
    doc.text(sig.signerName || fallbackName, x + 6, cy, { width: w - 12 })

    // Timestamp
    doc.fontSize(6.5).fillColor(C.steel500).font('Helvetica')
    doc.text(`Fecha/Hora: ${sig.timestamp ? fmtDateTime(sig.timestamp) : 'N/A'}`, x + 6, cy + 12, { width: w - 12 })

    // GPS info
    let gpsY = cy + 24
    if (sig.location?.latitude != null) {
      gpsBadge(
        doc, x + 6, gpsY, w - 12,
        sig.location.latitude!, sig.location.longitude!,
        sig.is_within_geofence,
        sig.distance_to_work_meters,
        sig.location.accuracy
      )
      gpsY += sig.location.accuracy != null ? 46 : 38
    }

    // Signature image
    const imgBoxY = y + BLOCK_OUTER_H - 52
    const imgBoxH = 46
    box(doc, x + 6, imgBoxY, w - 12, imgBoxH, { fill: C.white, stroke: C.steel300, radius: 2, lw: 0.5 })
    dashedLine(doc, x + 6, imgBoxY + imgBoxH / 2 + 6, x + w - 6)

    if (sig.signatureData) {
      try {
        const imgBuf = parseBase64Image(sig.signatureData)
        doc.image(imgBuf, x + 8, imgBoxY + 2, { width: w - 16, height: imgBoxH - 4, fit: [w - 16, imgBoxH - 4], align: 'center', valign: 'center' })
      } catch {
        doc.fontSize(6).fillColor(C.steel500).font('Helvetica-Oblique')
        doc.text('Firma digital registrada en el sistema', x + 8, imgBoxY + 18, { width: w - 16, align: 'center' })
      }
    } else {
      doc.fontSize(6).fillColor(C.steel300).font('Helvetica')
      doc.text('(sin imagen de firma)', x + 8, imgBoxY + 18, { width: w - 16, align: 'center' })
    }

  } else if (isPending) {
    const py = y + HEADER_H + 16
    box(doc, x + 10, py, w - 20, 28, { fill: C.warnYellowBg, stroke: C.warnYellowAccent + '60', radius: 3 })
    doc.fontSize(7).fillColor(C.warnYellow).font('Helvetica-Bold')
    doc.text('PENDIENTE DE FIRMA', x + 10, py + 8, { width: w - 20, align: 'center' })
    doc.fontSize(6).fillColor(C.warnYellow).font('Helvetica')
    doc.text('Esperando aprobación del supervisor', x + 10, py + 18, { width: w - 20, align: 'center' })

    const imgBoxY = y + BLOCK_OUTER_H - 52
    box(doc, x + 6, imgBoxY, w - 12, 46, { stroke: C.steel300, radius: 2, lw: 0.4 })
    dashedLine(doc, x + 6, imgBoxY + 23, x + w - 6, C.steel200)
    doc.fontSize(7).fillColor(C.steel300).font('Helvetica')
    doc.text('X', x + (w / 2) - 4, imgBoxY + 17)
  } else {
    const ey = y + HEADER_H + 22
    doc.fontSize(7).fillColor(C.steel500).font('Helvetica-Oblique')
    doc.text('No disponible', x + 8, ey, { width: w - 16, align: 'center' })
  }

  return BLOCK_OUTER_H
}

// ══════════════════════════════════════════════════════════════
//  CHECKLIST TABLE
// ══════════════════════════════════════════════════════════════
function drawChecklist(doc: PDFKit.PDFDocument, checks: Record<string, boolean>, notes: Record<string, string>, riskColor: string) {
  const entries = Object.entries(checks ?? {})
  if (entries.length === 0) {
    doc.fontSize(7).fillColor(C.steel500).font('Helvetica-Oblique')
    doc.text('No hay ítems de verificación registrados.', ML + 4, doc.y)
    doc.y += 14
    return
  }

  const checkedN = entries.filter(([, v]) => v).length
  const totalN   = entries.length
  const notesN   = Object.values(notes).filter(Boolean).length
  const pct      = totalN > 0 ? checkedN / totalN : 0

  // ── Progress bar ──────────────────────────────────────────
  const barX = ML
  const barY = doc.y
  const barH = 8
  const barR = 4

  box(doc, barX, barY, CW, barH, { fill: C.steel100, radius: barR })
  if (pct > 0) {
    const fillColor = pct === 1 ? C.safeGreenAccent : pct >= 0.8 ? C.warnYellowAccent : C.dangerRedAccent
    box(doc, barX, barY, CW * pct, barH, { fill: fillColor, radius: barR })
  }

  doc.y = barY + barH + 4

  // Summary row
  doc.fontSize(6.5).fillColor(C.navy).font('Helvetica-Bold')
  doc.text(`${checkedN} / ${totalN}`, ML, doc.y, { continued: true })
  doc.font('Helvetica').fillColor(C.steel500)
  doc.text(`  ítems verificados` + (notesN > 0 ? `  ·  ${notesN} con observaciones` : '') + `  ·  ${Math.round(pct * 100)}% completado`)
  doc.y += 10

  // ── Table ─────────────────────────────────────────────────
  const COL = {
    num:    { x: ML,               w: 22  },
    item:   { x: ML + 22,          w: CW * 0.55 },
    status: { x: ML + 22 + CW * 0.55, w: 50 },
    note:   { x: ML + 22 + CW * 0.55 + 50, w: CW - 22 - CW * 0.55 - 50 },
  }

  // Header
  const hdrH = 16
  box(doc, ML, doc.y, CW, hdrH, { fill: C.navy, radius: 2 })
  const hdrY = doc.y + 4
  const headerFont = (t: string, x: number, w: number) => {
    doc.fontSize(6).fillColor(C.steel300).font('Helvetica-Bold')
    doc.text(t, x + 4, hdrY, { width: w - 4 })
  }
  headerFont('N°',           COL.num.x,    COL.num.w)
  headerFont('ÍTEM DE VERIFICACIÓN HSE', COL.item.x, COL.item.w)
  headerFont('ESTADO',       COL.status.x, COL.status.w)
  headerFont('OBSERVACIÓN',  COL.note.x,   COL.note.w)
  doc.y += hdrH

  // Rows
  entries.forEach(([key, value], idx) => {
    const note     = notes[key] || ''
    const label    = labelCase(key)
    const noteLines = note
      ? Math.ceil(doc.fontSize(6).font('Helvetica').widthOfString(note) / (COL.note.w - 8)) + 1
      : 0
    const rowH = Math.max(18, 18 + noteLines * 8)

    ensureSpace(doc, rowH + 2)

    const ry  = doc.y
    const bg  = idx % 2 === 0 ? C.white : C.steel50

    box(doc, ML, ry, CW, rowH, { fill: bg })
    hline(doc, ry + rowH, ML, PW - ML, C.steel100, 0.3)

    const cy = ry + 5

    // Number
    doc.fontSize(6).fillColor(C.steel500).font('Helvetica')
    doc.text(`${idx + 1}`, COL.num.x + 6, cy, { width: COL.num.w - 6 })

    // Label
    doc.fontSize(6.5).fillColor(value ? C.steel700 : C.navy).font(value ? 'Helvetica' : 'Helvetica-Bold')
    doc.text(label, COL.item.x + 4, cy, { width: COL.item.w - 8 })

    // Status pill
    if (value) {
      box(doc, COL.status.x + 4, cy - 1, 36, 12, { fill: C.safeGreenBg, stroke: C.safeGreenAccent + '60', radius: 3, lw: 0.5 })
      doc.fontSize(7).fillColor(C.safeGreen).font('Helvetica-Bold')
      doc.text('✓ OK', COL.status.x + 6, cy + 1, { width: 32, align: 'center' })
    } else {
      box(doc, COL.status.x + 4, cy - 1, 36, 12, { fill: C.dangerRedBg, stroke: C.dangerRedAccent + '60', radius: 3, lw: 0.5 })
      doc.fontSize(7).fillColor(C.dangerRed).font('Helvetica-Bold')
      doc.text('✗ NO', COL.status.x + 6, cy + 1, { width: 32, align: 'center' })
    }

    // Note
    if (note) {
      doc.fontSize(6).fillColor(riskColor).font('Helvetica-Oblique')
      doc.text(`↳ ${note}`, COL.note.x + 4, cy, { width: COL.note.w - 8 })
    } else {
      doc.fontSize(6).fillColor(C.steel300).font('Helvetica')
      doc.text('—', COL.note.x + 4, cy, { width: COL.note.w - 8 })
    }

    doc.y = ry + rowH
  })

  // Table bottom border
  hline(doc, doc.y, ML, PW - ML, C.navy + '40', 0.75)
  doc.y += 6
}

// ══════════════════════════════════════════════════════════════
//  MAIN HEADER (Page 1 only)
// ══════════════════════════════════════════════════════════════
function drawHeader(doc: PDFKit.PDFDocument, permit: PermitPDFData, risk: ReturnType<typeof getRisk>, stCfg: ReturnType<typeof getStatus>) {
  // Top bar already drawn by drawBg()
  doc.y = 14

  // ── Left: Company identity ─────────────────────────────────
  doc.fontSize(14).fillColor(C.navy).font('Helvetica-Bold')
  doc.text('Energy-Compliance Hub', ML, doc.y, { width: CW * 0.6 })
  doc.fontSize(6.5).fillColor(C.steel500).font('Helvetica')
  doc.text('Sistema ATS de Gestión de Permisos y Cumplimiento HSE', ML, doc.y, { width: CW * 0.6 })
  doc.text('Oil & Gas  ·  Mining  ·  Power Generation  ·  Petrochemical', ML, doc.y, { width: CW * 0.6 })

  // ── Right: Permit number plate ─────────────────────────────
  const npX = PW - ML - 140
  box(doc, npX, 14, 140, 44, { fill: C.navy, radius: 4 })
  box(doc, npX, 14, 140, 16, { fill: C.amber, radius: 4 })
  box(doc, npX, 22, 140, 8, { fill: C.amber }) // square off bottom

  doc.fontSize(6).fillColor(C.navy).font('Helvetica-Bold')
  doc.text('N° DE PERMISO ATS', npX + 4, 17, { width: 132, align: 'center' })

  doc.fontSize(11).fillColor(C.white).font('Helvetica-Bold')
  doc.text(permit.permitNumber, npX + 4, 33, { width: 132, align: 'center' })

  doc.y = 64

  // ── Separator ─────────────────────────────────────────────
  hline(doc, doc.y, ML, PW - ML, C.navy, 1.5)
  doc.y += 10

  // ── Permit title bar ──────────────────────────────────────
  box(doc, ML, doc.y, CW, 28, { fill: C.navyTint, radius: 3 })
  doc.fontSize(14).fillColor(C.navy).font('Helvetica-Bold')
  doc.text('PERMISO DE TRABAJO SEGURO (ATS)', ML, doc.y + 7, { width: CW, align: 'center' })
  doc.y += 34

  doc.fontSize(7).fillColor(C.steel500).font('Helvetica')
  doc.text('Documento oficial para el control y autorización de trabajos de alto riesgo en instalaciones energéticas', ML, doc.y, { width: CW, align: 'center' })
  doc.y += 14

  // ── Status + Risk badges row ───────────────────────────────
  const badgeY = doc.y

  // Status badge
  const stLabelW = doc.fontSize(8.5).font('Helvetica-Bold').widthOfString(stCfg.label) + 32
  box(doc, ML, badgeY, stLabelW, 22, { fill: stCfg.color, radius: 3 })
  // Left color stripe
  box(doc, ML, badgeY, 6, 22, { fill: stCfg.accent, radius: 3 })
  doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold')
  doc.text(stCfg.label, ML + 14, badgeY + 6, { width: stLabelW - 14 })

  // Risk badge
  const riskLabelW = doc.fontSize(8.5).font('Helvetica-Bold').widthOfString(risk.label) + 32
  const riskBadgeX = ML + stLabelW + 8
  box(doc, riskBadgeX, badgeY, riskLabelW, 22, { fill: risk.color, radius: 3 })
  box(doc, riskBadgeX, badgeY, 6, 22, { fill: C.amber, radius: 3 })
  doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold')
  doc.text(risk.label, riskBadgeX + 14, badgeY + 6, { width: riskLabelW - 14 })

  // Date — right aligned
  doc.fontSize(7).fillColor(C.steel500).font('Helvetica')
  doc.text(`Emisión: ${fmtDate(permit.createdAt)}`, ML, badgeY + 7, { width: CW, align: 'right' })

  doc.y = badgeY + 28

  // Risk tagline
  doc.fontSize(6.5).fillColor(risk.color).font('Helvetica-Oblique')
  doc.text(risk.tagline, ML, doc.y, { width: CW })
  doc.y += 14

  hline(doc, doc.y, ML, PW - ML, C.steel300)
  doc.y += 10
}

// ══════════════════════════════════════════════════════════════
//  LOOKUP HELPERS
// ══════════════════════════════════════════════════════════════
function getRisk(riskType: string) {
  return RISK_CFG[riskType] ?? { label: riskType.toUpperCase(), color: C.riskDefault, tagline: '' }
}

function getStatus(status: string) {
  return STATUS_CFG[status] ?? STATUS_CFG.PENDING
}

// ══════════════════════════════════════════════════════════════
//  MAIN PDF GENERATOR
// ══════════════════════════════════════════════════════════════
export async function generatePermitPDF(permit: PermitPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true })
      const chunks: Buffer[] = []

      doc.on('data',  (c: Buffer) => chunks.push(c))
      doc.on('end',   () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const risk  = getRisk(permit.riskType)
      const stCfg = getStatus(permit.status)

      // ─── PAGE 1: Background + Header ────────────────────────
      drawBg(doc)
      drawWatermark(doc)
      drawHeader(doc, permit, risk, stCfg)

      // ══ SECTION 1: DATOS GENERALES ══════════════════════════
      sectionTitle(doc, 'DATOS GENERALES DEL PERMISO', { number: '1' })

      const gridY  = doc.y
      const colW   = (CW - 10) / 2
      const leftX  = ML
      const rightX = ML + colW + 10
      const cellH  = 72

      // ── Left cell: Personnel ────────────────────────────────
      box(doc, leftX, gridY, colW, cellH, { fill: C.navyTint, stroke: C.navy + '20', radius: 3, lw: 0.5 })
      box(doc, leftX, gridY, colW, 14, { fill: C.navy + '15', radius: 3 })
      box(doc, leftX, gridY + 7, colW, 7, { fill: C.navy + '15' }) // square off bottom corners
      doc.fontSize(6).fillColor(C.navy).font('Helvetica-Bold')
      doc.text('PERSONAL INVOLUCRADO', leftX + 6, gridY + 4, { width: colW - 12 })

      infoRow(doc, 'Técnico Responsable', permit.technicianName, leftX + 8, gridY + 19, colW - 16, { boldValue: true })
      infoRow(doc, 'Supervisor HSE',      permit.supervisorName, leftX + 8, gridY + 38, colW - 16)
      if (permit.approvedByName) {
        infoRow(doc, 'Autorizado por', permit.approvedByName, leftX + 8, gridY + 56, colW - 16, { boldValue: true, valueColor: C.safeGreen })
      }

      // ── Right cell: Location ─────────────────────────────────
      box(doc, rightX, gridY, colW, cellH, { fill: C.navyTint, stroke: C.navy + '20', radius: 3, lw: 0.5 })
      box(doc, rightX, gridY, colW, 14, { fill: C.navy + '15', radius: 3 })
      box(doc, rightX, gridY + 7, colW, 7, { fill: C.navy + '15' })
      doc.fontSize(6).fillColor(C.navy).font('Helvetica-Bold')
      doc.text('UBICACIÓN DEL TRABAJO', rightX + 6, gridY + 4, { width: colW - 12 })

      infoRow(doc, 'Punto de trabajo', permit.workLocation, rightX + 8, gridY + 19, colW - 16, { boldValue: true })

      if (permit.workLatitude != null && permit.workLongitude != null) {
        doc.fontSize(6).fillColor(C.steel500).font('Helvetica')
        doc.text(
          `GPS: ${fmtCoord(permit.workLatitude)}, ${fmtCoord(permit.workLongitude)}  ·  Radio geofence: ${permit.workRadius ?? 100} m`,
          rightX + 8, gridY + 50, { width: colW - 16 }
        )
      }

      doc.y = gridY + cellH + 8

      // ══ SECTION 2: DESCRIPCIÓN DEL TRABAJO ══════════════════
      sectionTitle(doc, 'DESCRIPCIÓN DEL TRABAJO', { number: '2' })

      const descH = 46
      box(doc, ML, doc.y, CW, descH, { fill: C.white, stroke: C.steel300, radius: 3, lw: 0.5 })
      // Left accent
      box(doc, ML, doc.y, 4, descH, { fill: risk.color })
      doc.fontSize(8).fillColor(C.steel900).font('Helvetica')
      doc.text(permit.workDescription, ML + 12, doc.y + 8, { width: CW - 20, align: 'justify', lineGap: 2 })
      doc.y += descH + 8

      // ══ SECTION 3: LISTA DE VERIFICACIÓN ════════════════════
      sectionTitle(doc, 'LISTA DE VERIFICACIÓN DE SEGURIDAD HSE', { number: '3', color: risk.color })
      drawChecklist(doc, permit.safetyChecks, permit.checklistNotes ?? {}, risk.color)

      // ══ SECTION 4: FIRMAS ═══════════════════════════════════
      sectionTitle(doc, 'FIRMAS DE AUTORIZACIÓN', { number: '4' })
      ensureSpace(doc, 175)

      const sigColW = (CW - 12) / 2
      const sigY    = doc.y

      signatureBlock(doc, permit.technicianSignature, 'FIRMA DEL TÉCNICO RESPONSABLE',
        permit.technicianName, ML, sigY, sigColW, C.navyLight)

      signatureBlock(doc, permit.supervisorSignature, 'FIRMA DEL SUPERVISOR HSE',
        permit.supervisorName, ML + sigColW + 12, sigY, sigColW, C.navy,
        permit.status === 'PENDING')

      doc.y = sigY + 168

      // ══ SECTION 5: MOTIVO DE RECHAZO ════════════════════════
      if (permit.status === 'REJECTED' && permit.rejectionReason) {
        sectionTitle(doc, 'MOTIVO DEL RECHAZO', { number: '5', color: C.dangerRed })
        ensureSpace(doc, 50)
        box(doc, ML, doc.y, CW, 44, { fill: C.dangerRedBg, stroke: C.dangerRed + '50', radius: 3, lw: 0.75 })
        box(doc, ML, doc.y, 5, 44, { fill: C.dangerRed })
        doc.fontSize(7.5).fillColor(C.dangerRed).font('Helvetica')
        doc.text(permit.rejectionReason, ML + 14, doc.y + 10, { width: CW - 22 })
        doc.y += 52
      }

      // ══ SECTION 6: JUSTIFICACIÓN FUERA DE GEOFENCE ══════════
      if (permit.approveJustification) {
        sectionTitle(doc, 'JUSTIFICACIÓN — APROBACIÓN FUERA DE GEOFENCE', { number: '6', color: C.warnYellow })
        ensureSpace(doc, 50)
        box(doc, ML, doc.y, CW, 44, { fill: C.warnYellowBg, stroke: C.warnYellow + '50', radius: 3, lw: 0.75 })
        box(doc, ML, doc.y, 5, 44, { fill: C.amber })
        doc.fontSize(7.5).fillColor(C.warnYellow).font('Helvetica')
        doc.text(permit.approveJustification, ML + 14, doc.y + 10, { width: CW - 22 })
        doc.y += 52
      }

      // ══ SECTION 7: EVIDENCIA FOTOGRÁFICA ════════════════════
      const photos = permit.photos?.filter(p => p.data) ?? []
      if (photos.length > 0) {
        sectionTitle(doc, `EVIDENCIA FOTOGRÁFICA (${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'})`, { number: '7' })

        const maxPhotos  = 6
        const photoSize  = 122
        const photoGap   = 10
        const perRow     = Math.floor(CW / (photoSize + photoGap))
        let   rowStartY  = doc.y

        photos.slice(0, maxPhotos).forEach((photo, idx) => {
          const col = idx % perRow
          const isNewRow = col === 0 && idx > 0

          if (isNewRow) {
            rowStartY = doc.y + photoSize + 18
          }

          if (col === 0) {
            ensureSpace(doc, photoSize + 30)
            if (isNewRow) rowStartY = doc.y
          }

          const px = ML + col * (photoSize + photoGap)
          const py = isNewRow ? rowStartY : doc.y

          // Photo frame
          box(doc, px, py, photoSize, photoSize, { fill: C.steel50, stroke: C.steel300, radius: 3, lw: 0.5 })
          // Top color accent
          box(doc, px, py, photoSize, 5, { fill: C.navyMid, radius: 3 })
          box(doc, px, py + 2, photoSize, 3, { fill: C.navyMid })

          try {
            const imgBuf = parseBase64Image(photo.data!)
            doc.image(imgBuf, px + 2, py + 6, { width: photoSize - 4, height: photoSize - 12, fit: [photoSize - 4, photoSize - 12], align: 'center', valign: 'center' })
          } catch { /* skip broken images */ }

          if (photo.caption) {
            doc.fontSize(5.5).fillColor(C.steel500).font('Helvetica')
            doc.text(photo.caption, px, py + photoSize + 2, { width: photoSize, align: 'center' })
          }

          // Advance doc.y only on last in row or last photo
          if (col === perRow - 1 || idx === Math.min(photos.length, maxPhotos) - 1) {
            doc.y = py + photoSize + 16
          }
        })

        if (photos.length > maxPhotos) {
          doc.fontSize(6.5).fillColor(C.steel500).font('Helvetica-Oblique')
          doc.text(
            `… y ${photos.length - maxPhotos} foto(s) adicional(es) disponibles en el portal ATS`,
            ML, doc.y + 4, { width: CW, align: 'center' }
          )
          doc.y += 16
        }
      }

      // ══ FLUSH FOOTERS (all pages) ════════════════════════════
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        drawFooter(doc, i + 1, range.count, permit.permitNumber)
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}