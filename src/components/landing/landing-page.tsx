"use client"

import { useState, useRef, useSyncExternalStore, useEffect } from "react"
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion"
import {
  Activity,
  FileCheck,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Menu,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  ChevronDown,
  Settings,
  Rocket,
  Mail,
  Linkedin,
  Twitter,
  TrendingUp,
  Users,
  Smartphone,
  Radio,
  Gauge,
  AlertTriangle,
  BarChart3,
  Cpu,
  X,
} from "lucide-react"

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
}

/* ------------------------------------------------------------------ */
/*  Animate on scroll                                                  */
/* ------------------------------------------------------------------ */
function FadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: "up" | "down" | "left" | "right" | "none"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  const dirMap: Record<string, object> = {
    up: { y: 40 }, down: { y: -40 }, left: { x: 40 }, right: { x: -40 }, none: {},
  }
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerContainer({ children, className, staggerDelay = 0.08 }: {
  children: React.ReactNode; className?: string; staggerDelay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-40px" })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: staggerDelay } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated energy grid background                                   */
/* ------------------------------------------------------------------ */
function EnergyGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Deep scan lines */}
      <div className="absolute inset-0" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(250,204,21,0.03) 79px, rgba(250,204,21,0.03) 80px)`,
      }} />
      {/* Vertical grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(250,204,21,0.025) 79px, rgba(250,204,21,0.025) 80px)`,
      }} />
      {/* Radial energy pulse — top center */}
      <div className="absolute -top-64 left-1/2 -translate-x-1/2 h-[700px] w-[900px] rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, rgba(250,204,21,0.07) 0%, rgba(250,204,21,0.02) 40%, transparent 70%)",
          animation: "energy-pulse 8s ease-in-out infinite",
        }}
      />
      {/* Left accent blob */}
      <div className="absolute top-1/3 -left-64 h-[500px] w-[500px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(20,184,166,0.06) 0%, transparent 70%)", animation: "drift-left 18s ease-in-out infinite" }}
      />
      {/* Bottom right bloom */}
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(250,204,21,0.04) 0%, transparent 70%)" }}
      />
      {/* Corner brackets */}
      <svg className="absolute top-8 left-8 opacity-20" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M0 16 L0 0 L16 0" stroke="#facc15" strokeWidth="1.5" />
      </svg>
      <svg className="absolute top-8 right-8 opacity-20" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M40 16 L40 0 L24 0" stroke="#facc15" strokeWidth="1.5" />
      </svg>
      <svg className="absolute bottom-8 left-8 opacity-20" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M0 24 L0 40 L16 40" stroke="#facc15" strokeWidth="1.5" />
      </svg>
      <svg className="absolute bottom-8 right-8 opacity-20" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M40 24 L40 40 L24 40" stroke="#facc15" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Telemetry simulation widget                                        */
/* ------------------------------------------------------------------ */
function TelemetryWidget() {
  const [values, setValues] = useState({ pressure: 142, temp: 87, flow: 2340, voltage: 380 })
  const [alerts, setAlerts] = useState([
    { id: 1, msg: "Presión normalizada — Zona A4", type: "ok", time: "hace 2m" },
    { id: 2, msg: "Permiso #PTW-2841 aprobado", type: "ok", time: "hace 5m" },
    { id: 3, msg: "Alerta temp. sensor S-07", type: "warn", time: "hace 9m" },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setValues(v => ({
        pressure: Math.max(120, Math.min(165, v.pressure + (Math.random() - 0.5) * 6)),
        temp: Math.max(75, Math.min(100, v.temp + (Math.random() - 0.5) * 3)),
        flow: Math.max(2100, Math.min(2600, v.flow + (Math.random() - 0.5) * 80)),
        voltage: Math.max(370, Math.min(395, v.voltage + (Math.random() - 0.5) * 4)),
      }))
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  const gaugeData = [
    { label: "PRESIÓN (PSI)", value: values.pressure, max: 200, unit: "psi", color: "#facc15", warn: 155 },
    { label: "TEMPERATURA", value: values.temp, max: 120, unit: "°C", color: "#14b8a6", warn: 95 },
    { label: "CAUDAL", value: values.flow, max: 3000, unit: "m³/h", color: "#facc15", warn: 2700 },
    { label: "VOLTAJE", value: values.voltage, max: 420, unit: "V", color: "#14b8a6", warn: 400 },
  ]

  return (
    <div className="relative rounded-2xl overflow-hidden border border-yellow-500/15 bg-[#0d0d0d]"
      style={{ boxShadow: "0 0 0 1px rgba(250,204,21,0.06), 0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/30">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-yellow-400 uppercase">SCADA Live</span>
          <span className="text-[10px] text-white/20 ml-2 font-mono">SISTEMA CONECTADO</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Gauge grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
        {gaugeData.map((g) => {
          const pct = (g.value / g.max) * 100
          const isWarn = g.value > g.warn
          return (
            <div key={g.label} className="bg-[#0d0d0d] p-4">
              <div className="text-[9px] tracking-[0.15em] text-white/30 mb-2 font-medium">{g.label}</div>
              {/* Bar */}
              <div className="h-1 rounded-full bg-white/5 mb-2 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: isWarn ? "#ef4444" : g.color }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-end gap-1">
                <motion.span
                  className="text-2xl font-bold font-mono leading-none"
                  style={{ color: isWarn ? "#ef4444" : g.color }}
                  animate={{ opacity: [1, isWarn ? 0.5 : 1, 1] }}
                  transition={{ duration: 1.5, repeat: isWarn ? Infinity : 0 }}
                >
                  {typeof g.value === "number" ? g.value.toFixed(0) : g.value}
                </motion.span>
                <span className="text-[10px] text-white/30 mb-0.5">{g.unit}</span>
                {isWarn && <AlertTriangle className="h-3 w-3 text-red-400 mb-0.5 ml-auto" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Alert feed */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-[9px] tracking-[0.15em] text-white/20 font-medium mb-3">REGISTRO DE EVENTOS</div>
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5 text-[11px]">
            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.type === "warn" ? "bg-orange-400" : "bg-teal-400"}`} />
            <span className="text-white/50">{a.msg}</span>
            <span className="text-white/20 ml-auto shrink-0">{a.time}</span>
          </div>
        ))}
      </div>

      {/* Simulated mini chart */}
      <div className="px-4 pb-4">
        <svg width="100%" height="44" viewBox="0 0 300 44" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,35 C30,32 60,18 90,22 C120,26 150,14 180,16 C210,18 240,28 270,20 L300,18 L300,44 L0,44 Z"
            fill="url(#chartGrad)" />
          <path d="M0,35 C30,32 60,18 90,22 C120,26 150,14 180,16 C210,18 240,28 270,20 L300,18"
            fill="none" stroke="#facc15" strokeWidth="1.5" opacity="0.6" />
        </svg>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Bento card                                                         */
/* ------------------------------------------------------------------ */
function BentoCard({
  icon: Icon, title, desc, accent = "yellow",
  className = "", delay = 0, large = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string; desc: string; accent?: "yellow" | "teal"
  className?: string; delay?: number; large?: boolean
}) {
  const accentColor = accent === "yellow" ? "#facc15" : "#14b8a6"
  const accentBg = accent === "yellow" ? "rgba(250,204,21,0.08)" : "rgba(20,184,166,0.08)"
  const accentBorder = accent === "yellow" ? "rgba(250,204,21,0.15)" : "rgba(20,184,166,0.15)"

  return (
    <StaggerItem className={className}>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="group relative h-full rounded-2xl overflow-hidden cursor-default"
        style={{
          background: "linear-gradient(135deg, #111111 0%, #0d0d0d 100%)",
          border: `1px solid ${accentBorder}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 20% 20%, ${accentBg} 0%, transparent 70%)` }} />

        <div className={`p-6 ${large ? "lg:p-8" : ""} relative z-10`}>
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
            <Icon className="h-5 w-5" style={{ color: accentColor }} />
          </div>
          <h3 className={`font-bold text-white mb-2 ${large ? "text-xl" : "text-base"}`}>{title}</h3>
          <p className="text-sm leading-relaxed text-white/40">{desc}</p>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      </motion.div>
    </StaggerItem>
  )
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const { scrollY } = useScroll()
  const navBg = useTransform(scrollY, [0, 80], ["rgba(10,10,10,0)", "rgba(10,10,10,0.95)"])
  const navBorder = useTransform(scrollY, [0, 80], ["rgba(250,204,21,0)", "rgba(250,204,21,0.1)"])

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  /* -------------------------------------------------------------- */
  /*  Data                                                           */
  /* -------------------------------------------------------------- */
  const navLinks = [
    { label: "Inicio", target: "hero" },
    { label: "Plataforma", target: "features" },
    { label: "Cómo Funciona", target: "how-it-works" },
    // { label: "Planes", target: "pricing" },  // Hidden for Enterprise presentation
    { label: "FAQ", target: "faq" },
  ]

  const partners = ["PetroAndina S.A.", "GasNatural Corp", "Eólica del Sur", "MinTech Energy", "Refinería Central", "SolarPack Latam"]

  const features = [
    { icon: FileCheck, title: "Permisos de Trabajo", desc: "Cree, apruebe y rastree PTW con firmas digitales y verificación GPS. Reduzca tiempos de aprobación en un 70%.", accent: "yellow" as const },
    { icon: Activity, title: "SCADA en Tiempo Real", desc: "Monitoree presión, temperatura, gas y voltaje con alertas predictivas por IA. Miles de puntos de medición unificados.", accent: "teal" as const },
    { icon: ShieldCheck, title: "Cumplimiento HSE", desc: "Gestione certificados y licencias con seguimiento automatizado. Auditoría completa trazable en cada acción.", accent: "yellow" as const },
    { icon: TrendingUp, title: "Análisis Predictivo", desc: "Machine learning que anticipa fallas y optimiza mantenimiento basado en datos históricos y en tiempo real.", accent: "teal" as const },
    { icon: Smartphone, title: "Acceso Móvil Total", desc: "PWA nativa para operadores en campo. Aprueba permisos, reporta incidencias y consulta sensores desde cualquier dispositivo.", accent: "yellow" as const },
    { icon: Users, title: "Gestión de Equipos", desc: "Roles granulares, registros de capacitación y seguimiento de competencias. Escala desde 5 hasta miles de usuarios.", accent: "teal" as const },
  ]

  const stats = [
    { value: "500+", label: "Empresas Activas", sub: "en 12 países" },
    { value: "2M+", label: "Permisos Procesados", sub: "anualmente" },
    { value: "99.99%", label: "Disponibilidad SLA", sub: "garantizado" },
    { value: "70%", label: "Menos Tiempo", sub: "en aprobaciones" },
  ]

  const steps = [
    { icon: Globe, number: "01", title: "Registre su empresa", desc: "Configuración guiada en 30 segundos. Sin tarjeta de crédito. Migración asistida desde sistemas legados." },
    { icon: Settings, number: "02", title: "Configure su operación", desc: "Plantillas predefinidas para PTW, telemetría SCADA y documentos HSE. Personalización completa." },
    { icon: Rocket, number: "03", title: "Opere con confianza", desc: "Monitoreo en tiempo real, alertas inteligentes, auditoría automática y cumplimiento regulatorio total." },
  ]

  const testimonials = [
    { quote: "Redujimos tiempos de aprobación de permisos en un 70% y eliminamos errores manuales en documentación HSE. Una herramienta de precisión real.", name: "Ing. Carlos Mendoza", role: "Director de Operaciones", company: "PetroSur Energía S.A." },
    { quote: "La telemetría SCADA nos permite anticipar problemas. En 6 meses pasamos de 3 incidentes mensuales a prácticamente cero paradas no planificadas.", name: "Lic. María Fernanda Rojas", role: "Gerente de HSE", company: "GasNatural Corp" },
    { quote: "Implementamos en 3 plantas simultáneamente. La migración fue fluida y el soporte técnico excepcional. Hoy no podemos operar sin esta plataforma.", name: "Ing. Roberto Aguilar", role: "CTO", company: "Eólica del Sur" },
  ]

  const plans = [
    {
      name: "Starter", price: "$149", period: "/mes", desc: "Para pequeñas operaciones",
      features: ["Hasta 10 usuarios", "200 permisos/mes", "Documentos HSE básicos", "Soporte por email", "Firma digital"],
      cta: "Comenzar Trial", popular: false, enterprise: false,
    },
    {
      name: "Business", price: "$499", period: "/mes", desc: "Para empresas en crecimiento",
      features: ["Hasta 50 usuarios", "2,000 permisos/mes", "SCADA en tiempo real", "Análisis predictivo IA", "Documentos HSE avanzados", "Soporte 24/7", "API de integración"],
      cta: "Comenzar Trial", popular: true, enterprise: false,
    },
    {
      name: "Enterprise", price: "", period: "", desc: "Solución a medida para su organización",
      features: ["Usuarios ilimitados", "Permisos ilimitados", "SCADA multi-sitio", "IA predictiva avanzada", "Cumplimiento regulatorio completo", "SLA 99.99%", "Soporte dedicado", "Integraciones personalizadas"],
      cta: "Contactar Ventas", popular: false, enterprise: true,
    },
  ]

  const faqs = [
    { id: "f1", q: "¿Cuánto tiempo toma la implementación?", a: "La configuración inicial toma menos de 30 minutos. Para Business, la implementación completa incluyendo migración de datos y capacitación se realiza en 5-10 días hábiles. Enterprise incluye un equipo dedicado con plan personalizado." },
    { id: "f2", q: "¿Es compatible con nuestros sistemas SCADA existentes?", a: "Sí. Contamos con conectores nativos para los protocolos más utilizados en la industria: Modbus, DNP3, OPC-UA, MQTT y APIs REST/GraphQL. La integración bidireccional garantiza que su inversión en infraestructura existente se preserve." },
    { id: "f3", q: "¿Dónde se alojan los datos y qué tan seguros están?", a: "Los datos se almacenan en servidores AWS con certificación ISO 27001 en regiones de Latinoamérica. Implementamos encriptación E2E, backups en tiempo real, cumplimiento SOC 2 Type II y auditoría de accesos. También ofrecemos modalidad on-premise." },
    { id: "f4", q: "¿Qué tipo de soporte técnico ofrecen?", a: "Starter incluye soporte por email con SLA de 24h. Business tiene soporte prioritario 24/7 con SLA de 4h. Enterprise incluye un CSM dedicado, soporte telefónico y canal exclusivo en Slack." },
    { id: "f5", q: "¿Puedo migrar desde nuestro sistema actual sin perder datos?", a: "Absolutamente. Nuestro equipo de onboarding ejecuta la migración usando herramientas propietarias con validación automática de integridad. Soportamos importación desde Excel, sistemas legados, SAP, Oracle y archivos CSV/JSON." },
  ]

  return (
    <div className="min-h-screen font-['Syne',sans-serif]" style={{ background: "#0a0a0a", color: "#e8e8e8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        * { -webkit-font-smoothing: antialiased; }
        :root { color-scheme: dark; }

        @keyframes energy-pulse {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scaleX(1) scaleY(1); }
          50% { opacity: 1; transform: translateX(-50%) scaleX(1.1) scaleY(1.15); }
        }
        @keyframes drift-left {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(250,204,21,0.15); }
          50% { box-shadow: 0 0 40px rgba(250,204,21,0.3), 0 0 80px rgba(250,204,21,0.1); }
        }
        @keyframes faq-open {
          from { max-height: 0; opacity: 0; }
          to { max-height: 400px; opacity: 1; }
        }
        @keyframes counter-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .faq-open { animation: faq-open 0.3s ease-out forwards; overflow: hidden; }
        .ticker-inner { animation: ticker-scroll 24s linear infinite; }
        .ticker-inner:hover { animation-play-state: paused; }
      `}</style>

      {/* ================================================================ */}
      {/*  NAVBAR                                                          */}
      {/* ================================================================ */}
      <motion.header
        className="fixed top-0 z-50 w-full backdrop-blur-xl"
        style={{ backgroundColor: navBg, borderBottom: `1px solid`, borderColor: navBorder }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden"
              style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)", boxShadow: "0 0 16px rgba(250,204,21,0.3)" }}>
              <img src="/logo.jpeg" alt="ECH" className="h-7 w-7 object-cover rounded" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">Energy Compliance</span>
              <span className="hidden sm:block text-[9px] tracking-[0.2em] text-yellow-400/60 uppercase font-medium -mt-0.5">Hub · Petrolinkvzla</span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => scrollTo(link.target)}
                className="rounded-md px-4 py-2 text-sm font-medium text-white/40 transition-colors hover:text-white hover:bg-white/5"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onLogin} className="text-sm font-medium text-white/40 hover:text-white transition-colors">
              Iniciar Sesión
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onRegister}
              className="relative text-sm font-bold px-5 py-2 rounded-lg text-black overflow-hidden"
              style={{ background: "linear-gradient(135deg, #facc15, #eab308)", boxShadow: "0 0 20px rgba(250,204,21,0.25)" }}
            >
              Solicitar Demo
            </motion.button>
          </div>

          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-[#0a0a0a]/98"
            >
              <div className="flex flex-col gap-1 p-4">
                {navLinks.map(link => (
                  <button
                    key={link.target}
                    onClick={() => scrollTo(link.target)}
                    className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/40 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
                <div className="h-px bg-white/5 my-2" />
                <button onClick={() => { setMobileOpen(false); onLogin() }} className="rounded-lg px-4 py-3 text-sm font-medium text-white/40 text-left hover:text-white">Iniciar Sesión</button>
                <button onClick={() => { setMobileOpen(false); onRegister() }} className="rounded-lg px-4 py-2.5 text-sm font-bold text-black" style={{ background: "linear-gradient(135deg, #facc15, #eab308)" }}>
                  Solicitar Demo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ================================================================ */}
      {/*  HERO                                                            */}
      {/* ================================================================ */}
      <section id="hero" className="relative overflow-hidden pt-24 pb-20 lg:pt-40 lg:pb-32 min-h-screen flex items-center">
        <EnergyGrid />

        {/* Scan line effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent"
            style={{ animation: "scan 12s linear infinite 3s" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Left copy */}
            <div>
              <FadeIn delay={0}>
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-8"
                  style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>
                  <div className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  </div>
                  500+ empresas en 12 países de LATAM
                </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[0.95] tracking-tight mb-6">
                  <span className="block text-white">Inteligencia</span>
                  <span className="block" style={{
                    background: "linear-gradient(135deg, #facc15 0%, #fde68a 40%, #14b8a6 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>Energética</span>
                  <span className="block text-white/30 text-4xl sm:text-5xl lg:text-6xl mt-1">de precisión</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-lg leading-relaxed text-white/40 mb-10 max-w-lg">
                  Plataforma SaaS para permisos de trabajo, telemetría SCADA y cumplimiento HSE.
                  Diseñada para la industria energética de Latinoamérica.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex flex-col sm:flex-row gap-3 mb-12">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onRegister}
                    className="group relative flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-black overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #facc15, #eab308)", boxShadow: "0 0 40px rgba(250,204,21,0.3), 0 8px 24px rgba(0,0,0,0.4)", animation: "glow-pulse 3s ease-in-out infinite" }}
                  >
                    Solicitar Demo
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onLogin}
                    className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                  >
                    Contacto Corporativo
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </FadeIn>

              {/* Trust strip — Enterprise */}
              <FadeIn delay={0.4}>
                <div className="flex items-center gap-6 text-xs text-white/25">
                  {["Plataforma corporativa", "SOC 2 Compliant", "SLA 99.99%"].map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-teal-400" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>

            {/* Right — Telemetry Widget */}
            <FadeIn delay={0.3} direction="left">
              <div className="relative">
                {/* Glow halo */}
                <div className="absolute -inset-8 rounded-3xl pointer-events-none"
                  style={{ background: "radial-gradient(ellipse, rgba(250,204,21,0.06) 0%, transparent 70%)" }} />
                <TelemetryWidget />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  TICKER — Partners                                               */}
      {/* ================================================================ */}
      <div className="relative border-y overflow-hidden py-4" style={{ borderColor: "rgba(250,204,21,0.08)", background: "rgba(250,204,21,0.02)" }}>
        <div className="text-[9px] tracking-[0.25em] text-yellow-400/40 absolute left-4 top-1/2 -translate-y-1/2 font-medium uppercase hidden sm:block">Clientes</div>
        <div className="overflow-hidden">
          <div className="ticker-inner flex gap-16 w-max px-8">
            {[...partners, ...partners].map((p, i) => (
              <span key={i} className="text-xs font-semibold tracking-wide text-white/20 whitespace-nowrap hover:text-white/50 transition-colors cursor-default">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  STATS                                                           */}
      {/* ================================================================ */}
      <section className="py-20 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" } as React.CSSProperties}>
            {stats.map((s) => (
              <StaggerItem key={s.label}>
                <div className="bg-[#0a0a0a] px-8 py-10 text-center group hover:bg-[#111] transition-colors">
                  <div className="text-4xl lg:text-5xl font-extrabold mb-1"
                    style={{ background: "linear-gradient(135deg, #facc15, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {s.value}
                  </div>
                  <div className="text-sm font-semibold text-white/60 mb-0.5">{s.label}</div>
                  <div className="text-xs text-white/25">{s.sub}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  FEATURES — Bento Grid                                           */}
      {/* ================================================================ */}
      <section id="features" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] font-medium uppercase mb-5"
              style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.15)", color: "#facc15" }}>
              <Cpu className="h-3 w-3" /> Plataforma
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-5 tracking-tight">
              Ingeniería de{" "}
              <span style={{ background: "linear-gradient(135deg, #facc15, #14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                precisión
              </span>
            </h2>
            <p className="text-lg text-white/35 max-w-2xl mx-auto">
              Cada módulo diseñado para los retos reales de la operación energética en campo y sala de control.
            </p>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
            {features.map((f, i) => (
              <BentoCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} accent={f.accent} delay={i * 0.06} />
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  HOW IT WORKS                                                    */}
      {/* ================================================================ */}
      <section id="how-it-works" className="py-24 lg:py-32 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] font-medium uppercase mb-5"
              style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", color: "#14b8a6" }}>
              <Radio className="h-3 w-3" /> Implementación
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              En producción{" "}
              <span style={{ background: "linear-gradient(135deg, #14b8a6, #facc15)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                en horas
              </span>
            </h2>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-6" staggerDelay={0.1}>
            {steps.map((step) => (
              <StaggerItem key={step.number}>
                <div className="relative p-8 rounded-2xl h-full"
                  style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
                  <div className="text-6xl font-extrabold mb-6 leading-none"
                    style={{ background: "linear-gradient(135deg, rgba(250,204,21,0.15), transparent)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {step.number}
                  </div>
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.15)" }}>
                    <step.icon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  TESTIMONIALS                                                    */}
      {/* ================================================================ */}
      <section className="py-24 lg:py-32 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] font-medium uppercase mb-5"
              style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.15)", color: "#facc15" }}>
              <Users className="h-3 w-3" /> Clientes
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Resultados{" "}
              <span style={{ background: "linear-gradient(135deg, #facc15, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                reales
              </span>
            </h2>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-4" staggerDelay={0.08}>
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div className="h-full rounded-2xl p-7 flex flex-col"
                  style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Quote mark */}
                  <div className="text-5xl font-serif leading-none mb-4" style={{ color: "rgba(250,204,21,0.2)" }}>"</div>
                  <p className="text-sm leading-relaxed text-white/50 flex-1 mb-6">{t.quote}</p>
                  <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                      style={{ background: "linear-gradient(135deg, #facc15, #eab308)" }}>
                      {t.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{t.name}</div>
                      <div className="text-[10px] text-white/30">{t.role} · {t.company}</div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  TRUST SIGNALS / HSE CERTS                                      */}
      {/* ================================================================ */}
      <section className="py-20 border-y" style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(250,204,21,0.02)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 font-medium">Certificaciones & Cumplimiento</p>
          </FadeIn>
          <StaggerContainer className="flex flex-wrap justify-center gap-4" staggerDelay={0.06}>
            {["ISO 27001", "SOC 2 Type II", "OSHA Compliant", "API RP 754", "ISO 45001", "GDPR Ready"].map((cert) => (
              <StaggerItem key={cert}>
                <div className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
                  style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {cert}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  PRICING — Hidden for Enterprise presentation                   */}
      {/* ================================================================ */}
      {false && (
      <section id="pricing" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] font-medium uppercase mb-5"
              style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", color: "#14b8a6" }}>
              <BarChart3 className="h-3 w-3" /> Planes
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">Precios transparentes</h2>
            <p className="text-white/35 text-lg">Sin sorpresas. Sin cargos ocultos.</p>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-4 items-stretch" staggerDelay={0.08}>
            {plans.map((plan) => (
              <StaggerItem key={plan.name}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="h-full rounded-2xl flex flex-col overflow-hidden"
                  style={{
                    background: plan.popular ? "linear-gradient(135deg, #111, #0d0d0d)" : "#0d0d0d",
                    border: plan.popular ? "1px solid rgba(250,204,21,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: plan.popular ? "0 0 60px rgba(250,204,21,0.1), 0 16px 40px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  {plan.popular && (
                    <div className="text-center py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-black"
                      style={{ background: "linear-gradient(90deg, #facc15, #eab308)" }}>
                      Más Popular
                    </div>
                  )}
                  <div className="p-7 flex-1 flex flex-col">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                      <p className="text-xs text-white/30">{plan.desc}</p>
                    </div>
                    {plan.price ? (
                      <div className="mb-8">
                        <span className="text-5xl font-extrabold text-white">{plan.price}</span>
                        <span className="text-white/30 text-sm ml-1">{plan.period}</span>
                      </div>
                    ) : (
                      <div className="mb-8">
                        <span className="text-2xl font-bold text-white/60">A consultar</span>
                      </div>
                    )}
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm text-white/50">
                          <CheckCircle className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={plan.enterprise ? () => {} : onRegister}
                      className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                      style={plan.popular
                        ? { background: "linear-gradient(135deg, #facc15, #eab308)", color: "#000", boxShadow: "0 0 20px rgba(250,204,21,0.2)" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {plan.cta}
                    </motion.button>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
      )}

      {/* ================================================================ */}
      {/*  FAQ                                                             */}
      {/* ================================================================ */}
      <section id="faq" className="py-24 lg:py-32 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-white tracking-tight mb-3">Preguntas frecuentes</h2>
            <p className="text-white/35">Respuestas directas para decisores técnicos.</p>
          </FadeIn>
          <FadeIn className="space-y-2" delay={0.1}>
            {faqs.map((faq) => {
              const isOpen = openFaq === faq.id
              return (
                <div key={faq.id} className="rounded-xl overflow-hidden"
                  style={{ background: "#0d0d0d", border: isOpen ? "1px solid rgba(250,204,21,0.2)" : "1px solid rgba(255,255,255,0.05)", transition: "border-color 0.3s" }}>
                  <button
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                  >
                    <span className="text-sm font-semibold text-white">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-white/30 shrink-0 ml-4 transition-transform duration-300 ${isOpen ? "rotate-180 text-yellow-400" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="faq-open">
                      <div className="px-6 pb-5 pt-0 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <p className="text-sm text-white/40 leading-relaxed pt-4">{faq.a}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </FadeIn>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  FINAL CTA                                                       */}
      {/* ================================================================ */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-t" style={{ borderColor: "rgba(250,204,21,0.08)" }}>
        <EnergyGrid />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
              style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.15)", color: "#facc15" }}>
              <Zap className="h-3 w-3" /> Plataforma corporativa exclusiva
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6">
              Su operación merece{" "}
              <span style={{ background: "linear-gradient(135deg, #facc15, #fde68a, #14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                herramientas de precisión
              </span>
            </h2>
            <p className="text-lg text-white/35 mb-12 max-w-xl mx-auto">
              Más de 500 empresas confían en nuestra plataforma. Acceso gestionado por el Holding, sin pagos públicos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={onRegister}
                className="group flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-sm font-bold text-black"
                style={{ background: "linear-gradient(135deg, #facc15, #eab308)", boxShadow: "0 0 60px rgba(250,204,21,0.3), 0 12px 32px rgba(0,0,0,0.5)", animation: "glow-pulse 3s ease-in-out infinite" }}
              >
                Solicitar Demo
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.02 }}
                href="mailto:ventas@energycompliance.com"
                className="flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
              >
                <Mail className="h-4 w-4" /> Contacto Corporativo
              </motion.a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  FOOTER                                                          */}
      {/* ================================================================ */}
      <footer className="border-t py-16" style={{ borderColor: "rgba(255,255,255,0.04)", background: "#080808" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">
            <div className="col-span-2 lg:pr-8">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0"
                  style={{ background: "linear-gradient(135deg, #facc15, #eab308)" }}>
                  <img src="/logo.jpeg" alt="ECH" className="h-full w-full object-cover" />
                </div>
                <span className="text-sm font-bold text-white">Energy Compliance Hub</span>
              </div>
              <p className="text-xs text-white/25 leading-relaxed mb-5 max-w-xs">
                Plataforma líder en gestión de permisos de trabajo, cumplimiento HSE y telemetría SCADA para la industria energética en LATAM.
              </p>
              <div className="flex gap-2">
                {[{ Icon: Twitter, label: "Twitter" }, { Icon: Linkedin, label: "LinkedIn" }, { Icon: Mail, label: "Email" }].map(({ Icon, label }) => (
                  <button key={label} aria-label={label}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-white/25 hover:text-yellow-400 transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#0d0d0d" }}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {[
              { title: "Producto", items: ["Permisos de Trabajo", "SCADA en Tiempo Real", "Documentos HSE", "Firma Digital", "Análisis Predictivo", "API"] },
              { title: "Empresa", items: ["Sobre Nosotros", "Blog", "Carreras", "Partners", "Contacto"] },
              { title: "Legal", items: ["Términos de Servicio", "Privacidad", "SLA", "Cookies"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-[9px] tracking-[0.2em] font-semibold uppercase text-white/20 mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.items.map(item => (
                    <li key={item}>
                      <button className="text-xs text-white/30 hover:text-white/60 transition-colors">{item}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* FOOTER ACTUALIZADO */}
          <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <p className="text-[11px] text-white/20">© {new Date().getFullYear()} Energy-Compliance Hub. Operado por Alserla Intelligence Holdings, LLC. Todos los derechos reservados.</p>
            <div className="flex items-center gap-5">
              {[{ Icon: Lock, label: "Encriptación E2E" }, { Icon: ShieldCheck, label: "SOC 2 Compliant" }].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] text-white/20">
                  <Icon className="h-3 w-3 text-teal-400/60" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
