'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import * as XLSX from 'xlsx'
import { apiFetch, getToken } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileUp,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Info,
  Trash2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

const SENSOR_PROFILES: Record<string, { unit: string; thresholdCritical: number; thresholdWarning: number }> = {
  PRESION:     { unit: 'psi',  thresholdCritical: 100, thresholdWarning: 80 },
  TEMPERATURA: { unit: '°C',   thresholdCritical: 90,  thresholdWarning: 78 },
  GAS:         { unit: '%LEL', thresholdCritical: 5.0, thresholdWarning: 3.5 },
  VOLTAJE:     { unit: 'V',    thresholdCritical: 250, thresholdWarning: 240 },
}

const VALID_TYPES = Object.keys(SENSOR_PROFILES)

type RowStatus = 'valid' | 'error' | 'warning'
type RowAction = 'CREATE' | 'UPDATE'

interface ParsedRow {
  row: number
  name: string
  type: string
  location: string | null
  locationMatched: boolean
  unit: string
  thresholdCritical: number
  thresholdWarning: number
  status: RowStatus
  action: RowAction
  errors: string[]
}

interface ImportResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

type Step = 'upload' | 'preview' | 'results'

// ── Helpers ────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '')
}

function findField(row: Record<string, any>, ...aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const norm = normalizeHeader(alias)
    for (const key of Object.keys(row)) {
      if (normalizeHeader(key) === norm) {
        const val = row[key]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim()
        }
      }
    }
  }
  return undefined
}

function generateTemplate(): void {
  const wb = XLSX.utils.book_new()
  const data = [
    { name: 'Presión Línea A', type: 'PRESION', location: 'Planta Principal', unit: '', thresholdCritical: '', thresholdWarning: '' },
    { name: 'Temp. Sala Control', type: 'TEMPERATURA', location: 'Sala de Control', unit: '', thresholdCritical: '', thresholdWarning: '' },
    { name: 'Detector Gas Zona 1', type: 'GAS', location: '', unit: '', thresholdCritical: '', thresholdWarning: '' },
    { name: 'Voltaje Tablero Eléctrico', type: 'VOLTAJE', location: 'Planta Principal', unit: '', thresholdCritical: '', thresholdWarning: '' },
  ]
  const ws = XLSX.utils.json_to_sheet(data)
  // Set column widths
  ws['!cols'] = [
    { wch: 28 }, // name
    { wch: 16 }, // type
    { wch: 22 }, // location
    { wch: 8 },  // unit
    { wch: 20 }, // thresholdCritical
    { wch: 20 }, // thresholdWarning
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Sensores')
  XLSX.writeFile(wb, 'sensor-import-template.xlsx')
}

// ── Component ──────────────────────────────────────────────

interface SensorImportProps {
  onImportComplete?: () => void
}

export default function SensorImport({ onImportComplete }: SensorImportProps) {
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File handling ────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      setParseError('Formato no soportado. Use CSV o XLSX.')
      return
    }

    setFileName(file.name)
    setParsing(true)
    setParseError(null)
    setResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        setParseError('El archivo está vacío.')
        setParsing(false)
        return
      }
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

      if (data.length === 0) {
        setParseError('El archivo no contiene filas de datos.')
        setParsing(false)
        return
      }

      // Fetch existing sensor names to determine CREATE vs UPDATE
      const token = getToken()
      let existingNames: Set<string> = new Set()
      if (token) {
        try {
          const sensors = await apiFetch<Array<{ id: string; name: string }>>('/sensors')
          existingNames = new Set(sensors.map((s) => s.name.toLowerCase()))
        } catch {
          // Non-fatal: treat all as CREATE
        }
      }

      // Fetch locations for matching
      let locationNames: Set<string> = new Set()
      if (token) {
        try {
          const locData = await apiFetch<{ locations?: Array<{ id: string; name: string }> }>('/locations')
          if (locData?.locations) {
            locationNames = new Set(locData.locations.map((l) => l.name.toLowerCase()))
          }
        } catch {
          // Non-fatal
        }
      }

      // Parse rows
      const parsed: ParsedRow[] = []
      const warnings: string[] = []

      for (let i = 0; i < data.length; i++) {
        const rowNum = i + 2
        const row = data[i]
        const rowErrors: string[] = []

        const name = findField(row, 'name', 'nombre', 'sensor', 'sensorname')
        if (!name) {
          rowErrors.push('Campo "name" requerido')
          parsed.push({
            row: rowNum, name: '(sin nombre)', type: '', location: null,
            locationMatched: false, unit: '', thresholdCritical: 0, thresholdWarning: 0,
            status: 'error', action: 'CREATE', errors: rowErrors,
          })
          continue
        }

        const rawType = findField(row, 'type', 'tipo')
        const type = rawType ? rawType.toUpperCase().trim() : ''

        if (!type || !VALID_TYPES.includes(type)) {
          rowErrors.push(`Tipo "${rawType || '(vacío)'}" no válido`)
          parsed.push({
            row: rowNum, name, type: rawType || '', location: null,
            locationMatched: false, unit: '', thresholdCritical: 0, thresholdWarning: 0,
            status: 'error', action: 'CREATE', errors: rowErrors,
          })
          continue
        }

        const profile = SENSOR_PROFILES[type]
        const rawLocation = findField(row, 'location', 'ubicacion', 'locacion', 'loc')
        const rawUnit = findField(row, 'unit', 'unidad')
        const rawCritical = findField(row, 'thresholdcritical', 'criticalthreshold', 'umbralcritico', 'critico', 'threshold_critical')
        const rawWarning = findField(row, 'thresholdwarning', 'warningthreshold', 'umbralwarning', 'warning', 'threshold_warning')

        const unit = rawUnit || profile.unit
        const thresholdCritical = rawCritical ? parseFloat(rawCritical) : profile.thresholdCritical
        const thresholdWarning = rawWarning ? parseFloat(rawWarning) : profile.thresholdWarning

        // Validate thresholds
        if (rawCritical && (isNaN(thresholdCritical) || thresholdCritical <= 0)) {
          rowErrors.push('thresholdCritical debe ser número > 0')
        }
        if (rawWarning && (isNaN(thresholdWarning) || thresholdWarning < 0)) {
          rowErrors.push('thresholdWarning debe ser número >= 0')
        }

        // Check location match
        let locationMatched = true
        if (rawLocation && !locationNames.has(rawLocation.toLowerCase())) {
          rowErrors.push(`Ubicación "${rawLocation}" no encontrada`)
          locationMatched = false
        }

        const action: RowAction = existingNames.has(name.toLowerCase()) ? 'UPDATE' : 'CREATE'
        const status: RowStatus = rowErrors.length > 0 ? 'warning' : 'valid'

        if (status === 'warning') {
          warnings.push(`Fila ${rowNum}: ${rowErrors.join('; ')}`)
        }

        parsed.push({
          row: rowNum,
          name,
          type,
          location: rawLocation || null,
          locationMatched,
          unit,
          thresholdCritical,
          thresholdWarning,
          status,
          action,
          errors: rowErrors,
        })
      }

      setRows(parsed)
      setParsing(false)

      if (parsed.length > 0) {
        setStep('preview')
      } else {
        setParseError('No se encontraron filas válidas para importar.')
      }
    } catch {
      setParseError('Error al leer el archivo. Verifique que sea un CSV/XLSX válido.')
      setParsing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Import ───────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const token = getToken()
      if (!token) {
        setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'No autenticado' }] })
        setStep('results')
        return
      }

      const formData = new FormData()
      // Reconstruct file from rows — we need to re-read the original file
      // Actually, we need to re-upload the original file
      // Let's use the file input ref
      if (fileInputRef.current?.files?.[0]) {
        formData.append('file', fileInputRef.current.files[0])
      } else {
        setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'Archivo no disponible. Vuelva a seleccionarlo.' }] })
        setStep('results')
        return
      }

      const res = await fetch('/api/v1/import/sensors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: data.error || `Error ${res.status}` }] })
      } else {
        setResult(data as ImportResult)
      }
      setStep('results')
      onImportComplete?.()
    } catch (err: any) {
      setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: err.message || 'Error de conexión' }] })
      setStep('results')
    } finally {
      setImporting(false)
    }
  }, [onImportComplete])

  // ── Reset ────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setStep('upload')
    setFileName(null)
    setRows([])
    setResult(null)
    setParseError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Counters ─────────────────────────────────────────────

  const validCount = rows.filter((r) => r.status === 'valid').length
  const warningCount = rows.filter((r) => r.status === 'warning').length
  const errorCount = rows.filter((r) => r.status === 'error').length
  const createCount = rows.filter((r) => r.action === 'CREATE' && r.status !== 'error').length
  const updateCount = rows.filter((r) => r.action === 'UPDATE' && r.status !== 'error').length

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600">
            <FileUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Importar Sensores SCADA</h2>
            <p className="text-xs text-slate-500">Carga masiva desde CSV o XLSX con previsualización</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateTemplate}
            className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Plantilla
          </Button>
          {step !== 'upload' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-slate-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Nueva Importación
            </Button>
          )}
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-2 px-1">
        {(['upload', 'preview', 'results'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              step === s
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : i < ['upload', 'preview', 'results'].indexOf(step)
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-slate-50 text-slate-400'
            )}>
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                step === s ? 'bg-emerald-600 text-white' : i < ['upload', 'preview', 'results'].indexOf(step) ? 'bg-slate-400 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                {i < ['upload', 'preview', 'results'].indexOf(step) ? '✓' : i + 1}
              </span>
              {s === 'upload' ? 'Cargar' : s === 'preview' ? 'Revisar' : 'Resultado'}
            </div>
            {i < 2 && (
              <div className={cn(
                'flex-1 h-0.5 rounded-full',
                i < ['upload', 'preview', 'results'].indexOf(step) ? 'bg-emerald-300' : 'bg-slate-200'
              )} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Upload ──────────────────────────────── */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-slate-200">
              <CardContent className="py-12">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
                    dragOver
                      ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]'
                      : 'border-slate-300 hover:border-emerald-300 hover:bg-slate-50/50'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <div className={cn(
                    'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
                    dragOver ? 'bg-emerald-100' : 'bg-slate-100'
                  )}>
                    <Upload className={cn('w-7 h-7', dragOver ? 'text-emerald-600' : 'text-slate-400')} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    {dragOver ? 'Suelte el archivo aquí' : 'Arrastre su archivo CSV o XLSX'}
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    o haga clic para seleccionar
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Seleccionar Archivo
                  </Button>
                </div>

                {parsing && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <span className="text-sm text-slate-600">Analizando archivo...</span>
                  </div>
                )}

                {parseError && (
                  <Alert className="mt-4 border-red-200 bg-red-50">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <AlertDescription className="text-red-700 text-sm">{parseError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <Card className="p-4 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">CSV / XLSX</p>
                    <p className="text-[10px] text-slate-400">Formatos soportados</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <PlusCircle className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Crear + Actualizar</p>
                    <p className="text-[10px] text-slate-400">Upsert por nombre</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Info className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Auto-Defaults</p>
                    <p className="text-[10px] text-slate-400">Unidad y umbrales por tipo</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Previsualización</p>
                    <p className="text-[10px] text-slate-400">Revise antes de importar</p>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Preview ─────────────────────────────── */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Summary */}
            <Card className="border-slate-200">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{fileName}</span>
                    <Badge className="text-[10px] bg-slate-100 text-slate-600">{rows.length} filas</Badge>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {createCount > 0 && (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                        <PlusCircle className="w-3 h-3" />
                        {createCount} nuevos
                      </Badge>
                    )}
                    {updateCount > 0 && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {updateCount} actualizar
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge className="text-[10px] bg-amber-50 text-amber-600 border-amber-200 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {warningCount} advertencia(s)
                      </Badge>
                    )}
                    {errorCount > 0 && (
                      <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 gap-1">
                        <XCircle className="w-3 h-3" />
                        {errorCount} error(es)
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview Table */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  Previsualización de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs">Nombre</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Ubicación</TableHead>
                        <TableHead className="text-xs text-center">Unidad</TableHead>
                        <TableHead className="text-xs text-center">Crítico</TableHead>
                        <TableHead className="text-xs text-center">Warning</TableHead>
                        <TableHead className="text-xs text-center">Acción</TableHead>
                        <TableHead className="text-xs text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow
                          key={row.row}
                          className={cn(
                            'transition-colors',
                            row.status === 'error' ? 'bg-red-50/50 hover:bg-red-50' :
                            row.status === 'warning' ? 'bg-amber-50/50 hover:bg-amber-50' :
                            'hover:bg-slate-50'
                          )}
                        >
                          <TableCell className="text-center text-xs text-slate-400">{row.row}</TableCell>
                          <TableCell className="text-sm font-medium text-slate-700">{row.name}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              'text-[10px]',
                              row.type === 'PRESION' ? 'bg-cyan-100 text-cyan-700' :
                              row.type === 'TEMPERATURA' ? 'bg-orange-100 text-orange-700' :
                              row.type === 'GAS' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-teal-100 text-teal-700'
                            )}>
                              {row.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.location ? (
                              <div className="flex items-center gap-1">
                                {row.locationMatched ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                                <span className={cn('text-xs', row.locationMatched ? 'text-slate-700' : 'text-red-600')}>
                                  {row.location}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600 font-mono">{row.unit}</TableCell>
                          <TableCell className="text-center text-xs font-mono font-semibold text-red-600">{row.thresholdCritical}</TableCell>
                          <TableCell className="text-center text-xs font-mono font-semibold text-amber-600">{row.thresholdWarning}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              'text-[10px] font-semibold',
                              row.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                            )}>
                              {row.action === 'CREATE' ? 'NUEVO' : 'ACTUALIZAR'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.status === 'valid' && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">OK</Badge>
                            )}
                            {row.status === 'warning' && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Warn
                              </Badge>
                            )}
                            {row.status === 'error' && (
                              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                <XCircle className="w-3 h-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Warnings / Errors list */}
            {(warningCount > 0 || errorCount > 0) && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {errorCount > 0 ? (
                      <>
                        <XCircle className="w-4 h-4 text-red-500" />
                        Errores y Advertencias
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Advertencias
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {rows.filter((r) => r.status !== 'valid').map((r) => (
                        <div
                          key={r.row}
                          className={cn(
                            'flex items-start gap-2 p-2.5 rounded-lg text-xs',
                            r.status === 'error' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
                          )}
                        >
                          <span className="font-mono font-bold text-slate-500 shrink-0">F{r.row}:</span>
                          <span className={r.status === 'error' ? 'text-red-700' : 'text-amber-700'}>
                            {r.errors.join('; ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setParseError(null) }}>
                Volver
              </Button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500">
                  {validCount + warningCount} fila(s) se procesarán
                </p>
                <Button
                  onClick={handleImport}
                  disabled={importing || (validCount + warningCount === 0)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Confirmar Importación
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Results ─────────────────────────────── */}
        {step === 'results' && result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Result Card */}
            <Card className={cn(
              'border-2',
              result.success && result.errors.length === 0
                ? 'border-emerald-200 bg-emerald-50/30'
                : result.success
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-red-200 bg-red-50/30'
            )}>
              <CardContent className="py-8">
                <div className="text-center">
                  <div className={cn(
                    'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
                    result.success && result.errors.length === 0
                      ? 'bg-emerald-100'
                      : result.success
                        ? 'bg-amber-100'
                        : 'bg-red-100'
                  )}>
                    {result.success && result.errors.length === 0 ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    ) : result.success ? (
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {result.success && result.errors.length === 0
                      ? 'Importación Completada'
                      : result.success
                        ? 'Importación Completada con Advertencias'
                        : 'Importación Fallida'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {result.success && result.errors.length === 0
                      ? 'Todos los sensores fueron procesados correctamente.'
                      : result.success
                        ? 'Algunas filas no pudieron ser procesadas.'
                        : 'No se pudo completar la importación.'}
                  </p>
                </div>

                {/* Stats */}
                {result.success && (
                  <div className="grid grid-cols-3 gap-4 mt-6 max-w-md mx-auto">
                    <div className="text-center p-4 rounded-xl bg-white border border-emerald-100 shadow-sm">
                      <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                      <p className="text-xs text-slate-500 mt-1">Creados</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-white border border-amber-100 shadow-sm">
                      <p className="text-2xl font-bold text-amber-600">{result.updated}</p>
                      <p className="text-xs text-slate-500 mt-1">Actualizados</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                      <p className="text-2xl font-bold text-slate-600">{result.skipped}</p>
                      <p className="text-xs text-slate-500 mt-1">Omitidos</p>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {result.success && (
                  <div className="mt-6 max-w-md mx-auto">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Progreso</span>
                      <span>{result.created + result.updated + result.skipped} filas procesadas</span>
                    </div>
                    <Progress
                      value={result.errors.length === 0 ? 100 : Math.round(((result.created + result.updated) / rows.length) * 100)}
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error details */}
            {result.errors.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Detalle de Errores ({result.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-xs">
                          <span className="font-mono font-bold text-slate-500 shrink-0">
                            {err.row > 0 ? `F${err.row}` : '•'}
                          </span>
                          <span className="text-red-700">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="w-4 h-4" />
                Nueva Importación
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
