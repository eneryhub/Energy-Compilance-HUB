// generar-propuesta.js
// Script para generar una propuesta comercial profesional de Energy-Compliance HUB

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────
// CONFIGURACIÓN
// ──────────────────────────────────────────────

const CONFIG = {
  // Ruta de salida
  outputDir: path.join(require("os").homedir(), "Documents"),
  fileName: `propuesta-energy-compliance-${new Date().toISOString().slice(0, 10)}.pdf`,

  // Colores de la marca
  colors: {
    primary: "#0A1628",      // Azul marino profundo
    secondary: "#0066CC",    // Azul corporativo
    accent: "#00A86B",       // Verde éxito
    warning: "#F59E0B",      // Ámbar
    danger: "#EF4444",       // Rojo
    text: "#1E293B",         // Texto principal
    muted: "#64748B",        // Texto secundario
    light: "#F1F5F9",        // Fondo claro
    border: "#E2E8F0",       // Bordes
    white: "#FFFFFF",
  },

  // Márgenes
  margins: {
    top: 60,
    bottom: 60,
    left: 50,
    right: 50,
  },

  // Fuentes
  fonts: {
    bold: "Helvetica-Bold",
    regular: "Helvetica",
  },
};

// ──────────────────────────────────────────────
// INICIALIZACIÓN DEL DOCUMENTO
// ──────────────────────────────────────────────

const { colors, margins, fonts } = CONFIG;
const doc = new PDFDocument({
  size: "A4",
  margins,
  bufferPages: true,
});

// Crear carpeta si no existe
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

const outputPath = path.join(CONFIG.outputDir, CONFIG.fileName);
const writeStream = fs.createWriteStream(outputPath);

writeStream.on("error", (err) => {
  console.error("❌ Error al escribir el archivo:", err.message);
  process.exit(1);
});

doc.pipe(writeStream);

// ──────────────────────────────────────────────
// UTILIDADES DE DISEÑO
// ──────────────────────────────────────────────

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const contentWidth = pageWidth - margins.left - margins.right;
const centerX = pageWidth / 2;

/**
 * Verifica si hay espacio suficiente en la página actual
 */
function ensureSpace(requiredHeight = 100) {
  const available = pageHeight - doc.y - margins.bottom;
  if (available < requiredHeight) {
    doc.addPage();
  }
}

/**
 * Dibuja una línea decorativa
 */
function drawDivider(y = null) {
  const posY = y || doc.y;
  doc
    .moveTo(margins.left, posY)
    .lineTo(pageWidth - margins.right, posY)
    .strokeColor(colors.secondary)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.5);
}

/**
 * Título principal de página
 */
function pageTitle(text) {
  ensureSpace(80);

  doc
    .fillColor(colors.primary)
    .font(fonts.bold)
    .fontSize(28)
    .text(text, margins.left, doc.y, {
      align: "left",
      width: contentWidth,
    });

  const titleY = doc.y - 5;
  drawDivider(titleY + 8);

  doc.moveDown(0.8);
}

/**
 * Subtítulo / Sección
 */
function sectionTitle(text, color = colors.secondary) {
  ensureSpace(50);

  doc
    .fillColor(color)
    .font(fonts.bold)
    .fontSize(16)
    .text(text, margins.left, doc.y, {
      align: "left",
      width: contentWidth,
    });

  doc.moveDown(0.3);
}

/**
 * Párrafo de texto
 */
function paragraph(text, options = {}) {
  const opts = {
    align: "justify",
    lineGap: 3,
    width: contentWidth,
    ...options,
  };

  doc
    .fillColor(colors.text)
    .font(fonts.regular)
    .fontSize(11)
    .text(text, margins.left, doc.y, opts);

  doc.moveDown(0.8);
}

/**
 * Viñeta simple
 */
function bullet(text, indent = 15) {
  doc
    .fillColor(colors.text)
    .font(fonts.regular)
    .fontSize(11)
    .text(`• ${text}`, {
      indent,
      lineGap: 2,
      width: contentWidth - indent,
    });
}

/**
 * Viñeta con icono de check
 */
function checkBullet(text) {
  doc
    .fillColor(colors.accent)
    .font(fonts.bold)
    .fontSize(13)
    .text("✓", margins.left, doc.y, { continued: true })
    .fillColor(colors.text)
    .font(fonts.regular)
    .fontSize(11)
    .text(` ${text}`, {
      indent: 0,
      lineGap: 2,
      width: contentWidth - 25,
    });
}

/**
 * Tarjeta de módulo
 */
function moduleCard(title, description, icon, x, y, width, height = 90) {
  const cardX = x || margins.left;
  const cardY = y || doc.y;

  // Fondo de la tarjeta
  doc
    .roundedRect(cardX, cardY, width, height, 8)
    .fillAndStroke(colors.white, colors.border);

  // Barra decorativa superior
  doc
    .roundedRect(cardX, cardY, width, 4, 8)
    .fill(colors.secondary);

  // Icono (simulado con texto)
  doc
    .fillColor(colors.secondary)
    .font(fonts.bold)
    .fontSize(20)
    .text(icon, cardX + 12, cardY + 12);

  // Título
  doc
    .fillColor(colors.primary)
    .font(fonts.bold)
    .fontSize(12)
    .text(title, cardX + 12, cardY + 14, {
      width: width - 24,
      align: "left",
    });

  // Descripción
  doc
    .fillColor(colors.muted)
    .font(fonts.regular)
    .fontSize(9)
    .text(description, cardX + 12, cardY + 38, {
      width: width - 24,
      height: 40,
      align: "left",
    });

  return cardY + height + 12;
}

/**
 * Tarjeta KPI
 */
function kpiCard(value, label, x, y, width = 110, height = 75) {
  const cardX = x || margins.left;
  const cardY = y || doc.y;

  doc
    .roundedRect(cardX, cardY, width, height, 10)
    .fillAndStroke(colors.light, colors.border);

  doc
    .fillColor(colors.primary)
    .font(fonts.bold)
    .fontSize(24)
    .text(value, cardX, cardY + 14, {
      align: "center",
      width,
    });

  doc
    .fillColor(colors.muted)
    .font(fonts.regular)
    .fontSize(9)
    .text(label, cardX, cardY + 46, {
      align: "center",
      width,
    });

  return cardY + height + 12;
}

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 1 - PORTADA
// ──────────────────────────────────────────────

// Logo y encabezado
doc
  .fillColor(colors.primary)
  .font(fonts.bold)
  .fontSize(14)
  .text("ENERGY-COMPLIANCE", margins.left, margins.top + 10, {
    align: "left",
  })
  .fillColor(colors.secondary)
  .text(" HUB", {
    continued: true,
  });

doc
  .fillColor(colors.muted)
  .font(fonts.regular)
  .fontSize(9)
  .text("Plataforma Integral de Gestión HSE", margins.left, margins.top + 30);

// Línea decorativa
doc
  .moveTo(margins.left, margins.top + 42)
  .lineTo(margins.left + 80, margins.top + 42)
  .strokeColor(colors.secondary)
  .lineWidth(3)
  .stroke();

doc.moveDown(2.5);

// Título principal
doc
  .fillColor(colors.primary)
  .font(fonts.bold)
  .fontSize(34)
  .text("Propuesta Comercial", margins.left, doc.y, {
    align: "left",
    width: contentWidth * 0.7,
  });

doc.moveDown(0.3);

doc
  .fillColor(colors.text)
  .font(fonts.regular)
  .fontSize(16)
  .text("Transformación Digital para la Seguridad", margins.left, doc.y, {
    align: "left",
    width: contentWidth * 0.7,
  });

doc.moveDown(0.3);

doc
  .fillColor(colors.secondary)
  .font(fonts.bold)
  .fontSize(16)
  .text("y el Cumplimiento Normativo", margins.left, doc.y, {
    align: "left",
    width: contentWidth * 0.7,
  });

doc.moveDown(2.5);

// Fecha y versión
const fechaActual = new Date().toLocaleDateString("es-ES", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

doc
  .fillColor(colors.muted)
  .font(fonts.regular)
  .fontSize(10)
  .text(`📅 ${fechaActual}`, margins.left, doc.y);

doc
  .text(`📄 Versión 2.0`, margins.left, doc.y + 16);

doc.moveDown(3);

// Línea inferior
doc
  .moveTo(margins.left, doc.y)
  .lineTo(pageWidth - margins.right, doc.y)
  .strokeColor(colors.border)
  .lineWidth(1)
  .stroke();

doc.moveDown(0.8);

doc
  .fillColor(colors.muted)
  .font(fonts.regular)
  .fontSize(9)
  .text(
    "Documento confidencial • Energy-Compliance HUB • Todos los derechos reservados",
    margins.left,
    doc.y,
    {
      align: "center",
      width: contentWidth,
    }
  );

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 2 - RESUMEN EJECUTIVO
// ──────────────────────────────────────────────

doc.addPage();
pageTitle("Resumen Ejecutivo");

paragraph(
  "Energy-Compliance HUB es una plataforma empresarial de última generación diseñada para " +
  "integrar y automatizar los procesos críticos de seguridad industrial, cumplimiento normativo, " +
  "gestión operacional y monitoreo en tiempo real."
);

paragraph(
  "La solución combina tecnología avanzada con un enfoque centrado en el usuario, " +
  "permitiendo a las organizaciones reducir riesgos, optimizar recursos y tomar decisiones " +
  "basadas en datos con total confianza."
);

sectionTitle("Principales Capacidades");

const capabilities = [
  "✅ Gestión digital de permisos de trabajo de alto riesgo",
  "✅ Monitoreo SCADA y telemetría en tiempo real",
  "✅ Centro de Operaciones Global (GOC) con alertas inteligentes",
  "✅ Sistema de Respuesta ante Emergencias (ERC)",
  "✅ Control de flotas y gestión de transporte",
  "✅ Gestión de incidentes ambientales",
  "✅ Inventario inteligente con trazabilidad",
  "✅ Cumplimiento documental automatizado",
  "✅ Panel ejecutivo con indicadores clave (KPIs)",
  "✅ Inteligencia artificial para análisis predictivo",
];

capabilities.forEach((item) => {
  doc
    .fillColor(colors.text)
    .font(fonts.regular)
    .fontSize(10.5)
    .text(item, margins.left, doc.y, {
      width: contentWidth,
      lineGap: 1,
    });
});

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 3 - KPI Y MÉTRICAS
// ──────────────────────────────────────────────

doc.addPage();
pageTitle("Indicadores Estratégicos");

const kpiData = [
  { value: "24/7", label: "Monitoreo Continuo" },
  { value: "100%", label: "Trazabilidad de Procesos" },
  { value: "85%", label: "Digitalización Alcanzada" },
  { value: "70%", label: "Reducción Administrativa" },
];

const kpiWidth = (contentWidth - 30) / kpiData.length;
let kpiX = margins.left;

kpiData.forEach((kpi, index) => {
  kpiCard(kpi.value, kpi.label, kpiX, doc.y, kpiWidth);
  kpiX += kpiWidth + 10;
});

doc.y += 90;

sectionTitle("Arquitectura de la Solución");

paragraph(
  "Energy-Compliance HUB está construida sobre una arquitectura moderna y escalable que " +
  "garantiza rendimiento, seguridad y flexibilidad para organizaciones de todos los tamaños."
);

const techStack = [
  "Frontend: Next.js 14 + React + Tailwind CSS",
  "Backend: Node.js + Next.js API Routes",
  "Base de Datos: PostgreSQL + Prisma ORM",
  "Autenticación: JWT + BCrypt",
  "Infraestructura: Cloud Ready (AWS / Azure / GCP)",
  "Arquitectura: Multi-tenant con aislamiento de datos",
];

techStack.forEach((item) => {
  bullet(item);
});

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 4 - MÓDULOS
// ──────────────────────────────────────────────

doc.addPage();
pageTitle("Módulos Funcionales");

paragraph(
  "La plataforma está organizada en módulos especializados que cubren todos los aspectos " +
  "de la gestión HSE, operaciones y cumplimiento normativo."
);

const modules = [
  { title: "Permisos", desc: "Gestión digital de permisos de trabajo de alto riesgo con firmas electrónicas y geolocalización.", icon: "📋" },
  { title: "SCADA / GOC", desc: "Monitoreo en tiempo real de sensores industriales con alertas inteligentes y dashboards.", icon: "📊" },
  { title: "ERC", desc: "Sistema de respuesta ante emergencias con gestión de incidentes y protocolos.", icon: "🚨" },
  { title: "Transporte", desc: "Control integral de flotas, conductores, inspecciones y eventos de conducción.", icon: "🚛" },
  { title: "Ambiente", desc: "Gestión de incidentes ambientales, evaluaciones de impacto y métricas.", icon: "🌿" },
  { title: "Inventario", desc: "Gestión inteligente de activos con tracking y control de stock.", icon: "📦" },
  { title: "Documental", desc: "Control automatizado de certificaciones, vencimientos y auditorías.", icon: "📄" },
  { title: "Analytics", desc: "Paneles ejecutivos, KPIs y análisis predictivo con inteligencia artificial.", icon: "📈" },
];

const cols = 2;
const moduleWidth = (contentWidth - (cols - 1) * 15) / cols;
const moduleHeight = 95;

let rowY = doc.y;

modules.forEach((mod, index) => {
  const col = index % cols;
  const row = Math.floor(index / cols);

  if (row > 0 && col === 0) {
    rowY = doc.y + 12;
  }

  const x = margins.left + col * (moduleWidth + 15);
  const y = rowY + row * (moduleHeight + 12);

  // Verificar espacio en página
  if (y + moduleHeight + 30 > pageHeight - margins.bottom) {
    doc.addPage();
    pageTitle("Módulos Funcionales (continuación)");
    rowY = doc.y;
    moduleCard(mod.title, mod.desc, mod.icon, x, rowY, moduleWidth, moduleHeight);
    return;
  }

  moduleCard(mod.title, mod.desc, mod.icon, x, y, moduleWidth, moduleHeight);
});

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 5 - BENEFICIOS
// ──────────────────────────────────────────────

doc.addPage();
pageTitle("Beneficios para la Organización");

sectionTitle("Impacto Operacional");

const benefits = [
  "Reducción significativa de incidentes y accidentes laborales",
  "Cumplimiento normativo garantizado con trazabilidad completa",
  "Visibilidad en tiempo real de todas las operaciones",
  "Automatización de procesos manuales que reducen errores",
  "Mejor toma de decisiones basada en datos precisos",
  "Optimización de recursos y reducción de costos operativos",
  "Mayor productividad del personal operativo",
  "Gestión proactiva de riesgos y amenazas",
];

benefits.forEach((item) => {
  checkBullet(item);
});

doc.moveDown(1);

sectionTitle("Retorno de Inversión (ROI)");

paragraph(
  "Energy-Compliance HUB ofrece un retorno de inversión significativo a través de la " +
  "reducción de costos operativos, la prevención de incidentes y la optimización de procesos."
);

const roiItems = [
  "💰 Reducción de costos administrativos: hasta 70%",
  "⚠️ Reducción de incidentes: hasta 60%",
  "📈 Aumento de productividad: hasta 40%",
  "✅ Cumplimiento normativo: 100% de trazabilidad",
  "⚡ Tiempo de respuesta: hasta 80% más rápido",
];

roiItems.forEach((item) => {
  doc
    .fillColor(colors.text)
    .font(fonts.regular)
    .fontSize(11)
    .text(item, margins.left + 20, doc.y, {
      width: contentWidth - 20,
    });
});

// ──────────────────────────────────────────────
// CONTENIDO: PÁGINA 6 - CONCLUSIÓN Y CIERRE
// ──────────────────────────────────────────────

doc.addPage();
pageTitle("Conclusión");

paragraph(
  "Energy-Compliance HUB representa la evolución natural de la gestión HSE y operacional " +
  "en la era digital. La plataforma no solo cumple con los requisitos actuales de seguridad " +
  "y cumplimiento normativo, sino que prepara a las organizaciones para los desafíos futuros."
);

paragraph(
  "Al adoptar Energy-Compliance HUB, su organización obtiene una ventaja competitiva " +
  "significativa, mejorando la seguridad, la eficiencia y la transparencia en todas las " +
  "operaciones críticas."
);

doc.moveDown(1);

// Call to Action
const ctaY = doc.y;

doc
  .roundedRect(margins.left, ctaY, contentWidth, 100, 12)
  .fillAndStroke(colors.light, colors.secondary);

const centerTextX = margins.left + contentWidth / 2;

doc
  .fillColor(colors.primary)
  .font(fonts.bold)
  .fontSize(18)
  .text(
    "Solicite una Demostración",
    margins.left,
    ctaY + 18,
    { align: "center", width: contentWidth }
  );

doc
  .fillColor(colors.muted)
  .font(fonts.regular)
  .fontSize(11)
  .text(
    "Descubra cómo Energy-Compliance HUB puede transformar la seguridad y el cumplimiento de su organización",
    margins.left,
    ctaY + 50,
    { align: "center", width: contentWidth }
  );

doc
  .fillColor(colors.secondary)
  .font(fonts.bold)
  .fontSize(12)
  .text(
    "📧 contacto@energy-compliance.com  |  📞 +58 212-555-0100",
    margins.left,
    ctaY + 75,
    { align: "center", width: contentWidth }
  );

// ──────────────────────────────────────────────
// FOOTER EN TODAS LAS PÁGINAS
// ──────────────────────────────────────────────

const totalPages = doc.bufferedPageRange().count || 6;

for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);

  const pageY = pageHeight - margins.bottom + 10;

  doc
    .fillColor(colors.muted)
    .font(fonts.regular)
    .fontSize(8)
    .text(
      `Energy-Compliance HUB • Propuesta Comercial • Página ${i + 1} de ${totalPages}`,
      margins.left,
      pageY,
      {
        align: "center",
        width: contentWidth,
      }
    );
}

// ──────────────────────────────────────────────
// FINALIZAR EL DOCUMENTO
// ──────────────────────────────────────────────

doc.end();

// ──────────────────────────────────────────────
// MENSAJE DE FINALIZACIÓN
// ──────────────────────────────────────────────

console.log("\n" + "═".repeat(60));
console.log("  ✅ PROPUESTA GENERADA EXITOSAMENTE");
console.log("═".repeat(60));
console.log(`\n  📄 Archivo: ${CONFIG.fileName}`);
console.log(`  📁 Ubicación: ${CONFIG.outputDir}`);
console.log(`  🔗 Ruta completa: ${outputPath}`);
console.log("\n  📂 Abrir carpeta:");
console.log(`     explorer "${CONFIG.outputDir}"`);
console.log("\n" + "═".repeat(60) + "\n");

// ──────────────────────────────────────────────
// OPCIÓN: ABRIR EL ARCHIVO AUTOMÁTICAMENTE
// ──────────────────────────────────────────────

// Descomenta las siguientes líneas si deseas que el PDF se abra automáticamente:
/*
const { exec } = require("child_process");
exec(`start "" "${outputPath}"`, (error) => {
  if (error) {
    console.log("⚠️ No se pudo abrir el archivo automáticamente.");
  }
});
*/