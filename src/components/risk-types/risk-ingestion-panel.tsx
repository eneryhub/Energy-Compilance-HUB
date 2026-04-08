'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  HardHat,
  FileSearch,
  ListChecks,
  Tag,
  MapPin,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────

interface ChecklistPreview {
  label: string
  required?: boolean
  category?: string
}

interface RiskTypePreview {
  label: string
  description?: string
  color?: string
  icon?: string
  checklist: ChecklistPreview[]
}

interface ExtractionData {
  documentTitle: string
  documentType: string
  summary: string
  generalInfo: {
    proceso?: string
    version?: string
    empresaEjecutadora?: string
    actividad?: string
  }
  accessTypes?: string[]
  eppRequired?: string[]
  rawSections?: Array<{ sectionName: string; items: string[] }>
  totalChecklistItems: number
  riskTypesDetail: RiskTypePreview[]
}

interface IngestionResult {
  riskTypes: Array<{
    id: string
    key: string
    label: string
    description: string | null
    checklistCount: number
  }>
  extraction?: ExtractionData
  rawExtraction?: any // legacy compat
}

type IngestionState = 'idle' | 'processing' | 'success' | 'error'

const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv']
const MAX_SIZE = 10 * 1024 * 1024

const CATEGORY_COLORS: Record<string, string> = {
  EPP: 'bg-amber-100 text-amber-700 border-amber-200',
  DOCUMENTACIÓN: 'bg-blue-100 text-blue-700 border-blue-200',
  PROCEDIMIENTO: 'bg-violet-100 text-violet-700 border-violet-200',
  EQUIPO: 'bg-slate-100 text-slate-700 border-slate-200',
  SEÑALIZACIÓN: 'bg-orange-100 text-orange-700 border-orange-200',
  CAPACITACIÓN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EMERGENCIA: 'bg-red-100 text-red-700 border-red-200',
  VERIFICACIÓN: 'bg-cyan-100 text-cyan-700 border-cyan-200',
}

// ── Component ──────────────────────────────────────────────

export default function RiskIngestionPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [state, setState] = useState<IngestionState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const extraction = result?.extraction
  const preview = extraction?.riskTypesDetail || result?.rawExtraction?.riskTypes || []

  const validateFile = useCallback((f: File): string | null => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Formato no soportado. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (f.size > MAX_SIZE) {
      return 'Archivo demasiado grande (máximo 10 MB)'
    }
    return null
  }, [])

  const handleFileSelect = useCallback((f: File) => {
    const err = validateFile(f)
    if (err) {
      setErrorMessage(err)
      setState('error')
      return
    }
    setFile(f)
    setErrorMessage('')
    setState('idle')
  }, [validateFile])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0])
    }
  }, [handleFileSelect])

  const processFile = async () => {
    if (!file) return
    setState('processing')
    setErrorMessage('')
    setExpandedRisk(null)
    setExpandedSection(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await apiFetch<IngestionResult>('/admin/risks/upload', {
        method: 'POST',
        body: formData,
      })

      setResult(data)
      setState('success')
      onSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el archivo'
      setErrorMessage(message)
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setFile(null)
    setResult(null)
    setErrorMessage('')
    setExpandedRisk(null)
    setExpandedSection(null)
  }

  const getFileIcon = () => {
    if (!file) return <FileText className="w-8 h-8 text-slate-400" />
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return <FileText className="w-8 h-8 text-red-500" />
    return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Group checklist items by category ──
  const groupByCategory = (items: ChecklistPreview[]) => {
    const groups: Record<string, ChecklistPreview[]> = {}
    for (const item of items) {
      const cat = item.category || 'GENERAL'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return groups
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                Ingesta Inteligente de Planillas
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Suba un PDF o Excel con sus tipos de riesgo. La IA extrae y mapea los datos automáticamente.
              </CardDescription>
            </div>
            {(state === 'success' || state === 'error') && (
              <Button variant="outline" size="sm" onClick={reset} className="text-xs gap-1">
                <Trash2 className="w-3 h-3" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Drag & Drop Zone */}
          {!file && state === 'idle' && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                dragActive
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-300 hover:border-violet-300 hover:bg-slate-50'
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  'p-4 rounded-full transition-colors',
                  dragActive ? 'bg-violet-100' : 'bg-slate-100'
                )}>
                  <Upload className={cn(
                    'w-6 h-6',
                    dragActive ? 'text-violet-500' : 'text-slate-400'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Arrastre su planilla aquí o{' '}
                    <span className="text-violet-600 underline">haga clic para seleccionar</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    PDF, Excel (.xlsx, .xls) o CSV — Máximo 10 MB
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          )}

          {/* File Selected — Ready to process */}
          {file && (state === 'idle' || state === 'error') && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                {getFileIcon()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                </div>
                <Button
                  onClick={processFile}
                  disabled={state === 'processing'}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Procesar con IA
                </Button>
              </div>

              {state === 'error' && errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Processing Animation */}
          <AnimatePresence>
            {state === 'processing' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
                  <Brain className="w-5 h-5 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Analizando documento con IA...</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Extrayendo texto, identificando riesgos y mapeando checklist completo
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SUCCESS RESULTS — Full Extraction View
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {state === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* ── Success Banner ── */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-700">
                  {result.riskTypes?.length || 0} tipo(s) de riesgo procesado(s)
                </p>
                <p className="text-xs text-emerald-600">
                  {result.riskTypes?.reduce((s, r) => s + r.checklistCount, 0) || 0} ítems de checklist creados/actualizados
                </p>
              </div>
            </div>

            {/* ── Document Overview Card ── */}
            {extraction && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <FileSearch className="w-3.5 h-3.5 text-violet-500" />
                    Información del Documento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Title & Type */}
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{extraction.documentTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-violet-100 text-violet-700 text-[10px]">
                          {extraction.documentType}
                        </Badge>
                        {extraction.generalInfo?.version && (
                          <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                            v{extraction.generalInfo.version}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {extraction.summary && (
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-600 leading-relaxed">{extraction.summary}</p>
                    </div>
                  )}

                  {/* General Info Grid */}
                  {(extraction.generalInfo?.proceso || extraction.generalInfo?.empresaEjecutadora || extraction.generalInfo?.actividad) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {extraction.generalInfo.proceso && (
                          <div className="p-2 rounded-lg bg-slate-50">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Proceso</p>
                            <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{extraction.generalInfo.proceso}</p>
                          </div>
                        )}
                        {extraction.generalInfo.empresaEjecutadora && (
                          <div className="p-2 rounded-lg bg-slate-50">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Empresa</p>
                            <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{extraction.generalInfo.empresaEjecutadora}</p>
                          </div>
                        )}
                        {extraction.generalInfo.actividad && (
                          <div className="p-2 rounded-lg bg-slate-50">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Actividad</p>
                            <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{extraction.generalInfo.actividad}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Access Types */}
                  {extraction.accessTypes && extraction.accessTypes.length > 0 && (
                    <SectionBlock
                      title="Tipos de Acceso"
                      icon={<MapPin className="w-3.5 h-3.5 text-cyan-500" />}
                      isExpanded={expandedSection === 'access'}
                      onToggle={() => setExpandedSection(expandedSection === 'access' ? null : 'access')}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {extraction.accessTypes.map((a, i) => (
                          <Badge key={i} className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px]">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </SectionBlock>
                  )}

                  {/* EPP Required */}
                  {extraction.eppRequired && extraction.eppRequired.length > 0 && (
                    <SectionBlock
                      title={`EPP y Equipos de Protección (${extraction.eppRequired.length})`}
                      icon={<HardHat className="w-3.5 h-3.5 text-amber-500" />}
                      isExpanded={expandedSection === 'epp'}
                      onToggle={() => setExpandedSection(expandedSection === 'epp' ? null : 'epp')}
                      badge={extraction.eppRequired.length}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {extraction.eppRequired.map((epp, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-0.5">
                            <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{epp}</span>
                          </div>
                        ))}
                      </div>
                    </SectionBlock>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Raw Sections Breakdown ── */}
            {extraction?.rawSections && extraction.rawSections.length > 0 && (
              <Card className="shadow-sm border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <FileSearch className="w-3.5 h-3.5 text-amber-500" />
                    Extracción por Secciones del Documento
                    <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-auto">
                      {extraction.rawSections.reduce((s, sec) => s + sec.items.length, 0)} ítems en {extraction.rawSections.length} secciones
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[200px]">
                    <div className="divide-y divide-amber-100">
                      {extraction.rawSections.map((section, i) => (
                        <div key={i} className="px-4 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded">
                              {section.sectionName}
                            </span>
                            <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-200">
                              {section.items.length} ítems
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-600 leading-relaxed">
                            {section.items.map((item, j) => (
                              <span key={j} className="inline">
                                {item}
                                {j < section.items.length - 1 ? ' · ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* ── Risk Types & Checklist Card ── */}
            {preview.length > 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <ListChecks className="w-3.5 h-3.5 text-emerald-500" />
                    Tipos de Riesgo y Checklist
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] ml-auto">
                      {extraction?.totalChecklistItems || preview.reduce((s, r) => s + (r.checklist?.length || 0), 0)} ítems total
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y divide-slate-100">
                      {preview.map((risk, i) => {
                        const riskKey = `risk-${i}`
                        const isExpanded = expandedRisk === riskKey
                        const groups = risk.checklist ? groupByCategory(risk.checklist) : {}
                        const categoryNames = Object.keys(groups)

                        return (
                          <div key={i}>
                            <button
                              onClick={() => setExpandedRisk(isExpanded ? null : riskKey)}
                              className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1"
                                style={{
                                  backgroundColor: risk.color || '#6366f1',
                                  ringColor: risk.color || '#6366f1',
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{risk.label}</p>
                                {risk.description && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{risk.description}</p>
                                )}
                                {/* Category pills preview */}
                                {categoryNames.length > 1 && !isExpanded && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {categoryNames.slice(0, 4).map((cat) => (
                                      <Badge key={cat} className={cn('text-[8px] py-0 px-1', CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-600')}>
                                        {cat} ({groups[cat].length})
                                      </Badge>
                                    ))}
                                    {categoryNames.length > 4 && (
                                      <span className="text-[8px] text-slate-400">+{categoryNames.length - 4}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                                  {risk.checklist?.length || 0}
                                </Badge>
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                                }
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && risk.checklist?.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-3">
                                    {categoryNames.map((cat) => (
                                      <div key={cat}>
                                        {/* Category header */}
                                        <div className="flex items-center gap-2 mb-1.5 pl-1">
                                          <Tag className="w-3 h-3 text-slate-400" />
                                          <span className={cn(
                                            'text-[10px] font-semibold uppercase tracking-wider',
                                          )}>
                                            {cat}
                                          </span>
                                          <Badge className={cn('text-[8px] py-0 px-1', CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-600')}>
                                            {groups[cat].length}
                                          </Badge>
                                        </div>
                                        {/* Items */}
                                        <div className="space-y-0.5 pl-6">
                                          {groups[cat].map((item, j) => (
                                            <div key={j} className="flex items-start gap-2 text-xs py-0.5">
                                              {item.required ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                              ) : (
                                                <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0 mt-0.5" />
                                              )}
                                              <span className={item.required ? 'text-slate-700 font-medium leading-tight' : 'text-slate-500 leading-tight'}>
                                                {item.label}
                                              </span>
                                              {item.required && (
                                                <Badge className="bg-red-100 text-red-700 text-[7px] py-0 px-1 shrink-0 mt-0.5">
                                                  REQ
                                                </Badge>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-component: Collapsible Section Block ───────────────

function SectionBlock({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
  children,
}: {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left py-1.5 px-1 rounded-lg hover:bg-slate-50 transition-colors"
      >
        {icon}
        <span className="text-xs font-medium text-slate-700 flex-1">{title}</span>
        {badge !== undefined && (
          <Badge className="bg-slate-100 text-slate-600 text-[9px]">{badge}</Badge>
        )}
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        }
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pl-6 pr-1 pt-1 pb-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
