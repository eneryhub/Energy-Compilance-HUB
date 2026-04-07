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
  Settings,
  Rocket,
  Mail,
  Linkedin,
  Twitter,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
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
  staggerDelay = 0.12,
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

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated floating shapes for Hero background                      */
/* ------------------------------------------------------------------ */
function FloatingShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Large emerald circle — top right */}
      <div
        className="absolute -top-24 -right-24 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-3xl"
        style={{ animation: "float-slow 20s ease-in-out infinite" }}
      />
      {/* Small emerald circle — bottom left */}
      <div
        className="absolute -bottom-16 -left-16 h-[350px] w-[350px] rounded-full bg-emerald-500/5 blur-3xl"
        style={{ animation: "float-slow 25s ease-in-out infinite reverse" }}
      />
      {/* Geometric shape 1 */}
      <div
        className="absolute top-1/4 left-[10%] h-16 w-16 rotate-45 rounded-xl border border-emerald-500/10 bg-emerald-500/5"
        style={{ animation: "float-spin 18s linear infinite" }}
      />
      {/* Geometric shape 2 */}
      <div
        className="absolute top-1/3 right-[15%] h-10 w-10 rotate-12 rounded-full border border-emerald-500/10 bg-emerald-500/5"
        style={{ animation: "float-slow 22s ease-in-out infinite" }}
      />
      {/* Geometric shape 3 */}
      <div
        className="absolute bottom-1/4 left-[25%] h-12 w-12 -rotate-12 rounded-lg border border-emerald-500/10 bg-emerald-500/5"
        style={{ animation: "float-spin 24s linear infinite reverse" }}
      />
      {/* Geometric shape 4 */}
      <div
        className="absolute top-[60%] right-[30%] h-8 w-8 rotate-45 border border-emerald-500/10 bg-emerald-500/5"
        style={{ animation: "float-slow 16s ease-in-out infinite" }}
      />
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16,185,129,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  )
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

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

  /* -------------------------------------------------------------- */
  /*  Data                                                           */
  /* -------------------------------------------------------------- */
  const navLinks = [
    { label: "Inicio", target: "hero" },
    { label: "Características", target: "features" },
    { label: "Planes", target: "pricing" },
  ]

  const features = [
    {
      icon: FileCheck,
      title: "Permisos de Trabajo",
      desc: "Cree, apruebe y rastree permisos de trabajo con firmas digitales, verificación GPS y flujos de aprobación automatizados.",
    },
    {
      icon: Activity,
      title: "SCADA en Tiempo Real",
      desc: "Monitoree sensores de presión, temperatura, gas y voltaje con alertas predictivas potenciadas por inteligencia artificial.",
    },
    {
      icon: ShieldCheck,
      title: "Documentos HSE",
      desc: "Gestione certificados, licencias y documentos de cumplimiento con seguimiento de vencimiento y renovación automática.",
    },
  ]

  const steps = [
    {
      icon: Globe,
      number: "01",
      title: "Registre su empresa",
      desc: "Configuración en 30 segundos. Sin tarjeta de crédito.",
    },
    {
      icon: Settings,
      number: "02",
      title: "Configure permisos y sensores",
      desc: "Plantillas incluidas para permisos de trabajo y telemetría SCADA.",
    },
    {
      icon: Rocket,
      number: "03",
      title: "Opere con cumplimiento total",
      desc: "Monitoreo en tiempo real, alertas automáticas y auditoría completa.",
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
      price: "$4,500",
      period: "/mes",
      annualPrice: "$45,900",
      annualPeriod: "/año",
      desc: "Solución a medida para grandes corporaciones",
      features: [
        "Hasta 500 usuarios activos",
        "Permisos ilimitados",
        "SCADA multi-sitio",
        "IA predictiva avanzada",
        "Cumplimiento regulatorio completo",
        "SLA garantizado 99.99%",
        "Soporte dedicado 24/7",
        "Integraciones personalizadas",
      ],
      cta: "Comenzar con Enterprise",
      popular: false,
      enterprise: true,
    },
  ]

  const testimonial = {
    quote:
      "Energy-Compliance Hub transformó nuestra operación. Redujimos los tiempos de aprobación de permisos en un 70% y eliminamos los errores manuales en documentación HSE. La telemetría SCADA nos permite anticipar problemas antes de que ocurran.",
    name: "Ing. Carlos Mendoza",
    role: "Director de Operaciones",
    company: "PetroSur Energía S.A.",
  }

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes float-spin {
          0% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(90deg) translateY(-10px); }
          50% { transform: rotate(180deg) translateY(0); }
          75% { transform: rotate(270deg) translateY(10px); }
          100% { transform: rotate(360deg) translateY(0); }
        }
      `}</style>

      {/* ============================================================ */}
      {/*  NAVBAR                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 overflow-hidden">
              <img src="/logo.jpeg" alt="ECH" className="h-7 w-7 object-cover rounded" />
            </div>
            <span className="text-lg font-bold tracking-tight">Energy-Compliance Hub</span>
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
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Cambiar tema"
                className="text-muted-foreground hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onLogin}>
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
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
                      <img src="/logo.jpeg" alt="ECH" className="h-6 w-6 object-cover rounded" />
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
                  <Button variant="outline" className="w-full" onClick={() => { setMobileOpen(false); onLogin() }}>
                    Iniciar Sesión
                  </Button>
                  <Button
                    className="mt-1 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => { setMobileOpen(false); onRegister() }}
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
        className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-background to-background dark:from-slate-950 dark:via-background dark:to-background"
      >
        <FloatingShapes />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <FadeIn>
              <Badge
                variant="outline"
                className="mb-6 border-emerald-500/30 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-600 dark:text-emerald-400"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                🚀 Trial de 7 días — Sin tarjeta de crédito
              </Badge>
            </FadeIn>

            {/* Headline */}
            <FadeIn delay={0.1}>
              <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Gestión de Permisos y Cumplimiento HSE para la{" "}
                <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
                  Industria Energética
                </span>
              </h1>
            </FadeIn>

            {/* Sub-headline */}
            <FadeIn delay={0.2}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Plataforma integral con telemetría SCADA en tiempo real, análisis predictivo con IA y firma
                digital. Reduzca tiempos de aprobación un{" "}
                <span className="font-semibold text-foreground">70%</span>.
              </p>
            </FadeIn>

            {/* CTA buttons */}
            <FadeIn delay={0.3}>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 w-full px-8 bg-emerald-600 text-base font-semibold text-white shadow-xl shadow-emerald-600/25 hover:bg-emerald-700 sm:w-auto"
                  onClick={onRegister}
                >
                  Comenzar Trial Gratis
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full border-border/60 px-8 text-base font-semibold sm:w-auto"
                  onClick={() => scrollTo("features")}
                >
                  Ver Demo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </FadeIn>

            {/* Stats row */}
            <FadeIn delay={0.45}>
              <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  { value: "500+", label: "empresas confían" },
                  { value: "2M+", label: "permisos procesados" },
                  { value: "99.9%", label: "uptime" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                      {stat.value}
                    </span>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURES                                                    */}
      {/* ============================================================ */}
      <section id="features" className="bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section heading */}
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Zap className="mr-1 h-3 w-3" />
              Características
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Todo lo que necesita para operar con{" "}
              <span className="text-emerald-600 dark:text-emerald-400">cumplimiento total</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Herramientas integradas diseñadas para las demandas de la industria energética.
            </p>
          </FadeIn>

          {/* Cards grid */}
          <StaggerContainer className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <Card className="group h-full border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <f.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">{f.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section className="border-y border-border/40 bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Rocket className="mr-1 h-3 w-3" />
              Cómo Funciona
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comience en minutos, no en semanas
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Tres simples pasos para transformar su gestión de cumplimiento.
            </p>
          </FadeIn>

          <StaggerContainer className="relative mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Dotted connector (desktop only) */}
            <div className="pointer-events-none absolute top-16 right-0 left-0 hidden h-0.5 md:block">
              <div className="mx-auto h-full max-w-3xl border-t-2 border-dashed border-emerald-500/25" />
            </div>

            {steps.map((step, i) => (
              <StaggerItem key={step.number}>
                <div className="relative flex flex-col items-center text-center">
                  {/* Step circle */}
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-background shadow-lg shadow-emerald-500/5">
                    <step.icon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {step.number}
                    </span>
                  </div>
                  {/* Text */}
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">{step.desc}</p>
                  {/* Arrow (last one hidden) */}
                  {i < steps.length - 1 && (
                    <ArrowRight className="mt-4 hidden h-5 w-5 text-emerald-500/40 md:block" />
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PRICING                                                     */}
      {/* ============================================================ */}
      <section id="pricing" className="bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Lock className="mr-1 h-3 w-3" />
              Planes
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Un plan para cada escala de operación
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comience gratis. Escale cuando esté listo. Sin sorpresas.
            </p>
          </FadeIn>

          <StaggerContainer className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3 items-start">
            {plans.map((plan) => (
              <StaggerItem key={plan.name}>
                <Card
                  className={`relative h-full flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    plan.popular
                      ? "border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02]"
                      : plan.enterprise
                        ? "border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5"
                        : "border-border/50 hover:shadow-lg hover:shadow-emerald-500/5"
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-600 px-3 py-1 text-white shadow-lg shadow-emerald-600/30">
                        <Zap className="mr-1 h-3 w-3" />
                        MÁS POPULAR
                      </Badge>
                    </div>
                  )}

                  {/* Enterprise gold accent */}
                  {plan.enterprise && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-400">
                        <Globe className="mr-1 h-3 w-3" />
                        ENTERPRISE
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.desc}</CardDescription>
                    <div className="mt-4 flex items-baseline gap-1">
                      {plan.price ? (
                        <>
                          <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                          <span className="text-muted-foreground">{plan.period}</span>
                          {(plan as any).annualPrice && (
                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {(plan as any).annualPrice}{(plan as any).annualPeriod} — Ahorra 15%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          Contactar con Ventas
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <ul className="space-y-3">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-muted-foreground">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    {plan.enterprise ? (
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        asChild
                      >
                        <a href="/register">
                          <Mail className="mr-1.5 h-4 w-4" />
                          {plan.cta}
                        </a>
                      </Button>
                    ) : (
                      <Button
                        className={`w-full text-white shadow-lg ${
                          plan.popular
                            ? "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
                            : "bg-slate-700 shadow-slate-700/20 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
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
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TESTIMONIAL                                                 */}
      {/* ============================================================ */}
      <section className="border-t border-border/40 bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-3xl">
            <Card className="border-border/50 bg-background">
              <CardContent className="pt-8">
                <div className="flex flex-col items-center text-center">
                  {/* Stars */}
                  <div className="mb-6 flex gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <blockquote className="text-lg leading-relaxed italic text-muted-foreground sm:text-xl">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {testimonial.name
                        .split(" ")
                        .filter((_, i) => i > 0)
                        .map((w) => w[0])
                        .join("")}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role} — {testimonial.company}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-border/40 bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white overflow-hidden">
                  <img src="/logo.jpeg" alt="ECH" className="h-7 w-7 object-cover rounded" />
                </div>
                <span className="text-lg font-bold tracking-tight">Energy-Compliance Hub</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Plataforma líder en gestión de permisos, cumplimiento HSE y telemetría SCADA para la industria
                energética.
              </p>
              {/* Social icons */}
              <div className="mt-5 flex gap-3">
                {[Twitter, Linkedin, Mail].map((Icon, i) => (
                  <button
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                    aria-label="Social link"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Links columns */}
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Producto
              </h4>
              <ul className="space-y-2.5 text-sm">
                {["Permisos de Trabajo", "SCADA en Tiempo Real", "Documentos HSE", "Firma Digital", "API"].map(
                  (item) => (
                    <li key={item}>
                      <button className="text-muted-foreground transition-colors hover:text-foreground">
                        {item}
                      </button>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Empresa
              </h4>
              <ul className="space-y-2.5 text-sm">
                {["Sobre Nosotros", "Blog", "Carreras", "Partners", "Contacto"].map((item) => (
                  <li key={item}>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Legal
              </h4>
              <ul className="space-y-2.5 text-sm">
                {["Términos de Servicio", "Política de Privacidad", "SLA", "Cookies"].map((item) => (
                  <li key={item}>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-10" />

          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-muted-foreground">
              © 2025 Energy-Compliance Hub. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Encriptación de extremo a extremo</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
