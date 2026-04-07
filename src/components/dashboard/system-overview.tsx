'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Shield,
  FileText,
  MapPin,
  PenLine,
  FileCheck,
  AlertTriangle,
  Brain,
  ArrowRight,
  Lock,
  Database,
  Server,
  Globe,
  Users,
  Layers,
  Zap,
  Eye,
  Clock,
  BarChart3,
  Building2,
  CheckCircle2,
  XCircle,
  ArrowDown,
  ArrowUp,
  Workflow,
  Cpu,
  Wifi,
} from 'lucide-react'

const modules = [
  {
    id: 'ops',
    name: 'Módulo de Operaciones',
    subtitle: 'Energy-Compliance (Legacy)',
    color: '#10b981',
    icon: FileText,
    features: [
      'Permisos de trabajo en altura, eléctrico, confinado, caliente',
      'Checklist de seguridad dinámico por tipo de riesgo',
      'Firma digital con coordenadas GPS integradas',
      'Generación automática de PDF (PENDIENTE → AUTORIZADO)',
      'Validación geofence: técnico dentro del radio de trabajo',
      'Creación dinámica de sitios de trabajo con GPS',
    ],
  },
  {
    id: 'hse',
    name: 'Módulo de Cumplimiento HSE',
    subtitle: 'HSE Guard (Legacy)',
    color: '#f59e0b',
    icon: Shield,
    features: [
      'Gestión de documentos HSE (médicos, capacitaciones, legales)',
      'Control de vencimiento con alertas inteligentes (30 días)',
      'Clasificación por criticidad: CRÍTICO, NORMAL, BAJO',
      'Categorías: PERSONAL, EQUIPOS, LEGAL, AMBIENTAL',
      'Extracción de datos con IA (DeepSeek Vision)',
      'Auditoría completa de cambios y revisiones',
    ],
  },
  {
    id: 'bridge',
    name: 'Puente de Cumplimiento',
    subtitle: 'Fusión Cross-Module',
    color: '#ef4444',
    icon: Lock,
    features: [
      'REGLA CRÍTICA: Documentos CRÍTICOS vencidos = OPERACIONES BLOQUEADAS',
      'Validación automática antes de crear permisos',
      'Validación automática antes de aprobar permisos',
      'Validación automática antes de firmar documentos',
      'Dashboard unificado con estado de cumplimiento en tiempo real',
      'Alertas visuales y bloqueos de UI en todas las pantallas',
    ],
  },
  {
    id: 'infra',
    name: 'Infraestructura Técnica',
    subtitle: 'SAS Cloud-Ready',
    color: '#6366f1',
    icon: Server,
    features: [
      'Next.js 15 App Router (SSR, Edge Functions, API Routes)',
      'Prisma ORM + PostgreSQL (Supabase ready)',
      'Autenticación JWT con sesiones seguras',
      'Multitenancy por empresa (Company isolation)',
      'PDFKit para generación de PDFs server-side',
      'Suscripción por planes: Starter, Business, Enterprise',
    ],
  },
]

const flowSteps = [
  {
    step: 1,
    title: 'Técnico firma permiso',
    desc: 'Captura GPS automática + firma digital canvas',
    icon: PenLine,
    color: '#3b82f6',
  },
  {
    step: 2,
    title: 'Validación HSE automática',
    desc: '¿Documentos críticos vigentes? Sí → Continuar / No → BLOQUEAR',
    icon: Shield,
    color: '#ef4444',
  },
  {
    step: 3,
    title: 'PDF generado: PENDIENTE',
    desc: 'PDF con datos del permiso, checklist, firma del técnico + GPS',
    icon: FileText,
    color: '#f59e0b',
  },
  {
    step: 4,
    title: 'Supervisor revisa',
    desc: 'Supervisor abre panel de aprobaciones, revisa checklist y ubicación',
    icon: Eye,
    color: '#8b5cf6',
  },
  {
    step: 5,
    title: 'Geofence validation',
    desc: '¿Supervisor dentro del radio del sitio de trabajo? GPS verification',
    icon: MapPin,
    color: '#10b981',
  },
  {
    step: 6,
    title: 'Supervisor firma',
    desc: 'Firma digital con GPS → PDF actualiza a: AUTORIZADO',
    icon: CheckCircle2,
    color: '#10b981',
  },
]

const techStack = [
  { name: 'Next.js 15', desc: 'Framework React fullstack con App Router', icon: Globe },
  { name: 'Prisma ORM', desc: 'Mapeo objeto-relacional con CUIDs', icon: Database },
  { name: 'SQLite / PostgreSQL', desc: 'DB local desarrollo, Supabase producción', icon: Database },
  { name: 'PDFKit', desc: 'Generación server-side de PDFs profesionales', icon: FileText },
  { name: 'Framer Motion', desc: 'Animaciones fluidas y transiciones', icon: Zap },
  { name: 'Recharts', desc: 'Gráficos interactivos para dashboard', icon: BarChart3 },
  { name: 'shadcn/ui', desc: 'Componentes UI profesionales y accesibles', icon: Layers },
  { name: 'Lucide Icons', desc: 'Iconografía consistente', icon: Cpu },
]

export default function SystemOverview() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 lg:p-8"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtMzBWMkgydjJoMzR6TTIgMjJoMzR2LTJIMHZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Energy-Compliance Hub</h1>
              <p className="text-slate-400 text-sm">Plataforma SaaS Profesional de Gestión HSE y Permisos de Trabajo</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              Fusión: Energy-Compliance + HSE Guard
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
              8 Modelos de Datos (CUIDs)
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
              Next.js 15 App Router
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
              GPS + Geofence
            </Badge>
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
              Compliance Bridge
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Architecture Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Modules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            Arquitectura de Módulos
          </h2>
          {modules.map((mod, idx) => {
            const Icon = mod.icon
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + idx * 0.05 }}
              >
                <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: mod.color + '15' }}>
                        <Icon className="w-5 h-5" style={{ color: mod.color }} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold text-slate-700">{mod.name}</CardTitle>
                        <CardDescription className="text-xs">{mod.subtitle}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {mod.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: mod.color }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Flow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Workflow className="w-5 h-5 text-emerald-600" />
            Flujo de Aprobación (Two-Phase Signature)
          </h2>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">
                Flujo: Técnico Firma → PDF PENDIENTE → Supervisor Aprueba → PDF AUTORIZADO
              </CardTitle>
              <CardDescription className="text-xs">
                Cada paso incluye validación GPS y verificación HSE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {flowSteps.map((step, idx) => {
                const Icon = step.icon
                const isLast = idx === flowSteps.length - 1
                const isBridge = step.step === 2
                return (
                  <div key={step.step}>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: step.color }}
                        >
                          {step.step}
                        </div>
                        {!isLast && (
                          <div className="w-0.5 h-8 my-1 bg-slate-200">
                            <ArrowDown className="w-3 h-3 text-slate-300 mx-auto" />
                          </div>
                        )}
                      </div>
                      <div className={`pb-4 ${isLast ? '' : ''}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: step.color }} />
                          <p className={`text-sm font-medium ${isBridge ? 'text-red-700' : 'text-slate-700'}`}>
                            {step.title}
                            {isBridge && (
                              <Badge className="ml-2 bg-red-100 text-red-600 text-[10px]">CRÍTICO</Badge>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Database Schema Overview */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Esquema Unificado (8 Modelos CUID)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Company', desc: 'Multi-tenancy', color: '#6366f1' },
                  { name: 'User', desc: 'RBAC: 5 roles', color: '#3b82f6' },
                  { name: 'Permit', desc: '4 tipos de riesgo', color: '#10b981' },
                  { name: 'WorkLocation', desc: 'GPS + Geofence', color: '#f59e0b' },
                  { name: 'Signature', desc: 'Hash SHA-256', color: '#ef4444' },
                  { name: 'HseDocument', desc: '3 criticidades', color: '#f97316' },
                  { name: 'AlertConfig', desc: 'Auto-alertas', color: '#8b5cf6' },
                  { name: 'AuditLog', desc: 'Trazabilidad total', color: '#64748b' },
                ].map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: model.color }} />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{model.name}</p>
                      <p className="text-[10px] text-slate-400">{model.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tech Stack & SAS Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tech Stack */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-emerald-600" />
            Stack Tecnológico
          </h2>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {techStack.map((tech) => {
                  const Icon = tech.icon
                  return (
                    <div key={tech.name} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="p-1.5 rounded-md bg-white border border-slate-200">
                        <Icon className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{tech.name}</p>
                        <p className="text-[10px] text-slate-400">{tech.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* SAS Competitive Features */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Capacidades SaaS Competitivas
          </h2>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-3">
              {[
                { title: 'Multi-tenancy Completo', desc: 'Aislamiento de datos por empresa, roles RBAC, usuarios ilimitados por plan', icon: Users },
                { title: 'Compliance Cross-Module', desc: 'Puente automático entre HSE y Operaciones. Bloqueo en tiempo real por documentos vencidos', icon: Lock },
                { title: 'GPS + Geofence Validation', desc: 'Fórmula Haversine, validación de radio, coordenadas en firma y aprobación', icon: MapPin },
                { title: 'Firma Digital con Hash', desc: 'Canvas nativo, SHA-256 integrity hash, timestamp, coordenadas GPS embebidas', icon: PenLine },
                { title: 'Generación PDF Server-Side', desc: 'PDFKit con datos completos, firmas embebidas, checklist, GPS, estado PENDIENTE/AUTORIZADO', icon: FileText },
                { title: 'Auditoría Total', desc: 'AuditLog con acción, entidad, usuario, IP, timestamp. Trazabilidad completa', icon: Eye },
                { title: 'Suscripción por Planes', desc: 'Starter ($149/mes), Business ($499/mes), Enterprise ($4,500/mes). Stripe-ready', icon: BarChart3 },
                { title: 'Responsive + Mobile-First', desc: 'Diseño adaptado para campo: tablets, móviles, sidebar colapsable', icon: Wifi },
              ].map((feature, i) => {
                const Icon = feature.icon
                return (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="p-1.5 rounded-md bg-emerald-50 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{feature.title}</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* API Endpoints */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-emerald-600" />
          API REST Endpoints
        </h2>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { method: 'POST', path: '/api/auth/login', desc: 'Login JWT' },
                { method: 'POST', path: '/api/auth/register', desc: 'Registro empresa + admin' },
                { method: 'GET', path: '/api/compliance/check', desc: 'Verificar cumplimiento HSE' },
                { method: 'GET', path: '/api/permits', desc: 'Listar permisos (filtro status)' },
                { method: 'POST', path: '/api/permits', desc: 'Crear permiso (+ validación HSE)' },
                { method: 'GET', path: '/api/permits/[id]', desc: 'Detalle del permiso' },
                { method: 'POST', path: '/api/permits/[id]/approve', desc: 'Aprobar (+ GPS geofence)' },
                { method: 'POST', path: '/api/permits/[id]/reject', desc: 'Rechazar con motivo' },
                { method: 'GET', path: '/api/documents', desc: 'Listar documentos HSE' },
                { method: 'POST', path: '/api/documents', desc: 'Crear documento HSE' },
                { method: 'GET', path: '/api/documents/[id]', desc: 'Detalle documento' },
                { method: 'GET', path: '/api/dashboard/stats', desc: 'Estadísticas del dashboard' },
                { method: 'GET', path: '/api/locations', desc: 'Sitios de trabajo GPS' },
                { method: 'GET', path: '/api/users', desc: 'Usuarios de la empresa' },
              ].map((ep, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <Badge className={`${ep.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} text-[10px] font-mono shrink-0`}>
                    {ep.method}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-700 truncate">{ep.path}</p>
                    <p className="text-[10px] text-slate-400">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
