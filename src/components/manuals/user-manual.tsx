'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { BookOpen, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Shield, FileText, Activity, MapPin, Settings, BarChart3, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ManualSection {
  id: string
  number: string
  title: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const sections: ManualSection[] = [
  {
    id: 'introduccion',
    number: '1',
    title: 'Introducción a Energy-Compliance Hub',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'permisos',
    number: '2',
    title: 'Permisos de Trabajo',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'documentos',
    number: '3',
    title: 'Documentos HSE',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  {
    id: 'scada',
    number: '4',
    title: 'SCADA Telemetría',
    icon: <Activity className="w-5 h-5" />,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'reportes',
    number: '5',
    title: 'Reportes',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'ubicaciones',
    number: '6',
    title: 'Gestión de Ubicaciones',
    icon: <MapPin className="w-5 h-5" />,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  {
    id: 'alertas',
    number: '7',
    title: 'Sistema de Alertas',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'configuracion',
    number: '8',
    title: 'Configuración',
    icon: <Settings className="w-5 h-5" />,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  {
    id: 'troubleshooting',
    number: '9',
    title: 'Solución de Problemas General',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    id: 'glosario',
    number: '10',
    title: 'Glosario',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  section,
  isOpen,
  onToggle,
}: {
  section: ManualSection
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <CollapsibleTrigger asChild>
      <button
        className={cn(
          'w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left',
          'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          isOpen
            ? cn(section.bgColor, 'ring-1', section.borderColor)
            : 'bg-white hover:bg-slate-50'
        )}
      >
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            section.bgColor,
            section.color
          )}
        >
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold uppercase tracking-wider', section.color)}>
              Sección {section.number}
            </span>
          </div>
          <h3 className={cn('text-base font-bold', isOpen ? section.color : 'text-slate-800')}>
            {section.title}
          </h3>
        </div>
        {isOpen ? (
          <ChevronDown className={cn('w-5 h-5 flex-shrink-0', section.color)} />
        ) : (
          <ChevronRight className="w-5 h-5 flex-shrink-0 text-slate-400" />
        )}
      </button>
    </CollapsibleTrigger>
  )
}

function ErrorBlock({
  title,
  description,
  solution,
  steps,
}: {
  title: string
  description: string
  solution: string
  steps?: string[]
}) {
  return (
    <div className="border border-red-200 rounded-xl bg-red-50/50 overflow-hidden">
      <div className="p-3 bg-red-100/60 border-b border-red-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <h4 className="font-semibold text-red-800 text-sm">{title}</h4>
        </div>
        <p className="text-red-700 text-xs mt-1 ml-8">{description}</p>
      </div>
      <div className="p-3 bg-emerald-50/50 border-t border-emerald-200">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-emerald-800 text-xs">Solución</span>
        </div>
        <p className="text-emerald-700 text-xs ml-6">{solution}</p>
        {steps && steps.length > 0 && (
          <ol className="mt-2 ml-6 space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-emerald-700">
                <span className="font-bold text-emerald-500 flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function StepGuide({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
            <span className="text-emerald-700 font-bold text-sm">{i + 1}</span>
          </div>
          <div className="flex-1 pb-3 border-b border-slate-100 last:border-0">
            <h4 className="font-semibold text-slate-800 text-sm">{step.title}</h4>
            <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
      {children}
    </div>
  )
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
      {children}
    </div>
  )
}

function ScreenshotPlaceholder({ description }: { description: string }) {
  return (
    <div className="my-3 p-6 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-center">
      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-200 flex items-center justify-center">
        <Activity className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-xs text-slate-500 font-medium">Captura de pantalla</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
        <div className="w-1 h-4 rounded-full bg-emerald-500" />
        {title}
      </h4>
      <div className="ml-3">{children}</div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UserManual() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['introduccion']))
  const [expandedToc, setExpandedToc] = useState(true)

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    setOpenSections(new Set(sections.map((s) => s.id)))
  }

  const collapseAll = () => {
    setOpenSections(new Set())
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (!openSections.has(id)) {
        toggleSection(id)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-8 mb-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-300 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                Manual de Usuario v2.0
              </Badge>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Manual de Usuario</h1>
          <h2 className="text-xl font-medium text-emerald-100 mb-3">
            Energy-Compliance Hub
          </h2>
          <p className="text-emerald-200 text-sm leading-relaxed max-w-2xl">
            Guía completa para la operación de la plataforma de gestión HSE (Salud, Seguridad y Medio Ambiente)
            con permisos de trabajo, telemetría SCADA, documentos, reportes y cumplimiento normativo.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="flex items-center gap-2 text-emerald-200 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Lectura estimada: 25 min</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs">
              <Users className="w-3.5 h-3.5" />
              <span>Para todos los roles</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>10 secciones</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table of Contents ── */}
      <Card className="mb-6 border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Tabla de Contenidos
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedToc(!expandedToc)}
              className="text-xs text-slate-500"
            >
              {expandedToc ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </CardHeader>
        {expandedToc && (
          <CardContent className="pt-0">
            <div className="space-y-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                >
                  <span
                    className={cn(
                      'flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold',
                      s.bgColor,
                      s.color
                    )}
                  >
                    {s.number}
                  </span>
                  <span className="text-sm text-slate-700 group-hover:text-emerald-700 transition-colors">
                    {s.title}
                  </span>
                  {openSections.has(s.id) && (
                    <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">
                      Abierto
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={expandAll} className="text-xs flex-1">
                Expandir todo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs flex-1">
                Colapsar todo
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Sections ── */}
      <div className="space-y-3">
        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 1: INTRODUCCIÓN
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-introduccion">
          <Collapsible open={openSections.has('introduccion')} onOpenChange={() => toggleSection('introduccion')}>
            <SectionHeader
              section={sections[0]}
              isOpen={openSections.has('introduccion')}
              onToggle={() => toggleSection('introduccion')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong>Energy-Compliance Hub</strong> es una plataforma integral diseñada para la gestión de
                  seguridad, salud y medio ambiente (HSE) en operaciones industriales de energía. Centraliza
                  el control de permisos de trabajo, documentos de cumplimiento, telemetría SCADA en
                  tiempo real y generación de reportes de cumplimiento normativo.
                </p>

                <SubSection title="¿Para quién es este manual?">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Este manual está dirigido a todos los usuarios de la plataforma, incluyendo:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] mt-0.5">ADMIN</Badge>
                      <span>Administradores con acceso total al sistema</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] mt-0.5">SUPERVISOR</Badge>
                      <span>Supervisores que aprueban permisos y gestionan equipos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] mt-0.5">MANAGER</Badge>
                      <span>Gerentes que revisan reportes y cumplimiento</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-slate-100 text-slate-700 text-[10px] mt-0.5">TECHNICIAN</Badge>
                      <span>Técnicos que monitorean sensores SCADA</span>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="Requisitos del sistema">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Navegador</p>
                      <p className="text-xs text-slate-500">Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Dispositivos</p>
                      <p className="text-xs text-slate-500">Desktop, tablet y móvil con GPS integrado</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Conexión</p>
                      <p className="text-xs text-slate-500">Internet estable (mínimo 3G para SCADA)</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Permisos</p>
                      <p className="text-xs text-slate-500">Cámara, GPS y notificaciones del navegador</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Estructura de la plataforma">
                  <ScreenshotPlaceholder description="Vista general del dashboard principal con panel de navegación lateral, tarjetas de estadísticas y estado de cumplimiento" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    La plataforma se organiza en un <strong>panel lateral de navegación</strong> (sidebar) que permite
                    acceder a cada módulo. En la parte superior se muestra el <strong>estado de cumplimiento HSE</strong>,
                    y en la sección central se despliega el contenido del módulo seleccionado. Los módulos visibles
                    dependen del rol del usuario.
                  </p>
                  <InfoBox>
                    <strong>Tip:</strong> Puede colapsar la barra lateral haciendo clic en &quot;Colapsar&quot; en la parte inferior
                    del menú para obtener más espacio en pantalla.
                  </InfoBox>
                </SubSection>

                <SubSection title="Roles y permisos">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Módulo</th>
                          <th className="p-2 text-center font-semibold text-slate-700 border border-slate-200">ADMIN</th>
                          <th className="p-2 text-center font-semibold text-slate-700 border border-slate-200">SUPERVISOR</th>
                          <th className="p-2 text-center font-semibold text-slate-700 border border-slate-200">MANAGER</th>
                          <th className="p-2 text-center font-semibold text-slate-700 border border-slate-200">TECHNICIAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Dashboard', '✅', '✅', '✅', '✅'],
                          ['Permisos', '✅', '✅', '✅', '✅'],
                          ['Documentos HSE', '✅', '✅', '✅', '✅'],
                          ['Aprobaciones', '✅', '✅', '✅', '❌'],
                          ['Tipos de Riesgo', '✅', '✅', '❌', '❌'],
                          ['SCADA', '✅', '✅', '✅', '✅'],
                          ['IA Predictiva', '✅', '✅', '✅', '❌'],
                          ['Reportes', '✅', '✅', '✅', '❌'],
                          ['Suscripción', '✅', '❌', '❌', '❌'],
                          ['Auditoría', '✅', '❌', '❌', '❌'],
                          ['Usuarios', '✅', '❌', '❌', '❌'],
                          ['Plataforma', '✅', '❌', '❌', '❌'],
                        ].map(([module, ...roles]) => (
                          <tr key={module as string}>
                            <td className="p-2 border border-slate-200 font-medium text-slate-700">{module as string}</td>
                            {roles.map((r, i) => (
                              <td key={i} className="p-2 border border-slate-200 text-center">{r}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 2: PERMISOS DE TRABAJO
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-permisos">
          <Collapsible open={openSections.has('permisos')} onOpenChange={() => toggleSection('permisos')}>
            <SectionHeader
              section={sections[1]}
              isOpen={openSections.has('permisos')}
              onToggle={() => toggleSection('permisos')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo de <strong>Permisos de Trabajo</strong> es el núcleo de la plataforma. Permite crear,
                  gestionar y aprobar permisos para trabajos de alto riesgo, asegurando que se cumplan todos los
                  requisitos de seguridad antes de iniciar cualquier operación.
                </p>

                <SubSection title="Descripción general">
                  <ScreenshotPlaceholder description="Lista de permisos con filtros de búsqueda, estados (BORRADOR, PENDIENTE, APROBADO, RECHAZADO, COMPLETADO) y acciones rápidas" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    La pantalla principal muestra una <strong>lista filtrable</strong> de todos los permisos de trabajo.
                    Cada permiso tiene un estado visual claramente diferenciado con badges de colores. Puede buscar por
                    número de permiso, tipo de riesgo, ubicación o estado. Las acciones disponibles dependen del rol
                    y del estado del permiso.
                  </p>
                </SubSection>

                <SubSection title="Tipos de riesgo disponibles">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { risk: 'ALTURA', desc: 'Trabajos en alturas superiores a 1.8 metros. Incluye andamios, techos y estructuras elevadas.', color: 'bg-red-100 text-red-700 border-red-200' },
                      { risk: 'ELECTRICO', desc: 'Trabajos con energía eléctrica. Requiere bloqueo/etiquetado (LOTO) y verificación de ausencia de voltaje.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      { risk: 'CONFINADO', desc: 'Espacios confinados como tanques, túneles o ductos. Requiere ventilación y monitoreo de gases continuo.', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                      { risk: 'CALIENTE', desc: 'Trabajos de soldadura, corte o cualquier actividad que genere chispas. Requiere permiso de fuego.', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    ].map((r) => (
                      <div key={r.risk} className={cn('p-3 rounded-lg border', r.color)}>
                        <Badge className="text-xs font-bold">{r.risk}</Badge>
                        <p className="text-xs mt-1.5 leading-relaxed">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>

                <SubSection title="Flujo de vida de un permiso">
                  <div className="flex flex-wrap gap-2 items-center">
                    {[
                      { label: 'BORRADOR', color: 'bg-slate-100 text-slate-700 border-slate-300' },
                      { label: '→', color: '' },
                      { label: 'PENDIENTE', color: 'bg-amber-100 text-amber-700 border-amber-300' },
                      { label: '→', color: '' },
                      { label: 'APROBADO', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                      { label: '→', color: '' },
                      { label: 'COMPLETADO', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                    ].map((s, i) =>
                      s.color ? (
                        <Badge key={i} variant="outline" className={cn('text-xs', s.color)}>
                          {s.label}
                        </Badge>
                      ) : (
                        <span key={i} className="text-slate-400 text-lg">→</span>
                      )
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    En cualquier estado PENDIENTE, el permiso puede ser RECHAZADO (badge rojo) y volver a BORRADOR.
                  </p>
                </SubSection>

                <SubSection title="Guía paso a paso: Crear un permiso de trabajo">
                  <StepGuide steps={[
                    {
                      title: 'Acceder al módulo de Permisos',
                      description: 'Haga clic en "Permisos" en el menú lateral izquierdo. Se mostrará la lista de permisos existentes.',
                    },
                    {
                      title: 'Iniciar nuevo permiso',
                      description: 'Haga clic en el botón "+ Nuevo Permiso" ubicado en la parte superior de la lista.',
                    },
                    {
                      title: 'Completar información general',
                      description: 'Ingrese el tipo de riesgo (ALTURA, ELECTRICO, CONFINADO, CALIENTE), descripción del trabajo, ubicación de trabajo, fecha programada y personal asignado.',
                    },
                    {
                      title: 'Completar la lista de verificación',
                      description: 'Revise cada item del checklist de seguridad correspondiente al tipo de riesgo. Marque cada item como cumplido. Es obligatorio completar TODOS los items.',
                    },
                    {
                      title: 'Adjuntar evidencia fotográfica',
                      description: 'Tome o adjunte fotos del área de trabajo, equipos y condiciones. Use el botón de cámara para capturar desde el dispositivo o el ícono de adjuntar para subir archivos existentes.',
                    },
                    {
                      title: 'Firma digital con GPS',
                      description: 'El solicitante debe firmar digitalmente en el pad de firma. El sistema captura automáticamente las coordenadas GPS y la hora de la firma para auditoría.',
                    },
                    {
                      title: 'Enviar para aprobación',
                      description: 'Haga clic en "Enviar para Aprobación". El permiso cambiará a estado PENDIENTE y será visible para supervisores y administradores en el panel de Aprobaciones.',
                    },
                  ]} />
                </SubSection>

                <SubSection title="Guía paso a paso: Aprobar un permiso">
                  <StepGuide steps={[
                    {
                      title: 'Acceder al panel de Aprobaciones',
                      description: 'Navegue a "Aprobaciones" en el menú lateral. Se listarán todos los permitos en estado PENDIENTE.',
                    },
                    {
                      title: 'Revisar el permiso',
                      description: 'Haga clic en un permiso para expandir y revisar toda la información: tipo de riesgo, checklist, fotos y firma del solicitante.',
                    },
                    {
                      title: 'Verificar cumplimiento SCADA',
                      description: 'El sistema verifica automáticamente si hay alertas SCADA activas. Si hay sensores en estado CRÍTICO, aparece un banner rojo "BLOQUEADO: Alerta SCADA Detectada" y no se puede aprobar.',
                    },
                    {
                      title: 'Verificar cumplimiento de documentos',
                      description: 'El sistema verifica que no haya documentos críticos vencidos. Si los hay, se muestra "OPERACIONES BLOQUEADAS" y los botones quedan deshabilitados.',
                    },
                    {
                      title: 'Firmar y aprobar',
                      description: 'Si todo está en orden, firme digitalmente y haga clic en "Aprobar". El permiso cambia a estado APROBADO y el solicitante es notificado.',
                    },
                  ]} />
                  <WarningBox>
                    <strong>Importante:</strong> Las operaciones se bloquean automáticamente cuando hay sensores SCADA
                    en estado CRÍTICO o documentos críticos vencidos. Debe resolver ambas condiciones antes de aprobar permisos.
                  </WarningBox>
                </SubSection>

                <SubSection title="Generación de PDF">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Cada permiso aprobado puede ser exportado como PDF para archivo físico o distribución.
                    El PDF incluye toda la información del permiso, checklist, evidencia fotográfica,
                    firmas digitales con coordenadas GPS y marca de tiempo.
                  </p>
                  <InfoBox>
                    <strong>Tip:</strong> Para generar el PDF, haga clic en el botón de descarga/PDF en el detalle del permiso.
                    El archivo se descargará automáticamente a su dispositivo.
                  </InfoBox>
                </SubSection>

                <SubSection title="Importar permisos masivamente">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Los administradores pueden importar permisos desde archivos Excel o CSV usando la función
                    de importación. Acceda desde <strong>Riesgos → Importar</strong>. Se proporciona una plantilla
                    descargable con el formato correcto de columnas.
                  </p>
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — Permisos de Trabajo">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="OPERACIONES BLOQUEADAS"
                      description="No se pueden crear, aprobar ni rechazar permisos. El banner muestra 'OPERACIONES BLOQUEADAS' y los botones están deshabilitados."
                      solution="Existen documentos HSE críticos con fecha de vencimiento expirada. Debe renovar o reemplazar estos documentos antes de continuar."
                      steps={[
                        'Vaya a "Documentos HSE" en el menú lateral.',
                        'Filtre por criticidad "CRÍTICO" y estado "VENCIDO".',
                        'Renueve cada documento: cargue el nuevo archivo y actualice la fecha de vencimiento.',
                        'Vuelva al módulo de Permisos. El banner de bloqueo desaparecerá automáticamente.',
                        'Si el problema persiste, verifique en Configuración que los documentos estén correctamente categorizados como CRÍTICO.',
                      ]}
                    />
                    <ErrorBlock
                      title="Geofence: Fuera del área de trabajo"
                      description="Al intentar firmar, el sistema muestra un error indicando que la ubicación actual está fuera del área permitida."
                      solution="El GPS del dispositivo indica que está fuera del radio definido para la ubicación de trabajo."
                      steps={[
                        'Verifique que está físicamente en la ubicación correcta del trabajo.',
                        'Active el GPS del dispositivo. En iOS: Ajustes → Privacidad → Ubicación. En Android: Ajustes → Ubicación.',
                        'Espere 10-30 segundos para que el GPS obtenga una lectura precisa (mínimo 5 metros de precisión).',
                        'Si está en interiores, acérquese a una ventana o salga al exterior para mejorar la señal GPS.',
                        'Verifique que la ubicación de trabajo en el sistema tenga el radio correcto. Acceda a SCADA → Ubicaciones.',
                      ]}
                    />
                    <ErrorBlock
                      title="Permiso de GPS denegado"
                      description="El navegador muestra un mensaje pidiendo permiso de ubicación y la firma digital no funciona sin GPS."
                      solution="Debe otorgar permiso de ubicación al navegador para que la firma digital capture las coordenadas."
                      steps={[
                        'Cuando el navegador solicite permiso de ubicación, seleccione "Permitir" o "Permitir siempre".',
                        'Si rechazó el permiso anteriormente: vaya a Configuración del navegador → Privacidad → Ubicación → Permitir para este sitio.',
                        'Chrome: icono de candado junto a la URL → Permisos del sitio → Ubicación → Permitir.',
                        'Recargue la página y vuelva a intentar la firma.',
                        'En dispositivos móviles, asegúrese de que el GPS del sistema operativo también esté activado.',
                      ]}
                    />
                    <ErrorBlock
                      title="Fallo en generación de PDF"
                      description="Al hacer clic en el botón de descarga PDF, se muestra un error o el archivo no se descarga."
                      solution="Error en el servidor al generar el documento PDF. Puede ser por datos faltantes o problemas de conexión."
                      steps={[
                        'Verifique que tiene conexión a Internet estable.',
                        'Asegúrese de que el permiso tenga toda la información completa (firma, checklist, fotos).',
                        'Intente nuevamente en 30 segundos.',
                        'Si el error persiste, contacte al administrador del sistema.',
                        'El administrador puede verificar los logs del servidor en la sección Auditoría.',
                      ]}
                    />
                    <ErrorBlock
                      title="Pad de firma no funciona en móvil"
                      description="El área de firma no responde al toque en dispositivos móviles o la firma se ve distorsionada."
                      solution="Problema de compatibilidad táctil o navegador no compatible."
                      steps={[
                        'Use Chrome o Safari (no Firefox móvil para esta función).',
                        'Limpie la pantalla del dispositivo, la humedad o suciedad puede interferir.',
                        'Desactive el zoom del navegador en la página (no use pellizco para zoom mientras firma).',
                        'Si usa un estuche protector grueso, intente sin él.',
                        'Actualice el navegador a la última versión disponible.',
                        'Como alternativa, use la vista de escritorio si está disponible.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 3: DOCUMENTOS HSE
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-documentos">
          <Collapsible open={openSections.has('documentos')} onOpenChange={() => toggleSection('documentos')}>
            <SectionHeader
              section={sections[2]}
              isOpen={openSections.has('documentos')}
              onToggle={() => toggleSection('documentos')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo de <strong>Documentos HSE</strong> gestiona toda la documentación de salud, seguridad
                  y medio ambiente de la empresa. Controla certificados médicos, licencias operativas, permisos
                  ambientales y cualquier otro documento requerido para el cumplimiento normativo.
                </p>

                <SubSection title="Descripción general">
                  <ScreenshotPlaceholder description="Panel de gestión de documentos con lista, filtros por categoría/criticidad/estado, y alertas de vencimiento" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    El panel muestra todos los documentos organizados por categoría, con indicadores visuales
                    de estado (vigente, por vencer, vencido) y nivel de criticidad. Las alertas se generan
                    automáticamente cuando un documento está próximo a vencer o ya expiró.
                  </p>
                </SubSection>

                <SubSection title="Categorías de documentos">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { cat: 'PERSONAL', desc: 'Certificados médicos, evaluaciones psicotécnicas, cursos de seguridad, inducciones.', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                      { cat: 'EQUIPOS', desc: 'Certificados de calibración, inspecciones de equipos, mantenciones preventivas.', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                      { cat: 'LEGAL', desc: 'Licencias operativas, seguros, contratos, permisos de construcción.', color: 'bg-violet-100 text-violet-700 border-violet-200' },
                      { cat: 'AMBIENTAL', desc: 'Estudios de impacto ambiental, permisos de emisiones, planes de manejo de residuos.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    ].map((c) => (
                      <div key={c.cat} className={cn('p-3 rounded-lg border', c.color)}>
                        <Badge className="text-xs font-bold">{c.cat}</Badge>
                        <p className="text-xs mt-1.5 leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>

                <SubSection title="Niveles de criticidad">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-200">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div>
                        <span className="text-xs font-bold text-red-800">CRÍTICO</span>
                        <span className="text-xs text-red-600 ml-2">— Su vencimiento bloquea TODAS las operaciones</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <div>
                        <span className="text-xs font-bold text-amber-800">ALTO</span>
                        <span className="text-xs text-amber-600 ml-2">— Genera alertas pero no bloquea operaciones</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div>
                        <span className="text-xs font-bold text-emerald-800">MEDIO</span>
                        <span className="text-xs text-emerald-600 ml-2">— Monitoreo normal de vencimiento</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="w-3 h-3 rounded-full bg-slate-400" />
                      <div>
                        <span className="text-xs font-bold text-slate-700">BAJO</span>
                        <span className="text-xs text-slate-500 ml-2">— Solo registro informativo</span>
                      </div>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Guía paso a paso: Cargar un documento">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a Documentos HSE',
                      description: 'Haga clic en "Documentos HSE" en el menú lateral.',
                    },
                    {
                      title: 'Crear nuevo documento',
                      description: 'Haga clic en "+ Nuevo Documento" o "Subir Documento" en la parte superior.',
                    },
                    {
                      title: 'Completar los datos',
                      description: 'Ingrese: nombre del documento, categoría (PERSONAL, EQUIPOS, LEGAL, AMBIENTAL), nivel de criticidad (CRÍTICO, ALTO, MEDIO, BAJO), fecha de emisión y fecha de vencimiento.',
                    },
                    {
                      title: 'Subir el archivo',
                      description: 'Arrastre el archivo o haga clic para seleccionar. Formatos aceptados: PDF, JPG, PNG, DOCX. Tamaño máximo: 10 MB.',
                    },
                    {
                      title: 'Extracción automática con IA',
                      description: 'Si el documento es un PDF o imagen, el sistema puede extraer automáticamente datos relevantes usando IA. Haga clic en "Extraer con IA" si está disponible.',
                    },
                    {
                      title: 'Guardar',
                      description: 'Revise los datos extraídos, corrija si es necesario y haga clic en "Guardar". El documento aparecerá en la lista con su estado calculado automáticamente.',
                    },
                  ]} />
                </SubSection>

                <SubSection title="Seguimiento de vencimiento">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    El sistema calcula automáticamente el estado de cada documento basándose en la fecha de vencimiento:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">VIGENTE</Badge>
                      <span>Más de 30 días para vencer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">POR VENCER</Badge>
                      <span>Entre 1 y 30 días para vencer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-700 text-[10px]">VENCIDO</Badge>
                      <span>La fecha de vencimiento ya pasó</span>
                    </li>
                  </ul>
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — Documentos HSE">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Extracción con IA fallida"
                      description="Al intentar extraer datos con IA, el sistema muestra un error o devuelve datos vacíos."
                      solution="El archivo puede estar ilegible, dañado o en un formato no soportado para extracción."
                      steps={[
                        'Asegúrese de que el archivo sea un PDF de texto (no escaneado como imagen sin OCR) o una imagen clara.',
                        'Verifique que el archivo no esté protegido con contraseña.',
                        'Si el archivo es muy grande, intente con las primeras páginas.',
                        'Ingrese los datos manualmente como alternativa.',
                        'Intente nuevamente en unos minutos — puede ser una limitación temporal del servicio.',
                      ]}
                    />
                    <ErrorBlock
                      title="Error al subir archivo"
                      description="El sistema muestra un error al intentar cargar el archivo del documento."
                      solution="El archivo supera el tamaño máximo o tiene un formato no soportado."
                      steps={[
                        'Verifique que el archivo no supere los 10 MB.',
                        'Formatos aceptados: PDF, JPG, JPEG, PNG, DOCX.',
                        'Si el archivo es muy grande, comprímalo o reduzca la resolución de las imágenes.',
                        'Verifique su conexión a Internet.',
                        'Intente con un navegador diferente.',
                      ]}
                    />
                    <ErrorBlock
                      title="El documento no aparece en la lista"
                      description="Después de guardar, el documento no aparece en la lista de Documentos HSE."
                      solution="Puede ser un problema de filtros o permisos."
                      steps={[
                        'Verifique que no tenga filtros activos que oculten el documento.',
                        'Revise que la categoría y criticidad coincidan con los filtros seleccionados.',
                        'Recargue la página (F5 o Ctrl+R).',
                        'Verifique que tenga permisos de ADMIN o SUPERVISOR para ver documentos de otras áreas.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 4: SCADA TELEMETRÍA
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-scada">
          <Collapsible open={openSections.has('scada')} onOpenChange={() => toggleSection('scada')}>
            <SectionHeader
              section={sections[3]}
              isOpen={openSections.has('scada')}
              onToggle={() => toggleSection('scada')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo <strong>SCADA Telemetría</strong> proporciona monitoreo en tiempo real de sensores
                  industriales. Presenta un panel tipo "sala de control" con indicadores LED, gráficos de
                  tendencias y umbrales de alerta para garantizar la seguridad operacional.
                </p>

                <SubSection title="Descripción del panel de control">
                  <ScreenshotPlaceholder description="Panel SCADA oscuro tipo sala de control con indicadores LED verdes/ámbar/rojos, barras de medición y gráficos de tendencia" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    El panel SCADA utiliza un diseño oscuro (estilo sala de control) para facilitar la lectura
                    de indicadores. Cada sensor muestra:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                      <span><strong>Indicador LED:</strong> Verde (normal), Ámbar (advertencia), Rojo (crítico)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-500 mt-1 flex-shrink-0" />
                      <span><strong>Barra de medición:</strong> Progreso visual con codificación de colores</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-500 mt-1 flex-shrink-0" />
                      <span><strong>Gráfico de tendencia:</strong> Historial de las últimas 200 lecturas por sensor</span>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="Tipos de sensores soportados">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { type: 'PRESION', unit: 'PSI', desc: 'Sensores de presión para líneas, tuberías y recipientes a presión. Rango típico: 0-500 PSI.', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                      { type: 'TEMPERATURA', unit: '°C', desc: 'Sensores de temperatura ambiental y de equipos. Rango típico: -20°C a 150°C.', color: 'bg-red-100 text-red-700 border-red-200' },
                      { type: 'GAS', unit: 'ppm/LEL', desc: 'Detectores de gases (H₂S, CO, CH₄, LEL). Rango típico: 0-100% LEL o 0-100 ppm.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      { type: 'VOLTAJE', unit: 'V', desc: 'Monitores de voltaje para equipos eléctricos. Rango típico: 0-480V.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    ].map((s) => (
                      <div key={s.type} className={cn('p-3 rounded-lg border', s.color)}>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs font-bold">{s.type}</Badge>
                          <span className="text-xs font-mono opacity-70">{s.unit}</span>
                        </div>
                        <p className="text-xs mt-1.5 leading-relaxed">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </SubSection>

                <SubSection title="Umbrales de alerta">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Estado</th>
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">LED</th>
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Descripción</th>
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Impacto</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2 border border-slate-200 font-medium text-emerald-700">NORMAL</td>
                          <td className="p-2 border border-slate-200"><div className="w-4 h-4 rounded-full bg-emerald-500" /></td>
                          <td className="p-2 border border-slate-200 text-slate-600">Valor por debajo del umbral de advertencia</td>
                          <td className="p-2 border border-slate-200 text-slate-600">Operación normal</td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-slate-200 font-medium text-amber-700">ADVERTENCIA</td>
                          <td className="p-2 border border-slate-200"><div className="w-4 h-4 rounded-full bg-amber-500" /></td>
                          <td className="p-2 border border-slate-200 text-slate-600">Valor entre umbral de advertencia y crítico</td>
                          <td className="p-2 border border-slate-200 text-slate-600">Alerta visual, operaciones continúan</td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-slate-200 font-medium text-red-700">CRÍTICO</td>
                          <td className="p-2 border border-slate-200"><div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" /></td>
                          <td className="p-2 border border-slate-200 text-slate-600">Valor por encima del umbral crítico</td>
                          <td className="p-2 border border-slate-200 text-red-600 font-medium">BLOQUEA aprobaciones de permisos</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <WarningBox>
                    <strong>Seguridad:</strong> Cuando un sensor está en estado CRÍTICO, el sistema bloquea automáticamente
                    la aprobación de permisos de trabajo. Esto es un mecanismo de seguridad que NO puede ser deshabilitado
                    por operadores normales.
                  </WarningBox>
                </SubSection>

                <SubSection title="Modo Demo vs. Modo Real">
                  <ScreenshotPlaceholder description="Interruptor de toggle para activar/desactivar el modo demostración en la parte superior del panel SCADA" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    La plataforma incluye un <strong>Modo Demo</strong> que simula datos de sensores para pruebas
                    y capacitación. En modo demo, los sensores generan lecturas aleatorias con movimiento browniano
                    y reversión a la media, incluyendo picos ocasionales.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-bold text-blue-800">Modo Demo (Simulación)</p>
                      <ul className="mt-1.5 space-y-1 text-xs text-blue-700">
                        <li>• Datos generados algorítmicamente</li>
                        <li>• Ideal para capacitación</li>
                        <li>• No requiere hardware</li>
                        <li>• Picos aleatorios para pruebas</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-800">Modo Real (Producción)</p>
                      <ul className="mt-1.5 space-y-1 text-xs text-emerald-700">
                        <li>• Datos de sensores físicos</li>
                        <li>• Lecturas cada 3 segundos</li>
                        <li>• Requiere configuración de webhook</li>
                        <li>• Datos reales del campo</li>
                      </ul>
                    </div>
                  </div>
                  <InfoBox>
                    <strong>Acceso:</strong> Solo los roles ADMIN, SUPERVISOR y MANAGER pueden activar/desactivar
                    el modo demo. Los técnicos solo pueden ver los datos.
                  </InfoBox>
                </SubSection>

                <SubSection title="Pestañas del módulo SCADA">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    El módulo SCADA se organiza en tres pestañas principales:
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📊 Telemetría</p>
                      <p className="text-xs text-slate-600 mt-0.5">Panel principal con sensores, indicadores LED y gráficos de tendencia. Aquí se agrega y elimina sensores.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📍 Ubicaciones</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gestión de ubicaciones de trabajo con GPS, radio y método de verificación. Compartida con el módulo de Permisos.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📥 Importar</p>
                      <p className="text-xs text-slate-600 mt-0.5">Importación masiva de sensores desde archivos CSV o Excel con vista previa y validación.</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Guía paso a paso: Agregar un sensor">
                  <StepGuide steps={[
                    {
                      title: 'Abrir el diálogo de agregar sensor',
                      description: 'En la pestaña "Telemetría", haga clic en el botón "+ Agregar Sensor".',
                    },
                    {
                      title: 'Definir el tipo y parámetros',
                      description: 'Seleccione el tipo de sensor (PRESION, TEMPERATURA, GAS, VOLTAJE). Los umbrales se auto-completan con valores predeterminados según el perfil del tipo.',
                    },
                    {
                      title: 'Asignar ubicación',
                      description: 'Seleccione una ubicación existente de la lista desplegable. Si no hay ubicaciones, haga clic en "Crear ubicación" para agregar una nueva.',
                    },
                    {
                      title: 'Configurar umbrales (opcional)',
                      description: 'Ajuste los umbrales de advertencia y crítico según los requisitos específicos del sitio. Los valores predeterminados son orientativos.',
                    },
                    {
                      title: 'Guardar',
                      description: 'Haga clic en "Guardar". El sensor aparecerá inmediatamente en el panel de telemetría.',
                    },
                  ]} />
                </SubSection>

                <SubSection title="Guía paso a paso: Importar sensores masivamente">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a la pestaña Importar',
                      description: 'En el módulo SCADA, haga clic en la pestaña "Importar".',
                    },
                    {
                      title: 'Descargar plantilla',
                      description: 'Haga clic en "Descargar plantilla" para obtener un archivo Excel con el formato correcto.',
                    },
                    {
                      title: 'Completar los datos',
                      description: 'Llene la plantilla con los datos de sus sensores: nombre, tipo, ubicación, umbrales.',
                    },
                    {
                      title: 'Subir archivo',
                      description: 'Arrastre el archivo al área de carga o haga clic para seleccionar. El sistema mostrará una vista previa.',
                    },
                    {
                      title: 'Revisar vista previa',
                      description: 'Verifique que los datos sean correctos. Las filas verdes son válidas, las amarillas tienen advertencias y las rojas tienen errores.',
                    },
                    {
                      title: 'Confirmar importación',
                      description: 'Haga clic en "Confirmar importación". El sistema creará o actualizará los sensores según corresponda.',
                    },
                  ]} />
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — SCADA Telemetría">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Modo Demo atascado (no se puede desactivar)"
                      description="El interruptor de modo demo vuelve a activarse automáticamente después de desactivarlo, o no responde al clic."
                      solution="Este problema fue causado por una condición de carrera entre el polling de datos y el toggle del usuario. La solución se ha implementado en versiones recientes."
                      steps={[
                        'Asegúrese de estar usando la versión más reciente de la plataforma.',
                        'Espere 5 segundos después de hacer clic en el toggle para que el cambio se propague.',
                        'Si el toggle sigue sin responder, recargue la página completa (Ctrl+Shift+R).',
                        'Verifique su conexión a Internet — el cambio se guarda en la base de datos del servidor.',
                        'Como última opción, contacte al administrador para verificar el estado de scadaDemoMode en la base de datos.',
                      ]}
                    />
                    <ErrorBlock
                      title="Sensor no muestra datos (se muestra desconectado)"
                      description="Un sensor aparece en la lista pero no muestra lecturas, el indicador LED está gris o apagado."
                      solution="El sensor no está recibiendo datos del campo o la conexión está interrumpida."
                      steps={[
                        'Verifique que el modo demo esté ACTIVADO (si está en modo de pruebas).',
                        'Si está en modo real, verifique que el sensor físico esté encendido y conectado.',
                        'Verifique la conectividad del gateway/webhook que envía datos al sistema.',
                        'Revise que el sensor no haya sido eliminado accidentalmente.',
                        'Recargue la página — a veces el polling se detiene por problemas de red.',
                        'Si el sensor era nuevo, espere hasta 10 segundos para la primera lectura.',
                      ]}
                    />
                    <ErrorBlock
                      title="Gráficos de tendencia vacíos o sin datos"
                      description="El gráfico de tendencia de un sensor no muestra líneas ni datos históricos."
                      solution="El sensor puede ser nuevo (sin lecturas acumuladas) o los datos históricos se eliminaron."
                      steps={[
                        'Sensores nuevos necesitan acumular lecturas. Espere al menos 1 minuto para ver datos en el gráfico.',
                        'El sistema conserva las últimas 200 lecturas por sensor.',
                        'Si está en modo demo, las lecturas se generan cada 3 segundos.',
                        'Verifique que no haya un filtro de fecha muy restrictivo en el gráfico.',
                      ]}
                    />
                    <ErrorBlock
                      title="Banner 'BLOQUEADO: Alerta SCADA Detectada' permanente"
                      description="El banner de bloqueo permanece activo incluso cuando todos los sensores muestran estado NORMAL."
                      solution="Puede haber un sensor con alertas pendientes que no está visible en el panel actual."
                      steps={[
                        'Verifique TODOS los sensores en la telemetría, no solo los que están en la pantalla actual.',
                        'El polling de seguridad del sitio (site-safe) revisa todos los sensores de la empresa.',
                        'Revise que no haya sensores en otras ubicaciones con estado CRÍTICO.',
                        'Recargue la página para forzar una actualización completa del estado.',
                        'Espere hasta 10 segundos — el polling del estado de seguridad se ejecuta cada 5 segundos.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 5: REPORTES
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-reportes">
          <Collapsible open={openSections.has('reportes')} onOpenChange={() => toggleSection('reportes')}>
            <SectionHeader
              section={sections[4]}
              isOpen={openSections.has('reportes')}
              onToggle={() => toggleSection('reportes')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo de <strong>Reportes</strong> genera informes profesionales de cumplimiento HSE
                  con datos agregados de permisos, documentos y sensores. Incluye gráficos interactivos,
                  tablas de datos y exportación en múltiples formatos.
                </p>

                <SubSection title="Descripción general">
                  <ScreenshotPlaceholder description="Dashboard de reportes con tarjetas de resumen, filtros de fecha, gráficos de barras y torta, y botones de exportación" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    El panel de reportes muestra un resumen ejecutivo con métricas clave, gráficos de
                    distribución y tendencias, y tablas detalladas. Los filtros permiten segmentar la
                    información por fecha, tipo de riesgo y estado de permisos.
                  </p>
                </SubSection>

                <SubSection title="Tarjetas de resumen">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">Total Permisos</p>
                      <p className="text-xs text-slate-600 mt-0.5">Número total de permisos en el período seleccionado</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">Índice de Seguridad</p>
                      <p className="text-xs text-slate-600 mt-0.5">Porcentaje de permisos aprobados (verde {'>80%'}, amarillo 50-80%, rojo {'<50%'})</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">Documentos Expirados</p>
                      <p className="text-xs text-slate-600 mt-0.5">Documentos HSE con fecha de vencimiento pasada</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">Alertas de Sensores</p>
                      <p className="text-xs text-slate-600 mt-0.5">Sensores en estado ADVERTENCIA o CRÍTICO</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Gráficos disponibles">
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📈 Permisos por Estado</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gráfico de barras con colores diferenciados para cada estado (BORRADOR, PENDIENTE, APROBADO, RECHAZADO, COMPLETADO)</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">🍩 Permisos por Tipo de Riesgo</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gráfico de torta/donut mostrando la distribución por tipo (ALTURA, ELECTRICO, CONFINADO, CALIENTE)</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📉 Tendencia Mensual</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gráfico de área con la evolución mensual de permisos totales y aprobados en los últimos 7 meses</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📊 Documentos por Categoría</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gráfico de barras horizontales con la cantidad de documentos en cada categoría (PERSONAL, EQUIPOS, LEGAL, AMBIENTAL)</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Filtros disponibles">
                  <p className="text-sm text-slate-600 leading-relaxed">Puede filtrar los datos del reporte usando:</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700 text-[10px]">FECHA</Badge>
                      <span>Presets rápidos (Este mes, Últimos 30 días, Este año) o rango personalizado</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700 text-[10px]">TIPO DE RIESGO</Badge>
                      <span>ALTURA, ELECTRICO, CONFINADO, CALIENTE</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700 text-[10px]">ESTADO</Badge>
                      <span>BORRADOR, PENDIENTE, APROBADO, RECHAZADO, COMPLETADO</span>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="Exportación de reportes">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs font-bold text-red-800">📄 PDF</p>
                      <p className="text-xs text-red-600 mt-0.5">Formato profesional con encabezado corporativo, tablas con colores alternados y pie de página. Ideal para distribución e impresión.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-800">📊 Excel (XLSX)</p>
                      <p className="text-xs text-emerald-600 mt-0.5">4 hojas: Resumen, Permisos, Documentos, Sensores. Permite análisis adicional en Excel.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-bold text-blue-800">📋 JSON</p>
                      <p className="text-xs text-blue-600 mt-0.5">Datos brutos en formato JSON para integraciones con otros sistemas o procesamiento programático.</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Guía paso a paso: Generar un reporte">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a Reportes',
                      description: 'Haga clic en "Reportes" en el menú lateral. Solo visible para ADMIN, SUPERVISOR y MANAGER.',
                    },
                    {
                      title: 'Aplicar filtros',
                      description: 'Seleccione el rango de fechas deseado (presets o personalizado). Opcionalmente, filtre por tipo de riesgo y estado.',
                    },
                    {
                      title: 'Revisar datos',
                      description: 'Consulte las tarjetas de resumen, gráficos y tablas de datos. Haga clic en las pestañas para cambiar entre vista de gráficos y vista de datos.',
                    },
                    {
                      title: 'Exportar',
                      description: 'Haga clic en el botón "Exportar PDF" o "Exportar Excel". Espere a que se genere el archivo y se descargue automáticamente.',
                    },
                  ]} />
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — Reportes">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Reporte vacío o sin datos"
                      description="El reporte se genera pero todas las métricas muestran cero y no hay gráficos."
                      solution="El rango de fechas seleccionado no tiene datos o los filtros son muy restrictivos."
                      steps={[
                        'Verifique el rango de fechas. Pruebe con "Este año" o "Este mes" para ver si hay datos.',
                        'Quite todos los filtros de tipo de riesgo y estado para ver si hay datos sin filtrar.',
                        'Verifique que haya permisos creados en el sistema. Vaya al módulo de Permisos.',
                        'Si es una empresa nueva, los datos empiezan a acumularse desde el primer permiso creado.',
                      ]}
                    />
                    <ErrorBlock
                      title="Error al exportar PDF"
                      description="Se muestra un error al intentar descargar el reporte en formato PDF."
                      solution="Problema de generación en el servidor o conexión interrumpida."
                      steps={[
                        'Verifique su conexión a Internet.',
                        'Intente exportar en formato Excel como alternativa.',
                        'Espere unos segundos y vuelva a intentar.',
                        'Si persiste, contacte al administrador para revisar los logs del servidor.',
                      ]}
                    />
                    <ErrorBlock
                      title="Gráficos no se muestran correctamente"
                      description="Los gráficos aparecen vacíos, distorsionados o con tamaño incorrecto."
                      solution="Problema de renderizado del navegador o datos insuficientes para el gráfico."
                      steps={[
                        'Recargue la página completa (Ctrl+Shift+R).',
                        'Verifique que los datos del reporte no estén vacíos.',
                        'Intente con un rango de fechas diferente.',
                        'Use Chrome o Firefox para mejor compatibilidad con gráficos.',
                        'Redimensione la ventana del navegador — los gráficos son responsivos.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 6: GESTIÓN DE UBICACIONES
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-ubicaciones">
          <Collapsible open={openSections.has('ubicaciones')} onOpenChange={() => toggleSection('ubicaciones')}>
            <SectionHeader
              section={sections[5]}
              isOpen={openSections.has('ubicaciones')}
              onToggle={() => toggleSection('ubicaciones')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo de <strong>Gestión de Ubicaciones</strong> se encuentra integrado dentro del módulo SCADA
                  (pestaña "Ubicaciones") y es compartido con el módulo de Permisos. Permite definir las áreas
                  de trabajo con coordenadas GPS, radio de cobertura y método de verificación.
                </p>

                <SubSection title="Descripción general">
                  <ScreenshotPlaceholder description="Lista de ubicaciones con nombre, dirección, coordenadas GPS, radio y método de verificación. Botones de editar y eliminar." />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Cada ubicación define un área geográfica de trabajo con los siguientes atributos:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Nombre y dirección:</strong> Identificación descriptiva del sitio de trabajo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Coordenadas GPS:</strong> Latitud y longitud del centro del área (formato decimal)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Radio:</strong> Radio en metros del área de cobertura (ej: 100m)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Método de verificación:</strong> GPS, QR_CODE o BEACON</span>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="Métodos de verificación">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-800">🛰️ GPS</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Verifica la ubicación del usuario comparando las coordenadas GPS con el centro y radio definidos.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                      <p className="text-xs font-bold text-violet-800">📷 QR Code</p>
                      <p className="text-xs text-violet-600 mt-0.5">El usuario escanea un código QR colocado en el sitio para verificar presencia física.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-bold text-blue-800">📡 Beacon</p>
                      <p className="text-xs text-blue-600 mt-0.5">Detecta señales Bluetooth Low Energy (BLE) de beacons instalados en el sitio.</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Guía paso a paso: Crear una ubicación">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a Ubicaciones',
                      description: 'En el módulo SCADA, haga clic en la pestaña "Ubicaciones".',
                    },
                    {
                      title: 'Crear nueva ubicación',
                      description: 'Haga clic en "+ Nueva Ubicación". Se abrirá un formulario.',
                    },
                    {
                      title: 'Ingresar datos generales',
                      description: 'Ingrese el nombre y la dirección de la ubicación.',
                    },
                    {
                      title: 'Capturar GPS',
                      description: 'Haga clic en el botón "Mi Ubicación" para capturar automáticamente sus coordenadas GPS actuales, o ingréselas manualmente en formato decimal.',
                    },
                    {
                      title: 'Definir radio',
                      description: 'Ingrese el radio de cobertura en metros (ej: 100 para un área de 100 metros de radio).',
                    },
                    {
                      title: 'Seleccionar método de verificación',
                      description: 'Elija GPS, QR_CODE o BEACON como método principal de verificación de presencia.',
                    },
                    {
                      title: 'Guardar',
                      description: 'Haga clic en "Guardar". La ubicación estará disponible para asignar a sensores y permisos.',
                    },
                  ]} />
                </SubSection>

                <WarningBox>
                  <strong>Importante:</strong> No se puede eliminar una ubicación que tiene sensores o permisos asociados.
                  Debe eliminar o reasignar los sensores y permisos primero. El sistema mostrará un error de conflicto
                  (409) si intenta eliminar una ubicación con dependencias.
                </WarningBox>

                <Separator />
                <SubSection title="Solución de problemas — Ubicaciones">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Error al capturar coordenadas GPS"
                      description="El botón 'Mi Ubicación' no funciona o muestra coordenadas incorrectas."
                      solution="El navegador no tiene permiso de ubicación o el GPS del dispositivo no está activo."
                      steps={[
                        'Active el GPS del dispositivo en la configuración del sistema.',
                        'Otorgue permiso de ubicación al navegador cuando lo solicite.',
                        'Salga al exterior o acérquese a una ventana para mejor señal GPS.',
                        'Espere 10-30 segundos para que el GPS obtenga fijación de satélites.',
                        'Como alternativa, ingrese las coordenadas manualmente usando Google Maps.',
                      ]}
                    />
                    <ErrorBlock
                      title="No se puede eliminar una ubicación"
                      description="Al intentar eliminar, se muestra un error indicando que la ubicación tiene dependencias."
                      solution="Existen sensores o permisos asociados a esta ubicación que deben ser eliminados o reasignados primero."
                      steps={[
                        'Vaya a la pestaña "Telemetría" y verifique qué sensores están asignados a esta ubicación.',
                        'Elimine o reasigne los sensores a otra ubicación.',
                        'Verifique en el módulo de Permisos si hay permisos activos para esta ubicación.',
                        'Espere a que los permisos se completen o reasígnelos.',
                        'Vuelva a intentar la eliminación de la ubicación.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 7: SISTEMA DE ALERTAS
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-alertas">
          <Collapsible open={openSections.has('alertas')} onOpenChange={() => toggleSection('alertas')}>
            <SectionHeader
              section={sections[6]}
              isOpen={openSections.has('alertas')}
              onToggle={() => toggleSection('alertas')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El <strong>Sistema de Alertas</strong> monitorea continuamente los documentos HSE y los sensores SCADA
                  para generar notificaciones automáticas cuando se detectan condiciones que requieren atención.
                </p>

                <SubSection title="Tipos de alertas">
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-bold text-amber-800">Alertas de Vencimiento de Documentos</p>
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Se generan cuando un documento HSE está próximo a vencer (30 días) o ya venció. Los documentos
                        con criticidad CRÍTICO generan alertas de mayor prioridad y pueden bloquear operaciones.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-red-600" />
                        <p className="text-xs font-bold text-red-800">Alertas de Umbrales de Sensores</p>
                      </div>
                      <p className="text-xs text-red-700 leading-relaxed">
                        Se generan cuando un sensor SCADA supera el umbral de advertencia (amarillo) o crítico (rojo).
                        Las alertas críticas activan el bloqueo de aprobaciones de permisos como medida de seguridad.
                      </p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Dónde ver las alertas">
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span><strong>Indicador en la barra lateral:</strong> El estado de cumplimiento en la parte inferior del menú muestra "Cumplimiento HSE: OK" (verde) o "OPERACIONES BLOQUEADAS" (rojo pulsante).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span><strong>Indicador en el encabezado:</strong> Una badge en la parte superior derecha muestra "Cumplimiento OK" o "Bloqueado".</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span><strong>Banner en Aprobaciones:</strong> Un banner rojo aparece cuando hay alertas SCADA críticas que bloquean aprobaciones.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span><strong>Panel SCADA:</strong> Los indicadores LED muestran el estado de cada sensor en tiempo real.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span><strong>Módulo de Documentos HSE:</strong> Los badges de estado (VIGENTE, POR VENCER, VENCIDO) indican la urgencia.</span>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="Acciones recomendadas ante alertas">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Alerta</th>
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Prioridad</th>
                          <th className="p-2 text-left font-semibold text-slate-700 border border-slate-200">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2 border border-slate-200">Documento CRÍTICO vencido</td>
                          <td className="p-2 border border-slate-200"><Badge className="bg-red-100 text-red-700 text-[10px]">URGENTE</Badge></td>
                          <td className="p-2 border border-slate-200">Renovar documento inmediatamente — operaciones bloqueadas</td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-slate-200">Documento por vencer (&lt;30 días)</td>
                          <td className="p-2 border border-slate-200"><Badge className="bg-amber-100 text-amber-700 text-[10px]">ALTA</Badge></td>
                          <td className="p-2 border border-slate-200">Iniciar proceso de renovación</td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-slate-200">Sensor en CRÍTICO</td>
                          <td className="p-2 border border-slate-200"><Badge className="bg-red-100 text-red-700 text-[10px]">URGENTE</Badge></td>
                          <td className="p-2 border border-slate-200">Evacuar área si es necesario, investigar causa, corregir</td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-slate-200">Sensor en ADVERTENCIA</td>
                          <td className="p-2 border border-slate-200"><Badge className="bg-amber-100 text-amber-700 text-[10px]">MEDIA</Badge></td>
                          <td className="p-2 border border-slate-200">Monitorear de cerca, preparar plan de contingencia</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — Alertas">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Alertas persistentes después de corregir el problema"
                      description="Después de renovar un documento o corregir un sensor, la alerta sigue activa."
                      solution="El sistema actualiza las alertas en intervalos de tiempo. Puede haber un retraso en la actualización."
                      steps={[
                        'Recargue la página para forzar una actualización.',
                        'Espere hasta 30 segundos para que el polling actualice el estado.',
                        'En el caso de sensores SCADA, las lecturas se actualizan cada 3 segundos.',
                        'Para documentos, la verificación de cumplimiento se ejecuta al cargar la página.',
                        'Si el problema persiste después de 1 minuto, verifique que el cambio se guardó correctamente.',
                      ]}
                    />
                    <ErrorBlock
                      title="No se reciben alertas visibles"
                      description={'El sistema muestra “Cumplimiento OK” pero hay documentos vencidos o sensores en alerta.'}
                      solution="Puede ser un problema de caché o que la verificación de cumplimiento no se ejecutó correctamente."
                      steps={[
                        'Recargue completamente la página (Ctrl+Shift+R).',
                        'Cierre sesión y vuelva a iniciar — esto fuerza una nueva verificación.',
                        'Verifique manualmente en Documentos HSE si hay documentos vencidos.',
                        'Verifique manualmente en SCADA si hay sensores en estado de alerta.',
                        'Contacte al administrador si sospecha de un problema en el servidor.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 8: CONFIGURACIÓN
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-configuracion">
          <Collapsible open={openSections.has('configuracion')} onOpenChange={() => toggleSection('configuracion')}>
            <SectionHeader
              section={sections[7]}
              isOpen={openSections.has('configuracion')}
              onToggle={() => toggleSection('configuracion')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  El módulo de <strong>Configuración</strong> permite personalizar la plataforma según las necesidades
                  de la empresa. Solo accesible para usuarios con rol ADMIN, incluye gestión de empresa, tipos de riesgo,
                  listas de verificación y administración de usuarios.
                </p>

                <SubSection title="Submódulos disponibles">
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">🏢 Plataforma</p>
                      <p className="text-xs text-slate-600 mt-0.5">Configuración general de la empresa, información legal y parámetros del sistema. Accesible desde "Plataforma" en el menú.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">⚠️ Tipos de Riesgo</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gestión de tipos de riesgo (ALTURA, ELECTRICO, CONFINADO, CALIENTE) con sus listas de verificación personalizables. Accesible desde "Riesgos" en el menú.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">📋 Checklists</p>
                      <p className="text-xs text-slate-600 mt-0.5">Configuración de items de verificación para cada tipo de riesgo. Se gestiona dentro del módulo "Riesgos".</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">👥 Usuarios</p>
                      <p className="text-xs text-slate-600 mt-0.5">Creación y gestión de cuentas de usuario, asignación de roles y contraseñas. Accesible desde "Usuarios" en el menú.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">💳 Suscripción</p>
                      <p className="text-xs text-slate-600 mt-0.5">Gestión del plan de suscripción (Starter, Business, Enterprise), pagos y estado de la cuenta. Accesible desde "Suscripción" en el menú.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-800">🔍 Auditoría</p>
                      <p className="text-xs text-slate-600 mt-0.5">Registro de todas las acciones realizadas en la plataforma para trazabilidad y cumplimiento. Accesible desde "Auditoría" en el menú.</p>
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Guía paso a paso: Gestionar tipos de riesgo">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a Riesgos',
                      description: 'Haga clic en "Riesgos" en el menú lateral. Solo visible para ADMIN y SUPERVISOR.',
                    },
                    {
                      title: 'Ver tipos existentes',
                      description: 'Se mostrarán los tipos de riesgo preconfigurados (ALTURA, ELECTRICO, CONFINADO, CALIENTE) con sus listas de verificación.',
                    },
                    {
                      title: 'Crear un nuevo tipo',
                      description: 'Haga clic en "+ Nuevo Tipo de Riesgo". Ingrese clave (identificador único), nombre, color, ícono y descripción.',
                    },
                    {
                      title: 'Configurar checklist',
                      description: 'Agregue los items de verificación específicos para este tipo de riesgo. Cada item representa un requisito de seguridad que debe cumplirse.',
                    },
                    {
                      title: 'Guardar cambios',
                      description: 'Haga clic en "Guardar". El nuevo tipo de riesgo estará disponible al crear permisos.',
                    },
                    {
                      title: 'Importar (opcional)',
                      description: 'Use el botón "Importar" para cargar tipos de riesgo y checklists desde un archivo Excel o CSV de forma masiva.',
                    },
                  ]} />
                </SubSection>

                <SubSection title="Guía paso a paso: Gestionar usuarios">
                  <StepGuide steps={[
                    {
                      title: 'Acceder a Usuarios',
                      description: 'Haga clic en "Usuarios" en el menú lateral. Solo visible para ADMIN.',
                    },
                    {
                      title: 'Crear nuevo usuario',
                      description: 'Haga clic en "+ Nuevo Usuario". Ingrese nombre, correo electrónico y seleccione un rol.',
                    },
                    {
                      title: 'Asignar rol',
                      description: 'Seleccione uno de los roles disponibles: ADMIN, SUPERVISOR, MANAGER o TECHNICIAN. Cada rol tiene permisos diferentes (ver tabla en Sección 1).',
                    },
                    {
                      title: 'Guardar',
                      description: 'Haga clic en "Guardar". Se generará una contraseña temporal que el usuario deberá cambiar en su primer inicio de sesión.',
                    },
                  ]} />
                </SubSection>

                <Separator />
                <SubSection title="Solución de problemas — Configuración">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="No puedo acceder a módulos de configuración"
                      description="Los módulos de Usuarios, Auditoría, Plataforma o Suscripción no aparecen en el menú."
                      solution="Estos módulos son exclusivos para el rol ADMIN. Su cuenta actual puede no tener este rol."
                      steps={[
                        'Verifique su rol mostrado en la parte inferior de la barra lateral.',
                        'Si es SUPERVISOR, solicite al ADMIN que le otorgue acceso temporal.',
                        'Si necesita acceso permanente, el ADMIN puede cambiar su rol desde "Usuarios".',
                        'El rol SUPER_ADMIN tiene acceso adicional al "Centro de Mando" para gestión multi-empresa.',
                      ]}
                    />
                    <ErrorBlock
                      title="Error al guardar tipo de riesgo"
                      description="Al crear o editar un tipo de riesgo, se muestra un error de validación o el sistema no guarda los cambios."
                      solution="El identificador (clave) del tipo de riesgo puede estar duplicado o contener caracteres inválidos."
                      steps={[
                        'Asegúrese de que la clave (key) sea única — no puede repetir claves existentes.',
                        'La clave solo debe contener letras mayúsculas, números y guiones bajos.',
                        'Verifique que al menos un item de checklist esté configurado.',
                        'Si edita un tipo existente, verifique que no haya permisos activos usando ese tipo.',
                      ]}
                    />
                    <ErrorBlock
                      title="Suscripción expirada — bloqueo de acceso"
                      description="Aparece un banner indicando que la suscripción ha expirado y no se puede acceder a la plataforma."
                      solution="El período de prueba (7 días) ha expirado o la suscripción no está activa."
                      steps={[
                        'Contacte al ADMIN de su empresa para renovar la suscripción.',
                        'Vaya a "Suscripción" para ver las opciones disponibles (Starter, Business, Enterprise).',
                        'El ADMIN puede activar el plan Demo temporalmente para reanudar el acceso.',
                        'Para planes Enterprise, contacte al equipo de ventas desde el formulario de contacto.',
                      ]}
                    />
                  </div>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 9: SOLUCIÓN DE PROBLEMAS GENERAL
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-troubleshooting">
          <Collapsible open={openSections.has('troubleshooting')} onOpenChange={() => toggleSection('troubleshooting')}>
            <SectionHeader
              section={sections[8]}
              isOpen={openSections.has('troubleshooting')}
              onToggle={() => toggleSection('troubleshooting')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Esta sección reúne los problemas más frecuentes que pueden ocurrir al usar la plataforma,
                  independientemente del módulo, con sus soluciones correspondientes.
                </p>

                <SubSection title="Problemas de acceso y autenticación">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="No puedo iniciar sesión"
                      description="El sistema muestra un error al intentar iniciar sesión con correo y contraseña."
                      solution="Credenciales incorrectas o cuenta desactivada."
                      steps={[
                        'Verifique que el correo electrónico esté escrito correctamente.',
                        'Asegúrese de escribir la contraseña sin espacios adicionales.',
                        'Si olvidó su contraseña, contacte al ADMIN para restablecerla.',
                        'Verifique que su cuenta no haya sido desactivada por el administrador.',
                        'Asegúrese de tener una suscripción activa — las cuentas sin suscripción no pueden iniciar sesión.',
                      ]}
                    />
                    <ErrorBlock
                      title="Cerré sesión y no puedo volver a entrar"
                      description="Después de cerrar sesión, al intentar entrar de nuevo se muestra un error."
                      solution="El token de sesión puede estar corrupto o la sesión del servidor expiró."
                      steps={[
                        'Limpie la caché y cookies del navegador.',
                        'Cierre todas las pestañas del navegador y abra una nueva.',
                        'Intente con una ventana de incógnito/privada.',
                        'Si el problema persiste, el ADMIN puede verificar el estado de su cuenta.',
                      ]}
                    />
                  </div>
                </SubSection>

                <SubSection title="Problemas de rendimiento">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="La plataforma responde lentamente"
                      description="Las páginas tardan mucho en cargar o las acciones tardan en responder."
                      solution="Conexión a Internet lenta o servidor bajo carga pesada."
                      steps={[
                        'Verifique su velocidad de conexión a Internet (mínimo recomendado: 5 Mbps).',
                        'Cierre otras pestañas y aplicaciones que consuman ancho de banda.',
                        'Deshabile las extensiones del navegador que puedan interferir (adblockers, VPNs).',
                        'Intente con un navegador diferente (Chrome, Firefox, Edge).',
                        'Si el problema es persistente, puede ser un problema del servidor — contacte al administrador.',
                      ]}
                    />
                    <ErrorBlock
                      title="La página se muestra en blanco"
                      description="Al cargar la plataforma, la pantalla permanece completamente blanca."
                      solution="Error de JavaScript o problema de compatibilidad del navegador."
                      steps={[
                        'Abra la consola de desarrollador (F12 → Console) para ver errores.',
                        'Intente con Chrome o Firefox actualizados.',
                        'Limpie la caché del navegador.',
                        'Desactive las extensiones del navegador temporalmente.',
                        'Si ve errores de CORS o de red, contacte al administrador del sistema.',
                      ]}
                    />
                  </div>
                </SubSection>

                <SubSection title="Problemas con dispositivos móviles">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="La interfaz no se adapta correctamente al móvil"
                      description="Elementos se superponen, textos no se leen o botones no funcionan en el celular."
                      solution="Problema de responsive design o navegador no compatible."
                      steps={[
                        'Use Chrome o Safari para la mejor experiencia en móvil.',
                        'Evite usar el modo de escritorio forzado en su móvil.',
                        'Active la rotación de pantalla para ver la versión horizontal si es necesario.',
                        'Actualice su navegador a la última versión.',
                        'Asegúrese de no tener un zoom excesivo del sistema (>150%).',
                      ]}
                    />
                    <ErrorBlock
                      title="La cámara no funciona para evidencia fotográfica"
                      description="Al intentar tomar una foto para el permiso, la cámara no se abre o muestra error."
                      solution="El navegador no tiene permiso de cámara o el dispositivo no tiene cámara accesible."
                      steps={[
                        'Otorgue permiso de cámara al navegador cuando lo solicite.',
                        'Verifique que ninguna otra aplicación esté usando la cámara.',
                        'En iOS: Ajustes → Safari → Cámara → Permitir.',
                        'En Android: Ajustes → Aplicaciones → Chrome → Permisos → Cámara → Permitir.',
                        'Si el problema persiste, suba fotos existentes desde la galería usando el botón de adjuntar.',
                      ]}
                    />
                  </div>
                </SubSection>

                <SubSection title="Problemas de datos y sincronización">
                  <div className="space-y-3">
                    <ErrorBlock
                      title="Los datos no se actualizan en tiempo real"
                      description="Los cambios realizados por otros usuarios no se reflejan en mi pantalla."
                      solution="La plataforma actualiza datos mediante polling periódico, no en tiempo real instantáneo."
                      steps={[
                        'Los datos de SCADA se actualizan cada 3 segundos automáticamente.',
                        'Para permisos y documentos, recargue la página para ver los cambios más recientes.',
                        'El estado de cumplimiento se verifica al cargar la página.',
                        'Si necesita datos en tiempo real, use la pantalla de telemetría SCADA.',
                      ]}
                    />
                    <ErrorBlock
                      title="Datos duplicados en listas"
                      description="Aparecen elementos duplicados en la lista de permisos, documentos o sensores."
                      solution="Error de renderizado o datos duplicados en la base de datos."
                      steps={[
                        'Recargue la página para descartar un problema de renderizado.',
                        'Si los duplicados persisten, puede ser un error de datos — contacte al ADMIN.',
                        'El ADMIN puede verificar y eliminar duplicados directamente en la base de datos.',
                        'Al importar datos masivamente, el sistema usa lógica de upsert para evitar duplicados.',
                      ]}
                    />
                  </div>
                </SubSection>

                <SubSection title="Contacto y soporte">
                  <InfoBox>
                    <div className="space-y-2">
                      <p><strong>¿No encontró la solución a su problema?</strong></p>
                      <p>Para soporte técnico, contacte a su administrador del sistema o al equipo de soporte de Energy-Compliance Hub.</p>
                      <p>Para reportar errores o sugerir mejoras, utilice el módulo de <strong>Auditoría</strong> (solo ADMIN) para revisar los registros del sistema.</p>
                    </div>
                  </InfoBox>
                </SubSection>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 10: GLOSARIO
            ════════════════════════════════════════════════════════════════════ */}
        <div id="section-glosario">
          <Collapsible open={openSections.has('glosario')} onOpenChange={() => toggleSection('glosario')}>
            <SectionHeader
              section={sections[9]}
              isOpen={openSections.has('glosario')}
              onToggle={() => toggleSection('glosario')}
            />
            <CollapsibleContent>
              <div className="p-5 pt-3 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Referencia rápida de términos y siglas utilizados en la plataforma.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { term: 'HSE', def: 'Health, Safety and Environment — Salud, Seguridad y Medio Ambiente. Conjunto de prácticas para garantizar la seguridad laboral y protección ambiental.' },
                    { term: 'SCADA', def: 'Supervisory Control and Data Acquisition — Sistema de control supervisorio y adquisición de datos. Permite monitorear y controlar procesos industriales en tiempo real.' },
                    { term: 'GPS', def: 'Global Positioning System — Sistema de posicionamiento global. Tecnología de geolocalización por satélite.' },
                    { term: 'Geofence', def: 'Cerca geográfica virtual. Define un área circular basada en coordenadas GPS y un radio para verificar la presencia de un usuario dentro del área permitida.' },
                    { term: 'LOTO', def: 'Lock Out / Tag Out — Bloqueo y etiquetado. Procedimiento de seguridad para asegurar que equipos energizados no se reactiven durante mantenimientos.' },
                    { term: 'LED', def: 'Light Emitting Diode — Diodo emisor de luz. En la plataforma, se usan indicadores LED virtuales (verde, ámbar, rojo) para representar el estado de los sensores.' },
                    { term: 'LEL', def: 'Lower Explosive Limit — Límite inferior de explosividad. Concentración mínima de gas en el aire que puede causar una explosión. Medido en porcentaje.' },
                    { term: 'PPM', def: 'Parts Per Million — Partes por millón. Unidad de concentración usada para medir gases tóxicos.' },
                    { term: 'PSI', def: 'Pounds per Square Inch — Libras por pulgada cuadrada. Unidad de presión común en equipos industriales.' },
                    { term: 'BLE', def: 'Bluetooth Low Energy — Bluetooth de bajo consumo. Tecnología inalámbrica usada por los beacons para detección de proximidad.' },
                    { term: 'Demo Mode', def: 'Modo de demostración. Función que simula datos de sensores sin necesidad de hardware real, ideal para capacitación y pruebas.' },
                    { term: 'Compliance', def: 'Cumplimiento normativo. Estado del sistema que indica si todos los requisitos HSE están satisfechos (documentos vigentes, sensores normales).' },
                    { term: 'Polling', def: 'Consultas periódicas. Mecanismo por el cual la plataforma consulta al servidor en intervalos regulares para obtener datos actualizados.' },
                    { term: 'PDF', def: 'Portable Document Format — Formato de documento portátil. Usado para generar reportes descargables con formato profesional.' },
                    { term: 'XLSX', def: 'Excel Open XML Spreadsheet — Formato de hoja de cálculo de Microsoft Excel. Usado para exportar datos tabulares.' },
                    { term: 'JSON', def: 'JavaScript Object Notation — Formato ligero de intercambio de datos. Usado para integraciones con otros sistemas.' },
                    { term: 'IA', def: 'Inteligencia Artificial. Tecnología utilizada para extraer datos de documentos y generar análisis predictivos.' },
                    { term: 'OCR', def: 'Optical Character Recognition — Reconocimiento óptico de caracteres. Tecnología para convertir imágenes de texto en texto editable.' },
                    { term: 'Audit Log', def: 'Registro de auditoría. Historial inmutable de todas las acciones realizadas en la plataforma, usado para trazabilidad y cumplimiento.' },
                    { term: 'QR Code', def: 'Quick Response Code — Código de respuesta rápida. Código bidimensional que puede ser escaneado con la cámara del dispositivo para verificar ubicaciones.' },
                  ].map((item) => (
                    <div key={item.term} className="flex gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <Badge variant="outline" className="flex-shrink-0 text-[11px] font-mono px-2 py-0.5 border-emerald-300 text-emerald-700">
                        {item.term}
                      </Badge>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.def}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 mb-4 p-6 rounded-xl bg-slate-100 border border-slate-200 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800">Energy-Compliance Hub</h3>
        </div>
        <p className="text-xs text-slate-500">
          Manual de Usuario v2.0 — Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Documento confidencial — Solo para uso interno de la organización
        </p>
      </div>
    </div>
  )
}
