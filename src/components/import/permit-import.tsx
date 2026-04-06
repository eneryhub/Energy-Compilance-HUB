'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Download,
  Columns3,
  Eye,
  ArrowRight,
  Info,
  Table2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import * as XLSX from 'xlsx'

// ============ Types ============

interface ParsedRow {
  rowNumber: number
  key: string
  label: string
  color: string
  icon: string
  description: string
  checklist: string[]
  status: 'ok' | 'warning' | 'error'
  message: string
}

interface ColumnMapping {
  key: string
  label: string
  color: string
  icon: string
  description: string
  checklist: string
}

interface ImportResult {
  success: boolean
  created: number
  updated: number
  errors: string[]
  skipped: number
}

type Step = 'upload' | 'mapping' | 'preview' | 'result'

const EXPECTED_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean; aliases: string[] }[] = [
  { key: 'key', label: 'Clave / Key', required: true, aliases: ['key', 'clave', 'tipo', 'type', 'codigo'] },
  { key: 'label', label: 'Nombre / Label', required: true, aliases: ['label', 'nombre', 'name', 'titulo', 'title'] },
  { key: 'color', label: 'Color', required: false, aliases: ['color', 'colour', 'hex'] },
  { key: 'icon', label: 'Icono', required: false, aliases: ['icon', 'icono'] },
  { key: 'description', label: 'Descripción', required: false, aliases: ['description', 'desc', 'detalle'] },
  { key: 'checklist', label: 'Lista de Verificación', required: false, aliases: ['checklist', 'items', 'checklist_items'] },
]

const STEP_LABELS: Record<Step, { title: string; description: string; number: number }> = {
  upload: { title: 'Cargar Archivo', description: 'Sube un archivo CSV o Excel con los datos de tipos de riesgo', number: 1 },
  mapping: { title: 'Mapeo de Columnas', description: 'Asigna las columnas de tu archivo a los campos esperados', number: 2 },
  preview: { title: 'Vista Previa', description: 'Revisa los datos antes de importar', number: 3 },
  result: { title: 'Resultado', description: 'Resumen de la importación', number: 4 },
}

// ============ Component ============

interface PermitImportProps {
  onImportComplete?: () => void
}

export default function PermitImport({ onImportComplete }: PermitImportProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [fileSize, setFileSize] = useState<number>(0)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])

  // Column mapping
  const [columnMap, setColumnMap] = useState<ColumnMapping>({
    key: '',
    label: '',
    color: '',
    icon: '',
    description: '',
    checklist: '',
  })

  // Parsed data
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // ============ Auto-map columns ============

  const autoMapColumns = useCallback((headers: string[]) => {
    const newMap: ColumnMapping = { key: '', label: '', color: '', icon: '', description: '', checklist: '' }

    const findMatch = (aliases: string[]): string | null => {
      for (const h of headers) {
        const norm = h.toLowerCase().trim().replace(/[\s_-]+/g, '')
        for (const a of aliases) {
          if (norm === a.replace(/[\s_-]+/g, '')) return h
        }
      }
      return null
    }

    // Map in priority order
    for (const field of EXPECTED_FIELDS) {
      const match = findMatch(field.aliases)
      if (match) {
        newMap[field.key] = match
      }
    }

    // Also detect checklist item columns (item_1, item_2, etc.)
    // We look for any remaining columns that match the pattern
    const usedCols = new Set(Object.values(newMap).filter(Boolean))
    const itemCols = headers.filter(h => /^item[_\-]?\d+$/i.test(h) && !usedCols.has(h))
    if (itemCols.length > 0 && !newMap.checklist) {
      newMap.checklist = itemCols.join(',')
    }

    setColumnMap(newMap)
  }, [])

  // ============ File handling ============

  const processFile = useCallback((file: File) => {
    setError(null)
    setImportResult(null)
    setParsedRows([])

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Formato no soportado. Use archivos CSV o Excel (.xlsx/.xls).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo excede el límite de 5MB.')
      return
    }

    setFileName(file.name)
    setFileSize(file.size)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result
        if (!buffer) {
          setError('No se pudo leer el archivo.')
          return
        }

        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          setError('El archivo está vacío.')
          return
        }

        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

        if (!jsonData || jsonData.length === 0) {
          setError('El archivo no contiene datos.')
          return
        }
        if (jsonData.length > 500) {
          setError('Máximo 500 filas permitidas por importación.')
          return
        }

        const headers = Object.keys(jsonData[0])
        setDetectedHeaders(headers)
        setRawRows(jsonData)
        autoMapColumns(headers)
        setCurrentStep('mapping')
      } catch (err: unknown) {
        console.error('Parse error:', err)
        setError('Error al procesar el archivo. Verifica que el formato sea correcto.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [autoMapColumns])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  // Drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  // ============ Parse rows with current mapping ============

  const parseRows = useCallback(() => {
    if (rawRows.length === 0) return

    const checklistCols = columnMap.checklist
      ? columnMap.checklist.split(',').map(s => s.trim()).filter(Boolean)
      : []
    // Also detect item_N columns from headers
    const itemCols = detectedHeaders.filter(h => /^item[_\-]?\d+$/i.test(h) && !checklistCols.includes(h))

    const rows: ParsedRow[] = rawRows.map((row, i) => {
      const key = columnMap.key ? String(row[columnMap.key] || '').toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') : ''
      const label = columnMap.label ? String(row[columnMap.label] || '').trim() : ''
      const color = columnMap.color ? String(row[columnMap.color] || '').trim() : ''
      const icon = columnMap.icon ? String(row[columnMap.icon] || '').trim() : ''
      const description = columnMap.description ? String(row[columnMap.description] || '').trim() : ''

      // Parse checklist
      const checklistItems: string[] = []
      if (checklistCols.length > 0) {
        // Check if it's a single column with semicolons or multiple columns
        if (checklistCols.length === 1) {
          const raw = String(row[checklistCols[0]] || '')
          raw.split(/[;\n|]/).forEach(s => {
            const t = s.trim()
            if (t) checklistItems.push(t)
          })
        } else {
          checklistCols.forEach(col => {
            const val = String(row[col] || '').trim()
            if (val) checklistItems.push(val)
          })
        }
      }
      // Also add item_N columns
      itemCols.forEach(col => {
        const val = String(row[col] || '').trim()
        if (val) checklistItems.push(val)
      })

      // Validation
      let status: ParsedRow['status'] = 'ok'
      let message = ''
      if (!key && !label) {
        status = 'error'
        message = 'Fila vacía (sin clave ni nombre)'
      } else if (!key) {
        status = 'error'
        message = 'Falta la clave (key)'
      } else if (!label) {
        status = 'error'
        message = 'Falta el nombre (label)'
      } else if (!color && checklistItems.length === 0) {
        status = 'warning'
        message = 'Sin color personalizado ni lista de verificación'
      }

      return {
        rowNumber: i + 2,
        key,
        label,
        color: color || '#6366f1',
        icon: icon || 'AlertTriangle',
        description,
        checklist: checklistItems,
        status,
        message,
      }
    })

    setParsedRows(rows)
    setCurrentStep('preview')
  }, [rawRows, columnMap, detectedHeaders])

  // ============ Import ============

  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportProgress(0)
    setError(null)

    const validRows = parsedRows.filter(r => r.status !== 'error')
    if (validRows.length === 0) {
      setError('No hay filas válidas para importar.')
      setImporting(false)
      return
    }

    const body = {
      items: validRows.map(r => ({
        key: r.key,
        label: r.label,
        color: r.color,
        icon: r.icon,
        description: r.description || undefined,
        checklist: r.checklist,
      })),
    }

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + Math.random() * 15, 90))
      }, 200)

      const result = await apiFetch<ImportResult>('/v1/import/permits', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      clearInterval(progressInterval)
      setImportProgress(100)
      setImportResult(result)
      setCurrentStep('result')
      onImportComplete?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en la importación'
      setError(message)
    } finally {
      setImporting(false)
    }
  }, [parsedRows])

  // ============ Reset ============

  const handleReset = useCallback(() => {
    setCurrentStep('upload')
    setFileName('')
    setFileSize(0)
    setDetectedHeaders([])
    setRawRows([])
    setColumnMap({ key: '', label: '', color: '', icon: '', description: '', checklist: '' })
    setParsedRows([])
    setImportResult(null)
    setError(null)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ============ Download sample template ============

  const handleDownloadTemplate = useCallback(() => {
    const sampleData = [
      { key: 'ALTURA', label: 'Trabajo en Altura', color: '#ef4444', icon: 'ArrowUp', description: 'Trabajos en alturas superiores a 1.8m', checklist: 'Arnés de seguridad;Punto de anclaje certificado;Botiquín de primeros auxilios;Charla de seguridad completada' },
      { key: 'ELECTRICO', label: 'Riesgo Eléctrico', color: '#f59e0b', icon: 'Zap', description: 'Trabajos con tensión eléctrica', checklist: 'EPP dieléctrico completo;Prueba de ausencia de tensión;Botiquín disponible' },
      { key: 'CONFINADO', label: 'Espacio Confinado', color: '#8b5cf6', icon: 'Box', description: 'Ingreso a espacios confinados', checklist: 'Monitoreo de atmósfera;Permiso de entrada vigente' },
      { key: 'CALIENTE', label: 'Trabajo en Caliente', color: '#dc2626', icon: 'Flame', description: 'Soldadura, corte, trabajos con fuego', checklist: 'Extintor disponible;Charla de seguridad' },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tipos de Riesgo')
    XLSX.writeFile(wb, 'plantilla_importacion_riesgos.xlsx')
  }, [])

  // ============ Computed values ============

  const validRows = useMemo(() => parsedRows.filter(r => r.status !== 'error').length, [parsedRows])
  const errorRows = useMemo(() => parsedRows.filter(r => r.status === 'error').length, [parsedRows])
  const warningRows = useMemo(() => parsedRows.filter(r => r.status === 'warning').length, [parsedRows])
  const isMappingValid = useMemo(() => !!columnMap.key && !!columnMap.label, [columnMap])
  const steps: Step[] = ['upload', 'mapping', 'preview', 'result']

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ============ Render ============

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const isActive = step === currentStep
          const isCompleted = steps.indexOf(currentStep) > i
          return (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isActive
                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                      : 'bg-slate-100 text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : STEP_LABELS[step].number}
                </div>
                <span className={`text-xs font-medium truncate hidden sm:block ${
                  isActive ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {STEP_LABELS[step].title}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          {STEP_LABELS[currentStep].title}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {STEP_LABELS[currentStep].description}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ============ STEP 1: Upload ============ */}
      {currentStep === 'upload' && (
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                isDragging ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                {isDragging ? (
                  <Upload className="w-8 h-8 text-emerald-600 animate-bounce" />
                ) : (
                  <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                )}
              </div>
              {isDragging ? (
                <p className="text-sm font-medium text-emerald-700">Suelta el archivo aquí...</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    Arrastra tu archivo aquí o <span className="text-emerald-600">haz clic para seleccionar</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Soporta CSV, Excel (.xlsx, .xls) — Máximo 5MB
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Formato esperado</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Columnas: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">key</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">label</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">color</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">icon</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">description</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">checklist</code>
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Table2 className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Lista de verificación</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Separa los items con punto y coma <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">;</code> en una sola columna,
                    o usa columnas <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">item_1</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">item_2</code>...
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Download template */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="gap-2 text-slate-600"
              onClick={handleDownloadTemplate}
            >
              <Download className="w-4 h-4" />
              Descargar Plantilla de Ejemplo (.xlsx)
            </Button>
          </div>
        </div>
      )}

      {/* ============ STEP 2: Column Mapping ============ */}
      {currentStep === 'mapping' && (
        <div className="space-y-4">
          {/* File info */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                {fileName.endsWith('.csv') ? (
                  <FileText className="w-5 h-5 text-slate-500" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(fileSize)} · {detectedHeaders.length} columnas detectadas · {rawRows.length} filas
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setCurrentStep('upload')}
              >
                Cambiar archivo
              </Button>
            </div>
          </Card>

          {/* Column mapping form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Columns3 className="w-5 h-5 text-emerald-600" />
                Mapeo de Columnas
              </CardTitle>
              <CardDescription>
                Asigna cada columna detectada a su campo correspondiente. Los campos marcados con * son obligatorios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {EXPECTED_FIELDS.map((field) => {
                const mappedCol = columnMap[field.key]
                return (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700 w-48 shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Select
                      value={mappedCol}
                      onValueChange={(val) => setColumnMap(prev => ({ ...prev, [field.key]: val }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="— No mapear —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No mapear —</SelectItem>
                        {detectedHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mappedCol && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0">
                        {field.aliases.slice(0, 2).join(', ')}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep('upload')}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Atrás
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={parseRows}
              disabled={!isMappingValid}
            >
              <Eye className="w-4 h-4" />
              Vista Previa
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============ STEP 3: Preview ============ */}
      {currentStep === 'preview' && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-lg font-bold text-slate-800">{validRows}</p>
                  <p className="text-[11px] text-slate-500">Válidos</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-slate-800">{warningRows}</p>
                  <p className="text-[11px] text-slate-500">Advertencias</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-lg font-bold text-slate-800">{errorRows}</p>
                  <p className="text-[11px] text-slate-500">Errores</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Preview table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Datos a Importar ({validRows} filas)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Clave</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Icono</TableHead>
                      <TableHead className="hidden lg:table-cell">Descripción</TableHead>
                      <TableHead className="hidden md:table-cell">Items ({parsedRows.reduce((s, r) => s + r.checklist.length, 0)})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        className={row.status === 'error' ? 'bg-red-50/50' : row.status === 'warning' ? 'bg-amber-50/30' : ''}
                      >
                        <TableCell className="text-center text-xs text-slate-400 font-mono">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell>
                          {row.status === 'ok' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              OK
                            </Badge>
                          )}
                          {row.status === 'warning' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              <AlertTriangle className="w-3 h-3 mr-0.5" />
                              Advertencia
                            </Badge>
                          )}
                          {row.status === 'error' && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              <AlertCircle className="w-3 h-3 mr-0.5" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {row.key || '—'}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-slate-800">
                          {row.label || '—'}
                        </TableCell>
                        <TableCell>
                          {row.color && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: row.color }} />
                              <span className="text-[10px] text-slate-500 font-mono">{row.color}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{row.icon}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-slate-500 max-w-[200px] truncate">
                          {row.description || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.checklist.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.checklist.slice(0, 3).map((item, idx) => (
                                <p key={idx} className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                  {idx + 1}. {item}
                                </p>
                              ))}
                              {row.checklist.length > 3 && (
                                <p className="text-[10px] text-slate-400">
                                  +{row.checklist.length - 3} más...
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Warnings summary */}
          {(warningRows > 0 || errorRows > 0) && (
            <Alert className={errorRows > 0 ? 'border-red-200' : 'border-amber-200'}>
              {errorRows > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <AlertDescription>
                {errorRows > 0
                  ? `${errorRows} fila(s) con errores serán omitidas. ${warningRows > 0 ? ` ${warningRows} fila(s) con advertencias serán importadas.` : ''}`
                  : `${warningRows} fila(s) con advertencias serán importadas (sin color personalizado).`
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Mapeo
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleImport}
              disabled={importing || validRows === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importar {validRows} Tipo(s) de Riesgo
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {importing && (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Importando...</p>
                  <span className="text-sm text-slate-500">{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ============ STEP 4: Result ============ */}
      {currentStep === 'result' && importResult && (
        <div className="space-y-4">
          {/* Success card */}
          {importResult.success && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Importación Completada</h3>
                    <p className="text-sm text-slate-500">Los tipos de riesgo han sido procesados correctamente</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-white">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Creados</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white">
                    <p className="text-2xl font-bold text-amber-600">{importResult.updated}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Actualizados</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white">
                    <p className="text-2xl font-bold text-slate-600">{importResult.skipped}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Omitidos</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white">
                    <p className="text-2xl font-bold text-slate-600">{validRows - importResult.skipped}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Total procesados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors card */}
          {importResult.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Errores ({importResult.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-48">
                  <div className="divide-y divide-red-100">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="px-4 py-2.5 bg-red-50/50">
                        <p className="text-sm text-red-700">{err}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleReset}
            >
              <RefreshCw className="w-4 h-4" />
              Nueva Importación
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
