'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

interface ChecklistPreview {
  label: string
  required: boolean
}

interface RiskTypePreview {
  label: string
  description?: string
  color?: string
  icon?: string
  checklist: ChecklistPreview[]
}

interface IngestionResult {
  riskTypes: Array<{
    id: string
    key: string
    label: string
    description: string | null
    checklistCount: number
  }>
}

type IngestionState = 'idle' | 'processing' | 'success' | 'error'

const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv']
const MAX_SIZE = 10 * 1024 * 1024

export default function RiskIngestionPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [state, setState] = useState<IngestionState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<RiskTypePreview[]>([])
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await apiFetch<{
        success: boolean
        message: string
        riskTypes: IngestionResult['riskTypes']
        rawExtraction?: { riskTypes: RiskTypePreview[] }
      }>('/admin/risks/upload', {
        method: 'POST',
        body: formData,
      })

      if (data.rawExtraction?.riskTypes) {
        setPreview(data.rawExtraction.riskTypes)
      }
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
    setPreview([])
    setResult(null)
    setErrorMessage('')
    setExpandedRisk(null)
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
          {/* Drag & Drop Zone (shown when no file selected) */}
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
                  <p className="text-sm font-medium text-slate-700">Procesando con IA...</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Extrayendo texto del documento y mapeando tipos de riesgo
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Success Results */}
      <AnimatePresence>
        {state === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Success Banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-700">
                  {result.riskTypes?.length || 0} tipo(s) de riesgo procesado(s)
                </p>
                <p className="text-xs text-emerald-600">
                  {result.riskTypes?.reduce((s, r) => s + r.checklistCount, 0) || 0} ítems de checklist creados/actualizados
                </p>
              </div>
            </div>

            {/* Preview Card */}
            {preview.length > 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    Datos Extraídos por IA
                    <Badge className="bg-violet-100 text-violet-700 text-[10px] ml-auto">
                      {preview.length} riesgo{preview.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[400px]">
                    <div className="divide-y divide-slate-100">
                      {preview.map((risk, i) => {
                        const riskKey = `risk-${i}`
                        const isExpanded = expandedRisk === riskKey
                        return (
                          <div key={i}>
                            <button
                              onClick={() => setExpandedRisk(isExpanded ? null : riskKey)}
                              className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: risk.color || '#6366f1' }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{risk.label}</p>
                                {risk.description && (
                                  <p className="text-[10px] text-slate-400 truncate">{risk.description}</p>
                                )}
                              </div>
                              <Badge className="bg-slate-100 text-slate-600 text-[10px] shrink-0">
                                {risk.checklist?.length || 0} ítems
                              </Badge>
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              }
                            </button>
                            <AnimatePresence>
                              {isExpanded && risk.checklist?.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-1">
                                    {risk.checklist.map((item, j) => (
                                      <div key={j} className="flex items-center gap-2 text-xs pl-6">
                                        {item.required ? (
                                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                        ) : (
                                          <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0" />
                                        )}
                                        <span className={item.required ? 'text-slate-700 font-medium' : 'text-slate-500'}>
                                          {item.label}
                                        </span>
                                        {item.required && (
                                          <Badge className="bg-red-100 text-red-700 text-[8px] py-0 px-1">
                                            Requerido
                                          </Badge>
                                        )}
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
