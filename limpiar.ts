import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  try {
    const companyB = await prisma.company.findFirst({ 
      where: { name: { contains: 'PetrolinkVZLA Industrial' } } 
    });

    if (companyB) {
      console.log('🔄 Iniciando limpieza profunda de PetrolinkVZLA Industrial...');

      // 1. Borrar Logs de Auditoría
      await prisma.auditLog.deleteMany({ where: { companyId: companyB.id } });
      
      // 2. Borrar Lecturas de Sensores (SCADA)
      // Como SensorReading no tiene companyId, filtramos por la relación con el sensor
      await prisma.sensorReading.deleteMany({
        where: {
          sensor: {
            companyId: companyB.id
          }
        }
      });
      console.log('✅ Lecturas de sensores eliminadas');

      // 3. Borrar los Sensores mismos
      await prisma.sensor.deleteMany({ where: { companyId: companyB.id } });

      // 4. Borrar Permisos
      await prisma.permit.deleteMany({ where: { companyId: companyB.id } });

      // 5. Borrar Usuarios
      await prisma.user.deleteMany({ where: { companyId: companyB.id } });

      // 6. Finalmente, borrar la Empresa
      await prisma.company.delete({ where: { id: companyB.id } });
      
      console.log('✅ Empresa B y toda su infraestructura eliminada exitosamente');
    } else {
      console.log('⚠️ Empresa B no encontrada');
    }

    // Limpiar base de conocimientos del GOC
    const kb = await prisma.knowledgeBase.deleteMany({});
    console.log(`✅ ${kb.count} entradas de KnowledgeBase eliminadas`);

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clean();