import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Seed Demo GOC — Creando Empresa C: Suministros IT Consarve...')

  // ── 0. LIMPIEZA: Eliminar datos previos de esta empresa para evitar conflictos ──
  const existingCompany = await prisma.company.findFirst({
    where: { name: 'Suministros IT Consarve C.A.' },
  })
  if (existingCompany) {
    console.log('  🗑️ Eliminando datos previos de la empresa...')
    // Eliminar en orden inverso por relaciones (primero las tablas que dependen de otras)
    
    // ⚠️ TRANSPORTE (dependen de users, vehicles, trips, routes)
    await prisma.transportDriverEvent.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.transportInspection.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.transportTrip.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.transportRoute.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.transportDriver.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.transportVehicle.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ AMBIENTE (dependen de users)
    await prisma.environmentalMetric.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.environmentalAssessment.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.environmentalIncident.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ HSE EVENT LOGS
    await prisma.hSEEventLog.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ INVENTARIO
    await prisma.inventoryAudit.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.smartInventory.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.inventoryDevice.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.inventoryItem.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.inventoryLocation.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ EMERGENCY ALERTS (dependen de users) - NUEVO
    await prisma.emergencyAlert.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ HSE REPORTS (dependen de users)
    await prisma.hseReport.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ SUPPORT MESSAGES (dependen de users)
    await prisma.supportMessage.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ SISTEMA
    await prisma.systemAlert.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.sensorReading.deleteMany({ where: { sensor: { companyId: existingCompany.id } } })
    await prisma.sensor.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.signature.deleteMany({ where: { permit: { companyId: existingCompany.id } } })
    await prisma.permit.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.auditLog.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.alertConfig.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.hseDocument.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.workLocation.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ USUARIOS (dependen de company)
    await prisma.user.deleteMany({ where: { companyId: existingCompany.id } })
    
    // ⚠️ EMPRESA
    await prisma.company.delete({ where: { id: existingCompany.id } })
    console.log('  ✅ Datos previos eliminados')
  }

  const now = new Date()

  // ── 1. Empresa C: Suministros IT Consarve ──
  const company = await prisma.company.create({
    data: {
      name: 'Suministros IT Consarve C.A.',
      taxId: 'J-501234567-8',
      email: 'admin@suministrosit.com',
      phone: '+58 212-555-0100',
      address: 'Caracas, Distrito Capital, Venezuela',
      logo: null,
      subscriptionPlan: 'enterprise',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxUsers: 500,
      maxPermitsPerMonth: 100000,
      isActive: true,
      scadaDemoMode: true,
    },
  })

  // ── 2. Usuarios de Empresa C ──
  const passAdmin = await hash('Admin@2024', 10)
  const passUser = await hash('Demo1234', 10)

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@suministrosit.com',
      passwordHash: passAdmin,
      name: 'Rafael Martínez',
      role: 'ADMIN',
      phone: '+58 412-555-0101',
    },
  })

  const supervisor = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'jesus@suministrosit.com',
      passwordHash: passUser,
      name: 'Jesús Ramírez',
      role: 'SUPERVISOR',
      phone: '+58 414-555-0201',
    },
  })

  const tech1 = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'antonio@suministrosit.com',
      passwordHash: passUser,
      name: 'Antonio Fernández',
      role: 'TECHNICIAN',
      phone: '+58 416-555-0301',
    },
  })

  const tech2 = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'daniel@suministrosit.com',
      passwordHash: passUser,
      name: 'Daniel Colmenares',
      role: 'TECHNICIAN',
      phone: '+58 416-555-0302',
    },
  })

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'carmen@suministrosit.com',
      passwordHash: passUser,
      name: 'Carmen Delgado',
      role: 'MANAGER',
      phone: '+58 414-555-0401',
    },
  })

  // ── 3. Ubicaciones de Empresa C ──
  const loc1 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Plataforma Cardón - Muelle Norte',
      address: 'Punta Cardón, Pto. Falcón, Muelle Principal',
      latitude: 11.6158,
      longitude: -70.2269,
      radiusMeters: 200,
      verificationMethod: 'GPS',
    },
  })

  const loc2 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Refinería Amuay - Área de Tanques',
      address: 'Complejo Refinador Paraguaná, Amuay',
      latitude: 11.7417,
      longitude: -70.2133,
      radiusMeters: 300,
      verificationMethod: 'GPS',
    },
  })

  const loc3 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Terminal de Gas - Tía Juana',
      address: 'Tía Juana, Edo. Zulia',
      latitude: 10.5333,
      longitude: -71.3333,
      radiusMeters: 150,
      verificationMethod: 'GPS',
    },
  })

  const loc4 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Campamento Base - Coro',
      address: 'Av. Industrial, Coro, Edo. Falcón',
      latitude: 11.4043,
      longitude: -69.6731,
      radiusMeters: 100,
      verificationMethod: 'GPS',
    },
  })

  // ── 4. Sensores SCADA (8 sensores, 4 ubicaciones) ──
  const sensors = await Promise.all([
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc1.id,
        name: 'Presión Línea Carguero PC-01', type: 'PRESION', unit: 'psi',
        thresholdCritical: 120, thresholdWarning: 95,
        currentValue: 88.5, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc1.id,
        name: 'Gas H2S Muelle Norte', type: 'GAS', unit: '%LEL',
        thresholdCritical: 10.0, thresholdWarning: 5.0,
        currentValue: 2.1, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc2.id,
        name: 'Temperatura Tanque TK-501', type: 'TEMPERATURA', unit: '°C',
        thresholdCritical: 85, thresholdWarning: 70,
        currentValue: 58.3, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc2.id,
        name: 'Presión Vapor TK-501', type: 'PRESION', unit: 'psi',
        thresholdCritical: 45, thresholdWarning: 35,
        currentValue: 28.7, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc2.id,
        name: 'Detector Gas LEV Amuay', type: 'GAS', unit: '%LEL',
        thresholdCritical: 20.0, thresholdWarning: 10.0,
        currentValue: 4.3, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc3.id,
        name: 'Presión Gasoducto GNL-03', type: 'PRESION', unit: 'psi',
        thresholdCritical: 1500, thresholdWarning: 1200,
        currentValue: 980.0, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc3.id,
        name: 'Voltaje Estación Compresora', type: 'VOLTAJE', unit: 'V',
        thresholdCritical: 480, thresholdWarning: 440,
        currentValue: 416.0, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: company.id, locationId: loc4.id,
        name: 'Temperatura Ambiente Campamento', type: 'TEMPERATURA', unit: '°C',
        thresholdCritical: 42, thresholdWarning: 38,
        currentValue: 33.5, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
  ])

  // Generate 50 readings per sensor
  const readingsData: Array<{ sensorId: string; value: number; status: string; timestamp: Date }> = []
  for (const sensor of sensors) {
    let prev = sensor.currentValue ?? 50
    const meanTarget = sensor.type === 'PRESION' ? (sensor.thresholdCritical * 0.6) :
                       sensor.type === 'TEMPERATURA' ? 60 :
                       sensor.type === 'GAS' ? (sensor.thresholdWarning * 0.5) : 420
    for (let i = 50; i >= 0; i--) {
      const noise = (Math.random() - 0.5) * (sensor.thresholdCritical * 0.08)
      const meanRev = (meanTarget - prev) * 0.03
      prev = Math.max(0, prev + noise + meanRev)
      const status = prev >= sensor.thresholdCritical ? 'CRITICO' : prev >= sensor.thresholdWarning ? 'WARNING' : 'NORMAL'
      readingsData.push({
        sensorId: sensor.id,
        value: Math.round(prev * 100) / 100,
        status,
        timestamp: new Date(Date.now() - i * 3000),
      })
    }
  }
  await prisma.sensorReading.createMany({ data: readingsData })

  // ── 5. Documentos HSE ──
  await prisma.hseDocument.createMany({
    data: [
      {
        companyId: company.id, userId: tech1.id,
        title: 'Certificado Médico - Antonio Fernández',
        documentType: 'certificado_medico', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'EXPIRED',
        issueDate: new Date('2023-09-01'), expiryDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        holderName: 'Antonio Fernández',
      },
      {
        companyId: company.id, userId: tech2.id,
        title: 'Certificado Médico - Daniel Colmenares',
        documentType: 'certificado_medico', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-03-15'), expiryDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
        holderName: 'Daniel Colmenares',
      },
      {
        companyId: company.id,
        title: 'Licencia de Operación Industrial - Refinería Amuay',
        documentType: 'licencia_operativa', category: 'LEGAL', criticality: 'CRITICAL',
        status: 'PENDING_RENEWAL',
        issueDate: new Date('2022-01-15'), expiryDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        title: 'Permiso Ambiental MINAMB - Terminal Gas',
        documentType: 'permiso_ambiental', category: 'AMBIENTAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'), expiryDate: new Date('2026-01-01'),
      },
      {
        companyId: company.id, userId: supervisor.id,
        title: 'Curso Trabajo en Altura IV - Jesús Ramírez',
        documentType: 'curso_altura', category: 'PERSONAL', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-06-01'), expiryDate: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
        holderName: 'Jesús Ramírez',
      },
      {
        companyId: company.id, userId: tech1.id,
        title: 'Curso Riesgo Eléctrico - Antonio Fernández',
        documentType: 'curso_electrico', category: 'PERSONAL', criticality: 'NORMAL',
        status: 'EXPIRED',
        issueDate: new Date('2023-02-10'), expiryDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        holderName: 'Antonio Fernández',
      },
      {
        companyId: company.id,
        title: 'Seguro Riesgos Laborales - Suministros IT Consarve',
        documentType: 'seguro_rst', category: 'LEGAL', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'), expiryDate: new Date('2025-06-30'),
      },
      {
        companyId: company.id, userId: tech2.id,
        title: 'Curso Espacios Confinados - Daniel Colmenares',
        documentType: 'curso_confinado', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-08-01'), expiryDate: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
        holderName: 'Daniel Colmenares',
      },
      {
        companyId: company.id,
        title: 'Inspección Extintores Muelle Norte',
        documentType: 'inspeccion_extintores', category: 'EQUIPOS', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-10-01'), expiryDate: new Date('2025-10-01'),
      },
      {
        companyId: company.id,
        title: 'Calibración Detectores Gas Amuay',
        documentType: 'calibracion_equipos', category: 'EQUIPOS', criticality: 'HIGH',
        status: 'PENDING_RENEWAL',
        issueDate: new Date('2024-04-15'), expiryDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 6. Permisos de Trabajo (12 permisos, varios estados) ──
  await prisma.permit.createMany({
    data: [
      {
        companyId: company.id, permitNumber: 'SIC-2025-0001',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, briefing_completed: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Muelle Norte - Grúa Gantry', workDescription: 'Inspección de cables de izamiento en grúa pórtico. Lubricación de poleas y verificación de límites de carga.',
        workLatitude: 11.6158, workLongitude: -70.2269, workRadius: 200, locationSource: 'gps', workLocationId: loc1.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6158, longitude: -70.2269, accuracy: 8 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6159, longitude: -70.2268, accuracy: 12 } }),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0002',
        riskType: 'ELECTRICO', status: 'PENDING',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: true, voltage_tested: true, has_first_aid_kit: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Subestación Amuay - Tablero SE-12', workDescription: 'Mantenimiento preventivo en tablero de distribución SE-12. Verificación de conexiones y torqueo de barras.',
        workLatitude: 11.7417, workLongitude: -70.2133, workRadius: 300, locationSource: 'gps', workLocationId: loc2.id,
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7417, longitude: -70.2133, accuracy: 10 } }),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0003',
        riskType: 'CONFINADO', status: 'APPROVED',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: true, rescue_team_standing: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Tanque TK-501 - Amuay', workDescription: 'Inspección interna de tanque de almacenamiento. Medición de espesores de placa y revisión de revestimiento anti-corrosivo.',
        workLatitude: 11.7417, workLongitude: -70.2133, workRadius: 300, locationSource: 'gps', workLocationId: loc2.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7417, longitude: -70.2133, accuracy: 6 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7418, longitude: -70.2134, accuracy: 9 } }),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0004',
        riskType: 'CALIENTE', status: 'REJECTED',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: false, has_first_aid_kit: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Rafael Martínez',
        workLocation: 'Taller Mecánico Campamento', workDescription: 'Soldadura de soporte para tubería de drenaje en taller de mantenimiento.',
        rejectionReason: 'Zona de trabajo caliente no despejada. Materiales inflamables detectados a 3m del área de soldadura.',
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        rejectedById: admin.id, rejectedByName: 'Rafael Martínez', rejectedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0005',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, buddy_system: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Torre de Enfriamiento Tía Juana', workDescription: 'Pintura anticorrosiva en estructura superior de torre de enfriamiento. Inspección de aletas de intercambio.',
        workLatitude: 10.5333, workLongitude: -71.3333, workRadius: 150, locationSource: 'gps', workLocationId: loc3.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 10.5333, longitude: -71.3333, accuracy: 14 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 10.5334, longitude: -71.3332, accuracy: 11 } }),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0006',
        riskType: 'CONFINADO', status: 'PENDING',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: false }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Sistema de Drenaje Pluvial - Amuay', workDescription: 'Inspección de cámara de drenaje pluvial para verificar integridad estructural.',
        workLocationId: loc2.id,
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0007',
        riskType: 'CALIENTE', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: true, has_first_aid_kit: true, fire_watch_60min: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Rafael Martínez',
        workLocation: 'Muelle Norte - Área de Soldadura', workDescription: 'Reparación de deflector en barandilla del muelle. Corte y soldadura con electrodos E-7018.',
        workLatitude: 11.6158, workLongitude: -70.2269, workRadius: 200, locationSource: 'gps', workLocationId: loc1.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: admin.id, approvedByName: 'Rafael Martínez', approvedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6158, longitude: -70.2269, accuracy: 7 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6159, longitude: -70.2270, accuracy: 10 } }),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0008',
        riskType: 'ELECTRICO', status: 'CANCELLED',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Estación Compresora Tía Juana', workDescription: 'Reemplazo de breaker principal de estación compresora de gas.',
        workLocationId: loc3.id,
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0009',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, weather_check: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Chimenea Incinerador - Amuay', workDescription: 'Inspección de revestimiento refractario en chimenea de incinerador. Mediciones de temperatura en línea.',
        workLocationId: loc2.id,
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0010',
        riskType: 'CALIENTE', status: 'PENDING',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: true, has_first_aid_kit: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Taller Mecánico - Campamento Coro', workDescription: 'Fabricación de brida especial para acople de tubería de gas de 8 pulgadas.',
        workLocationId: loc4.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0011',
        riskType: 'CONFINADO', status: 'APPROVED',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: true, rescue_team_standing: true, continuous_ventilation: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Separador de Agua - Oleoducto', workDescription: 'Limpieza e inspección de separador agua-aceite. Verificación de internos y placa de orificio.',
        workLocationId: loc1.id,
        createdById: tech1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id, permitNumber: 'SIC-2025-0012',
        riskType: 'ELECTRICO', status: 'REJECTED',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: false, voltage_tested: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Rafael Martínez',
        workLocation: 'Panel Control Bombas - Muelle', workDescription: 'Mantenimiento correctivo en panel de control de bombas de transferencia de crudo.',
        rejectionReason: 'EPP dieléctrico no disponible. No se puede proceder sin guantes y botas dieléctricas certificadas.',
        createdById: tech2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        rejectedById: admin.id, rejectedByName: 'Rafael Martínez', rejectedAt: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 7. SYSTEM ALERTS (GOC) ──
  const alertsData = [
    // SENSOR_CRITICAL alerts
    {
      companyId: company.id,
      type: 'SENSOR_CRITICAL', severity: 'CRITICAL',
      title: 'Gas H2S - Nivel Crítico Muelle Norte',
      message: 'Detector de H2S en Muelle Norte registró 8.2% LEL, superando umbral crítico de 10% LEL. Evacuación del área iniciada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-H2S-CRIT', sensorName: 'Gas H2S Muelle Norte', sensorType: 'GAS', value: 8.2, unit: '%LEL', threshold: 10.0, location: 'Muelle Norte' }),
      isAcknowledged: false,
      relatedEntityId: sensors[1].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SENSOR_CRITICAL', severity: 'HIGH',
      title: 'Temperatura Tanque TK-501 - Aviso Alto',
      message: 'Temperatura del Tanque TK-501 alcanzó 72°C, umbral de advertencia es 70°C. Monitoreo intensificado activado.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-TEMP-HIGH', sensorName: 'Temperatura Tanque TK-501', sensorType: 'TEMPERATURA', value: 72.0, unit: '°C', thresholdWarning: 70, location: 'Amuay' }),
      isAcknowledged: false,
      relatedEntityId: sensors[2].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SENSOR_CRITICAL', severity: 'CRITICAL',
      title: 'Gas LEV Amuay - Umbral Crítico Excedido',
      message: 'Detector LEV en área de tanques de Amuay registró 22% LEL. Zona evacuada. Brigada de emergencia desplegada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-GAS-LEV-CRIT', sensorName: 'Detector Gas LEV Amuay', sensorType: 'GAS', value: 22.0, unit: '%LEL', threshold: 20.0, location: 'Amuay' }),
      isAcknowledged: true,
      relatedEntityId: sensors[4].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SENSOR_CRITICAL', severity: 'MEDIUM',
      title: 'Voltaje Compresora - Fluctuación Detectada',
      message: 'Voltaje en estación compresora fluctuando entre 410V-435V. Umbral de advertencia: 440V. Monitoreo continuo activo.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-VOLT-FLUCT', sensorName: 'Voltaje Estación Compresora', sensorType: 'VOLTAJE', value: 428.0, unit: 'V', thresholdWarning: 440, location: 'Tía Juana' }),
      isAcknowledged: false,
      relatedEntityId: sensors[6].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SENSOR_CRITICAL', severity: 'HIGH',
      title: 'Presión Gasoducto GNL-03 - Lectura Anómala',
      message: 'Presión del gasoducto GNL-03 registró pico de 1,350 psi. Umbral de advertencia: 1,200 psi. Válvula de seguridad activada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-PRES-ANOM', sensorName: 'Presión Gasoducto GNL-03', sensorType: 'PRESION', value: 1350.0, unit: 'psi', thresholdWarning: 1200, location: 'Tía Juana' }),
      isAcknowledged: false,
      relatedEntityId: sensors[5].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
    // GEOFENCE_BREACH alerts
    {
      companyId: company.id,
      type: 'GEOFENCE_BREACH', severity: 'CRITICAL',
      title: 'Violación de Geocerca - Supervisor fuera de zona',
      message: 'Jesús Ramírez aprobó permiso SIC-2025-0001 a 450m del sitio de trabajo (radio: 200m). Justificación requerida.',
      metadata: JSON.stringify({ errorCode: 'GEOFENCE-SUP-OOR', permitNumber: 'SIC-2025-0001', supervisorName: 'Jesús Ramírez', distanceMeters: 450, allowedRadius: 200, workLocation: 'Muelle Norte' }),
      isAcknowledged: false,
      relatedEntityType: 'PERMIT',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'GEOFENCE_BREACH', severity: 'HIGH',
      title: 'Técnico fuera de geocerca - Amuay',
      message: 'Antonio Fernández intentó firmar permiso desde ubicación 350m fuera del área autorizada en Amuay. Firma bloqueada.',
      metadata: JSON.stringify({ errorCode: 'GEOFENCE-TECH-OOR', permitNumber: 'SIC-2025-0003', technicianName: 'Antonio Fernández', distanceMeters: 350, allowedRadius: 300, workLocation: 'Amuay' }),
      isAcknowledged: false,
      relatedEntityType: 'PERMIT',
      createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
    },
    // SYSTEM_ERROR alerts
    {
      companyId: company.id,
      type: 'SYSTEM_ERROR', severity: 'MEDIUM',
      title: 'Error en sincronización de sensores',
      message: 'Fallo en la comunicación con gateway de sensores en Tía Juana. Último dato recibido hace 15 minutos. Reconexión automática en progreso.',
      metadata: JSON.stringify({ errorCode: 'ERR_SENSOR_COMM_01', gateway: 'TIA-JUANA-GW-03', lastDataAge: 900, retryCount: 3 }),
      isAcknowledged: false,
      relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 15 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SYSTEM_ERROR', severity: 'LOW',
      title: 'Servicio de reportes - Timeout',
      message: 'Generación de reporte mensual excedió el tiempo límite de 30 segundos. Reporte se regenerará en el próximo ciclo.',
      metadata: JSON.stringify({ errorCode: 'ERR_REPORT_TIMEOUT', reportType: 'monthly', timeoutSeconds: 30 }),
      isAcknowledged: true,
      relatedEntityType: 'SYSTEM',
      createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SYSTEM_ERROR', severity: 'HIGH',
      title: 'Base de datos - Consulta lenta detectada',
      message: 'Query de permits en /api/permits tardó 4.2 segundos. Umbral: 2s. Posible degradación de rendimiento.',
      metadata: JSON.stringify({ errorCode: 'ERR_DB_SLOW_01', endpoint: '/api/permits', durationMs: 4200, thresholdMs: 2000 }),
      isAcknowledged: false,
      relatedEntityType: 'SYSTEM',
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    // SECURITY_BREACH alerts
    {
      companyId: company.id,
      type: 'SECURITY_BREACH', severity: 'CRITICAL',
      title: 'Intento de acceso no autorizado - Múltiples intentos',
      message: 'Se detectaron 12 intentos fallidos de login para el usuario admin@suministrosit.com desde IP 45.227.xxx.xxx (Brasil). Cuenta temporalmente bloqueada.',
      metadata: JSON.stringify({ errorCode: 'ERR_AUTH_BRUTE_01', targetEmail: 'admin@suministrosit.com', attempts: 12, sourceIp: '45.227.xxx.xxx', sourceCountry: 'BR', accountLocked: true }),
      isAcknowledged: false,
      relatedEntityType: 'USER',
      createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SECURITY_BREACH', severity: 'MEDIUM',
      title: 'API Key sin permisos suficientes',
      message: 'Solicitud a /api/sensors/ingest con API key que no tiene permiso sensor:ingest. Origen: 190.205.xxx.xxx.',
      metadata: JSON.stringify({ errorCode: 'ERR_API_KEY_01', apiKeyPrefix: 'ech_live_x8k2m', requestedPermission: 'sensor:ingest', sourceIp: '190.205.xxx.xxx' }),
      isAcknowledged: false,
      relatedEntityType: 'API_KEY',
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
    // SUBSCRIPTION_ALERT alerts
    {
      companyId: company.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'HIGH',
      title: 'Licencia Operativa vence en 20 días',
      message: 'La Licencia de Operación Industrial de la Refinería Amuay vence el 20 de este mes. Renovación requerida antes del vencimiento.',
      metadata: JSON.stringify({ errorCode: 'SUB-LIC-VENCE', documentType: 'licencia_operativa', documentTitle: 'Licencia de Operación Industrial - Refinería Amuay', daysRemaining: 20 }),
      isAcknowledged: false,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'MEDIUM',
      title: 'Calibración de Detectores Gas próxima a vencer',
      message: 'El certificado de calibración de detectores de gas en Amuay vence en 10 días. Programar mantenimiento preventivo.',
      metadata: JSON.stringify({ errorCode: 'SUB-CAL-VENCE', documentType: 'calibracion_equipos', documentTitle: 'Calibración Detectores Gas Amuay', daysRemaining: 10 }),
      isAcknowledged: true,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
    },
    {
      companyId: company.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'CRITICAL',
      title: 'Certificado Médico Expirado - Antonio Fernández',
      message: 'El certificado médico de Antonio Fernández expiró hace 45 días. Técnico NO debe realizar trabajos de campo hasta renovar.',
      metadata: JSON.stringify({ errorCode: 'SUB-CERT-EXP', documentType: 'certificado_medico', holderName: 'Antonio Fernández', daysExpired: 45, restricted: true }),
      isAcknowledged: false,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  ]

  await prisma.systemAlert.createMany({ data: alertsData })
  console.log(`  ✅ SystemAlerts creados para GOC`)

  // ── 8. KNOWLEDGE BASE ──
  await prisma.knowledgeBase.createMany({
    data: [
      // SENSOR codes
      {
        errorCode: 'SENSOR-H2S-CRIT',
        category: 'SCADA',
        title: 'Gas H2S — Nivel Crítico Excedido',
        rootCause: 'Concentración de ácido sulfhídrico (H2S) superó el umbral crítico de 10% LEL. Posibles causas: fuga en línea de gas, fallo en válvula de alivio, o venteo no controlado en muelle de carga.',
        appliedSolution: '1. Activar protocolo de evacuación inmediata del área (bocina de alarma).\n2. Ningún trabajador debe ingresar sin equipo SCBA (Self-Contained Breathing Apparatus).\n3. Cerrar válvulas de aislamiento de la zona afectada.\n4. Desplegar brigada de emergencia con detectores portátiles H2S.\n5. Solo reingresar después de que lectura baje a <5% LEL sostenido por 30 min.',
        severity: 'CRITICAL',
        referenceUrl: 'https://docs.suministrosit.com/scada/h2s-emergency-protocol',
        timesUsed: 14,
      },
      {
        errorCode: 'SENSOR-TEMP-HIGH',
        category: 'SCADA',
        title: 'Temperatura de Tanque — Umbral Alto Excedido',
        rootCause: 'La temperatura del tanque de almacenamiento TK-501 superó los 70°C. Causas probables: radiación solar directa prolongada, falla en sistema de enfriamiento por aspersión, o reacción exotérmica del contenido.',
        appliedSolution: '1. Activar sistema de aspersión de agua sobre el tanque.\n2. Verificar flujo de agua en bombas de enfriamiento.\n3. Reducir nivel de llenado del tanque si es posible.\n4. Monitorear cada 5 minutos hasta que temperatura baje a <65°C.\n5. Si supera 85°C, activar protocolo de emergencia por posible BLEVE.',
        severity: 'HIGH',
        timesUsed: 8,
      },
      {
        errorCode: 'SENSOR-GAS-LEV-CRIT',
        category: 'SCADA',
        title: 'Gas LEV — Nivel Crítico Excedido',
        rootCause: 'Detector de gas Lower Explosive Limit (LEV) registró concentración de 22% LEL, superando el umbral crítico de 20%. Esto indica acumulación peligrosa de gases inflamables en el área de tanques. Posible fuga en válvulas o bridas.',
        appliedSolution: '1. Evacuar inmediatamente toda el área (radio mínimo 200m del punto de detección).\n2. Cortar todas las fuentes de ignición (apagar motores, equipos eléctricos no intrínsecamente seguros).\n3. Cerrar válvulas de bloqueo del sector afectado.\n4. Desplegar equipo de búsqueda de fugas con cámara termográfica.\n5. Ventilar el área con extractores ATEX hasta lectura <10% LEL.',
        severity: 'CRITICAL',
        referenceUrl: 'https://docs.suministrosit.com/scada/lev-emergency-response',
        timesUsed: 11,
      },
      {
        errorCode: 'SENSOR-VOLT-FLUCT',
        category: 'SCADA',
        title: 'Voltaje — Fluctuación en Estación Compresora',
        rootCause: 'Oscilaciones de voltaje en la alimentación eléctrica de la estación compresora (410V-435V vs. nominal 440V). Causas: red eléctrica inestable, regulador de voltaje dañado, o carga desbalanceada en el transformador.',
        appliedSolution: '1. Verificar con multiclamp el voltaje en bornas del equipo.\n2. Revisar regulador de voltaje automático (AVR) del transformador.\n3. Si la red es inestable, activar UPS/generador de respaldo.\n4. Reportar a la empresa distribuidora de energía eléctrica.\n5. No reiniciar compresora hasta estabilizar voltaje >430V sostenido.',
        severity: 'MEDIUM',
        timesUsed: 6,
      },
      {
        errorCode: 'SENSOR-PRES-ANOM',
        category: 'SCADA',
        title: 'Presión Gasoducto — Lectura Anómala',
        rootCause: 'Pico de presión de 1,350 psi en gasoducto GNL-03 (umbral advertencia: 1,200 psi). Causas: obstrucción parcial en línea, cierre repentino de válvula aguas abajo, o acumulación de hidratos.',
        appliedSolution: '1. Verificar posición de válvulas de bloqueo en el tramo afectado.\n2. Abrir parcialmente válvula de alivio de presión (PSV) para reducir a <1,200 psi.\n3. Inyectar inhibitor de hidratos si la temperatura del gas es baja.\n4. Monitorear cada 2 minutos hasta estabilización.\n5. Si presión supera 1,500 psi, activar cierre de emergencia (ESD).',
        severity: 'HIGH',
        referenceUrl: 'https://docs.suministrosit.com/scada/pressure-anomaly-procedure',
        timesUsed: 9,
      },
      // GEOFENCE codes
      {
        errorCode: 'GEOFENCE-SUP-OOR',
        category: 'PERMIT',
        title: 'Supervisor aprobó permiso fuera de la geocerca',
        rootCause: 'Un supervisor firmó la aprobación de un permiso de trabajo desde una ubicación que está fuera del radio autorizado del sitio de trabajo. Esto puede indicar: aprobación remota no autorizada, GPS impreciso, o posible suplantación de ubicación.',
        appliedSolution: '1. Contactar al supervisor para verificar su ubicación física real.\n2. Si es un GPS impreciso, solicitar que se acerque al sitio y refirme.\n3. Si fue aprobación remota, verificar si existe autorización escrita para aprobaciones fuera de sitio.\n4. Documentar el incidente en el registro de auditoría.\n5. Revisar la política de geocercas para este tipo de permisos.',
        severity: 'CRITICAL',
        timesUsed: 4,
      },
      {
        errorCode: 'GEOFENCE-TECH-OOR',
        category: 'PERMIT',
        title: 'Técnico intentó firmar permiso fuera de geocerca',
        rootCause: 'El técnico intentó registrar su firma de inicio de trabajo desde una ubicación fuera del área autorizada. Causas: GPS del dispositivo con poca precisión, técnico no se encuentra en el sitio correcto, o interferencia de señal en área industrial.',
        appliedSolution: '1. La firma fue correctamente bloqueada por el sistema — verificar que el técnico se encuentre físicamente en el sitio de trabajo.\n2. Pedir que active GPS de alta precisión en su dispositivo móvil.\n3. Si está dentro del área pero el GPS no detecta, verificar calibración GPS.\n4. Como contingencia, el supervisor puede permitir firma manual con justificación por escrito.\n5. Reportar problemas recurrentes de GPS para ajustar el radio de la geocerca.',
        severity: 'HIGH',
        timesUsed: 3,
      },
      // SUBSCRIPTION / DOCUMENT codes
      {
        errorCode: 'SUB-LIC-VENCE',
        category: 'COMPLIANCE',
        title: 'Licencia Operativa próxima a vencer',
        rootCause: 'La licencia de operación industrial de la refinería tiene 20 días o menos de vigencia. Sin renovación oportuna, la instalación debe detener operaciones por incumplimiento legal ante el Ministerio de Energía.',
        appliedSolution: '1. Iniciar trámite de renovación inmediatamente ante el órgano regulador.\n2. Coordinar con el departamento legal la documentación requerida (inspecciones, planes de emergencia actualizados).\n3. Programar inspección técnica previa si es requerida.\n4. Notificar a la gerencia general del riesgo operativo.\n5. Si no se renueva a tiempo, preparar plan de parada programada.',
        severity: 'HIGH',
        timesUsed: 5,
      },
      {
        errorCode: 'SUB-CAL-VENCE',
        category: 'COMPLIANCE',
        title: 'Calibración de detectores de gas próxima a vencer',
        rootCause: 'El certificado de calibración de los detectores de gas en Amuay vence en 10 días. Detectores sin calibración vigente no son confiables para medición de gases inflamables, lo que pone en riesgo la seguridad del personal.',
        appliedSolution: '1. Programar visita del laboratorio de calibración acreditado (ISO 17025).\n2. Preparar lista de detectores a calibrar (serial, ubicación, fecha última calibración).\n3. Tener detectores de repuesto calibrados disponibles para el período de servicio.\n4. No permitir operaciones en áreas de riesgo sin detectores calibrados.\n5. Actualizar el registro en el sistema al recibir nuevo certificado.',
        severity: 'MEDIUM',
        timesUsed: 7,
      },
      {
        errorCode: 'SUB-CERT-EXP',
        category: 'COMPLIANCE',
        title: 'Certificado Médico de Personal Expirado',
        rootCause: 'El certificado médico de aptitud ocupacional de un técnico expiró hace más de 30 días. Legalmente, el trabajador no puede realizar labores de campo, trabajos en altura, espacios confinados ni actividades de riesgo sin certificado vigente.',
        appliedSolution: '1. Restringir inmediatamente al trabajador de labores de campo (el sistema ya lo hizo).\n2. Programar cita médica ocupacional lo antes posible.\n3. Asignar temporalmente al trabajador tareas administrativas mientras renueva.\n4. Notificar al supervisor directo del estado del trabajador.\n5. Una vez obtenido el nuevo certificado, cargarlo al sistema para habilitar operaciones.',
        severity: 'CRITICAL',
        timesUsed: 10,
      },
      // SYSTEM codes
      {
        errorCode: 'ERR_SENSOR_COMM_01',
        category: 'SCADA',
        title: 'Fallo en comunicación con gateway de sensores',
        rootCause: 'El gateway IoT pierde conectividad con la red debido a: (1) interferencia RF en la frecuencia del radio, (2) pérdida de alimentación en el gateway, (3) saturación de buffer por alta densidad de datos.',
        appliedSolution: '1. Verificar alimentación del gateway (LED verde).\n2. Reiniciar gateway vía SSH: ssh admin@gw-ip "reboot"\n3. Verificar señal RF con comando: rssi-check --gw GATEWAY_ID\n4. Si persiste, escalar a proveedor de conectividad.',
        severity: 'MEDIUM',
        referenceUrl: 'https://docs.suministrosit.com/scada/troubleshooting',
        timesUsed: 7,
      },
      {
        errorCode: 'ERR_REPORT_TIMEOUT',
        category: 'SYSTEM',
        title: 'Generación de reporte excede tiempo límite',
        rootCause: 'La consulta SQL del reporte abarca un rango de fechas muy amplio o la base de datos tiene fragmentación. Reportes PDF con más de 1000 registros pueden exceder el timeout.',
        appliedSolution: '1. Reducir rango de fechas del reporte (máximo 90 días recomendado).\n2. Ejecutar VACUUM en SQLite si la DB supera 500MB.\n3. En caso de reportes masivos, usar endpoint asíncrono: POST /api/reports/generate-async',
        severity: 'LOW',
        timesUsed: 3,
      },
      {
        errorCode: 'ERR_DB_SLOW_01',
        category: 'SYSTEM',
        title: 'Consulta lenta en base de datos',
        rootCause: 'Los índices Prisma pueden estar desactualizados después de grandes operaciones de inserción/eliminación. También puede ser causado por bloqueos de escritura en SQLite.',
        appliedSolution: '1. Ejecutar ANALYZE para actualizar estadísticas de índices.\n2. Verificar con EXPLAIN QUERY PLAN que se usen índices.\n3. Para SQLite en producción, considerar migrar a PostgreSQL si hay >100 usuarios concurrentes.',
        severity: 'HIGH',
        timesUsed: 12,
      },
      // SECURITY codes
      {
        errorCode: 'ERR_AUTH_BRUTE_01',
        category: 'AUTH',
        title: 'Múltiples intentos de login fallidos (posible ataque)',
        rootCause: 'Un atacante está intentando credenciales por fuerza bruta. La IP de origen puede ser de un botnet o proxy. La cuenta queda bloqueada después de 10 intentos.',
        appliedSolution: '1. Verificar si el usuario legítimo tiene problemas para recordar su contraseña.\n2. Bloquear IP de origen en el firewall: iptables -A INPUT -s IP -j DROP\n3. Habilitar 2FA para la cuenta comprometida.\n4. Si es ataque persistente, habilitar rate limiting global.',
        severity: 'CRITICAL',
        timesUsed: 5,
      },
      {
        errorCode: 'ERR_API_KEY_01',
        category: 'AUTH',
        title: 'API Key con permisos insuficientes',
        rootCause: 'El integrador externo está usando una API key creada con permisos limitados. Posible error de configuración al crear la key o intento de acceder a endpoints no autorizados.',
        appliedSolution: '1. Verificar los permisos de la API key en el panel de Configuración > API Keys.\n2. Si es legítimo, actualizar permisos: agregar "sensor:ingest" a los permisos.\n3. Si no es legítimo, revocar la API key inmediatamente.\n4. Contactar al integrador para confirmar el uso esperado.',
        severity: 'MEDIUM',
        timesUsed: 2,
      },
    ],
  })
  console.log('  ✅ Knowledge Base creada con 15 soluciones')

  // ── 9. AUDIT LOGS ──
  await prisma.auditLog.createMany({
    data: [
      { companyId: company.id, userId: admin.id, action: 'LOGIN', entityType: 'USER', entityId: admin.id, details: JSON.stringify({ method: 'credentials', ip: '190.205.1.100' }) },
      { companyId: company.id, userId: tech1.id, action: 'LOGIN', entityType: 'USER', entityId: tech1.id, details: JSON.stringify({ method: 'credentials', ip: '190.205.2.50' }) },
      { companyId: company.id, userId: supervisor.id, action: 'APPROVE', entityType: 'PERMIT', entityId: 'SIC-2025-0001', details: JSON.stringify({ permitNumber: 'SIC-2025-0001', riskType: 'ALTURA' }) },
      { companyId: company.id, userId: admin.id, action: 'REJECT', entityType: 'PERMIT', entityId: 'SIC-2025-0004', details: JSON.stringify({ permitNumber: 'SIC-2025-0004', reason: 'Zona caliente no despejada' }) },
      { companyId: company.id, userId: supervisor.id, action: 'APPROVE', entityType: 'PERMIT', entityId: 'SIC-2025-0003', details: JSON.stringify({ permitNumber: 'SIC-2025-0003', riskType: 'CONFINADO' }) },
      { companyId: company.id, userId: admin.id, action: 'REJECT', entityType: 'PERMIT', entityId: 'SIC-2025-0012', details: JSON.stringify({ permitNumber: 'SIC-2025-0012', reason: 'EPP dieléctrico no disponible' }) },
      { companyId: company.id, userId: tech1.id, action: 'CREATE', entityType: 'PERMIT', entityId: 'SIC-2025-0001', details: JSON.stringify({ permitNumber: 'SIC-2025-0001', riskType: 'ALTURA' }) },
      { companyId: company.id, userId: tech2.id, action: 'CREATE', entityType: 'PERMIT', entityId: 'SIC-2025-0002', details: JSON.stringify({ permitNumber: 'SIC-2025-0002', riskType: 'ELECTRICO' }) },
      { companyId: company.id, action: 'SYSTEM_ERROR', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_SENSOR_COMM_01', gateway: 'TIA-JUANA-GW-03' }) },
      { companyId: company.id, action: 'SECURITY_BREACH', entityType: 'USER', entityId: null, details: JSON.stringify({ errorCode: 'ERR_AUTH_BRUTE_01', attempts: 12, sourceIp: '45.227.xxx.xxx' }) },
      { companyId: company.id, action: 'ERROR', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_REPORT_TIMEOUT', reportType: 'monthly' }) },
      { companyId: company.id, action: 'FAILURE', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_DB_SLOW_01', durationMs: 4200 }) },
    ],
  })
  console.log('  ✅ Audit Logs creados')

  // ── 10. Configuración de alertas (AlertConfig) ──
  await prisma.alertConfig.createMany({
    data: [
      { companyId: company.id, name: 'Alerta Documento Crítico', alertType: 'IN_APP', triggerDaysBefore: 30, isActive: true },
      { companyId: company.id, name: 'Alerta Documento Crítico Email', alertType: 'EMAIL', triggerDaysBefore: 15, isActive: true },
      { companyId: company.id, name: 'Alerta Sensor Crítico', alertType: 'IN_APP', triggerDaysBefore: 0, isActive: true },
    ],
  })

  // ═══════════════════════════════════════════════════════════
  //  NUEVOS MÓDULOS: TRANSPORTE Y AMBIENTE
  // ═══════════════════════════════════════════════════════════

  // ── 11. INVENTORY LOCATIONS (para Transporte) ──
  console.log('  📦 Creando ubicaciones de inventario...')

  const invLoc1 = await prisma.inventoryLocation.create({
    data: {
      companyId: company.id,
      name: 'Almacén Principal - Coro',
      province: 'Falcón',
      city: 'Coro',
      address: 'Av. Industrial, Zona Industrial Coro',
      latitude: 11.4043,
      longitude: -69.6731,
      isActive: true,
    },
  })

  const invLoc2 = await prisma.inventoryLocation.create({
    data: {
      companyId: company.id,
      name: 'Bodega Muelle Norte - Punta Cardón',
      province: 'Falcón',
      city: 'Punta Cardón',
      address: 'Muelle Principal, Punta Cardón',
      latitude: 11.6158,
      longitude: -70.2269,
      isActive: true,
    },
  })

  const invLoc3 = await prisma.inventoryLocation.create({
    data: {
      companyId: company.id,
      name: 'Almacén Refinería Amuay',
      province: 'Falcón',
      city: 'Amuay',
      address: 'Complejo Refinador Paraguaná, Amuay',
      latitude: 11.7417,
      longitude: -70.2133,
      isActive: true,
    },
  })

  // ── 12. INVENTORY ITEMS ──
  console.log('  📦 Creando ítems de inventario...')

  const items = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Batería 12V 100Ah',
        sku: 'BAT-12V-100AH',
        category: 'BATERIA',
        unit: 'unidad',
        thresholdMin: 10,
        thresholdMax: 50,
        isActive: true,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Casco de Seguridad Clase E',
        sku: 'PPE-CASCO-E',
        category: 'EPP',
        unit: 'unidad',
        thresholdMin: 25,
        thresholdMax: 100,
        isActive: true,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Guantes Dieléctricos Clase 00',
        sku: 'PPE-GUANTES-00',
        category: 'EPP',
        unit: 'par',
        thresholdMin: 15,
        thresholdMax: 60,
        isActive: true,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Multímetro Digital Fluke 87V',
        sku: 'HERR-FLUKE-87V',
        category: 'HERRAMIENTA',
        unit: 'unidad',
        thresholdMin: 3,
        thresholdMax: 15,
        isActive: true,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Detector de Gas 4-Gas BW Ultra',
        sku: 'GAS-BW-ULTRA',
        category: 'GENERAL',
        unit: 'unidad',
        thresholdMin: 5,
        thresholdMax: 20,
        isActive: true,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        companyId: company.id,
        name: 'Cinta de Señalización 5cm x 50m',
        sku: 'MAT-CINTA-5X50',
        category: 'MATERIAL',
        unit: 'rollo',
        thresholdMin: 10,
        thresholdMax: 50,
        isActive: true,
      },
    }),
  ])

  // ── 13. SMART INVENTORY (stock por ubicación) ──
  console.log('  📦 Creando stock de inventario...')

  await prisma.smartInventory.createMany({
    data: [
      { companyId: company.id, itemId: items[0].id, locationId: invLoc1.id, quantity: 25, lastCountedAt: now },
      { companyId: company.id, itemId: items[0].id, locationId: invLoc2.id, quantity: 15, lastCountedAt: now },
      { companyId: company.id, itemId: items[1].id, locationId: invLoc1.id, quantity: 50, lastCountedAt: now },
      { companyId: company.id, itemId: items[1].id, locationId: invLoc2.id, quantity: 30, lastCountedAt: now },
      { companyId: company.id, itemId: items[1].id, locationId: invLoc3.id, quantity: 40, lastCountedAt: now },
      { companyId: company.id, itemId: items[2].id, locationId: invLoc1.id, quantity: 25, lastCountedAt: now },
      { companyId: company.id, itemId: items[2].id, locationId: invLoc3.id, quantity: 20, lastCountedAt: now },
      { companyId: company.id, itemId: items[3].id, locationId: invLoc1.id, quantity: 8, lastCountedAt: now },
      { companyId: company.id, itemId: items[3].id, locationId: invLoc2.id, quantity: 4, lastCountedAt: now },
      { companyId: company.id, itemId: items[4].id, locationId: invLoc2.id, quantity: 12, lastCountedAt: now },
      { companyId: company.id, itemId: items[4].id, locationId: invLoc3.id, quantity: 8, lastCountedAt: now },
      { companyId: company.id, itemId: items[5].id, locationId: invLoc1.id, quantity: 30, lastCountedAt: now },
    ],
  })

  // ── 14. TRANSPORT VEHICLES ──
  console.log('  🚛 Creando vehículos de transporte...')

  const vehicles = await Promise.all([
    prisma.transportVehicle.create({
      data: {
        companyId: company.id,
        plate: 'AB123CD',
        type: 'CAMION',
        brand: 'Mercedes Benz',
        model: 'Actros 2651',
        year: 2022,
        capacityKg: 25000,
        vin: 'WDB12345678901234',
        isActive: true,
        status: 'DISPONIBLE',
        lastInspectionAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.transportVehicle.create({
      data: {
        companyId: company.id,
        plate: 'CD456EF',
        type: 'TRACTOR',
        brand: 'Kenworth',
        model: 'T680',
        year: 2023,
        capacityKg: 35000,
        vin: 'KEN12345678905678',
        isActive: true,
        status: 'EN_RUTA',
        currentDriverId: tech1.id,
        lastInspectionAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.transportVehicle.create({
      data: {
        companyId: company.id,
        plate: 'EF789GH',
        type: 'CAMIONETA',
        brand: 'Toyota',
        model: 'Hilux',
        year: 2024,
        capacityKg: 1000,
        vin: 'TOY12345678901234',
        isActive: true,
        status: 'MANTENIMIENTO',
        lastInspectionAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.transportVehicle.create({
      data: {
        companyId: company.id,
        plate: 'GH012IJ',
        type: 'PICKUP',
        brand: 'Ford',
        model: 'Ranger',
        year: 2022,
        capacityKg: 1200,
        vin: 'FOR12345678905678',
        isActive: true,
        status: 'DISPONIBLE',
        lastInspectionAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.transportVehicle.create({
      data: {
        companyId: company.id,
        plate: 'IJ345KL',
        type: 'EQUIPO_ESPECIAL',
        brand: 'CAT',
        model: 'D8T',
        year: 2021,
        capacityKg: 50000,
        vin: 'CAT12345678901234',
        isActive: true,
        status: 'DISPONIBLE',
        lastInspectionAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // ── 15. TRANSPORT DRIVERS ──
  console.log('  👤 Creando conductores de transporte...')

  await Promise.all([
    prisma.transportDriver.create({
      data: {
        companyId: company.id,
        userId: tech1.id,
        licenseNumber: 'VEN-12345678',
        licenseType: 'C',
        licenseExpiry: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        status: 'ACTIVO',
        fatigueScore: 0.15,
        totalTrips: 42,
        medicalExpiry: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        emergencyContact: JSON.stringify({ name: 'María Fernández', phone: '+58 412-555-9999', relationship: 'Esposa' }),
      },
    }),
    prisma.transportDriver.create({
      data: {
        companyId: company.id,
        userId: tech2.id,
        licenseNumber: 'VEN-87654321',
        licenseType: 'D',
        licenseExpiry: new Date(now.getTime() + 250 * 24 * 60 * 60 * 1000),
        status: 'ACTIVO',
        fatigueScore: 0.08,
        totalTrips: 38,
        medicalExpiry: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
        emergencyContact: JSON.stringify({ name: 'Laura Colmenares', phone: '+58 414-555-8888', relationship: 'Hermana' }),
      },
    }),
    prisma.transportDriver.create({
      data: {
        companyId: company.id,
        userId: supervisor.id,
        licenseNumber: 'VEN-43215678',
        licenseType: 'E',
        licenseExpiry: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        status: 'ACTIVO',
        fatigueScore: 0.22,
        totalTrips: 15,
        medicalExpiry: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        emergencyContact: JSON.stringify({ name: 'Ana Ramírez', phone: '+58 416-555-7777', relationship: 'Esposa' }),
      },
    }),
  ])

  // ── 16. TRANSPORT ROUTES ──
  console.log('  🗺️ Creando rutas de transporte...')

  const routes = await Promise.all([
    prisma.transportRoute.create({
      data: {
        companyId: company.id,
        name: 'Ruta Coro - Muelle Norte',
        origin: 'Coro - Almacén Principal',
        destination: 'Punta Cardón - Muelle Norte',
        distanceKm: 85.5,
        estimatedDurationMin: 90,
        waypoints: JSON.stringify([
          { lat: 11.4043, lng: -69.6731, name: 'Salida Almacén Coro' },
          { lat: 11.5000, lng: -70.0000, name: 'Punto de Control - Peaje' },
          { lat: 11.6158, lng: -70.2269, name: 'Llegada Muelle Norte' },
        ]),
        riskLevel: 'MEDIO',
        hasHSECheckpoints: true,
        checkpointConfig: JSON.stringify({
          checkpoints: [
            { km: 0, type: 'SALIDA', required: ['documentacion', 'vehiculo'] },
            { km: 42, type: 'INTERMEDIO', required: ['documentacion', 'conductor'] },
            { km: 85, type: 'LLEGADA', required: ['documentacion'] },
          ]
        }),
        isActive: true,
      },
    }),
    prisma.transportRoute.create({
      data: {
        companyId: company.id,
        name: 'Ruta Amuay - Tía Juana',
        origin: 'Refinería Amuay',
        destination: 'Terminal de Gas Tía Juana',
        distanceKm: 120.0,
        estimatedDurationMin: 135,
        waypoints: JSON.stringify([
          { lat: 11.7417, lng: -70.2133, name: 'Salida Amuay' },
          { lat: 11.0000, lng: -71.0000, name: 'Punto de Control - Bomberos' },
          { lat: 10.5333, lng: -71.3333, name: 'Llegada Tía Juana' },
        ]),
        riskLevel: 'ALTO',
        hasHSECheckpoints: true,
        checkpointConfig: JSON.stringify({
          checkpoints: [
            { km: 0, type: 'SALIDA', required: ['documentacion', 'vehiculo', 'carga'] },
            { km: 60, type: 'INTERMEDIO', required: ['documentacion', 'conductor', 'carga'] },
            { km: 120, type: 'LLEGADA', required: ['documentacion', 'carga'] },
          ]
        }),
        isActive: true,
      },
    }),
    prisma.transportRoute.create({
      data: {
        companyId: company.id,
        name: 'Ruta Campamento - Plataforma Cardón',
        origin: 'Campamento Base Coro',
        destination: 'Plataforma Cardón',
        distanceKm: 45.0,
        estimatedDurationMin: 50,
        waypoints: JSON.stringify([
          { lat: 11.4043, lng: -69.6731, name: 'Salida Campamento' },
          { lat: 11.6158, lng: -70.2269, name: 'Llegada Plataforma' },
        ]),
        riskLevel: 'BAJO',
        hasHSECheckpoints: true,
        checkpointConfig: JSON.stringify({
          checkpoints: [
            { km: 0, type: 'SALIDA', required: ['documentacion', 'vehiculo'] },
            { km: 45, type: 'LLEGADA', required: ['documentacion'] },
          ]
        }),
        isActive: true,
      },
    }),
  ])

  // ── 17. TRANSPORT TRIPS ──
  console.log('  🚛 Creando viajes de transporte...')

  const trips = await Promise.all([
    prisma.transportTrip.create({
      data: {
        companyId: company.id,
        vehicleId: vehicles[0].id,
        driverId: tech1.id,
        routeId: routes[0].id,
        status: 'COMPLETADO',
        startDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        startOdometerKm: 45230.5,
        endOdometerKm: 45316.0,
        fuelConsumed: 45.8,
        riskValidationResult: JSON.stringify({ status: 'PASSED', checkedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }),
        inspectionResult: JSON.stringify({ status: 'PASSED', items: ['documentacion', 'vehiculo'] }),
        notes: 'Viaje de rutina. Sin incidentes.',
      },
    }),
    prisma.transportTrip.create({
      data: {
        companyId: company.id,
        vehicleId: vehicles[1].id,
        driverId: tech2.id,
        routeId: routes[1].id,
        status: 'EN_TRANSITO',
        startDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        startOdometerKm: 89760.2,
        riskValidationResult: JSON.stringify({ status: 'PASSED', checkedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }),
        inspectionResult: JSON.stringify({ status: 'PASSED', items: ['documentacion', 'vehiculo', 'carga'] }),
        notes: 'Transporte de gasoducto GNL-03.',
      },
    }),
    prisma.transportTrip.create({
      data: {
        companyId: company.id,
        vehicleId: vehicles[3].id,
        driverId: supervisor.id,
        routeId: routes[2].id,
        status: 'PLANIFICADO',
        startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        riskValidationResult: JSON.stringify({ status: 'PENDING' }),
        notes: 'Planificado para inspección de rutina.',
      },
    }),
    prisma.transportTrip.create({
      data: {
        companyId: company.id,
        vehicleId: vehicles[0].id,
        driverId: tech1.id,
        routeId: routes[2].id,
        status: 'BLOQUEADO',
        startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        blockingReason: 'Certificado médico de conductor vencido.',
        blockedById: admin.id,
        blockedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        riskValidationResult: JSON.stringify({ status: 'BLOCKED', reason: 'CERT_EXPIRED' }),
        notes: 'Bloqueado por incumplimiento HSE.',
      },
    }),
  ])

  // ── 18. TRANSPORT INSPECTIONS ──
  console.log('  🔍 Creando inspecciones de transporte...')

  await prisma.transportInspection.createMany({
    data: [
      {
        companyId: company.id,
        tripId: trips[0].id,
        vehicleId: vehicles[0].id,
        inspectorId: supervisor.id,
        type: 'PRE_VIAJE',
        checklistResult: JSON.stringify({
          items: [
            { id: 'documentacion', name: 'Documentación del vehículo', passed: true, notes: '' },
            { id: 'luces', name: 'Luces delanteras y traseras', passed: true, notes: '' },
            { id: 'frenos', name: 'Sistema de frenos', passed: true, notes: '' },
            { id: 'neumaticos', name: 'Neumáticos', passed: true, notes: 'Presión OK' },
            { id: 'extintor', name: 'Extintor', passed: true, notes: 'Carga OK' },
          ]
        }),
        passed: true,
        issues: JSON.stringify([]),
        photos: JSON.stringify([]),
      },
      {
        companyId: company.id,
        tripId: trips[0].id,
        vehicleId: vehicles[0].id,
        inspectorId: supervisor.id,
        type: 'POST_VIAJE',
        checklistResult: JSON.stringify({
          items: [
            { id: 'estado_general', name: 'Estado general del vehículo', passed: true, notes: '' },
            { id: 'niveles', name: 'Niveles de fluidos', passed: true, notes: '' },
            { id: 'documentacion', name: 'Documentación', passed: true, notes: '' },
          ]
        }),
        passed: true,
        issues: JSON.stringify([]),
        photos: JSON.stringify([]),
      },
      {
        companyId: company.id,
        tripId: trips[1].id,
        vehicleId: vehicles[1].id,
        inspectorId: supervisor.id,
        type: 'PRE_VIAJE',
        checklistResult: JSON.stringify({
          items: [
            { id: 'documentacion', name: 'Documentación del vehículo', passed: true, notes: '' },
            { id: 'luces', name: 'Luces delanteras y traseras', passed: true, notes: '' },
            { id: 'frenos', name: 'Sistema de frenos', passed: false, notes: 'Freno de mano con juego excesivo' },
            { id: 'neumaticos', name: 'Neumáticos', passed: true, notes: '' },
            { id: 'extintor', name: 'Extintor', passed: true, notes: '' },
            { id: 'carga', name: 'Sujeción de carga', passed: true, notes: '' },
          ]
        }),
        passed: false,
        issues: JSON.stringify([{ id: 'frenos', description: 'Freno de mano con juego excesivo', severity: 'ALTA' }]),
        photos: JSON.stringify([]),
      },
    ],
  })

  // ── 19. TRANSPORT DRIVER EVENTS (DMS) ──
  console.log('  🎯 Creando eventos de conductores (DMS)...')

  await prisma.transportDriverEvent.createMany({
    data: [
      {
        companyId: company.id,
        tripId: trips[0].id,
        driverId: tech1.id,
        vehicleId: vehicles[0].id,
        eventType: 'NORMAL',
        riskLevel: 'BAJO',
        confidence: 0.95,
        snapshotUrl: null,
        aiAnalysis: JSON.stringify({ faceDetected: true, gaze: 'FOCUSED', period: 'INITIAL' }),
        gpsLocation: JSON.stringify({ lat: 11.4043, lng: -69.6731 }),
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        isResolved: true,
        resolvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
        actionTaken: 'Monitoreo continuo - Sin anomalías',
      },
      {
        companyId: company.id,
        tripId: trips[0].id,
        driverId: tech1.id,
        vehicleId: vehicles[0].id,
        eventType: 'DISTRACCION_CELULAR',
        riskLevel: 'MEDIO',
        confidence: 0.78,
        snapshotUrl: null,
        aiAnalysis: JSON.stringify({ objectDetected: 'CELL_PHONE', duration: 8, context: 'CONDUCCION' }),
        gpsLocation: JSON.stringify({ lat: 11.5000, lng: -70.0000 }),
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
        isResolved: true,
        resolvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000),
        actionTaken: 'Alerta sonora enviada al conductor. Reporte generado.',
      },
      {
        companyId: company.id,
        tripId: trips[1].id,
        driverId: tech2.id,
        vehicleId: vehicles[1].id,
        eventType: 'FATIGA',
        riskLevel: 'ALTO',
        confidence: 0.85,
        snapshotUrl: null,
        aiAnalysis: JSON.stringify({ eyeClosure: 0.35, yawns: 3, duration: 120, period: 'MID_TRIP' }),
        gpsLocation: JSON.stringify({ lat: 11.0000, lng: -71.0000 }),
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        isResolved: false,
        actionTaken: 'Recomendación de pausa activa. Supervisor notificado.',
      },
      {
        companyId: company.id,
        tripId: trips[1].id,
        driverId: tech2.id,
        vehicleId: vehicles[1].id,
        eventType: 'NORMAL',
        riskLevel: 'BAJO',
        confidence: 0.92,
        snapshotUrl: null,
        aiAnalysis: JSON.stringify({ faceDetected: true, gaze: 'FOCUSED', period: 'INITIAL' }),
        gpsLocation: JSON.stringify({ lat: 11.7417, lng: -70.2133 }),
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        isResolved: true,
        resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        actionTaken: 'Monitoreo continuo - Sin anomalías',
      },
    ],
  })

  // ── 20. ENVIRONMENTAL INCIDENTS ──
  console.log('  🌍 Creando incidentes ambientales...')

  await prisma.environmentalIncident.createMany({
    data: [
      {
        companyId: company.id,
        reportedById: tech1.id,
        type: 'DERRAME',
        severity: 'MEDIO',
        sourceId: null,
        sourceType: 'MANUAL',
        description: 'Derrame de aceite hidráulico en área de bombas del Muelle Norte. Aproximadamente 15 litros.',
        location: JSON.stringify({ lat: 11.6158, lng: -70.2269, accuracy: 10 }),
        estimatedImpact: JSON.stringify({ area_m2: 12, soil_affected: true, water_affected: false }),
        photos: JSON.stringify([]),
        status: 'CONTENIDO',
        containmentMeasures: JSON.stringify(['Barreras de contención colocadas', 'Material absorbente aplicado']),
        remediationPlan: 'Retiro de tierra contaminada y disposición en contenedor de residuos peligrosos.',
        remediationDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        reportedById: tech2.id,
        type: 'EMISION',
        severity: 'ALTO',
        sourceId: null,
        sourceType: 'SENSOR',
        description: 'Emisión de gas detectada por sensor LEV en área de tanques de Amuay. Niveles de H2S elevados.',
        location: JSON.stringify({ lat: 11.7417, lng: -70.2133, accuracy: 5 }),
        estimatedImpact: JSON.stringify({ affected_zone_m2: 200, evacuation_required: true }),
        photos: JSON.stringify([]),
        status: 'EN_INVESTIGACION',
        containmentMeasures: JSON.stringify(['Evacuación parcial del área', 'Válvulas de aislamiento cerradas']),
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        reportedById: supervisor.id,
        type: 'RESIDUO_PELIGROSO',
        severity: 'BAJO',
        sourceId: null,
        sourceType: 'MANUAL',
        description: 'Contenedor de residuos peligrosos sin etiquetar en área de taller de mantenimiento.',
        location: JSON.stringify({ lat: 11.4043, lng: -69.6731, accuracy: 8 }),
        estimatedImpact: JSON.stringify({ risk: 'BAJO' }),
        photos: JSON.stringify([]),
        status: 'REPORTADO',
        containmentMeasures: JSON.stringify(['Área aislada', 'Etiquetas solicitadas']),
        createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        reportedById: admin.id,
        type: 'CONTAMINACION_AGUA',
        severity: 'CRITICO',
        sourceId: null,
        sourceType: 'TRANSPORT_INCIDENT',
        description: 'Vuelco de vehículo de transporte en ruta Amuay - Tía Juana. Derrame de combustible cerca de cuerpo de agua.',
        location: JSON.stringify({ lat: 11.2000, lng: -71.0000, accuracy: 15 }),
        estimatedImpact: JSON.stringify({ water_affected: true, area_m2: 500, aquatic_life_risk: true }),
        photos: JSON.stringify([]),
        status: 'EN_INVESTIGACION',
        containmentMeasures: JSON.stringify(['Barreras absorbentes', 'Equipo de contención desplegado']),
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 21. ENVIRONMENTAL ASSESSMENTS ──
  console.log('  📊 Creando evaluaciones ambientales...')

  await prisma.environmentalAssessment.createMany({
    data: [
      {
        companyId: company.id,
        title: 'Evaluación de Impacto Ambiental - Ampliación Muelle Norte',
        type: 'IMPACTO_AMBIENTAL',
        status: 'APROBADO',
        description: 'Evaluación completa del impacto ambiental para la ampliación del muelle de carga en Punta Cardón.',
        location: JSON.stringify({ lat: 11.6158, lng: -70.2269, radius: 500 }),
        scope: JSON.stringify({ area_m2: 10000, duration_months: 6, phases: ['CONSTRUCCION', 'OPERACION'] }),
        findings: JSON.stringify([
          'Impacto moderado en ecosistema marino costero',
          'Aumento de tráfico vehicular en un 15%',
          'Ruido durante construcción dentro de límites permitidos'
        ]),
        recommendations: JSON.stringify([
          'Implementar barreras de sedimentación durante construcción',
          'Programa de monitoreo de calidad de agua mensual',
          'Plan de gestión de residuos de construcción'
        ]),
        approvedById: admin.id,
        approvedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        nextReviewDate: new Date(now.getTime() + 330 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        title: 'Evaluación de Riesgo Hidrocarburo - Refinería Amuay',
        type: 'RIESGO_HIDROCARBURO',
        status: 'EN_REVISION',
        description: 'Evaluación de riesgos asociados al manejo de hidrocarburos en el área de tanques de la Refinería Amuay.',
        location: JSON.stringify({ lat: 11.7417, lng: -70.2133, radius: 300 }),
        scope: JSON.stringify({ area_m2: 5000, assets: ['TANQUES', 'BOMBAS', 'TUBERIAS'] }),
        findings: JSON.stringify([
          'Riesgo alto de fuga en válvulas del área TK-501',
          'Sistema de detección de gas requiere actualización',
          'Plan de contingencia desactualizado'
        ]),
        recommendations: JSON.stringify([
          'Reemplazo de válvulas en TK-501 antes de 6 meses',
          'Actualizar sistema de detección de gas a versión 3.0',
          'Revisar y actualizar plan de contingencia'
        ]),
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        nextReviewDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        title: 'Monitoreo de Emisiones - Terminal de Gas Tía Juana',
        type: 'EMISIONES',
        status: 'BORRADOR',
        description: 'Monitoreo trimestral de emisiones de gas en terminal de Tía Juana.',
        location: JSON.stringify({ lat: 10.5333, lng: -71.3333, radius: 150 }),
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        nextReviewDate: new Date(now.getTime() + 88 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 22. ENVIRONMENTAL METRICS ──
  console.log('  📈 Creando métricas ambientales...')

  await prisma.environmentalMetric.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Emisiones CO2 - Estación Compresora Tía Juana',
        type: 'CO2',
        unit: 'ppm',
        currentValue: 410.5,
        thresholdWarning: 400,
        thresholdCritical: 500,
        measurementDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        source: 'SENSOR',
        sensorId: sensors[6].id,
        locationId: loc3.id,
        notes: 'Medición por sensor de emisiones',
      },
      {
        companyId: company.id,
        name: 'Nivel de Ruido - Muelle Norte',
        type: 'RUIDO_DB',
        unit: 'dB',
        currentValue: 72.3,
        thresholdWarning: 75,
        thresholdCritical: 90,
        measurementDate: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        source: 'MANUAL',
        locationId: loc1.id,
        notes: 'Medición manual durante operación de grúa',
      },
      {
        companyId: company.id,
        name: 'pH Agua de Enfriamiento - Refinería Amuay',
        type: 'PH_AGUA',
        unit: 'pH',
        currentValue: 7.2,
        thresholdWarning: 6.5,
        thresholdCritical: 5.5,
        measurementDate: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        source: 'MANUAL',
        locationId: loc2.id,
        notes: 'Muestra de agua de enfriamiento del sistema de torres',
      },
      {
        companyId: company.id,
        name: 'Turbidez Agua Residual - Terminal Gas',
        type: 'TURBIDEZ',
        unit: 'NTU',
        currentValue: 2.8,
        thresholdWarning: 5,
        thresholdCritical: 10,
        measurementDate: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        source: 'MANUAL',
        locationId: loc3.id,
        notes: 'Medición en efluente tratado',
      },
      {
        companyId: company.id,
        name: 'SO2 - Chimenea Incinerador Amuay',
        type: 'SO2',
        unit: 'ppm',
        currentValue: 85.0,
        thresholdWarning: 100,
        thresholdCritical: 150,
        measurementDate: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        source: 'SENSOR',
        sensorId: sensors[2].id,
        locationId: loc2.id,
        notes: 'Monitoreo continuo de emisiones de chimenea',
      },
    ],
  })

  // ── 23. HSE EVENT LOGS ──
  console.log('  📝 Creando logs de eventos HSE...')

  await prisma.hSEEventLog.createMany({
    data: [
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-001`,
        sourceModule: 'TRANSPORT',
        eventType: 'TRIP_STARTED',
        severity: 'INFO',
        title: 'Inicio de viaje programado',
        description: 'Viaje SIC-TRIP-001 iniciado con vehículo AB123CD desde Almacén Coro hacia Muelle Norte.',
        metadata: JSON.stringify({ tripId: trips[0].id, vehicle: 'AB123CD', driver: 'Antonio Fernández' }),
        actorId: tech1.id,
        actorName: 'Antonio Fernández',
        relatedEntityId: trips[0].id,
        relatedEntityType: 'TRANSPORT_TRIP',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-002`,
        sourceModule: 'TRANSPORT',
        eventType: 'TRIP_BLOCKED',
        severity: 'HIGH',
        title: 'Viaje bloqueado por incumplimiento HSE',
        description: 'Viaje planificado para Campamento - Plataforma bloqueado por certificado médico vencido del conductor.',
        metadata: JSON.stringify({ tripId: trips[3].id, vehicle: 'AB123CD', reason: 'CERT_EXPIRED' }),
        actorId: admin.id,
        actorName: 'Rafael Martínez',
        relatedEntityId: trips[3].id,
        relatedEntityType: 'TRANSPORT_TRIP',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-003`,
        sourceModule: 'TRANSPORT',
        eventType: 'DRIVER_ALERT',
        severity: 'WARNING',
        title: 'Alerta de fatiga detectada',
        description: 'Sistema DMS detectó signos de fatiga en conductor durante viaje Amuay - Tía Juana.',
        metadata: JSON.stringify({ driver: 'Daniel Colmenares', eventType: 'FATIGA', confidence: 0.85 }),
        actorId: tech2.id,
        actorName: 'Daniel Colmenares',
        relatedEntityType: 'TRANSPORT_DRIVER_EVENT',
        createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-004`,
        sourceModule: 'ENVIRONMENT',
        eventType: 'INCIDENT_REPORTED',
        severity: 'CRITICAL',
        title: 'Incidente ambiental reportado - Derrame de combustible',
        description: 'Vuelco de vehículo con derrame de combustible cerca de cuerpo de agua en ruta Amuay - Tía Juana.',
        metadata: JSON.stringify({ incidentType: 'CONTAMINACION_AGUA', severity: 'CRITICO' }),
        actorId: admin.id,
        actorName: 'Rafael Martínez',
        relatedEntityType: 'ENVIRONMENTAL_INCIDENT',
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-005`,
        sourceModule: 'ENVIRONMENT',
        eventType: 'CONTAINMENT_ACTIVATED',
        severity: 'HIGH',
        title: 'Medidas de contención activadas',
        description: 'Barreras de contención y material absorbente desplegados para incidente de derrame en Muelle Norte.',
        metadata: JSON.stringify({ incidentType: 'DERRAME', measures: ['Barreras', 'Material absorbente'] }),
        actorId: tech1.id,
        actorName: 'Antonio Fernández',
        relatedEntityType: 'ENVIRONMENTAL_INCIDENT',
        createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        eventId: `EVT-${Date.now()}-006`,
        sourceModule: 'SCADA',
        eventType: 'SENSOR_ALERT',
        severity: 'CRITICAL',
        title: 'Alerta crítica de gas H2S',
        description: 'Detector de H2S en Muelle Norte registró 8.2% LEL, superando umbral crítico.',
        metadata: JSON.stringify({ sensor: 'Gas H2S Muelle Norte', value: 8.2, threshold: 10.0 }),
        relatedEntityId: sensors[1].id,
        relatedEntityType: 'SENSOR',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 24. KNOWLEDGE BASE (nuevos para Transporte y Ambiente) ──
  console.log('  📚 Agregando entradas a Knowledge Base para Transporte y Ambiente...')

  await prisma.knowledgeBase.createMany({
    data: [
      // Transporte
      {
        errorCode: 'TRIP-BLOCKED-CERT',
        category: 'TRANSPORT',
        title: 'Viaje bloqueado por certificado vencido',
        rootCause: 'El conductor tiene un certificado médico o licencia de conducir vencida que impide la autorización del viaje.',
        appliedSolution: '1. Revisar el documento vencido en el perfil del conductor.\n2. Programar cita médica o renovación de licencia.\n3. Actualizar el documento en el sistema.\n4. Re-evaluar el viaje una vez que el documento esté vigente.',
        severity: 'HIGH',
        timesUsed: 3,
      },
      {
        errorCode: 'INSPECTION-FAILED',
        category: 'TRANSPORT',
        title: 'Inspección de vehículo fallida',
        rootCause: 'El vehículo no pasó la inspección pre-viaje debido a fallas mecánicas, falta de documentación o condiciones inseguras.',
        appliedSolution: '1. Revisar el checklist de inspección para identificar el ítem fallido.\n2. Programar mantenimiento correctivo del vehículo.\n3. Completar la documentación faltante.\n4. Realizar una nueva inspección después de corregir las deficiencias.',
        severity: 'MEDIUM',
        timesUsed: 2,
      },
      {
        errorCode: 'DMS-FATIGUE-ALERT',
        category: 'TRANSPORT',
        title: 'Alerta de fatiga en conductor (DMS)',
        rootCause: 'El sistema de monitoreo de conductor detectó signos de fatiga como parpadeo prolongado, bostezos o desviación del carril.',
        appliedSolution: '1. Notificar al conductor para que tome una pausa activa de 15-30 minutos.\n2. Verificar las horas de conducción acumuladas.\n3. Si la fatiga persiste, reemplazar al conductor por uno de relevo.\n4. Registrar el incidente en el sistema de salud ocupacional.',
        severity: 'HIGH',
        timesUsed: 4,
      },
      {
        errorCode: 'DMS-DISTRACTION-ALERT',
        category: 'TRANSPORT',
        title: 'Alerta de distracción en conductor (DMS)',
        rootCause: 'El sistema detectó que el conductor está distraído usando el teléfono celular o manipulando objetos mientras conduce.',
        appliedSolution: '1. Enviar alerta sonora al conductor para corregir la conducta.\n2. Si el incidente es recurrente, escalar al supervisor.\n3. Programar sesión de capacitación sobre conducción segura.\n4. Documentar el incidente en el registro de eventos de conductor.',
        severity: 'MEDIUM',
        timesUsed: 2,
      },
      // Ambiente
      {
        errorCode: 'ENV-SPILL',
        category: 'ENVIRONMENT',
        title: 'Derrame de sustancia peligrosa',
        rootCause: 'Fuga o derrame de hidrocarburos, químicos o residuos peligrosos durante operaciones de carga/descarga o transporte.',
        appliedSolution: '1. Activar protocolo de emergencia y contener el derrame inmediatamente.\n2. Notificar al departamento de HSE y coordinador ambiental.\n3. Aplicar material absorbente y/o barreras de contención.\n4. Realizar muestreo de suelo/agua afectado.\n5. Iniciar proceso de remediación del área impactada.',
        severity: 'CRITICAL',
        timesUsed: 2,
      },
      {
        errorCode: 'ENV-EMISSION-EXCEEDED',
        category: 'ENVIRONMENT',
        title: 'Emisión de gas supera límite permitido',
        rootCause: 'Los niveles de emisión de CO2, SO2, NOx u otros gases superan los límites establecidos por normativa ambiental.',
        appliedSolution: '1. Identificar la fuente de emisión (chimenea, venteo, compresora).\n2. Verificar el funcionamiento de los sistemas de control de emisiones.\n3. Si es necesario, detener la operación del equipo que causa la emisión.\n4. Notificar al ente regulador ambiental.\n5. Implementar medidas correctivas antes de reanudar operaciones.',
        severity: 'HIGH',
        timesUsed: 1,
      },
      {
        errorCode: 'ENV-ASSESSMENT-EXPIRED',
        category: 'ENVIRONMENT',
        title: 'Evaluación ambiental expirada o pendiente',
        rootCause: 'La evaluación de impacto ambiental o estudio de riesgo ha expirado y requiere renovación o actualización.',
        appliedSolution: '1. Revisar fecha de vencimiento en el registro de evaluaciones.\n2. Coordinar con consultor ambiental para actualización.\n3. Planificar nuevo estudio considerando cambios operativos.\n4. Obtener aprobación de la autoridad ambiental competente.',
        severity: 'MEDIUM',
        timesUsed: 1,
      },
      {
        errorCode: 'ENV-WASTE-MANAGEMENT',
        category: 'ENVIRONMENT',
        title: 'Gestión inadecuada de residuos',
        rootCause: 'Los residuos peligrosos no están siendo segregados, etiquetados o dispuestos correctamente según la normativa aplicable.',
        appliedSolution: '1. Verificar los puntos de generación de residuos.\n2. Implementar programa de segregación en la fuente.\n3. Asegurar que los contenedores estén correctamente etiquetados.\n4. Verificar que los manifiestos de disposición estén vigentes.\n5. Realizar auditoría periódica del sistema de gestión de residuos.',
        severity: 'HIGH',
        timesUsed: 1,
      },
    ],
  })
  console.log('  ✅ Knowledge Base actualizada con 8 nuevas entradas (Transporte y Ambiente)')

  // ── DONE ──
  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('  ✅ SEED COMPLETADO — Empresa C (Suministros IT Consarve) creada exitosamente')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log('📋 CREDENCIALES DE ACCESO:')
  console.log('')
  console.log('  🔑 ADMIN (Full Access):')
  console.log('     Email:    admin@suministrosit.com')
  console.log('     Password: Admin@2024')
  console.log('')
  console.log('  👷 SUPERVISOR:')
  console.log('     Email:    jesus@suministrosit.com')
  console.log('     Password: Demo1234')
  console.log('')
  console.log('  🔧 TÉCNICOS:')
  console.log('     Email:    antonio@suministrosit.com')
  console.log('     Password: Demo1234')
  console.log('     Email:    daniel@suministrosit.com')
  console.log('     Password: Demo1234')
  console.log('')
  console.log('  📊 GERENTE:')
  console.log('     Email:    carmen@suministrosit.com')
  console.log('     Password: Demo1234')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  📊 DATOS CREADOS:')
  console.log('     • 5 usuarios (1 admin, 1 supervisor, 2 técnicos, 1 gerente)')
  console.log('     • 4 ubicaciones (Muelle Cardón, Amuay, Tía Juana, Campamento Coro)')
  console.log('     • 8 sensores SCADA con 50 lecturas cada uno')
  console.log('     • 10 documentos HSE (3 expirados/vencidos, 2 por renovar)')
  console.log('     • 12 permisos de trabajo (5 aprobados, 3 pendientes, 2 rechazados, 1 cancelado)')
  console.log('     • 15 alertas de sistema (5 sensor, 2 geofence, 3 sistema, 2 seguridad, 3 suscripción)')
  console.log('     • 15 entradas en Base de Conocimiento (5 sensor, 2 geofence, 3 suscripción, 3 sistema, 2 seguridad)')
  console.log('     • 12 registros de auditoría')
  console.log('')
  console.log('  🆕 NUEVOS MÓDULOS:')
  console.log('     • 3 ubicaciones de inventario')
  console.log('     • 6 ítems de inventario con stock en 3 ubicaciones')
  console.log('     • 5 vehículos de transporte (camión, tractor, camioneta, pickup, equipo especial)')
  console.log('     • 3 conductores con licencias y certificados')
  console.log('     • 3 rutas de transporte con waypoints y checkpoints HSE')
  console.log('     • 4 viajes (completado, en tránsito, planificado, bloqueado)')
  console.log('     • 3 inspecciones de vehículos (2 pre-viaje, 1 post-viaje)')
  console.log('     • 4 eventos de conductor DMS (fatiga, distracción, normal)')
  console.log('     • 4 incidentes ambientales (derrame, emisión, residuo, contaminación agua)')
  console.log('     • 3 evaluaciones ambientales (impacto, riesgo hidrocarburo, emisiones)')
  console.log('     • 5 métricas ambientales (CO2, ruido, pH, turbidez, SO2)')
  console.log('     • 6 eventos HSE (transporte y ambiente)')
  console.log('     • 8 nuevas entradas en Knowledge Base (transporte y ambiente)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  ⚠️  Para ver el GOC, usa la cuenta SUPER_ADMIN:')
  console.log('     Email:    superadmin@energycompliance.com')
  console.log('     Password: admin123')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })