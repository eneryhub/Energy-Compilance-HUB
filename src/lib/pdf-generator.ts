import PDFDocument from 'pdfkit'

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
  technicianSignature?: {
    signerName?: string
    timestamp?: string
    location?: { latitude?: number; longitude?: number; accuracy?: number }
    signatureData?: string
    is_within_geofence?: boolean
    distance_to_work_meters?: number
  } | null
  supervisorSignature?: {
    signerName?: string
    timestamp?: string
    location?: { latitude?: number; longitude?: number; accuracy?: number }
    signatureData?: string
    is_within_geofence?: boolean
    distance_to_work_meters?: number
  } | null
  photos?: Array<{ data?: string; caption?: string }> | null
  workLatitude?: number | null
  workLongitude?: number | null
  workRadius?: number
  rejectionReason?: string | null
  approveJustification?: string
}

// ── Color Palette ──────────────────────────────────────────────
const COLORS = {
  // Primary brand
  primary:       '#0c4a6e',   // sky-900
  primaryLight:  '#e0f2fe',   // sky-100
  primaryMid:    '#0284c7',   // sky-600
  // Neutrals
  dark:          '#0f172a',   // slate-900
  text:          '#1e293b',   // slate-800
  textSecondary: '#475569',   // slate-600
  muted:         '#94a3b8',   // slate-400
  light:         '#f1f5f9',   // slate-100
  lighter:       '#f8fafc',   // slate-50
  white:         '#ffffff',
  border:        '#cbd5e1',   // slate-300
  borderLight:   '#e2e8f0',   // slate-200
  // Status
  approved:      '#15803d',   // green-700
  approvedBg:    '#f0fdf4',   // green-50
  rejected:      '#b91c1c',   // red-700
  rejectedBg:    '#fef2f2',   // red-50
  pending:       '#a16207',   // yellow-700
  pendingBg:     '#fefce8',   // yellow-50
  cancelled:     '#6b7280',   // gray-500
  // Risk
  riskAltura:    '#991b1b',   // red-800
  riskElectrico: '#92400e',   // amber-800
  riskConfinado: '#5b21b6',   // violet-800
  riskCaliente:  '#9a3412',   // orange-800
  // Success / danger indicators
  check:         '#16a34a',
  cross:         '#dc2626',
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ALTURA:     { label: 'TRABAJO EN ALTURA',       color: COLORS.riskAltura,    bg: '#fef2f2' },
  ELECTRICO:  { label: 'RIESGO ELÉCTRICO',        color: COLORS.riskElectrico,  bg: '#fffbeb' },
  CONFINADO:  { label: 'ESPACIO CONFINADO',       color: COLORS.riskConfinado,  bg: '#f5f3ff' },
  CALIENTE:   { label: 'TRABAJO EN CALIENTE',     color: COLORS.riskCaliente,   bg: '#fff7ed' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:  { label: 'AUTORIZADO',              color: COLORS.approved,  bg: COLORS.approvedBg },
  REJECTED:  { label: 'RECHAZADO',               color: COLORS.rejected,  bg: COLORS.rejectedBg },
  PENDING:   { label: 'PENDIENTE DE APROBACIÓN', color: COLORS.pending,   bg: COLORS.pendingBg },
  CANCELLED: { label: 'CANCELADO',               color: COLORS.cancelled, bg: COLORS.lighter },
}

// ── Page Layout ────────────────────────────────────────────────
const PAGE_W = 595.28  // A4
const PAGE_H = 841.89
const M = 36           // margin
const CW = PAGE_W - M * 2  // content width

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, footerReserve = 48) {
  if (doc.y + needed > PAGE_H - M - footerReserve) {
    doc.addPage()
    drawPageBackground(doc)
  }
}

function drawLine(doc: PDFKit.PDFDocument, y: number, color = COLORS.borderLight) {
  doc.save()
  doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(color).lineWidth(0.5).stroke()
  doc.restore()
}

function drawBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, opts: { fill?: string; stroke?: string; radius?: number } = {}) {
  doc.save()
  if (opts.radius) {
    doc.roundedRect(x, y, w, h, opts.radius)
  } else {
    doc.rect(x, y, w, h)
  }
  if (opts.fill) doc.fill(opts.fill)
  if (opts.stroke) {
    doc.strokeColor(opts.stroke).lineWidth(0.5)
    if (!opts.fill) doc.fill('white')
    doc.stroke()
  }
  doc.restore()
}

// ── Page background (subtle top accent line) ───────────────────
function drawPageBackground(doc: PDFKit.PDFDocument) {
  // Top accent bar
  doc.save()
  doc.rect(0, 0, PAGE_W, 3).fill(COLORS.primary)
  doc.restore()
}

// ── Section Title ──────────────────────────────────────────────
function sectionTitle(doc: PDFKit.PDFDocument, title: string, opts: { color?: string; number?: string } = {}) {
  const color = opts.color || COLORS.primary
  const num = opts.number || ''

  ensureSpace(doc, 26)
  doc.y += 6

  // Accent bar
  doc.save()
  doc.rect(M, doc.y, 3, 16).fill(color)
  doc.restore()

  // Title text
  const textX = M + 10
  doc.fontSize(9).fillColor(color).font('Helvetica-Bold')
  if (num) {
    doc.text(`${num}`, textX, doc.y + 1, { continued: true })
    doc.text(`   ${title}`)
  } else {
    doc.text(title, textX, doc.y + 1)
  }

  // Underline
  doc.y += 20
  drawLine(doc, doc.y, color + '30')
  doc.y += 6
}

// ── Table row ──────────────────────────────────────────────────
function tableRow(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, colW: number, opts: { boldLabel?: boolean; boldValue?: boolean } = {}) {
  // Label
  doc.fontSize(7).fillColor(COLORS.textSecondary).font(opts.boldLabel ? 'Helvetica-Bold' : 'Helvetica')
  doc.text(label, x, y, { width: colW * 0.35 })

  // Value
  const valX = x + colW * 0.35
  const valW = colW * 0.65
  doc.fontSize(7.5).fillColor(COLORS.text).font(opts.boldValue ? 'Helvetica-Bold' : 'Helvetica')
  doc.text(value, valX, y, { width: valW })
}

// ══════════════════════════════════════════════════════════════
//  MAIN PDF GENERATOR
// ══════════════════════════════════════════════════════════════
export async function generatePermitPDF(permit: PermitPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true })
      const buffers: Buffer[] = []

      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const risk  = RISK_CONFIG[permit.riskType]  || { label: permit.riskType.toUpperCase(), color: COLORS.primary, bg: COLORS.primaryLight }
      const stCfg = STATUS_CONFIG[permit.status]   || STATUS_CONFIG.PENDING

      // ─────────── PAGE 1 ───────────

      // Top accent bar
      drawPageBackground(doc)

      // ── 1. HEADER ──────────────────────────────────────────
      doc.y = 14

      // Company name (left)
      doc.fontSize(13).fillColor(COLORS.dark).font('Helvetica-Bold')
      doc.text('Energy-Compliance Hub', M, doc.y, { width: CW * 0.55 })
      doc.y -= 2
      doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
      doc.text('Sistema de Gestión de Permisos y Cumplimiento HSE', M, doc.y, { width: CW * 0.55 })

      // Permit number (right)
      doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
      doc.text('N° DE PERMISO', M, doc.y, { width: CW, align: 'right' })
      doc.y += 9
      doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
      doc.text(permit.permitNumber, M, doc.y, { width: CW, align: 'right' })
      doc.y += 18

      // Header separator
      drawLine(doc, doc.y, COLORS.primary + '40')
      doc.y += 10

      // ── 2. STATUS + RISK BADGES ────────────────────────────
      // Status badge (left)
      const stLabel = stCfg.label
      const stW = doc.fontSize(8).font('Helvetica-Bold').widthOfString(stLabel) + 28
      drawBox(doc, M, doc.y, stW, 20, { fill: stCfg.color, radius: 3 })
      doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold')
      doc.text(stLabel, M + 14, doc.y + 5.5)

      // Risk badge (right of status)
      const rLabel = risk.label
      const rW = doc.fontSize(8).font('Helvetica-Bold').widthOfString(rLabel) + 28
      drawBox(doc, M + stW + 8, doc.y, rW, 20, { fill: risk.color, radius: 3 })
  doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold')
  doc.text(rLabel, M + stW + 8 + 14, doc.y + 5.5)

  // Date (right-aligned)
  doc.fontSize(7).fillColor(COLORS.textSecondary).font('Helvetica')
  doc.text(`Emisión: ${formatDate(permit.createdAt)}`, M, doc.y + 4, { width: CW, align: 'right' })

  doc.y += 28

      // ── 3. PERMIT TITLE ────────────────────────────────────
      doc.fontSize(16).fillColor(COLORS.dark).font('Helvetica-Bold')
      doc.text('PERMISO DE TRABAJO SEGURO', M, doc.y, { width: CW, align: 'center' })
      doc.y += 18
      doc.fontSize(7.5).fillColor(COLORS.muted).font('Helvetica')
      doc.text('Documento oficial para el control y autorización de trabajos de alto riesgo', M, doc.y, { width: CW, align: 'center' })
      doc.y += 14

      drawLine(doc, doc.y)
      doc.y += 10

      // ── 4. INFO SECTION (2-column grid) ───────────────────
      sectionTitle(doc, 'DATOS GENERALES DEL PERMISO', { number: '1' })

      const gridY = doc.y
      const halfW = (CW - 10) / 2
      const leftX = M
      const rightX = M + halfW + 10

      // Left box — People
      drawBox(doc, leftX, gridY, halfW, 58, { fill: COLORS.lighter, stroke: COLORS.borderLight })
      let bY = gridY + 8
      tableRow(doc, 'Técnico:', permit.technicianName, leftX + 8, bY, halfW - 16, { boldValue: true })
      bY += 14
      tableRow(doc, 'Supervisor:', permit.supervisorName, leftX + 8, bY, halfW - 16)
      bY += 14
      if (permit.approvedByName) {
        tableRow(doc, 'Aprobado por:', permit.approvedByName, leftX + 8, bY, halfW - 16, { boldValue: true })
      }

      // Right box — Location
      drawBox(doc, rightX, gridY, halfW, 58, { fill: COLORS.lighter, stroke: COLORS.borderLight })
      bY = gridY + 8
      tableRow(doc, 'Ubicación:', permit.workLocation, rightX + 8, bY, halfW - 16, { boldValue: true })
      bY += 14
      if (permit.workLatitude != null && permit.workLongitude != null) {
        doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
        doc.text(
          `GPS: ${Number(permit.workLatitude).toFixed(6)}, ${Number(permit.workLongitude).toFixed(6)}  ·  Radio: ${permit.workRadius || 100}m`,
          rightX + 8, bY, { width: halfW - 16 }
        )
      }

      doc.y = gridY + 66

      // ── 5. WORK DESCRIPTION ────────────────────────────────
      sectionTitle(doc, 'DESCRIPCIÓN DEL TRABAJO', { number: '2' })

      drawBox(doc, M, doc.y, CW, 40, { fill: COLORS.white, stroke: COLORS.borderLight })
      doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      doc.text(permit.workDescription, M + 10, doc.y + 8, { width: CW - 20, align: 'justify', lineGap: 2 })
      doc.y += 48

      // ── 6. SAFETY CHECKLIST ────────────────────────────────
      sectionTitle(doc, 'LISTA DE VERIFICACIÓN DE SEGURIDAD', { number: '3', color: risk.color })

      const checks = permit.safetyChecks
      const notes  = permit.checklistNotes || {}
      const entries = (checks && typeof checks === 'object' ? Object.entries(checks) : [])
      const checkedCount = entries.filter(([, v]) => v).length
      const totalCount   = entries.length
      const notesCount   = Object.values(notes).filter(Boolean).length

      // Progress bar
      const pct = totalCount > 0 ? checkedCount / totalCount : 0
      const barW = CW - 8
      const barH = 4
      const barX = M + 4
      const barY = doc.y
      drawBox(doc, barX, barY, barW, barH, { fill: COLORS.borderLight, radius: 2 })
      if (pct > 0) {
        drawBox(doc, barX, barY, barW * pct, barH, { fill: pct === 1 ? COLORS.check : COLORS.pending, radius: 2 })
      }
      doc.y = barY + 10

      // Summary line
      doc.fontSize(7).fillColor(COLORS.textSecondary).font('Helvetica')
      const summaryText = `${checkedCount}/${totalCount} items verificados` + (notesCount > 0 ? `  ·  ${notesCount} con observaciones` : '')
      doc.text(summaryText, M, doc.y, { width: CW, align: 'right' })
      doc.y += 8

      if (entries.length > 0) {
        // Table header
        const tX = M
        const tW = CW
        drawBox(doc, tX, doc.y, tW, 15, { fill: COLORS.light })
        doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica-Bold')
        doc.text('N°', tX + 8, doc.y + 4, { width: 20 })
        doc.text('ITEM DE VERIFICACIÓN', tX + 32, doc.y + 4, { width: tW * 0.58 })
        doc.text('EST.', tX + tW - 80, doc.y + 4, { width: 30, align: 'center' })
        doc.text('OBSERVACIONES', tX + tW - 45, doc.y + 4, { width: 40, align: 'center' })
        doc.y += 15

        // Table rows
        entries.forEach(([key, value], idx) => {
          const note = notes[key] || ''
          const label = key.replace(/_/g, ' ').toUpperCase()
          const noteLines = note ? Math.ceil(doc.fontSize(6.5).font('Helvetica').widthOfString(note) / (tW - 80)) : 0
          const rowH = Math.max(16, 16 + (noteLines * 9) + (note ? 4 : 0))

          ensureSpace(doc, rowH + 2, 48)

          // Alternating row background
          if (idx % 2 === 0) {
            drawBox(doc, tX, doc.y, tW, rowH, { fill: COLORS.lighter })
          }

          // Row border
          doc.save()
          doc.moveTo(tX, doc.y + rowH).lineTo(tX + tW, doc.y + rowH)
            .strokeColor(COLORS.borderLight).lineWidth(0.3).stroke()
          doc.restore()

          const cY = doc.y + 4

          // Number
          doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
          doc.text(`${idx + 1}`, tX + 8, cY, { width: 20 })

          // Label
          doc.fontSize(6.5).fillColor(value ? COLORS.textSecondary : COLORS.text)
            .font(value ? 'Helvetica' : 'Helvetica-Bold')
          doc.text(label, tX + 32, cY, { width: tW * 0.58 })

          // Status
          if (value) {
            drawBox(doc, tX + tW - 74, cY - 1, 18, 10, { fill: COLORS.approvedBg, stroke: COLORS.approved + '40', radius: 2 })
            doc.fontSize(8).fillColor(COLORS.check).font('Helvetica-Bold')
            doc.text('✓', tX + tW - 70, cY)
          } else {
            drawBox(doc, tX + tW - 74, cY - 1, 18, 10, { fill: COLORS.rejectedBg, stroke: COLORS.rejected + '40', radius: 2 })
            doc.fontSize(8).fillColor(COLORS.cross).font('Helvetica-Bold')
            doc.text('✗', tX + tW - 70, cY)
          }

          // Note indicator
          if (note) {
            doc.fontSize(6).fillColor(COLORS.primary).font('Helvetica-BoldOblique')
            doc.text('N', tX + tW - 42, cY, { width: 30, align: 'center' })
            // Note text (full line below)
            doc.fontSize(6).fillColor(COLORS.primary).font('Helvetica-Oblique')
            doc.text(`↳ ${note}`, tX + 32, cY + 11, { width: tW - 80 })
            doc.y = cY + 11 + (noteLines * 9) + 4
          } else {
            doc.fontSize(6).fillColor(COLORS.border).font('Helvetica')
            doc.text('—', tX + tW - 42, cY, { width: 30, align: 'center' })
            doc.y = cY + 12
          }
        })
      } else {
        doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        doc.text('No hay items de verificación registrados', M + 8, doc.y)
        doc.y += 14
      }

      doc.y += 6

      // ── 7. SIGNATURES ──────────────────────────────────────
      sectionTitle(doc, 'FIRMAS DE AUTORIZACIÓN', { number: '4' })

      const sigColW = (CW - 12) / 2
      const sigY = doc.y

      // ── TECHNICIAN SIGNATURE BLOCK ──
      drawBox(doc, M, sigY, sigColW, 4, { fill: COLORS.primary })
      doc.fontSize(6.5).fillColor(COLORS.white).font('Helvetica-Bold')
      doc.text('  FIRMA DEL TÉCNICO', M + 2, sigY)

      const techSig = permit.technicianSignature
      if (techSig) {
        let ty = sigY + 10
        doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica-Bold')
        doc.text(techSig.signerName || permit.technicianName, M + 8, ty, { width: sigColW - 16 })
        ty += 12
        doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
        doc.text(`Fecha y hora: ${techSig.timestamp ? formatDateTime(techSig.timestamp) : 'N/A'}`, M + 8, ty, { width: sigColW - 16 })
        ty += 10
        if (techSig.location && techSig.location.latitude != null) {
          doc.text(`GPS: ${Number(techSig.location.latitude).toFixed(6)}, ${Number(techSig.location.longitude).toFixed(6)}`, M + 8, ty, { width: sigColW - 16 })
          ty += 9
          if (techSig.location.accuracy != null) {
            doc.text(`Precisión GPS: ±${Math.round(Number(techSig.location.accuracy))}m`, M + 8, ty, { width: sigColW - 16 })
            ty += 9
          }
          if (techSig.is_within_geofence !== undefined) {
            const ok = techSig.is_within_geofence
            doc.fontSize(6.5).fillColor(ok ? COLORS.check : COLORS.cross).font('Helvetica-Bold')
            doc.text(ok ? '✓ Dentro del área de trabajo' : '⚠ Fuera del área de trabajo', M + 8, ty, { width: sigColW - 16 })
            ty += 9
            if (techSig.distance_to_work_meters) {
              doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
              doc.text(`Distancia al centro: ${Math.round(techSig.distance_to_work_meters)}m`, M + 8, ty, { width: sigColW - 16 })
              ty += 9
            }
          }
        }
        ty += 4
        if (techSig.signatureData) {
          try {
            const base64Data = techSig.signatureData.replace(/^data:image\/\w+;base64,/, '')
            const imgBuf = Buffer.from(base64Data, 'base64')
            // Signature image with dashed-style border
            drawBox(doc, M + 8, ty, sigColW - 16, 50, { stroke: COLORS.border })
            doc.image(imgBuf, M + 10, ty + 2, { width: sigColW - 20, height: 46 })
            ty += 56
          } catch {
            doc.fontSize(6).fillColor(COLORS.muted).font('Helvetica-Oblique')
            doc.text('(Firma digital disponible en el sistema)', M + 8, ty, { width: sigColW - 16 })
            ty += 10
          }
        }
      } else {
        let ty = sigY + 12
        doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        doc.text('Pendiente de firma', M + 8, ty, { width: sigColW - 16, align: 'center' })
        ty += 12
        drawBox(doc, M + 8, ty, sigColW - 16, 45, { stroke: COLORS.border })
        // X mark for placeholder
        doc.fontSize(7).fillColor(COLORS.border).font('Helvetica')
        doc.text('X', M + 8 + (sigColW - 16) / 2 - 3, ty + 18)
      }

      // ── SUPERVISOR SIGNATURE BLOCK ──
      const supX = M + sigColW + 12
      drawBox(doc, supX, sigY, sigColW, 4, { fill: COLORS.dark })
      doc.fontSize(6.5).fillColor(COLORS.white).font('Helvetica-Bold')
      doc.text('  FIRMA DEL SUPERVISOR', supX + 2, sigY)

      const supSig = permit.supervisorSignature
      if (supSig) {
        let sy = sigY + 10
        doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica-Bold')
        doc.text(supSig.signerName || 'Supervisor', supX + 8, sy, { width: sigColW - 16 })
        sy += 12
        doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
        doc.text(`Fecha y hora: ${supSig.timestamp ? formatDateTime(supSig.timestamp) : 'N/A'}`, supX + 8, sy, { width: sigColW - 16 })
        sy += 10
        if (supSig.location && supSig.location.latitude != null) {
          doc.text(`GPS: ${Number(supSig.location.latitude).toFixed(6)}, ${Number(supSig.location.longitude).toFixed(6)}`, supX + 8, sy, { width: sigColW - 16 })
          sy += 9
          if (supSig.is_within_geofence !== undefined) {
            const ok = supSig.is_within_geofence
            doc.fontSize(6.5).fillColor(ok ? COLORS.check : COLORS.cross).font('Helvetica-Bold')
            doc.text(ok ? '✓ Dentro del área' : '⚠ Fuera del área', supX + 8, sy, { width: sigColW - 16 })
            sy += 9
            if (supSig.distance_to_work_meters) {
              doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
              doc.text(`Distancia: ${Math.round(supSig.distance_to_work_meters)}m`, supX + 8, sy, { width: sigColW - 16 })
              sy += 9
            }
          }
        }
        sy += 4
        if (supSig.signatureData) {
          try {
            const base64Data = supSig.signatureData.replace(/^data:image\/\w+;base64,/, '')
            const imgBuf = Buffer.from(base64Data, 'base64')
            drawBox(doc, supX + 8, sy, sigColW - 16, 50, { stroke: COLORS.border })
            doc.image(imgBuf, supX + 10, sy + 2, { width: sigColW - 20, height: 46 })
          } catch {
            doc.fontSize(6).fillColor(COLORS.muted).font('Helvetica-Oblique')
            doc.text('(Firma digital disponible en el sistema)', supX + 8, sy, { width: sigColW - 16 })
          }
        }
      } else if (permit.status === 'PENDING') {
        doc.fontSize(7).fillColor(COLORS.pending).font('Helvetica-Bold')
        doc.text('PENDIENTE DE APROBACIÓN', supX + 8, sigY + 22, { width: sigColW - 16, align: 'center' })
        doc.fontSize(6.5).fillColor(COLORS.textSecondary).font('Helvetica')
        doc.text('Esperando firma del supervisor', supX + 8, sigY + 35, { width: sigColW - 16, align: 'center' })
      } else {
        doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        doc.text('No firmado', supX + 8, sigY + 22, { width: sigColW - 16, align: 'center' })
      }

      // Set doc.y after both signature blocks
      const maxSigContentH = 130
      doc.y = Math.max(doc.y, sigY + maxSigContentH)
      doc.y += 8

      // ── 8. REJECTION REASON ────────────────────────────────
      if (permit.status === 'REJECTED' && permit.rejectionReason) {
        sectionTitle(doc, 'MOTIVO DEL RECHAZO', { number: '5', color: COLORS.rejected })
        drawBox(doc, M, doc.y, CW, 30, { fill: COLORS.rejectedBg, stroke: COLORS.rejected + '40' })
        doc.fontSize(7.5).fillColor(COLORS.rejected).font('Helvetica')
        doc.text(permit.rejectionReason, M + 10, doc.y + 8, { width: CW - 20 })
        doc.y += 38
      }

      // ── 9. APPROVE JUSTIFICATION (outside geofence) ───────
      if (permit.approveJustification) {
        sectionTitle(doc, 'JUSTIFICACIÓN DE APROBACIÓN FUERA DE GEOFENCE', { number: '6', color: COLORS.pending })
        drawBox(doc, M, doc.y, CW, 30, { fill: COLORS.pendingBg, stroke: COLORS.pending + '40' })
        doc.fontSize(7.5).fillColor(COLORS.pending).font('Helvetica')
        doc.text(permit.approveJustification, M + 10, doc.y + 8, { width: CW - 20 })
        doc.y += 38
      }

      // ── 10. PHOTO EVIDENCE ─────────────────────────────────
      if (permit.photos && Array.isArray(permit.photos) && permit.photos.length > 0) {
        sectionTitle(doc, `EVIDENCIA FOTOGRÁFICA (${permit.photos.length})`, { number: '7' })

        const photoSize = 120
        const photoGap = 10
        const photosPerRow = Math.floor(CW / (photoSize + photoGap))

        permit.photos.slice(0, 6).forEach((photo, idx) => {
          if (idx > 0 && idx % photosPerRow === 0) {
            doc.addPage()
            drawPageBackground(doc)
            doc.y = M
          }

          if (photo.data) {
            try {
              ensureSpace(doc, photoSize + 20, 48)
              const base64Data = photo.data.replace(/^data:image\/\w+;base64,/, '')
              const imgBuf = Buffer.from(base64Data, 'base64')
              const px = M + (idx % photosPerRow) * (photoSize + photoGap)
              const py = doc.y

              drawBox(doc, px, py, photoSize, photoSize, { stroke: COLORS.border })
              doc.image(imgBuf, px + 1, py + 1, { width: photoSize - 2, height: photoSize - 2 })

              if (photo.caption) {
                doc.fontSize(5.5).fillColor(COLORS.muted).font('Helvetica')
                doc.text(photo.caption, px, py + photoSize + 2, { width: photoSize, align: 'center' })
              }
            } catch { /* skip */ }
          }
        })

        const photoRows = Math.ceil(Math.min(permit.photos.length, 6) / photosPerRow)
        doc.y += photoRows > 0 ? photoSize + 18 : 0

        if (permit.photos.length > 6) {
          doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
          doc.text(`... y ${permit.photos.length - 6} foto(s) adicional(es) disponible(s) en el sistema`, M, doc.y, { width: CW, align: 'center' })
          doc.y += 12
        }
      }

      // ─────────── FOOTER (all pages) ────────────────────────
      const pages = doc.bufferedPageRange()
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i)

        const footY = PAGE_H - 32

        // Footer separator
        drawLine(doc, footY, COLORS.border)

        // Footer text
        doc.fontSize(5.5).fillColor(COLORS.muted).font('Helvetica')
        doc.text(
          'Energy-Compliance Hub  ·  Sistema de Gestión de Permisos y Cumplimiento HSE  ·  Documento confidencial',
          M, footY + 5, { width: CW, align: 'center' }
        )

        // Page number
        doc.text(`Página ${i + 1} de ${pages.count}`, M, footY + 14, { width: CW, align: 'center' })

        // Verification code (last page)
        if (i === pages.count - 1) {
          const code = permit.permitNumber.split('-').pop() || permit.permitNumber
          doc.fontSize(5.5).fillColor(COLORS.muted).font('Helvetica')
          doc.text(`Código de verificación: ${code}  ·  Generado el ${formatDateTime(new Date().toISOString())}`, M, footY + 22, { width: CW, align: 'center' })
        }
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
