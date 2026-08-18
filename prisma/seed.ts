import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Seed Demo GOC — Creando Empresa B con datos de demostración...')

  const now = new Date()

  // ── 1. Empresa B: PetrolinkVZLA Industrial ──
  const companyB = await prisma.company.create({
    data: {
      name: 'PetrolinkVZLA Industrial C.A.',
      taxId: 'J-402156789-0',
      email: 'admin@petrolinkvzla.com',
      phone: '+58 412-555-0100',
      address: 'Punta Cardón, Estado Falcón, Venezuela',
      logo: null,
      subscriptionPlan: 'enterprise',
      subscriptionStatus: 'ACTIVE',
      billingCycle: 'monthly',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxUsers: 500,
      maxPermitsPerMonth: 100000,
      isActive: true,
      scadaDemoMode: true,
    },
  })

  // ── 2. Usuarios de Empresa B ──
  const passAdmin = await hash('Admin@2024', 10)
  const passUser = await hash('Demo1234', 10)

  const adminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: 'admin@petrolinkvzla.com',
      passwordHash: passAdmin,
      name: 'Rafael Martínez',
      role: 'ADMIN',
      phone: '+58 412-555-0101',
    },
  })

  const supervisorB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: 'jesus@petrolinkvzla.com',
      passwordHash: passUser,
      name: 'Jesús Ramírez',
      role: 'SUPERVISOR',
      phone: '+58 414-555-0201',
    },
  })

  const techB1 = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: 'antonio@petrolinkvzla.com',
      passwordHash: passUser,
      name: 'Antonio Fernández',
      role: 'TECHNICIAN',
      phone: '+58 416-555-0301',
    },
  })

  const techB2 = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: 'daniel@petrolinkvzla.com',
      passwordHash: passUser,
      name: 'Daniel Colmenares',
      role: 'TECHNICIAN',
      phone: '+58 416-555-0302',
    },
  })

  const managerB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: 'carmen@petrolinkvzla.com',
      passwordHash: passUser,
      name: 'Carmen Delgado',
      role: 'MANAGER',
      phone: '+58 414-555-0401',
    },
  })

  // ── 3. Ubicaciones de Empresa B ──
  const locB1 = await prisma.workLocation.create({
    data: {
      companyId: companyB.id,
      name: 'Plataforma Cardón - Muelle Norte',
      address: 'Punta Cardón, Pto. Falcón, Muelle Principal',
      latitude: 11.6158,
      longitude: -70.2269,
      radiusMeters: 200,
      verificationMethod: 'GPS',
    },
  })

  const locB2 = await prisma.workLocation.create({
    data: {
      companyId: companyB.id,
      name: 'Refinería Amuay - Área de Tanques',
      address: 'Complejo Refinador Paraguaná, Amuay',
      latitude: 11.7417,
      longitude: -70.2133,
      radiusMeters: 300,
      verificationMethod: 'GPS',
    },
  })

  const locB3 = await prisma.workLocation.create({
    data: {
      companyId: companyB.id,
      name: 'Terminal de Gas - Tía Juana',
      address: 'Tía Juana, Edo. Zulia',
      latitude: 10.5333,
      longitude: -71.3333,
      radiusMeters: 150,
      verificationMethod: 'GPS',
    },
  })

  const locB4 = await prisma.workLocation.create({
    data: {
      companyId: companyB.id,
      name: 'Campamento Base - Coro',
      address: 'Av. Industrial, Coro, Edo. Falcón',
      latitude: 11.4043,
      longitude: -69.6731,
      radiusMeters: 100,
      verificationMethod: 'GPS',
    },
  })

  // ── 4. Sensores SCADA (8 sensores, 4 ubicaciones) ──
  const sensorsB = await Promise.all([
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB1.id,
        name: 'Presión Línea Carguero PC-01', type: 'PRESION', unit: 'psi',
        thresholdCritical: 120, thresholdWarning: 95,
        currentValue: 88.5, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB1.id,
        name: 'Gas H2S Muelle Norte', type: 'GAS', unit: '%LEL',
        thresholdCritical: 10.0, thresholdWarning: 5.0,
        currentValue: 2.1, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB2.id,
        name: 'Temperatura Tanque TK-501', type: 'TEMPERATURA', unit: '°C',
        thresholdCritical: 85, thresholdWarning: 70,
        currentValue: 58.3, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB2.id,
        name: 'Presión Vapor TK-501', type: 'PRESION', unit: 'psi',
        thresholdCritical: 45, thresholdWarning: 35,
        currentValue: 28.7, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB2.id,
        name: 'Detector Gas LEV Amuay', type: 'GAS', unit: '%LEL',
        thresholdCritical: 20.0, thresholdWarning: 10.0,
        currentValue: 4.3, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB3.id,
        name: 'Presión Gasoducto GNL-03', type: 'PRESION', unit: 'psi',
        thresholdCritical: 1500, thresholdWarning: 1200,
        currentValue: 980.0, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB3.id,
        name: 'Voltaje Estación Compresora', type: 'VOLTAJE', unit: 'V',
        thresholdCritical: 480, thresholdWarning: 440,
        currentValue: 416.0, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
    prisma.sensor.create({
      data: {
        companyId: companyB.id, locationId: locB4.id,
        name: 'Temperatura Ambiente Campamento', type: 'TEMPERATURA', unit: '°C',
        thresholdCritical: 42, thresholdWarning: 38,
        currentValue: 33.5, isSimulated: true, isActive: true, lastReadingAt: now,
      },
    }),
  ])

  // Generate 50 readings per sensor
  const readingsData: Array<{ sensorId: string; value: number; status: string; timestamp: Date }> = []
  for (const sensor of sensorsB) {
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
        companyId: companyB.id, userId: techB1.id,
        title: 'Certificado Médico - Antonio Fernández',
        documentType: 'certificado_medico', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'EXPIRED',
        issueDate: new Date('2023-09-01'), expiryDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        holderName: 'Antonio Fernández',
      },
      {
        companyId: companyB.id, userId: techB2.id,
        title: 'Certificado Médico - Daniel Colmenares',
        documentType: 'certificado_medico', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-03-15'), expiryDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
        holderName: 'Daniel Colmenares',
      },
      {
        companyId: companyB.id,
        title: 'Licencia de Operación Industrial - Refinería Amuay',
        documentType: 'licencia_operativa', category: 'LEGAL', criticality: 'CRITICAL',
        status: 'PENDING_RENEWAL',
        issueDate: new Date('2022-01-15'), expiryDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: companyB.id,
        title: 'Permiso Ambiental MINAMB - Terminal Gas',
        documentType: 'permiso_ambiental', category: 'AMBIENTAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'), expiryDate: new Date('2026-01-01'),
      },
      {
        companyId: companyB.id, userId: supervisorB.id,
        title: 'Curso Trabajo en Altura IV - Jesús Ramírez',
        documentType: 'curso_altura', category: 'PERSONAL', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-06-01'), expiryDate: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
        holderName: 'Jesús Ramírez',
      },
      {
        companyId: companyB.id, userId: techB1.id,
        title: 'Curso Riesgo Eléctrico - Antonio Fernández',
        documentType: 'curso_electrico', category: 'PERSONAL', criticality: 'NORMAL',
        status: 'EXPIRED',
        issueDate: new Date('2023-02-10'), expiryDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        holderName: 'Antonio Fernández',
      },
      {
        companyId: companyB.id,
        title: 'Seguro Riesgos Laborales - PetrolinkVZLA',
        documentType: 'seguro_rst', category: 'LEGAL', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'), expiryDate: new Date('2025-06-30'),
      },
      {
        companyId: companyB.id, userId: techB2.id,
        title: 'Curso Espacios Confinados - Daniel Colmenares',
        documentType: 'curso_confinado', category: 'PERSONAL', criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-08-01'), expiryDate: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
        holderName: 'Daniel Colmenares',
      },
      {
        companyId: companyB.id,
        title: 'Inspección Extintores Muelle Norte',
        documentType: 'inspeccion_extintores', category: 'EQUIPOS', criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-10-01'), expiryDate: new Date('2025-10-01'),
      },
      {
        companyId: companyB.id,
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
        companyId: companyB.id, permitNumber: 'PLV-2025-0001',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, briefing_completed: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Muelle Norte - Grúa Gantry', workDescription: 'Inspección de cables de izamiento en grúa pórtico. Lubricación de poleas y verificación de límites de carga.',
        workLatitude: 11.6158, workLongitude: -70.2269, workRadius: 200, locationSource: 'gps', workLocationId: locB1.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisorB.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6158, longitude: -70.2269, accuracy: 8 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6159, longitude: -70.2268, accuracy: 12 } }),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0002',
        riskType: 'ELECTRICO', status: 'PENDING',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: true, voltage_tested: true, has_first_aid_kit: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Subestación Amuay - Tablero SE-12', workDescription: 'Mantenimiento preventivo en tablero de distribución SE-12. Verificación de conexiones y torqueo de barras.',
        workLatitude: 11.7417, workLongitude: -70.2133, workRadius: 300, locationSource: 'gps', workLocationId: locB2.id,
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7417, longitude: -70.2133, accuracy: 10 } }),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0003',
        riskType: 'CONFINADO', status: 'APPROVED',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: true, rescue_team_standing: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Tanque TK-501 - Amuay', workDescription: 'Inspección interna de tanque de almacenamiento. Medición de espesores de placa y revisión de revestimiento anti-corrosivo.',
        workLatitude: 11.7417, workLongitude: -70.2133, workRadius: 300, locationSource: 'gps', workLocationId: locB2.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisorB.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7417, longitude: -70.2133, accuracy: 6 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.7418, longitude: -70.2134, accuracy: 9 } }),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0004',
        riskType: 'CALIENTE', status: 'REJECTED',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: false, has_first_aid_kit: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Rafael Martínez',
        workLocation: 'Taller Mecánico Campamento', workDescription: 'Soldadura de soporte para tubería de drenaje en taller de mantenimiento.',
        rejectionReason: 'Zona de trabajo caliente no despejada. Materiales inflamables detectados a 3m del área de soldadura.',
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        rejectedById: adminB.id, rejectedByName: 'Rafael Martínez', rejectedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0005',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, buddy_system: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Torre de Enfriamiento Tía Juana', workDescription: 'Pintura anticorrosiva en estructura superior de torre de enfriamiento. Inspección de aletas de intercambio.',
        workLatitude: 10.5333, workLongitude: -71.3333, workRadius: 150, locationSource: 'gps', workLocationId: locB3.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisorB.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 10.5333, longitude: -71.3333, accuracy: 14 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 10.5334, longitude: -71.3332, accuracy: 11 } }),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0006',
        riskType: 'CONFINADO', status: 'PENDING',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: false }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Sistema de Drenaje Pluvial - Amuay', workDescription: 'Inspección de cámara de drenaje pluvial para verificar integridad estructural.',
        workLocationId: locB2.id,
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0007',
        riskType: 'CALIENTE', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: true, has_first_aid_kit: true, fire_watch_60min: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Rafael Martínez',
        workLocation: 'Muelle Norte - Área de Soldadura', workDescription: 'Reparación de deflector en barandilla del muelle. Corte y soldadura con electrodos E-7018.',
        workLatitude: 11.6158, workLongitude: -70.2269, workRadius: 200, locationSource: 'gps', workLocationId: locB1.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: adminB.id, approvedByName: 'Rafael Martínez', approvedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6158, longitude: -70.2269, accuracy: 7 } }),
        supervisorSignature: JSON.stringify({ data: 'sig_base64_...', gps: { latitude: 11.6159, longitude: -70.2270, accuracy: 10 } }),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0008',
        riskType: 'ELECTRICO', status: 'CANCELLED',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Estación Compresora Tía Juana', workDescription: 'Reemplazo de breaker principal de estación compresora de gas.',
        workLocationId: locB3.id,
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0009',
        riskType: 'ALTURA', status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, weather_check: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Jesús Ramírez',
        workLocation: 'Chimenea Incinerador - Amuay', workDescription: 'Inspección de revestimiento refractario en chimenea de incinerador. Mediciones de temperatura en línea.',
        workLocationId: locB2.id,
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        approvedById: supervisorB.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0010',
        riskType: 'CALIENTE', status: 'PENDING',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, hot_work_zone_clear: true, has_first_aid_kit: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Taller Mecánico - Campamento Coro', workDescription: 'Fabricación de brida especial para acople de tubería de gas de 8 pulgadas.',
        workLocationId: locB4.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0011',
        riskType: 'CONFINADO', status: 'APPROVED',
        safetyChecks: JSON.stringify({ atmosphere_monitored: true, has_entry_permit: true, has_first_aid_kit: true, rescue_team_standing: true, continuous_ventilation: true }),
        technicianName: 'Antonio Fernández', supervisorName: 'Jesús Ramírez',
        workLocation: 'Separador de Agua - Oleoducto', workDescription: 'Limpieza e inspección de separador agua-aceite. Verificación de internos y placa de orificio.',
        workLocationId: locB1.id,
        createdById: techB1.id, createdByName: 'Antonio Fernández', createdByRole: 'TECHNICIAN',
        approvedById: supervisorB.id, approvedByName: 'Jesús Ramírez', approvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        companyId: companyB.id, permitNumber: 'PLV-2025-0012',
        riskType: 'ELECTRICO', status: 'REJECTED',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: false, voltage_tested: true }),
        technicianName: 'Daniel Colmenares', supervisorName: 'Rafael Martínez',
        workLocation: 'Panel Control Bombas - Muelle', workDescription: 'Mantenimiento correctivo en panel de control de bombas de transferencia de crudo.',
        rejectionReason: 'EPP dieléctrico no disponible. No se puede proceder sin guantes y botas dieléctricas certificadas.',
        createdById: techB2.id, createdByName: 'Daniel Colmenares', createdByRole: 'TECHNICIAN',
        rejectedById: adminB.id, rejectedByName: 'Rafael Martínez', rejectedAt: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      },
    ],
  })

  // ── 7. SYSTEM ALERTS (GOC) — Lo que realmente alimenta el panel ──
  const alertsData = [
    // SENSOR_CRITICAL alerts (varios)
    {
      companyId: companyB.id,
      type: 'SENSOR_CRITICAL', severity: 'CRITICAL',
      title: 'Gas H2S - Nivel Crítico Muelle Norte',
      message: 'Detector de H2S en Muelle Norte registró 8.2% LEL, superando umbral crítico de 10% LEL. Evacuación del área iniciada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-H2S-CRIT', sensorName: 'Gas H2S Muelle Norte', sensorType: 'GAS', value: 8.2, unit: '%LEL', threshold: 10.0, location: 'Muelle Norte' }),
      isAcknowledged: false,
      relatedEntityId: sensorsB[1].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SENSOR_CRITICAL', severity: 'HIGH',
      title: 'Temperatura Tanque TK-501 - Aviso Alto',
      message: 'Temperatura del Tanque TK-501 alcanzó 72°C, umbral de advertencia es 70°C. Monitoreo intensificado activado.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-TEMP-HIGH', sensorName: 'Temperatura Tanque TK-501', sensorType: 'TEMPERATURA', value: 72.0, unit: '°C', thresholdWarning: 70, location: 'Amuay' }),
      isAcknowledged: false,
      relatedEntityId: sensorsB[2].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SENSOR_CRITICAL', severity: 'CRITICAL',
      title: 'Gas LEV Amuay - Umbral Crítico Excedido',
      message: 'Detector LEV en área de tanques de Amuay registró 22% LEL. Zona evacuada. Brigada de emergencia desplegada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-GAS-LEV-CRIT', sensorName: 'Detector Gas LEV Amuay', sensorType: 'GAS', value: 22.0, unit: '%LEL', threshold: 20.0, location: 'Amuay' }),
      isAcknowledged: true,
      relatedEntityId: sensorsB[4].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SENSOR_CRITICAL', severity: 'MEDIUM',
      title: 'Voltaje Compresora - Fluctuación Detectada',
      message: 'Voltaje en estación compresora fluctuando entre 410V-435V. Umbral de advertencia: 440V. Monitoreo continuo activo.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-VOLT-FLUCT', sensorName: 'Voltaje Estación Compresora', sensorType: 'VOLTAJE', value: 428.0, unit: 'V', thresholdWarning: 440, location: 'Tía Juana' }),
      isAcknowledged: false,
      relatedEntityId: sensorsB[6].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SENSOR_CRITICAL', severity: 'HIGH',
      title: 'Presión Gasoducto GNL-03 - Lectura Anómala',
      message: 'Presión del gasoducto GNL-03 registró pico de 1,350 psi. Umbral de advertencia: 1,200 psi. Válvula de seguridad activada.',
      metadata: JSON.stringify({ errorCode: 'SENSOR-PRES-ANOM', sensorName: 'Presión Gasoducto GNL-03', sensorType: 'PRESION', value: 1350.0, unit: 'psi', thresholdWarning: 1200, location: 'Tía Juana' }),
      isAcknowledged: false,
      relatedEntityId: sensorsB[5].id, relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },

    // GEOFENCE_BREACH alerts
    {
      companyId: companyB.id,
      type: 'GEOFENCE_BREACH', severity: 'CRITICAL',
      title: 'Violación de Geocerca - Supervisor fuera de zona',
      message: 'Jesús Ramírez aprobó permiso PLV-2025-0001 a 450m del sitio de trabajo (radio: 200m). Justificación requerida.',
      metadata: JSON.stringify({ errorCode: 'GEOFENCE-SUP-OOR', permitNumber: 'PLV-2025-0001', supervisorName: 'Jesús Ramírez', distanceMeters: 450, allowedRadius: 200, workLocation: 'Muelle Norte' }),
      isAcknowledged: false,
      relatedEntityType: 'PERMIT',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'GEOFENCE_BREACH', severity: 'HIGH',
      title: 'Técnico fuera de geocerca - Amuay',
      message: 'Antonio Fernández intentó firmar permiso desde ubicación 350m fuera del área autorizada en Amuay. Firma bloqueada.',
      metadata: JSON.stringify({ errorCode: 'GEOFENCE-TECH-OOR', permitNumber: 'PLV-2025-0003', technicianName: 'Antonio Fernández', distanceMeters: 350, allowedRadius: 300, workLocation: 'Amuay' }),
      isAcknowledged: false,
      relatedEntityType: 'PERMIT',
      createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
    },

    // SYSTEM_ERROR alerts
    {
      companyId: companyB.id,
      type: 'SYSTEM_ERROR', severity: 'MEDIUM',
      title: 'Error en sincronización de sensores',
      message: 'Fallo en la comunicación con gateway de sensores en Tía Juana. Último dato recibido hace 15 minutos. Reconexión automática en progreso.',
      metadata: JSON.stringify({ errorCode: 'ERR_SENSOR_COMM_01', gateway: 'TIA-JUANA-GW-03', lastDataAge: 900, retryCount: 3 }),
      isAcknowledged: false,
      relatedEntityType: 'SENSOR',
      createdAt: new Date(now.getTime() - 15 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SYSTEM_ERROR', severity: 'LOW',
      title: 'Servicio de reportes - Timeout',
      message: 'Generación de reporte mensual excedió el tiempo límite de 30 segundos. Reporte se regenerará en el próximo ciclo.',
      metadata: JSON.stringify({ errorCode: 'ERR_REPORT_TIMEOUT', reportType: 'monthly', timeoutSeconds: 30 }),
      isAcknowledged: true,
      relatedEntityType: 'SYSTEM',
      createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
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
      companyId: companyB.id,
      type: 'SECURITY_BREACH', severity: 'CRITICAL',
      title: 'Intento de acceso no autorizado - Múltiples intentos',
      message: 'Se detectaron 12 intentos fallidos de login para el usuario admin@petrolinkvzla.com desde IP 45.227.xxx.xxx (Brasil). Cuenta temporalmente bloqueada.',
      metadata: JSON.stringify({ errorCode: 'ERR_AUTH_BRUTE_01', targetEmail: 'admin@petrolinkvzla.com', attempts: 12, sourceIp: '45.227.xxx.xxx', sourceCountry: 'BR', accountLocked: true }),
      isAcknowledged: false,
      relatedEntityType: 'USER',
      createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
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
      companyId: companyB.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'HIGH',
      title: 'Licencia Operativa vence en 20 días',
      message: 'La Licencia de Operación Industrial de la Refinería Amuay vence el 20 de este mes. Renovación requerida antes del vencimiento.',
      metadata: JSON.stringify({ errorCode: 'SUB-LIC-VENCE', documentType: 'licencia_operativa', documentTitle: 'Licencia de Operación Industrial - Refinería Amuay', daysRemaining: 20 }),
      isAcknowledged: false,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'MEDIUM',
      title: 'Calibración de Detectores Gas próxima a vencer',
      message: 'El certificado de calibración de detectores de gas en Amuay vence en 10 días. Programar mantenimiento preventivo.',
      metadata: JSON.stringify({ errorCode: 'SUB-CAL-VENCE', documentType: 'calibracion_equipos', documentTitle: 'Calibración Detectores Gas Amuay', daysRemaining: 10 }),
      isAcknowledged: true,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
    },
    {
      companyId: companyB.id,
      type: 'SUBSCRIPTION_ALERT', severity: 'CRITICAL',
      title: 'Certificado Médico Expirado - Antonio Fernández',
      message: 'El certificado médico de Antonio Fernández expiró hace 45 días. Técnico NO debe realizar trabajos de campo hasta renovar.',
      metadata: JSON.stringify({ errorCode: 'SUB-CERT-EXP', documentType: 'certificado_medico', holderName: 'Antonio Fernández', daysExpired: 45, restricted: true }),
      isAcknowledged: false,
      relatedEntityType: 'DOCUMENT',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  ]

  const createdAlerts = await prisma.systemAlert.createMany({ data: alertsData })
  console.log(`  ✅ ${createdAlerts.count} SystemAlerts creados para GOC`)

  // ── 8. KNOWLEDGE BASE (soluciones para los códigos de error) ──
  await prisma.knowledgeBase.createMany({
    data: [
      // ── SENSOR codes ──
      {
        errorCode: 'SENSOR-H2S-CRIT',
        category: 'SCADA',
        title: 'Gas H2S — Nivel Crítico Excedido',
        rootCause: 'Concentración de ácido sulfhídrico (H2S) superó el umbral crítico de 10% LEL. Posibles causas: fuga en línea de gas, fallo en válvula de alivio, o venteo no controlado en muelle de carga.',
        appliedSolution: '1. Activar protocolo de evacuación inmediata del área (bocina de alarma).\n2. Ningún trabajador debe ingresar sin equipo SCBA (Self-Contained Breathing Apparatus).\n3. Cerrar válvulas de aislamiento de la zona afectada.\n4. Desplegar brigada de emergencia con detectores portátiles H2S.\n5. Solo reingresar después de que lectura baje a <5% LEL sostenido por 30 min.',
        severity: 'CRITICAL',
        referenceUrl: 'https://docs.petrolinkvzla.com/scada/h2s-emergency-protocol',
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
        referenceUrl: 'https://docs.petrolinkvzla.com/scada/lev-emergency-response',
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
        referenceUrl: 'https://docs.petrolinkvzla.com/scada/pressure-anomaly-procedure',
        timesUsed: 9,
      },
      // ── GEOFENCE codes ──
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
      // ── SUBSCRIPTION / DOCUMENT codes ──
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
      // ── SYSTEM codes (existentes) ──
      {
        errorCode: 'ERR_SENSOR_COMM_01',
        category: 'SCADA',
        title: 'Fallo en comunicación con gateway de sensores',
        rootCause: 'El gateway IoT pierde conectividad con la red debido a: (1) interferencia RF en la frecuencia del radio, (2) pérdida de alimentación en el gateway, (3) saturación de buffer por alta densidad de datos.',
        appliedSolution: '1. Verificar alimentación del gateway (LED verde).\n2. Reiniciar gateway vía SSH: ssh admin@gw-ip "reboot"\n3. Verificar señal RF con comando: rssi-check --gw GATEWAY_ID\n4. Si persiste, escalar a proveedor de conectividad.',
        severity: 'MEDIUM',
        referenceUrl: 'https://docs.petrolinkvzla.com/scada/troubleshooting',
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
      // ── SECURITY codes (existentes) ──
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

  // ── 9. AUDIT LOGS (para que System Health muestre actividad) ──
  await prisma.auditLog.createMany({
    data: [
      { companyId: companyB.id, userId: adminB.id, action: 'LOGIN', entityType: 'USER', entityId: adminB.id, details: JSON.stringify({ method: 'credentials', ip: '190.205.1.100' }) },
      { companyId: companyB.id, userId: techB1.id, action: 'LOGIN', entityType: 'USER', entityId: techB1.id, details: JSON.stringify({ method: 'credentials', ip: '190.205.2.50' }) },
      { companyId: companyB.id, userId: supervisorB.id, action: 'APPROVE', entityType: 'PERMIT', entityId: 'PLV-2025-0001', details: JSON.stringify({ permitNumber: 'PLV-2025-0001', riskType: 'ALTURA' }) },
      { companyId: companyB.id, userId: adminB.id, action: 'REJECT', entityType: 'PERMIT', entityId: 'PLV-2025-0004', details: JSON.stringify({ permitNumber: 'PLV-2025-0004', reason: 'Zona caliente no despejada' }) },
      { companyId: companyB.id, userId: supervisorB.id, action: 'APPROVE', entityType: 'PERMIT', entityId: 'PLV-2025-0003', details: JSON.stringify({ permitNumber: 'PLV-2025-0003', riskType: 'CONFINADO' }) },
      { companyId: companyB.id, userId: adminB.id, action: 'REJECT', entityType: 'PERMIT', entityId: 'PLV-2025-0012', details: JSON.stringify({ permitNumber: 'PLV-2025-0012', reason: 'EPP dieléctrico no disponible' }) },
      { companyId: companyB.id, userId: techB1.id, action: 'CREATE', entityType: 'PERMIT', entityId: 'PLV-2025-0001', details: JSON.stringify({ permitNumber: 'PLV-2025-0001', riskType: 'ALTURA' }) },
      { companyId: companyB.id, userId: techB2.id, action: 'CREATE', entityType: 'PERMIT', entityId: 'PLV-2025-0002', details: JSON.stringify({ permitNumber: 'PLV-2025-0002', riskType: 'ELECTRICO' }) },
      { companyId: companyB.id, action: 'SYSTEM_ERROR', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_SENSOR_COMM_01', gateway: 'TIA-JUANA-GW-03' }) },
      { companyId: companyB.id, action: 'SECURITY_BREACH', entityType: 'USER', entityId: null, details: JSON.stringify({ errorCode: 'ERR_AUTH_BRUTE_01', attempts: 12, sourceIp: '45.227.xxx.xxx' }) },
      { companyId: companyB.id, action: 'ERROR', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_REPORT_TIMEOUT', reportType: 'monthly' }) },
      { companyId: companyB.id, action: 'FAILURE', entityType: 'SYSTEM', entityId: null, details: JSON.stringify({ errorCode: 'ERR_DB_SLOW_01', durationMs: 4200 }) },
    ],
  })
  console.log('  ✅ Audit Logs creados')

  // ── 10. Configuración de alertas (AlertConfig) ──
  await prisma.alertConfig.createMany({
    data: [
      { companyId: companyB.id, name: 'Alerta Documento Crítico', alertType: 'IN_APP', triggerDaysBefore: 30, isActive: true },
      { companyId: companyB.id, name: 'Alerta Documento Crítico Email', alertType: 'EMAIL', triggerDaysBefore: 15, isActive: true },
      { companyId: companyB.id, name: 'Alerta Sensor Crítico', alertType: 'IN_APP', triggerDaysBefore: 0, isActive: true },
    ],
  })

  // ── DONE ──
  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('  ✅ SEED COMPLETADO — Empresa B creada exitosamente')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log('📋 CREDENCIALES DE ACCESO:')
  console.log('')
  console.log('  🔑 ADMIN (Full Access):')
  console.log('     Email:    admin@petrolinkvzla.com')
  console.log('     Password: Admin@2024')
  console.log('')
  console.log('  👷 SUPERVISOR:')
  console.log('     Email:    jesus@petrolinkvzla.com')
  console.log('     Password: Demo1234')
  console.log('')
  console.log('  🔧 TÉCNICOS:')
  console.log('     Email:    antonio@petrolinkvzla.com')
  console.log('     Password: Demo1234')
  console.log('     Email:    daniel@petrolinkvzla.com')
  console.log('     Password: Demo1234')
  console.log('')
  console.log('  📊 GERENTE:')
  console.log('     Email:    carmen@petrolinkvzla.com')
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
