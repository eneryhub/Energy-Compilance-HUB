import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Energy-Compliance Hub...')

  // Clean existing data
  await prisma.auditLog.deleteMany()
  await prisma.signature.deleteMany()
  await prisma.permit.deleteMany()
  await prisma.hseDocument.deleteMany()
  await prisma.alertConfig.deleteMany()
  await prisma.workLocation.deleteMany()
  await prisma.user.deleteMany()
  await prisma.company.deleteMany()

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'EnergyCorp S.A.',
      taxId: '310123456789',
      email: 'contacto@energycorp.com',
      phone: '+506 2200-0000',
      address: 'San José, Costa Rica',
      subscriptionPlan: 'business',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxUsers: 50,
      maxPermitsPerMonth: 2000,
    },
  })

  // 2. Create Users
  const adminPass = await hash('admin123', 10)
  const userPass = await hash('user123', 10)

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@energy.com',
      passwordHash: adminPass,
      name: 'Roberto Guzmán',
      role: 'ADMIN',
      phone: '+506 8888-0001',
    },
  })

  const supervisor = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'ana@energy.com',
      passwordHash: userPass,
      name: 'Ana Rodríguez',
      role: 'SUPERVISOR',
      phone: '+506 8888-0002',
    },
  })

  const technician1 = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'carlos@energy.com',
      passwordHash: userPass,
      name: 'Carlos Mendoza',
      role: 'TECHNICIAN',
      phone: '+506 8888-0003',
    },
  })

  const technician2 = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'pedro@energy.com',
      passwordHash: userPass,
      name: 'Pedro Gómez',
      role: 'TECHNICIAN',
      phone: '+506 8888-0004',
    },
  })

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'maria@energy.com',
      passwordHash: userPass,
      name: 'María García',
      role: 'MANAGER',
      phone: '+506 8888-0005',
    },
  })

  // 3. Create Work Locations
  const loc1 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Plataforma Principal - Área A',
      address: 'Planta Principal, Sector Norte',
      latitude: 10.0726,
      longitude: -84.3125,
      radiusMeters: 150,
      verificationMethod: 'GPS',
    },
  })

  const loc2 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Subestación Eléctrica B',
      address: 'Sector Sur, Cerca de tanques',
      latitude: 10.0730,
      longitude: -84.3110,
      radiusMeters: 100,
      verificationMethod: 'GPS',
    },
  })

  const loc3 = await prisma.workLocation.create({
    data: {
      companyId: company.id,
      name: 'Taller de Soldadura',
      address: 'Área de Mantenimiento',
      latitude: 10.0720,
      longitude: -84.3130,
      radiusMeters: 80,
      verificationMethod: 'GPS',
    },
  })

  // 4. Create HSE Documents (mix of active, expired, critical)
  const now = new Date()
  await prisma.hseDocument.createMany({
    data: [
      {
        companyId: company.id,
        userId: technician1.id,
        title: 'Certificado Médico - Carlos Mendoza',
        documentType: 'certificado_medico',
        category: 'PERSONAL',
        criticality: 'CRITICAL',
        status: 'EXPIRED',
        issueDate: new Date('2023-06-15'),
        expiryDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days expired
        holderName: 'Carlos Mendoza',
      },
      {
        companyId: company.id,
        userId: supervisor.id,
        title: 'Certificado Médico - Ana Rodríguez',
        documentType: 'certificado_medico',
        category: 'PERSONAL',
        criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-06-01'),
        expiryDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000), // 6 months valid
        holderName: 'Ana Rodríguez',
      },
      {
        companyId: company.id,
        title: 'Licencia Operativa - Planta Principal',
        documentType: 'licencia_operativa',
        category: 'LEGAL',
        criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-12-31'),
      },
      {
        companyId: company.id,
        userId: technician2.id,
        title: 'Curso Trabajo en Altura - Pedro Gómez',
        documentType: 'curso_altura',
        category: 'PERSONAL',
        criticality: 'NORMAL',
        status: 'PENDING_RENEWAL',
        issueDate: new Date('2023-08-15'),
        expiryDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days remaining
        holderName: 'Pedro Gómez',
      },
      {
        companyId: company.id,
        title: 'Permiso Ambiental - Operaciones 2024',
        documentType: 'permiso_ambiental',
        category: 'AMBIENTAL',
        criticality: 'CRITICAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-01-01'),
      },
      {
        companyId: company.id,
        title: 'Seguro RST - EnergyCorp S.A.',
        documentType: 'seguro_rst',
        category: 'LEGAL',
        criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-03-01'),
        expiryDate: new Date('2025-03-01'),
      },
      {
        companyId: company.id,
        userId: technician1.id,
        title: 'Curso Riesgo Eléctrico - Carlos Mendoza',
        documentType: 'curso_electrico',
        category: 'PERSONAL',
        criticality: 'NORMAL',
        status: 'ACTIVE',
        issueDate: new Date('2024-05-01'),
        expiryDate: new Date('2025-05-01'),
        holderName: 'Carlos Mendoza',
      },
      {
        companyId: company.id,
        title: 'Capacitación Primeros Auxilios - Equipo Planta',
        documentType: 'capacitacion_seguridad',
        category: 'PERSONAL',
        criticality: 'LOW',
        status: 'ACTIVE',
        issueDate: new Date('2024-09-01'),
        expiryDate: new Date('2025-09-01'),
      },
    ],
  })

  // 5. Create Permits (various states)
  const permits = await prisma.permit.createMany({
    data: [
      {
        companyId: company.id,
        permitNumber: 'PT-2024-0048',
        riskType: 'ALTURA',
        status: 'PENDING',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: true, briefing_completed: true }),
        technicianName: 'Carlos Mendoza',
        supervisorName: 'Ana Rodríguez',
        workLocation: 'Plataforma A, Nivel 3',
        workDescription: 'Revisión y mantenimiento de estructura metálica en plataforma superior. Inspección visual y torqueo de pernos.',
        workLatitude: 10.0726,
        workLongitude: -84.3125,
        workRadius: 100,
        locationSource: 'gps',
        workLocationId: loc1.id,
        createdById: technician1.id,
        createdByName: 'Carlos Mendoza',
        createdByRole: 'TECHNICIAN',
        technicianSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0726, longitude: -84.3125, accuracy: 12 } }),
      },
      {
        companyId: company.id,
        permitNumber: 'PT-2024-0047',
        riskType: 'ELECTRICO',
        status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_dielectric_ppe: true, voltage_test_performed: true, has_first_aid_kit: true, emergency_routes_identified: true }),
        technicianName: 'Pedro Gómez',
        supervisorName: 'Ana Rodríguez',
        workLocation: 'Subestación B, Tablero TB-204',
        workDescription: 'Reemplazo de interruptor termomagnético de 200A en tablero de distribución principal.',
        workLatitude: 10.0730,
        workLongitude: -84.3110,
        workRadius: 100,
        locationSource: 'gps',
        workLocationId: loc2.id,
        createdById: technician2.id,
        createdByName: 'Pedro Gómez',
        createdByRole: 'TECHNICIAN',
        approvedById: supervisor.id,
        approvedByName: 'Ana Rodríguez',
        approvedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0730, longitude: -84.3110, accuracy: 8 } }),
        supervisorSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0731, longitude: -84.3112, accuracy: 15 } }),
      },
      {
        companyId: company.id,
        permitNumber: 'PT-2024-0046',
        riskType: 'CONFINADO',
        status: 'REJECTED',
        safetyChecks: JSON.stringify({ atmosphere_monitored: false, has_entry_permit: true, has_first_aid_kit: true }),
        technicianName: 'Luis Torres',
        supervisorName: 'Ana Rodríguez',
        workLocation: 'Tanque de almacenamiento T-201',
        workDescription: 'Limpieza interna de tanque de almacenamiento de combustible.',
        rejectionReason: 'Monitoreo de atmósfera no realizado. Es obligatorio antes de ingresar.',
        createdById: technician1.id,
        createdByName: 'Carlos Mendoza',
        createdByRole: 'TECHNICIAN',
        rejectedById: supervisor.id,
        rejectedByName: 'Ana Rodríguez',
        rejectedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      },
      {
        companyId: company.id,
        permitNumber: 'PT-2024-0045',
        riskType: 'CALIENTE',
        status: 'APPROVED',
        safetyChecks: JSON.stringify({ has_fire_extinguisher: true, has_first_aid_kit: true, briefing_completed: true, emergency_routes_identified: true }),
        technicianName: 'Miguel Sánchez',
        supervisorName: 'Roberto Lima',
        workLocation: 'Taller de soldadura A',
        workDescription: 'Fabricación de soporte para tubería de vapor de 4 pulgadas.',
        workLatitude: 10.0720,
        workLongitude: -84.3130,
        workRadius: 80,
        locationSource: 'gps',
        workLocationId: loc3.id,
        createdById: technician2.id,
        createdByName: 'Pedro Gómez',
        createdByRole: 'TECHNICIAN',
        approvedById: admin.id,
        approvedByName: 'Roberto Guzmán',
        approvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        technicianSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0720, longitude: -84.3130, accuracy: 10 } }),
        supervisorSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0721, longitude: -84.3129, accuracy: 12 } }),
      },
      {
        companyId: company.id,
        permitNumber: 'PT-2024-0044',
        riskType: 'ALTURA',
        status: 'PENDING',
        safetyChecks: JSON.stringify({ has_harness: true, has_anchor_point: true, has_first_aid_kit: false, briefing_completed: true }),
        technicianName: 'Juan Pérez',
        supervisorName: 'Ana Rodríguez',
        workLocation: 'Torre de enfriamiento T-3',
        workDescription: 'Inspección de estructura superior de torre de enfriamiento. Verificar estado de pintura anticorrosiva.',
        createdById: technician1.id,
        createdByName: 'Carlos Mendoza',
        createdByRole: 'TECHNICIAN',
        technicianSignature: JSON.stringify({ data: 'base64_signature...', gps: { latitude: 10.0725, longitude: -84.3123, accuracy: 15 } }),
      },
    ],
  })

  // 6. Create Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { companyId: company.id, userId: admin.id, action: 'LOGIN', entityType: 'USER', entityId: admin.id, details: JSON.stringify({ method: 'credentials' }) },
      { companyId: company.id, userId: technician1.id, action: 'LOGIN', entityType: 'USER', entityId: technician1.id, details: JSON.stringify({ method: 'credentials' }) },
      { companyId: company.id, userId: technician1.id, action: 'CREATE', entityType: 'PERMIT', entityId: '1', details: JSON.stringify({ permitNumber: 'PT-2024-0048', riskType: 'ALTURA' }) },
      { companyId: company.id, userId: supervisor.id, action: 'APPROVE', entityType: 'PERMIT', entityId: '2', details: JSON.stringify({ permitNumber: 'PT-2024-0047' }) },
      { companyId: company.id, userId: supervisor.id, action: 'REJECT', entityType: 'PERMIT', entityId: '3', details: JSON.stringify({ permitNumber: 'PT-2024-0046', reason: 'Monitoreo de atmósfera no realizado' }) },
      { companyId: company.id, userId: admin.id, action: 'APPROVE', entityType: 'PERMIT', entityId: '4', details: JSON.stringify({ permitNumber: 'PT-2024-0045' }) },
    ],
  })

  console.log('✅ Seed completed successfully!')
  console.log('📋 Demo accounts:')
  console.log('   Admin:     admin@energy.com / admin123')
  console.log('   Supervisor: ana@energy.com / user123')
  console.log('   Technician: carlos@energy.com / user123')
  console.log('   Manager:   maria@energy.com / user123')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
