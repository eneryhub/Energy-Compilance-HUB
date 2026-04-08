"use client"

import { useState, useRef, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { motion, useInView } from "framer-motion"
import {
  Activity,
  FileCheck,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Menu,
  Sun,
  Moon,
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
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
}

/* ------------------------------------------------------------------ */
/*  Fade-in wrapper (scroll-triggered)                                */
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
  direction?: "up" | "down" | "left" | "right"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  const dirMap = {
    up: { y: 30 },
    down: { y: -30 },
    left: { x: 30 },
    right: { x: -30 },
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stagger container                                                 */
/* ------------------------------------------------------------------ */
function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated gradient mesh background for Hero                        */
/* ------------------------------------------------------------------ */
function GradientMesh() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Primary emerald blob — top right */}
      <div
        className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]"
        style={{ animation: "mesh-drift-1 25s ease-in-out infinite" }}
      />
      {/* Secondary teal blob — bottom left */}
      <div
        className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-teal-500/8 blur-[100px]"
        style={{ animation: "mesh-drift-2 30s ease-in-out infinite" }}
      />
      {/* Tertiary green blob — center */}
      <div
        className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-green-500/5 blur-[80px]"
        style={{ animation: "mesh-drift-3 20s ease-in-out infinite" }}
      />
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16,185,129,0.4) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />
      {/* Radial gradient vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--mesh-fade-color)_70%)]" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                   */
/* ------------------------------------------------------------------ */
function Section({
  id,
  children,
  className = "",
  dark = false,
}: {
  id?: string
  children: React.ReactNode
  className?: string
  dark?: boolean
}) {
  return (
    <section
      id={id}
      className={`relative py-24 sm:py-32 ${dark ? "bg-muted/30 border-y border-border/40" : "bg-background"} ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section header pattern                                            */
/* ------------------------------------------------------------------ */
function SectionHeader({
  badge,
  badgeIcon: BadgeIcon,
  title,
  highlight,
  description,
}: {
  badge: string
  badgeIcon: React.ComponentType<{ className?: string }>
  title: string
  highlight?: string
  description: string
}) {
  return (
    <FadeIn className="mx-auto max-w-3xl text-center">
      <Badge
        variant="secondary"
        className="mb-5 border-border/50 px-4 py-1.5 text-xs font-medium uppercase tracking-widest"
      >
        <BadgeIcon className="mr-1.5 h-3 w-3" />
        {badge}
      </Badge>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
        {highlight && (
          <span className="text-emerald-600 dark:text-emerald-400">
            {" "}
            {highlight}
          </span>
        )}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>
    </FadeIn>
  )
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function LandingPage({
  onLogin,
  onRegister,
}: LandingPageProps) {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  // Hydration-safe client detection (React 19 pattern)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id))
  }

  /* -------------------------------------------------------------- */
  /*  Data                                                           */
  /* -------------------------------------------------------------- */
  const navLinks = [
    { label: "Inicio", target: "hero" },
    { label: "Características", target: "features" },
    { label: "Cómo Funciona", target: "how-it-works" },
    { label: "Planes", target: "pricing" },
    { label: "FAQ", target: "faq" },
  ]

  const partnerIndustries = [
    "PetroAndina S.A.",
    "GasNatural Corp",
    "Eólica del Sur",
    "MinTech Energy",
    "Refinería Central",
    "SolarPack Latam",
  ]

  const features = [
    {
      icon: FileCheck,
      title: "Permisos de Trabajo",
      desc: "Cree, apruebe y rastree permisos de trabajo con firmas digitales, verificación GPS y flujos de aprobación automatizados. Reduzca tiempos de aprobación hasta en un 70%.",
    },
    {
      icon: Activity,
      title: "SCADA en Tiempo Real",
      desc: "Monitoree sensores de presión, temperatura, gas y voltaje con alertas predictivas potenciadas por inteligencia artificial. Visualice datos de miles de puntos de medición.",
    },
    {
      icon: ShieldCheck,
      title: "Cumplimiento HSE",
      desc: "Gestione certificados, licencias y documentos regulatorios con seguimiento de vencimiento automatizado. Auditoría completa trazable en cada acción.",
    },
    {
      icon: TrendingUp,
      title: "Análisis Predictivo",
      desc: "Algoritmos de machine learning que analizan datos históricos y en tiempo real para anticipar fallas en equipos y optimizar planificación de mantenimiento.",
    },
    {
      icon: Smartphone,
      title: "Acceso Móvil Total",
      desc: "Plataforma responsive y PWA nativa. Operadores en campo pueden aprobar permisos, reportar incidencias y consultar sensores desde cualquier dispositivo.",
    },
    {
      icon: Users,
      title: "Gestión de Equipos",
      desc: "Roles personalizados, asignación de permisos granular, registros de capacitación y seguimiento de competencias. Escala desde 5 hasta miles de usuarios.",
    },
  ]

  const stats = [
    { value: "500+", label: "Empresas activas", sublabel: "en 12 países" },
    { value: "2M+", label: "Permisos procesados", sublabel: "anualmente" },
    { value: "99.99%", label: "Disponibilidad", sublabel: "SLA garantizado" },
    { value: "70%", label: "Menos tiempo", sublabel: "en aprobaciones" },
  ]

  const steps = [
    {
      icon: Globe,
      number: "01",
      title: "Registre su empresa",
      desc: "Configuración guiada en 30 segundos. Sin tarjeta de crédito. Migración asistida desde sistemas legados.",
    },
    {
      icon: Settings,
      number: "02",
      title: "Configure su operación",
      desc: "Plantillas predefinidas para permisos de trabajo, telemetría SCADA y documentos HSE. Personalización completa.",
    },
    {
      icon: Rocket,
      number: "03",
      title: "Opere con confianza",
      desc: "Monitoreo en tiempo real, alertas inteligentes, auditoría automática y cumplimiento regulatorio total.",
    },
  ]

  const testimonials = [
    {
      quote:
        "Energy-Compliance Hub transformó nuestra operación. Redujimos los tiempos de aprobación de permisos en un 70% y eliminamos los errores manuales en documentación HSE.",
      name: "Ing. Carlos Mendoza",
      role: "Director de Operaciones",
      company: "PetroSur Energía S.A.",
    },
    {
      quote:
        "La telemetría SCADA nos permite anticipar problemas antes de que ocurran. En 6 meses pasamos de 3 incidentes mensuales a prácticamente cero paradas no planificadas.",
      name: "Lic. María Fernanda Rojas",
      role: "Gerente de HSE",
      company: "GasNatural Corp",
    },
    {
      quote:
        "Implementamos la plataforma en 3 plantas simultáneamente. La migración fue fluida y el soporte técnico excepcional. Hoy no podemos operar sin ella.",
      name: "Ing. Roberto Aguilar",
      role: "CTO",
      company: "Eólica del Sur",
    },
  ]

  const plans = [
    {
      name: "Starter",
      price: "$149",
      period: "/mes",
      desc: "Ideal para pequeñas operaciones",
      features: [
        "Hasta 10 usuarios",
        "200 permisos/mes",
        "Documentos HSE básicos",
        "Soporte por email",
        "Firma digital",
      ],
      cta: "Comenzar Trial",
      popular: false,
      enterprise: false,
    },
    {
      name: "Business",
      price: "$499",
      period: "/mes",
      desc: "Para empresas en crecimiento",
      features: [
        "Hasta 50 usuarios",
        "2,000 permisos/mes",
        "SCADA en tiempo real",
        "Análisis predictivo con IA",
        "Documentos HSE avanzados",
        "Soporte prioritario 24/7",
        "API de integración",
      ],
      cta: "Comenzar Trial",
      popular: true,
      enterprise: false,
    },
    {
      name: "Enterprise",
      price: "",
      period: "",
      desc: "Solución a medida para su organización",
      features: [
        "Usuarios ilimitados",
        "Permisos ilimitados",
        "SCADA multi-sitio",
        "IA predictiva avanzada",
        "Cumplimiento regulatorio completo",
        "SLA garantizado 99.99%",
        "Soporte dedicado",
        "Integraciones personalizadas",
      ],
      cta: "Contactar Ventas",
      popular: false,
      enterprise: true,
    },
  ]

  const faqs = [
    {
      id: "faq-1",
      question: "¿Cuánto tiempo toma la implementación?",
      answer:
        "La configuración inicial toma menos de 30 minutos. Para la versión Business, la implementación completa incluyendo migración de datos y capacitación se realiza en 5-10 días hábiles. La versión Enterprise incluye un equipo de implementación dedicado con un plan personalizado.",
    },
    {
      id: "faq-2",
      question: "¿Es compatible con nuestros sistemas SCADA existentes?",
      answer:
        "Sí. Energy-Compliance Hub se integra con los principales protocolos industriales (OPC-UA, Modbus, MQTT) y plataformas SCADA. Además ofrecemos APIs REST y WebSockets para integración personalizada con cualquier sistema.",
    },
    {
      id: "faq-3",
      question: "¿Cumple con las regulaciones locales de cada país?",
      answer:
        "Nuestra plataforma está diseñada para cumplir con las regulaciones HSE de los principales países latinoamericanos (OSHA, IRAM, NTP, ISO 45001, ISO 14001). Actualizamos continuamente nuestros templates según cambios regulatorios.",
    },
    {
      id: "faq-4",
      question: "¿Qué pasa con mis datos si decido no continuar?",
      answer:
        "Puede exportar todos sus datos en formato estándar (CSV, JSON, PDF) en cualquier momento. Cumplimos con políticas de portabilidad de datos y eliminamos toda su información bajo solicitud dentro de los 30 días siguientes a la cancelación.",
    },
    {
      id: "faq-5",
      question: "¿Ofrecen capacitación para mi equipo?",
      answer:
        "Todos los planes incluyen acceso a nuestra biblioteca de video-tutoriales, documentación técnica y webinars semanales. Los planes Business y Enterprise incluyen sesiones de capacitación en vivo y un responsable de éxito del cliente dedicado.",
    },
    {
      id: "faq-6",
      question: "¿Puedo usar la plataforma sin conexión a internet?",
      answer:
        "Sí. Nuestra aplicación móvil (PWA) funciona offline y sincroniza automáticamente cuando se restaura la conexión. Los operadores en campo pueden crear, firmar y aprobar permisos sin cobertura, asegurando continuidad operativa.",
    },
  ]

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes mesh-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 40px) scale(1.05); }
          66% { transform: translate(20px, -20px) scale(0.95); }
        }
        @keyframes mesh-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(0.95); }
          66% { transform: translate(-20px, 20px) scale(1.05); }
        }
        @keyframes mesh-drift-3 {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50% { transform: translate(-50%, -30px) scale(1.1); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        @keyframes float-spin {
          0% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(90deg) translateY(-10px); }
          50% { transform: rotate(180deg) translateY(0); }
          75% { transform: rotate(270deg) translateY(10px); }
          100% { transform: rotate(360deg) translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes slide-in-fade {
          0% { max-height: 0; opacity: 0; }
          100% { max-height: 500px; opacity: 1; }
        }
        @keyframes counter-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(16, 185, 129, 0); }
          50% { text-shadow: 0 0 40px rgba(16, 185, 129, 0.15); }
        }
        .faq-answer-open {
          animation: slide-in-fade 0.3s ease-out forwards;
        }
      `}</style>

      {/* ============================================================ */}
      {/*  NAVBAR                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 overflow-hidden">
              <img src="/logo.jpeg" alt="ECH" className="h-7 w-7 object-cover rounded" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Energy-Compliance Hub
            </span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => scrollTo(link.target)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTA + theme toggle */}
          <div className="hidden items-center gap-2 md:flex">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setTheme(theme === "dark" ? "light" : "dark")
                }
                aria-label="Cambiar tema"
                className="text-muted-foreground hover:text-foreground"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onLogin}>
              Iniciar Sesión
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
              onClick={onRegister}
            >
              Comenzar Gratis
            </Button>
          </div>

          {/* Mobile: hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setTheme(theme === "dark" ? "light" : "dark")
                }
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 overflow-hidden">
                      <img
                        src="/logo.jpeg"
                        alt="ECH"
                        className="h-6 w-6 object-cover rounded"
                      />
                    </div>
                    Energy-Compliance Hub
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-1 px-4">
                  {navLinks.map((link) => (
                    <button
                      key={link.target}
                      onClick={() => scrollTo(link.target)}
                      className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {link.label}
                    </button>
                  ))}
                  <Separator className="my-3" />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMobileOpen(false)
                      onLogin()
                    }}
                  >
                    Iniciar Sesión
                  </Button>
                  <Button
                    className="mt-1 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setMobileOpen(false)
                      onRegister()
                    }}
                  >
                    Comenzar Gratis
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section
        id="hero"
        className="relative overflow-hidden"
        style={
          {
            "--mesh-fade-color": theme === "dark" ? "rgb(2,6,23)" : "rgb(255,255,255)",
          } as React.CSSProperties
        }
      >
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/20 dark:via-background dark:to-background" />
        <GradientMesh />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-36 lg:pb-32">
          <div className="mx-auto max-w-5xl text-center">
            {/* Trust badge */}
            <FadeIn>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-5 py-2 text-sm text-emerald-700 dark:text-emerald-300 backdrop-blur-sm">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <span className="font-medium">Usado por 500+ empresas en Latinoamérica</span>
              </div>
            </FadeIn>

            {/* Headline */}
            <FadeIn delay={0.1}>
              <h1 className="text-5xl leading-[1.08] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                Transforme la gestión de{" "}
                <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  cumplimiento energético
                </span>
              </h1>
            </FadeIn>

            {/* Sub-headline */}
            <FadeIn delay={0.2}>
              <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                La plataforma integral que une permisos de trabajo, telemetría SCADA en tiempo real,
                análisis predictivo con IA y firma digital. Reduzca tiempos de aprobación un{" "}
                <span className="font-semibold text-foreground">70%</span> y elimine incidentes
                operativos.
              </p>
            </FadeIn>

            {/* CTA buttons */}
            <FadeIn delay={0.3}>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="group h-13 w-full px-8 bg-emerald-600 text-base font-semibold text-white shadow-xl shadow-emerald-600/25 hover:bg-emerald-700 transition-all hover:shadow-2xl hover:shadow-emerald-600/30 sm:w-auto"
                  onClick={onRegister}
                >
                  Comenzar Trial Gratis
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="group h-13 w-full border-border/60 px-8 text-base font-semibold sm:w-auto"
                  onClick={() => scrollTo("how-it-works")}
                >
                  Ver cómo funciona
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            </FadeIn>

            {/* Social proof line */}
            <FadeIn delay={0.4}>
              <p className="mt-8 text-sm text-muted-foreground">
                Trial gratuito de 7 días · Sin tarjeta de crédito · Configuración en 30 segundos
              </p>
            </FadeIn>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ============================================================ */}
      {/*  LOGOS / PARTNERS                                            */}
      {/* ============================================================ */}
      <Section className="py-16 sm:py-20">
        <FadeIn className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Empresas líderes confían en nosotros
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-40 grayscale">
            {partnerIndustries.map((name) => (
              <span
                key={name}
                className="whitespace-nowrap text-lg font-bold tracking-tight text-foreground sm:text-xl"
              >
                {name}
              </span>
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* ============================================================ */}
      {/*  FEATURES                                                    */}
      {/* ============================================================ */}
      <Section id="features">
        <SectionHeader
          badge="Características"
          badgeIcon={Zap}
          title="Todo lo que necesita para operar con"
          highlight="cumplimiento total"
          description="Herramientas integradas diseñadas para las demandas más exigentes de la industria energética y de recursos naturales."
        />

        <StaggerContainer className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <Card className="group relative h-full border-border/50 bg-card transition-all duration-500 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5">
                {/* Gradient top accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent transition-all duration-500 group-hover:via-emerald-500/60" />
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-600 transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {f.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ============================================================ */}
      {/*  METRICS / STATS                                             */}
      {/* ============================================================ */}
      <Section dark>
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.1}>
              <div className="text-center">
                <div
                  className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #059669, #10b981, #14b8a6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {stat.value}
                </div>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {stat.sublabel}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <Section id="how-it-works">
        <SectionHeader
          badge="Cómo Funciona"
          badgeIcon={Rocket}
          title="Comience en minutos,"
          highlight="no en semanas"
          description="Tres simples pasos para digitalizar y transformar su gestión de cumplimiento operativo."
        />

        <StaggerContainer className="relative mt-20 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {/* Connecting line (desktop only) */}
          <div className="pointer-events-none absolute top-[52px] right-[16.66%] left-[16.66%] hidden md:block">
            <div className="h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0" />
            {/* Midpoint dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-500/30" />
          </div>

          {steps.map((step) => (
            <StaggerItem key={step.number}>
              <div className="relative flex flex-col items-center text-center">
                {/* Step circle */}
                <div className="relative z-10 flex h-[104px] w-[104px] items-center justify-center rounded-2xl border border-emerald-500/20 bg-card shadow-xl shadow-emerald-500/5 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/10">
                  <step.icon className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  <span className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/30">
                    {step.number}
                  </span>
                </div>
                {/* Text */}
                <h3 className="mt-7 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ============================================================ */}
      {/*  TESTIMONIALS                                                */}
      {/* ============================================================ */}
      <Section dark>
        <SectionHeader
          badge="Testimonios"
          badgeIcon={Mail}
          title="Lo que dicen nuestros"
          highlight="clientes"
          description="Empresas líderes en la industria energética confían en Energy-Compliance Hub para sus operaciones críticas."
        />

        <StaggerContainer className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <Card className="group h-full border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
                <CardContent className="pt-7 pb-6">
                  {/* Stars */}
                  <div className="mb-5 flex gap-0.5 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="h-4 w-4 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <blockquote className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {t.name
                        .split(" ")
                        .filter((_, i) => i > 0)
                        .map((w) => w[0])
                        .join("")}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.role} — {t.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ============================================================ */}
      {/*  PRICING                                                     */}
      {/* ============================================================ */}
      <Section id="pricing">
        <SectionHeader
          badge="Planes"
          badgeIcon={Lock}
          title="Un plan para cada escala de"
          highlight="operación"
          description="Comience gratis. Escale cuando esté listo. Sin sorpresas ni costos ocultos."
        />

        <StaggerContainer className="mt-16 grid grid-cols-1 gap-6 items-start md:grid-cols-3">
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <Card
                className={`relative h-full flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "border-emerald-500/60 shadow-xl shadow-emerald-500/10 scale-[1.02] md:scale-105"
                    : plan.enterprise
                      ? "border-border/50 hover:shadow-lg hover:shadow-emerald-500/5"
                      : "border-border/50 hover:shadow-lg hover:shadow-emerald-500/5"
                }`}
              >
                {/* Popular gradient top */}
                {plan.popular && (
                  <>
                    <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30">
                        <Zap className="mr-1 h-3 w-3" />
                        MÁS POPULAR
                      </Badge>
                    </div>
                  </>
                )}

                {/* Enterprise badge */}
                {plan.enterprise && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Globe className="mr-1 h-3 w-3" />
                      ENTERPRISE
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.desc}</CardDescription>
                  <div className="mt-5 flex items-baseline gap-1">
                    {plan.price ? (
                      <>
                        <span className="text-4xl font-extrabold tracking-tight">
                          {plan.price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      </>
                    ) : (
                      <span className="text-xl font-bold text-foreground">
                        Contactar con Ventas
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {plan.enterprise ? (
                    <Button
                      variant="outline"
                      className="w-full border-border/60 hover:bg-accent"
                      asChild
                    >
                      <a href="mailto:ventas@energycompliance.com">
                        <Mail className="mr-1.5 h-4 w-4" />
                        Contactar Ventas
                      </a>
                    </Button>
                  ) : (
                    <Button
                      className={`w-full text-white shadow-lg transition-all ${
                        plan.popular
                          ? "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-emerald-600/30"
                          : "bg-slate-800 shadow-slate-800/20 hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:shadow-slate-100/10 dark:hover:bg-slate-200"
                      }`}
                      onClick={onRegister}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      {/* ============================================================ */}
      {/*  FAQ                                                         */}
      {/* ============================================================ */}
      <Section id="faq" dark>
        <SectionHeader
          badge="Preguntas Frecuentes"
          badgeIcon={HelpCircleIcon}
          title="¿Tiene preguntas?"
          highlight="Tenemos respuestas"
          description="Encuentre respuestas a las preguntas más comunes sobre Energy-Compliance Hub."
        />

        <FadeIn className="mx-auto mt-16 max-w-3xl">
          <div className="space-y-3">
            {faqs.map((faq) => {
              const isOpen = openFaq === faq.id
              return (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-xl border border-border/50 bg-card transition-colors hover:border-border/80"
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="faq-answer-open overflow-hidden">
                      <div className="border-t border-border/40 px-6 pb-5 pt-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </FadeIn>
      </Section>

      {/* ============================================================ */}
      {/*  FINAL CTA                                                   */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-background py-24 sm:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(16,185,129,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(16,185,129,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Comience a transformar su{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                operación hoy
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Únase a más de 500 empresas que ya digitalizaron su gestión de cumplimiento.
              Configure su cuenta en 30 segundos y comience su trial gratuito.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="group h-13 w-full px-10 bg-emerald-600 text-base font-semibold text-white shadow-xl shadow-emerald-600/25 hover:bg-emerald-700 transition-all hover:shadow-2xl hover:shadow-emerald-600/30 sm:w-auto"
                onClick={onRegister}
              >
                Comenzar Trial Gratis
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="group h-13 w-full px-10 text-base font-semibold sm:w-auto"
                asChild
              >
                <a href="mailto:ventas@energycompliance.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Hablar con Ventas
                </a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Sin tarjeta de crédito requerida · Soporte incluido · Cancelación en cualquier momento
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-border/40 bg-background py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-2 lg:pr-8">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white overflow-hidden">
                  <img
                    src="/logo.jpeg"
                    alt="ECH"
                    className="h-7 w-7 object-cover rounded"
                  />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  Energy-Compliance Hub
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Plataforma líder en gestión de permisos de trabajo, cumplimiento HSE y telemetría SCADA
                para la industria energética en Latinoamérica.
              </p>
              {/* Social icons */}
              <div className="mt-6 flex gap-2.5">
                {[
                  { Icon: Twitter, label: "Twitter" },
                  { Icon: Linkedin, label: "LinkedIn" },
                  { Icon: Mail, label: "Email" },
                ].map(({ Icon, label }) => (
                  <button
                    key={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Links columns */}
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Producto
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  "Permisos de Trabajo",
                  "SCADA en Tiempo Real",
                  "Documentos HSE",
                  "Firma Digital",
                  "Análisis Predictivo",
                  "API",
                ].map((item) => (
                  <li key={item}>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Empresa
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  "Sobre Nosotros",
                  "Blog",
                  "Carreras",
                  "Partners",
                  "Contacto",
                ].map((item) => (
                  <li key={item}>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Legal
              </h4>
              <ul className="space-y-3 text-sm">
                {[
                  "Términos de Servicio",
                  "Privacidad",
                  "SLA",
                  "Cookies",
                ].map((item) => (
                  <li key={item}>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-10 opacity-50" />

          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Energy-Compliance Hub. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Encriptación E2E</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                <span>SOC 2 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Small helper icon for FAQ badge (using existing icon)             */
/* ------------------------------------------------------------------ */
function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}
