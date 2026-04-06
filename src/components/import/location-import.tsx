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
  MapPin,
  Navigation,
  Wifi,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

const VALID_VERIFICATION_METHODS = ['GPS', 'QR_CODE', 'BEACON']
const VERIFICATION_LABELS: Record<string, string> = {
  GPS: 'GPS Automático',
  QR_CODE: 'Código QR',
  BEACON: 'Beacon BLE',
}

type RowStatus = 'valid' | 'error' | 'warning'
type RowAction = 'CREATE' | 'UPDATE'

interface ParsedRow {
  row: number
  name: string
  address: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  verificationMethod: string
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
    { name: 'Planta Principal', address: 'Av. Industrial 123', latitude: '10.0726', longitude: '-84.3125', radiusMeters: '100', verificationMethod: 'GPS' },
    { name: 'Sala de Control', address: 'Edificio A, Nivel 2', latitude: '10.0730', longitude: '-84.3120', radiusMeters: '50', verificationMethod: 'GPS' },
    { name: 'Plataforma B', address: '', latitude: '10.0740', longitude: '-84.3110', radiusMeters: '200', verificationMethod: 'QR_CODE' },
    { name: 'Almacén Norte', address: 'Zona de Almacenamiento', latitude: '10.0750', longitude: '-84.3130', radiusMeters: '150', verificationMethod: 'BEACON' },
  ]
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 24 }, // name
    { wch: 28 }, // address
    { wch: 14 }, // latitude
    { wch: 14 }, // longitude
    { wch: 16 }, // radiusMeters
    { wch: 20 }, // verificationMethod
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Ubicaciones')
  XLSX.writeFile(wb, 'location-import-template.xlsx')
}

// ── Component ──────────────────────────────────────────────

interface LocationImportProps {
  onImportComplete?: () => void
}

export default function LocationImport({ onImportComplete }: LocationImportProps) {
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

      if (data.length > 200) {
        setParseError('Máximo 200 filas permitidas.')
        setParsing(false)
        return
      }

      // Fetch existing location names to determine CREATE vs UPDATE
      const token = getToken()
      let existingNames: Set<string> = new Set()
      if (token) {
        try {
          const locData = await apiFetch<{ locations?: Array<{ id: string; name: string }> }>('/locations')
          if (locData?.locations) {
            existingNames = new Set(locData.locations.map((l) => l.name.toLowerCase()))
          }
        } catch {
          // Non-fatal: treat all as CREATE
        }
      }

      // Parse rows
      const parsed: ParsedRow[] = []

      for (let i = 0; i < data.length; i++) {
        const rowNum = i + 2
        const row = data[i]
        const rowErrors: string[] = []

        const name = findField(row, 'name', 'nombre', 'location', 'ubicacion', 'locacion', 'sitio', 'site')
        if (!name) {
          rowErrors.push('Campo "name" requerido')
          parsed.push({
            row: rowNum, name: '(sin nombre)', address: null,
            latitude: 0, longitude: 0, radiusMeters: 0, verificationMethod: '',
            status: 'error', action: 'CREATE', errors: rowErrors,
          })
          continue
        }

        const rawLat = findField(row, 'latitude', 'lat', 'latitud')
        const rawLng = findField(row, 'longitude', 'lng', 'lon', 'longitud')
        const rawAddress = findField(row, 'address', 'direccion', 'dir')
        const rawRadius = findField(row, 'radiusmeters', 'radius', 'radio', 'radiometers')
        const rawMethod = findField(row, 'verificationmethod', 'verification', 'method', 'metodo', 'verificacion')

        // Validate latitude
        const latitude = rawLat ? parseFloat(rawLat) : NaN
        if (!rawLat || isNaN(latitude) || latitude < -90 || latitude > 90) {
          rowErrors.push(`Latitud inválida: "${rawLat || '(vacío)'}"`)
        }

        // Validate longitude
        const longitude = rawLng ? parseFloat(rawLng) : NaN
        if (!rawLng || isNaN(longitude) || longitude < -180 || longitude > 180) {
          rowErrors.push(`Longitud inválida: "${rawLng || '(vacío)'}"`)
        }

        // Validate radius
        let radiusMeters = 100
        if (rawRadius) {
          const r = parseInt(rawRadius)
          if (isNaN(r) || r < 10 || r > 10000) {
            rowErrors.push(`Radio inválido: "${rawRadius}" (10-10000m)`)
          } else {
            radiusMeters = r
          }
        }

        // Validate verification method
        let verificationMethod = 'GPS'
        if (rawMethod) {
          const upper = rawMethod.toUpperCase().trim()
          if (!VALID_VERIFICATION_METHODS.includes(upper)) {
            rowErrors.push(`Método inválido: "${rawMethod}"`)
          } else {
            verificationMethod = upper
          }
        }

        const hasErrors = rowErrors.some((e) => !e.startsWith('Método inválido'))
        const action: RowAction = existingNames.has(name.toLowerCase()) ? 'UPDATE' : 'CREATE'
        const status: RowStatus = rowErrors.length > 0 ? (hasErrors ? 'error' : 'warning') : 'valid'

        parsed.push({
          row: rowNum,
          name,
          address: rawAddress || null,
          latitude: isNaN(latitude) ? 0 : latitude,
          longitude: isNaN(longitude) ? 0 : longitude,
          radiusMeters,
          verificationMethod: rawMethod ? rawMethod.toUpperCase().trim() : verificationMethod,
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
        setParseError('No se encontraron filas para importar.')
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
      if (fileInputRef.current?.files?.[0]) {
        formData.append('file', fileInputRef.current.files[0])
      } else {
        setResult({ success: false, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'Archivo no disponible. Vuelva a seleccionarlo.' }] })
        setStep('results')
        return
      }

      const res = await fetch('/api/v1/import/locations', {
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 shrink-0">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Importar Ubicaciones</h2>
            <p className="text-xs text-slate-500 leading-normal mt-0.5">
              Carga masiva desde CSV o XLSX con previsualización
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateTemplate}
            className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0"
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
      <div className="flex items-center gap-0 overflow-x-auto">
        {(['upload', 'preview', 'results'] as const).map((s, i) => {
          const stepIndex = ['upload', 'preview', 'results'].indexOf(step)
          const isActive = step === s
          const isCompleted = i < stepIndex

          return (
            <div key={s} className="flex items-center gap-0 flex-1 min-w-0">
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : isCompleted
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-slate-50 text-slate-400'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  isActive ? 'bg-emerald-600 text-white' : isCompleted ? 'bg-slate-400 text-white' : 'bg-slate-200 text-slate-500'
                )}>
                  {isCompleted ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">
                  {s === 'upload' ? 'Cargar' : s === 'preview' ? 'Revisar' : 'Resultado'}
                </span>
              </div>
              {i < 2 && (
                <div className={cn(
                  'flex-1 h-0.5 rounded-full mx-1 min-w-[12px]',
                  isCompleted ? 'bg-emerald-300' : 'bg-slate-200'
                )} />
              )}
            </div>
          )
        })}
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
              <CardContent className="py-10">
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
                    'w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center',
                    dragOver ? 'bg-emerald-100' : 'bg-slate-100'
                  )}>
                    <Upload className={cn('w-6 h-6', dragOver ? 'text-emerald-600' : 'text-slate-400')} />
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <Card className="p-3.5 border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">CSV / XLSX</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Formatos soportados</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3.5 border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <PlusCircle className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">Crear + Actualizar</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Upsert por nombre</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3.5 border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">GPS Requerido</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Latitud y Longitud</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3.5 border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Wifi className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">3 Verificaciones</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">GPS, QR, Beacon BLE</p>
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
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
                    <Badge className="text-[10px] bg-slate-100 text-slate-600 shrink-0">{rows.length} filas</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap ml-auto">
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
                        <TableHead className="text-xs hidden sm:table-cell">Dirección</TableHead>
                        <TableHead className="text-xs text-center">Lat</TableHead>
                        <TableHead className="text-xs text-center">Lng</TableHead>
                        <TableHead className="text-xs text-center hidden md:table-cell">Radio</TableHead>
                        <TableHead className="text-xs text-center hidden lg:table-cell">Verificación</TableHead>
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
                          <TableCell className="text-xs font-medium text-slate-700 max-w-[120px] truncate">{row.name}</TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[150px] truncate hidden sm:table-cell">
                            {row.address || '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600 font-mono">{row.latitude.toFixed(4)}</TableCell>
                          <TableCell className="text-center text-xs text-slate-600 font-mono">{row.longitude.toFixed(4)}</TableCell>
                          <TableCell className="text-center text-xs text-slate-600 hidden md:table-cell">{row.radiusMeters}m</TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            <Badge className={cn(
                              'text-[10px]',
                              row.verificationMethod === 'GPS' ? 'bg-emerald-100 text-emerald-700' :
                              row.verificationMethod === 'QR_CODE' ? 'bg-violet-100 text-violet-700' :
                              'bg-sky-100 text-sky-700'
                            )}>
                              {VERIFICATION_LABELS[row.verificationMethod] || row.verificationMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              'text-[10px] font-semibold',
                              row.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                            )}>
                              {row.action === 'CREATE' ? 'NUEVO' : 'ACT'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.status === 'valid' && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">OK</Badge>
                            )}
                            {row.status === 'warning' && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                Warn
                              </Badge>
                            )}
                            {row.status === 'error' && (
                              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                <XCircle className="w-2.5 h-2.5 mr-0.5" />
                                Err
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                    'w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center',
                    result.success && result.errors.length === 0
                      ? 'bg-emerald-100'
                      : result.success
                        ? 'bg-amber-100'
                        : 'bg-red-100'
                  )}>
                    {result.success && result.errors.length === 0 ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    ) : result.success ? (
                      <AlertTriangle className="w-7 h-7 text-amber-600" />
                    ) : (
                      <XCircle className="w-7 h-7 text-red-600" />
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
                      ? 'Todas las ubicaciones fueron procesadas correctamente.'
                      : result.success
                        ? 'Algunas filas no pudieron ser procesadas.'
                        : 'No se pudo completar la importación.'}
                  </p>
                </div>

                {/* Stats */}
                {result.success && (
                  <div className="grid grid-cols-3 gap-3 mt-6 max-w-sm mx-auto">
                    <div className="text-center p-3 rounded-xl bg-white border border-emerald-100 shadow-sm">
                      <p className="text-xl font-bold text-emerald-600">{result.created}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Creadas</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white border border-amber-100 shadow-sm">
                      <p className="text-xl font-bold text-amber-600">{result.updated}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Actualizadas</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                      <p className="text-xl font-bold text-slate-600">{result.skipped}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Omitidas</p>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {result.success && (
                  <div className="mt-6 max-w-sm mx-auto">
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
