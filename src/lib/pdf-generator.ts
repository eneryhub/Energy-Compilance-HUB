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
  photos?: Array<{ data?: string }> | null
  workLatitude?: number | null
  workLongitude?: number | null
  workRadius?: number
  rejectionReason?: string | null
}

const RISK_LABELS: Record<string, string> = {
  ALTURA: 'Trabajo en Altura',
  ELECTRICO: 'Riesgo Eléctrico',
  CONFINADO: 'Espacio Confinado',
  CALIENTE: 'Trabajo en Caliente',
}

export async function generatePermitPDF(permit: PermitPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const buffers: Buffer[] = []

      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('ENERGY-COMPLIANCE HUB', { align: 'center' })
      doc.moveDown(0.3)
      doc.fontSize(14).font('Helvetica').text('PERMISO DE TRABAJO SEGURO', { align: 'center' })
      doc.moveDown(0.3)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(0.5)

      // Status badge
      if (permit.status === 'APPROVED') {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('green').text('AUTORIZADO - TRABAJO SEGURO', { align: 'center' })
        doc.fillColor('black')
      } else if (permit.status === 'REJECTED') {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('red').text('RECHAZADO', { align: 'center' })
        doc.fillColor('black')
        if (permit.rejectionReason) {
          doc.fontSize(10).font('Helvetica').fillColor('red').text(`Motivo: ${permit.rejectionReason}`, { align: 'center' })
          doc.fillColor('black')
        }
      } else {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#e67e22').text('PENDIENTE DE APROBACION', { align: 'center' })
        doc.fillColor('black')
      }
      doc.moveDown(0.5)

      // Permit data
      doc.fontSize(10).font('Helvetica-Bold').text(`Numero: ${permit.permitNumber}`)
      doc.font('Helvetica').text(`Fecha: ${new Date(permit.createdAt).toLocaleString('es-ES')}`)
      doc.text(`Riesgo: ${RISK_LABELS[permit.riskType] || permit.riskType}`)
      doc.moveDown(0.5)

      // Personnel
      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL PERSONAL')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica').text(`Tecnico: ${permit.technicianName}`)
      doc.text(`Supervisor: ${permit.supervisorName}`)
      if (permit.approvedByName) {
        doc.text(`Aprobado por: ${permit.approvedByName}`)
      }
      doc.moveDown(0.5)

      // Location
      doc.fontSize(12).font('Helvetica-Bold').text('UBICACION Y DESCRIPCION')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica').text(`Ubicacion: ${permit.workLocation}`)
      doc.moveDown(0.2)
      doc.text('Descripcion:')
      doc.text(permit.workDescription, { width: 500, align: 'justify' })
      doc.moveDown(0.3)

      // GPS
      if (permit.workLatitude && permit.workLongitude) {
        doc.fontSize(10).text(`Coordenadas GPS: ${permit.workLatitude.toFixed(6)}, ${permit.workLongitude.toFixed(6)}`)
        doc.text(`Radio de tolerancia: ${permit.workRadius || 100} metros`)
        doc.moveDown(0.3)
      }
      doc.moveDown(0.5)

      // Safety checklist
      doc.fontSize(12).font('Helvetica-Bold').text('LISTA DE VERIFICACION')
      doc.moveDown(0.3)
      const checks = permit.safetyChecks
      if (checks && typeof checks === 'object') {
        Object.entries(checks).forEach(([key, value]) => {
          const label = key.replace(/_/g, ' ').toUpperCase()
          doc.fontSize(10).font('Helvetica').text(
            `${value ? '[X]' : '[ ]'} ${label}: ${value ? 'SI' : 'NO'}`
          )
        })
      }
      doc.moveDown(0.5)

      // Technician signature section
      doc.fontSize(12).font('Helvetica-Bold').text('FIRMA DEL TECNICO')
      doc.moveDown(0.3)
      const techSig = permit.technicianSignature
      if (techSig) {
        doc.fontSize(10).font('Helvetica').text(`Firmado por: ${techSig.signerName || 'Tecnico'}`)
        doc.text(`Fecha: ${techSig.timestamp ? new Date(techSig.timestamp).toLocaleString('es-ES') : 'N/A'}`)
        if (techSig.location) {
          doc.text(`GPS al firmar: ${techSig.location.latitude?.toFixed(6)}, ${techSig.location.longitude?.toFixed(6)}`)
          if (techSig.location.accuracy) {
            doc.text(`Precision: +/-${Math.round(techSig.location.accuracy)}m`)
          }
        }
        if (techSig.is_within_geofence !== undefined) {
          doc.text(techSig.is_within_geofence ? '[OK] Dentro del area de trabajo' : '[!] Fuera del area de trabajo')
          if (techSig.distance_to_work_meters) {
            doc.text(`Distancia al centro: ${Math.round(techSig.distance_to_work_meters)}m`)
          }
        }
        if (techSig.signatureData) {
          try {
            const base64Data = techSig.signatureData.replace(/^data:image\/\w+;base64,/, '')
            const imageBuffer = Buffer.from(base64Data, 'base64')
            doc.image(imageBuffer, { width: 200, height: 80 })
          } catch {
            doc.text('(Imagen de firma disponible en el sistema digital)')
          }
        }
      } else {
        doc.fontSize(10).text('Pendiente de firma')
      }
      doc.moveDown(0.5)

      // Supervisor signature section
      doc.fontSize(12).font('Helvetica-Bold').text('FIRMA DEL SUPERVISOR')
      doc.moveDown(0.3)
      const supSig = permit.supervisorSignature
      if (supSig) {
        doc.fontSize(10).font('Helvetica').text(`Firmado por: ${supSig.signerName || 'Supervisor'}`)
        doc.text(`Fecha: ${supSig.timestamp ? new Date(supSig.timestamp).toLocaleString('es-ES') : 'N/A'}`)
        if (supSig.location) {
          doc.text(`GPS al firmar: ${supSig.location.latitude?.toFixed(6)}, ${supSig.location.longitude?.toFixed(6)}`)
        }
        if (supSig.signatureData) {
          try {
            const base64Data = supSig.signatureData.replace(/^data:image\/\w+;base64,/, '')
            const imageBuffer = Buffer.from(base64Data, 'base64')
            doc.image(imageBuffer, { width: 200, height: 80 })
          } catch {
            doc.text('(Imagen de firma disponible en el sistema digital)')
          }
        }
      } else if (permit.status === 'PENDING') {
        doc.fontSize(10).text('Pendiente de aprobacion por supervisor')
      } else {
        doc.fontSize(10).text('No firmado')
      }
      doc.moveDown(0.5)

      // Photo evidence
      if (permit.photos && Array.isArray(permit.photos) && permit.photos.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('EVIDENCIA FOTOGRAFICA')
        doc.moveDown(0.3)
        doc.fontSize(10).text(`${permit.photos.length} foto(s) adjunta(s) como evidencia:`)
        doc.moveDown(0.2)
        permit.photos.slice(0, 3).forEach((photo, idx) => {
          if (photo.data) {
            try {
              const base64Data = photo.data.replace(/^data:image\/\w+;base64,/, '')
              const imageBuffer = Buffer.from(base64Data, 'base64')
              doc.image(imageBuffer, { width: 150, height: 100 })
            } catch {
              doc.text(`Foto ${idx + 1}: Disponible en el sistema digital`)
            }
          }
        })
        if (permit.photos.length > 3) {
          doc.text(`... y ${permit.photos.length - 3} foto(s) adicional(es) en el sistema digital`)
        }
        doc.moveDown(0.5)
      }

      // Footer
      doc.fontSize(8).fillColor('gray')
      doc.text(`Codigo de verificacion: ${permit.permitNumber.split('-')[1] || permit.permitNumber}`, { align: 'center' })
      doc.moveDown(0.2)
      doc.text(
        `Documento generado por Energy-Compliance Hub\n` +
        `Sistema unificado de Gestion de Permisos y Cumplimiento HSE\n` +
        `Fecha de emision: ${new Date().toLocaleString('es-ES')}`,
        { align: 'center', width: 500 }
      )

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
