import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

// ============ Smart Auto-Reply Engine ============

interface ReplyMatch {
  keywords: string[]
  reply: string
}

const REPLY_RULES: ReplyMatch[] = [
  {
    keywords: ['hola', 'buenos d\u00edas', 'buenas tardes', 'buenas noches', 'buen d\u00eda', 'hey', 'hi'],
    reply: '\u00a1Hola! \ud83d\udc4b Bienvenido al centro de soporte de Energy-Compliance Hub. \u00bfEn qu\u00e9 podemos ayudarte hoy? Puedes describir tu consulta y te guiaremos.',
  },
  {
    keywords: ['permiso', 'permisos', 'trabajo en altura', 'riesgo', 'aprobaci\u00f3n', 'aprobar', 'rechazar', 'checklist'],
    reply: '\ud83d\udcdd **Permisos de Trabajo**\n\n\u2022 Para crear un permiso: ve a "Permisos" \u2192 "Nuevo Permiso"\n\u2022 El t\u00e9cnico llena el formulario y firma digitalmente\n\u2022 El supervisor recibe la solicitud en "Aprobaciones"\n\u2022 Si est\u00e1 fuera de geocerca, se le pedir\u00e1 justificaci\u00f3n\n\n\u00bfNecesitas ayuda con un permiso espec\u00edfico?',
  },
  {
    keywords: ['sensor', 'sensores', 'scada', 'telemetr\u00eda', 'temperatura', 'presi\u00f3n', 'gas', 'voltaje', 'alerta'],
    reply: '\ud83d\udd27 **SCADA y Sensores**\n\n\u2022 Revisa el estado en tiempo real en "SCADA"\n\u2022 Para integrar sensores reales: Manual T\u00e9cnico \u2192 Secci\u00f3n 2\n\u2022 Protocolos soportados: HTTP Webhook, Modbus TCP/RTU, MQTT, OPC-UA\n\u2022 Activa/desactiva modo demo desde la pesta\u00f1a SCADA\n\n\u00bftienes un sensor que no reporta datos?',
  },
  {
    keywords: ['factura', 'pago', 'suscripci\u00f3n', 'cobro', 'tarjeta', 'stripe', 'plan', 'precio', 'costo'],
    reply: '\ud83d\udcb3 **Suscripci\u00f3n y Pagos**\n\n\u2022 Gestiona tu plan en "Suscripci\u00f3n" (men\u00fa lateral)\n\u2022 Planes: Starter ($149), Business ($499), Enterprise (personalizado)\n\u2022 Puedes activar prueba gratuita de 7 d\u00edas\n\u2022 Los cambios de plan se reflejan de inmediato\n\n\u00bfTienes un problema con un cobro o necesitas cambiar de plan?',
  },
  {
    keywords: ['documento', 'documentos', 'hse', 'certificado', 'expirado', 'vencimiento', 'renovar', 'cargar'],
    reply: '\ud83d\udcc4 **Documentos HSE**\n\n\u2022 Gestiona documentos en "Documentos HSE"\n\u2022 Categor\u00edas: Personal, Equipos, Legal, Ambiental\n\u2022 Soporta extracci\u00f3n autom\u00e1tica con IA\n\u2022 Recibir\u00e1s alertas antes de que expire un documento\n\u2022 Documentos cr\u00edticos expirados bloquean operaciones\n\n\u00bfNecesitas help con un documento espec\u00edfico?',
  },
  {
    keywords: ['gps', 'geocerca', 'ubicaci\u00f3n', 'fuera', 'localizaci\u00f3n', 'gps no funciona', 'ubicar'],
    reply: '\ud83c\udf0d **GPS y Geocerca**\n\n\u2022 La app solicita permisos de GPS al firmar\n\u2022 Si est\u00e1s fuera de la geocerca: se requerir\u00e1 justificaci\u00f3n por escrito\n\u2022 Radio por defecto: 100m (configurable por ubicaci\u00f3n)\n\u2022 Verifica que tu navegador tenga permisos de ubicaci\u00f3n activados\n\n\u00bfla app no detecta tu ubicaci\u00f3n?',
  },
  {
    keywords: ['usuario', 'usuarios', 'contrase\u00f1a', 'clave', 'login', 'ingresar', 'acceso', 'no puedo entrar', 'sesi\u00f3n'],
    reply: '\ud83d\udc64 **Usuarios y Acceso**\n\n\u2022 Solo el ADMIN puede crear usuarios desde "Usuarios"\n\u2022 Roles: Admin, Supervisor, T\u00e9cnico, Gerente\n\u2022 Si olvidaste tu clave, contacta al administrador de tu empresa\n\u2022 La sesi\u00f3n expira por seguridad; vuelve a iniciar sesi\u00f3n\n\n\u00bfNecesitas crear un nuevo usuario o restablecer una clave?',
  },
  {
    keywords: ['reporte', 'reportes', 'exportar', 'pdf', 'excel', 'estad\u00edstica', 'gr\u00e1fico'],
    reply: '\ud83d\udcca **Reportes**\n\n\u2022 Accede a "Reportes" en el men\u00fa (plan Business+)\n\u2022 Filtros por fecha, tipo de riesgo y estado\n\u2022 Exporta en PDF o Excel profesional\n\u2022 Incluye: permisos, documentos, sensores, tendencias mensuales\n\n\u00bfQuieres un reporte espec\u00edfico?',
  },
  {
    keywords: ['api', 'api key', 'integraci\u00f3n', 'webhook', 'conectar', 'sistema externo', 'erp'],
    reply: '\ud83d\udd17 **API e Integraciones**\n\n\u2022 Gestiona API Keys en SCADA \u2192 Credenciales API (plan Enterprise)\n\u2022 Endpoints: /api/sensors/ingest para datos de sensores\n\u2022 Autenticaci\u00f3n: Bearer Token o API Key\n\u2022 Documentaci\u00f3n completa en el Manual T\u00e9cnico\n\n\u00bfQu\u00e9 sistema deseas integrar?',
  },
  {
    keywords: ['mapa de calor', 'mapa de riesgo', 'riesgo', 'heatmap'],
    reply: '\ud83d\udd25 **Mapa de Calor de Riesgo**\n\n\u2022 Disponible en "Mapa de Riesgo" (plan Enterprise)\n\u2022 Visualiza riesgo por ubicaci\u00f3n y tipo de trabajo\n\u2022 Datos autom\u00e1ticos de permisos, sensores y documentos\n\u2022 Colores: verde (bajo) \u2192 amarillo \u2192 naranja \u2192 rojo (cr\u00edtico)\n\nLos datos se actualizan autom\u00e1ticamente con tu operaci\u00f3n.',
  },
  {
    keywords: ['error', 'no funciona', 'problema', 'bug', 'falla', 'no carga', 'lento', 'traba'],
    reply: '\u26a0\ufe0f **Soluci\u00f3n de Problemas**\n\nIntenta estos pasos:\n1. \u2728 Refresca la p\u00e1gina (Ctrl+Shift+R)\n2. \ud83d\uddf3 Limpia cach\u00e9 del navegador\n3. \ud83c\udf10 Verifica tu conexi\u00f3n a internet\n4. \ud83d\udcf1 Prueba en otro navegador o inc\u00f3gnito\n\nSi persiste, describe el error con detalle: \u00bfqu\u00e9 haces?, \u00bfqu\u00e9 ves?, \u00bfqu\u00e9 mensaje de error aparece?',
  },
  {
    keywords: ['gracias', 'genial', 'perfecto', 'excelente', 'resuelto', 'listo', 'ya qued\u00f3'],
    reply: '\u00a1De nada! \ud83d\ude80 Me alegra haber podido ayudar. Si necesitas algo m\u00e1s, no dudes en escribir. Estamos para apoyarte.',
  },
  {
    keywords: ['manual', 'gu\u00eda', 'ayuda', 'tutorial', 'c\u00f3mo se usa', 'c\u00f3mo funciona', 'aprender'],
    reply: '\ud83d\udcd6 **Recursos de Ayuda**\n\n\u2022 **Manual de Usuario**: disponible en el men\u00fa lateral\n\u2022 **Manual T\u00e9cnico**: para integraciones SCADA (roles Admin+)\n\u2022 **Diagn\u00f3stico**: verifica el estado del sistema en "Diagn\u00f3stico"\n\n\u00bfSobre qu\u00e9 m\u00f3dulo necesitas orientaci\u00f3n?',
  },
  {
    keywords: ['whatsapp', 'tel\u00e9fono', 'llamar', 'contacto directo', 'urgente', 'emergencia'],
    reply: '\ud83d\udcde **Contacto Directo**\n\nPara urgencias:\n\u2022 Email: soporte@energycompliance.com\n\u2022 Pronto habilitaremos soporte por WhatsApp\n\nTu mensaje ha sido registrado con prioridad. Un agente te contactar\u00e1 a la brevedad. \u00bfPuedes describir la urgencia para escalarla?',
  },
]

function findSmartReply(userMessage: string): string {
  const lower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let bestMatch: ReplyMatch | null = null
  let bestScore = 0

  for (const rule of REPLY_RULES) {
    let score = 0
    for (const keyword of rule.keywords) {
      const kw = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (lower.includes(kw)) {
        score += kw.length // longer keywords = better match
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = rule
    }
  }

  if (bestMatch && bestScore >= 3) {
    return bestMatch.reply
  }

  return null
}

// GET /api/support/messages — list company support messages
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const messages = await db.supportMessage.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        message: true,
        senderType: true,
        userName: true,
        isRead: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get support messages error:', error)
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 })
  }
}

// POST /api/support/messages — send a support message with smart auto-reply
export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req)
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'El mensaje no puede estar vac\u00edo' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'El mensaje no puede exceder 2000 caracteres' }, { status: 400 })
    }

    // Create user message
    const userMessage = await db.supportMessage.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        userName: payload.name,
        message: message.trim(),
        senderType: 'USER',
      },
    })

    // Smart auto-reply
    const smartReply = findSmartReply(message.trim())

    let replyMessage: string
    if (smartReply) {
      replyMessage = smartReply
    } else {
      replyMessage = `Gracias por tu mensaje, ${payload.name.split(' ')[0]}. Tu consulta ha sido registrada con el ticket #${userMessage.id.slice(-6).toUpperCase()}.\n\nNuestro equipo de soporte te responder\u00e1 en horario laboral (Lun-Vie, 8am-6pm). Para consultas urgentes: soporte@energycompliance.com\n\nMientras tanto, puedes consultar:\n\u2022 Manual de Usuario (men\u00fa lateral)\n\u2022 Manual T\u00e9cnico (para integraciones SCADA)\n\u2022 Secci\u00f3n de Diagn\u00f3stico del sistema`
    }

    await db.supportMessage.create({
      data: {
        companyId: payload.companyId,
        message: replyMessage,
        senderType: 'SYSTEM',
        isRead: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: userMessage,
    })
  } catch (error) {
    console.error('Post support message error:', error)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}
