'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Siren, MapPin, Camera, AlertTriangle, CheckCircle2, Clock,
  FileText, Send, Loader2, ImagePlus, X, ShieldCheck, Wifi, WifiOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useSyncExternalStore } from 'react'

// ============ Types ============

interface ERCStats {
  activeAlerts: number
  totalAlerts: number
}

interface ERCAlert {
  id: string
  tipo: string
  descripcion: string | null
  estado: string
  prioridad: string
  ubicacion: string | null
  photoUrl: string | null
  createdAt: string
  user?: { name: string; email: string }
}

interface ReportFormData {
  categoria: string
  prioridad: string
  descripcion: string
}

// ============ Helpers ============

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
function getServerSnapshot() {
  return true
}

const TIPO_OPTIONS = [
  { value: 'PANICO', label: 'Pánico', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'INCENDIO', label: 'Incendio', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'DERRAME', label: 'Derrame', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'LESION', label: 'Lesión', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'OTRO', label: 'Otro', color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

const PRIORIDAD_OPTIONS = [
  { value: 'ALTA', label: 'Alta', color: 'bg-red-100 text-red-700' },
  { value: 'MEDIA', label: 'Media', color: 'bg-amber-100 text-amber-700' },
  { value: 'BAJA', label: 'Baja', color: 'bg-slate-100 text-slate-700' },
]

function getTipoBadge(tipo: string) {
  return TIPO_OPTIONS.find((t) => t.value === tipo) || TIPO_OPTIONS[4]
}

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'ACTIVA':
      return { className: 'bg-red-100 text-red-700 border-red-200', label: 'Activa' }
    case 'ATENDIDA':
      return { className: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Atendida' }
    case 'DESCARTADA':
      return { className: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Descartada' }
    default:
      return { className: 'bg-slate-100 text-slate-700', label: estado }
  }
}

function getTipoIcon(tipo: string) {
  switch (tipo) {
    case 'PANICO': return { icon: Siren, color: 'text-red-600', bg: 'bg-red-50' }
    case 'INCENDIO': return { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' }
    case 'DERRAME': return { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' }
    default: return { icon: AlertTriangle, color: 'text-slate-600', bg: 'bg-slate-50' }
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHr < 24) return `hace ${diffHr}h`
  return `hace ${diffDay}d`
}

function compressImage(file: File, maxWidth = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas error')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Image load error'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsDataURL(file)
  })
}

// ============ Component ============

export default function PanicButton() {
  const { toast } = useToast()
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reportFileInputRef = useRef<HTMLInputElement>(null)

  // Panic button state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tipo, setTipo] = useState('PANICO')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState('ALTA')
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [alertSent, setAlertSent] = useState(false)

  // HSE Report form state
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportForm, setReportForm] = useState<ReportFormData>({
    categoria: '',
    prioridad: '',
    descripcion: '',
  })
  const [submittingReport, setSubmittingReport] = useState(false)
  const [reportPhotoPreview, setReportPhotoPreview] = useState<string | null>(null)
  const [reportPhotoFile, setReportPhotoFile] = useState<File | null>(null)

  // Data state
  const [stats, setStats] = useState<ERCStats | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<ERCAlert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  // GPS location for reports
  const [reportGpsLocation, setReportGpsLocation] = useState<{ lat: number; lng: number } | null>(null)

  // ============ GPS ============

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setReportGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { /* GPS denied */ },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // ============ Data fetching ============

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<ERCStats>('/erc/stats')
      setStats(data)
    } catch {
      // silent
    }
  }, [])

  const fetchRecentAlerts = useCallback(async () => {
    try {
      const data = await apiFetch<{ alerts: ERCAlert[] } | ERCAlert[]>('/erc/list?limit=10')
      // API returns { alerts: [...], total } or plain array
      if (Array.isArray(data)) {
        setRecentAlerts(data)
      } else if (data && Array.isArray(data.alerts)) {
        setRecentAlerts(data.alerts)
      } else {
        setRecentAlerts([])
      }
    } catch {
      setRecentAlerts([])
    } finally {
      setLoadingAlerts(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchRecentAlerts()
    const statsInterval = setInterval(fetchStats, 10000)
    const alertsInterval = setInterval(fetchRecentAlerts, 15000)
    return () => {
      clearInterval(statsInterval)
      clearInterval(alertsInterval)
    }
  }, [fetchStats, fetchRecentAlerts])

  // ============ Panic alert handlers ============

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS no disponible', description: 'Tu navegador no soporta geolocalización', variant: 'destructive' })
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setGpsLoading(false)
        toast({ title: 'Ubicación GPS capturada' })
      },
      () => {
        setGpsLoading(false)
        toast({ title: 'Error GPS', description: 'No se pudo obtener la ubicación', variant: 'destructive' })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [toast])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'La foto no debe superar los 10 MB.', variant: 'destructive' })
      return
    }
    setPhotoName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  const openDialog = () => {
    setTipo('PANICO')
    setDescripcion('')
    setPrioridad('ALTA')
    setPhotoBase64(null)
    setPhotoName('')
    setGpsLocation(null)
    setAlertSent(false)
    setDialogOpen(true)
  }

  const handlePanicSubmit = async () => {
    setSubmitting(true)
    try {
      // Send ubicacion as JSON string (empty object if no GPS captured)
      const ubicacionStr = gpsLocation
        ? JSON.stringify({ lat: gpsLocation.lat, lng: gpsLocation.lng, accuracy: gpsLocation.accuracy })
        : '{}'

      await apiFetch('/erc/alerts', {
        method: 'POST',
        body: JSON.stringify({ tipo, descripcion, ubicacion: ubicacionStr, photoUrl: photoBase64, prioridad }),
      })

      setAlertSent(true)
      toast({ title: 'Alerta enviada', description: 'El equipo de emergencia fue notificado con tu ubicación.' })
      fetchStats()
      fetchRecentAlerts()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al enviar alerta', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ============ HSE Report handlers ============

  const handleReportPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'La foto no debe superar los 10 MB.', variant: 'destructive' })
      return
    }
    setReportPhotoFile(file)
    try {
      const compressed = await compressImage(file)
      setReportPhotoPreview(compressed)
    } catch {
      const reader = new FileReader()
      reader.onload = () => setReportPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const removeReportPhoto = () => {
    setReportPhotoPreview(null)
    setReportPhotoFile(null)
    if (reportFileInputRef.current) reportFileInputRef.current.value = ''
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportForm.categoria || !reportForm.prioridad || !reportForm.descripcion.trim()) {
      toast({ title: 'Campos requeridos', description: 'Complete categoría, prioridad y descripción.', variant: 'destructive' })
      return
    }

    setSubmittingReport(true)
    try {
      const body: Record<string, unknown> = { ...reportForm }
      if (reportPhotoPreview) body.fotoUrl = reportPhotoPreview
      if (reportGpsLocation) body.ubicacion = reportGpsLocation

      await apiFetch('/erc/reports', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      toast({ title: 'Reporte enviado', description: 'Su hallazgo HSE fue registrado exitosamente.' })
      setReportForm({ categoria: '', prioridad: '', descripcion: '' })
      setReportPhotoPreview(null)
      setReportPhotoFile(null)
      if (reportFileInputRef.current) reportFileInputRef.current.value = ''
      setShowReportForm(false)
      fetchRecentAlerts()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al enviar reporte', variant: 'destructive' })
    } finally {
      setSubmittingReport(false)
    }
  }

  const activeAlerts = recentAlerts.filter((a) => a.estado === 'ACTIVA').length

  // ============ Render ============

  return (
    <div className="space-y-6">
      {/* Connection status + Active alerts banner */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? 'En línea' : 'Sin conexión'}
        </div>
        {stats && stats.activeAlerts > 0 && (
          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
            <Siren className="w-3 h-3" />
            {stats.activeAlerts} activa{stats.activeAlerts !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Active Alerts Banner */}
      <AnimatePresence>
        {activeAlerts > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Siren className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800">
                  {activeAlerts} alerta{activeAlerts !== 1 ? 's' : ''} activa{activeAlerts !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600">Emergencia en curso — revisa el historial abajo</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emergency Panic Button ── */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            Alerta de Emergencia
          </CardTitle>
          {reportGpsLocation && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 pl-9">
              <MapPin className="w-3 h-3" />
              GPS activo ({reportGpsLocation.lat.toFixed(4)}, {reportGpsLocation.lng.toFixed(4)})
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center py-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.93 }}
                className="relative flex flex-col items-center justify-center w-[130px] h-[130px] rounded-full text-white font-bold text-sm transition-all duration-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-red-500/30 bg-red-600 shadow-lg shadow-red-500/40 hover:bg-red-500 hover:shadow-red-500/50"
              >
                {!submitting && !alertSent && (
                  <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />
                )}
                {submitting ? (
                  <Loader2 className="w-10 h-10 animate-spin mb-1" />
                ) : alertSent ? (
                  <CheckCircle2 className="w-10 h-10 mb-1" />
                ) : (
                  <Siren className="w-10 h-10 mb-1" />
                )}
                <span className="text-[11px] leading-tight text-center mt-0.5 font-medium">
                  {submitting ? 'ENVIANDO...' : alertSent ? 'RECIBIDA' : 'PULSAR ALERTA'}
                </span>
              </motion.button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Confirmar Alerta de Emergencia
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">
                  Se notificará inmediatamente al equipo de emergencia con tu ubicación GPS actual.
                  Solo usa este botón en situaciones de emergencia real.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePanicSubmit}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sí, Activar Alerta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {alertSent && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Alerta recibida — Esperando respuesta...</span>
            </motion.div>
          )}

          {!alertSent && (
            <p className="text-xs text-emerald-600 mt-4 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sin alertas activas en este momento
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions: Report HSE + Create more alerts ── */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowReportForm(!showReportForm)}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Reportar Hallazgo</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Condición insegura, acto inseguro, etc.</p>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={openDialog}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <Siren className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Otra Emergencia</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Incendio, derrame, lesión, etc.</p>
        </motion.button>
      </div>

      {/* ── HSE Report Form (Expandable) ── */}
      <AnimatePresence>
        {showReportForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Send className="w-4 h-4 text-emerald-600" />
                    </div>
                    Nuevo Reporte HSE
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowReportForm(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReportSubmit} className="space-y-4">
                  {/* Category & Priority */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Categoría *</Label>
                      <Select
                        value={reportForm.categoria}
                        onValueChange={(val) => setReportForm((prev) => ({ ...prev, categoria: val }))}
                      >
                        <SelectTrigger className="w-full h-10 text-sm">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CONDICION_INSEGURA">Condición Insegura</SelectItem>
                          <SelectItem value="ACTO_INSEGURO">Acto Inseguro</SelectItem>
                          <SelectItem value="CUASI_ACCIDENTE">Cuasi Accidente</SelectItem>
                          <SelectItem value="INCIDENTE_AMBIENTAL">Incidente Ambiental</SelectItem>
                          <SelectItem value="MEJORA">Mejora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Prioridad *</Label>
                      <Select
                        value={reportForm.prioridad}
                        onValueChange={(val) => setReportForm((prev) => ({ ...prev, prioridad: val }))}
                      >
                        <SelectTrigger className="w-full h-10 text-sm">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALTA">Alta</SelectItem>
                          <SelectItem value="MEDIA">Media</SelectItem>
                          <SelectItem value="BAJA">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Descripción del hallazgo *</Label>
                    <Textarea
                      value={reportForm.descripcion}
                      onChange={(e) => setReportForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                      placeholder="Describa detalladamente lo observado..."
                      rows={4}
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Photo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">
                      Foto evidencia <span className="text-slate-400 font-normal">(recomendado)</span>
                    </Label>
                    <input
                      ref={reportFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleReportPhotoSelect}
                      className="hidden"
                    />
                    {reportPhotoPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={reportPhotoPreview} alt="Foto evidencia" className="w-full h-48 object-cover" />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                          onClick={removeReportPhoto}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                          <p className="text-[11px] text-white font-medium">Foto adjunta</p>
                        </div>
                      </div>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => reportFileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all p-6 flex flex-col items-center gap-2"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <ImagePlus className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Tocar para tomar foto</p>
                        <p className="text-[11px] text-slate-400">Se abrirá la cámara de tu dispositivo</p>
                      </motion.button>
                    )}
                  </div>

                  {/* GPS info */}
                  {reportGpsLocation && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      Ubicación GPS adjunta automáticamente al reporte
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                  >
                    {submittingReport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando reporte...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Reporte HSE
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Separator />

      {/* ── Recent Alerts / Activity Log ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Actividad Reciente</h3>
        {loadingAlerts ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="text-center py-8">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Sin actividad</p>
            <p className="text-xs text-slate-400 mt-1">Las alertas y reportes aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {recentAlerts.map((alert) => {
              const estadoInfo = getEstadoBadge(alert.estado)
              const tipoInfo = getTipoIcon(alert.tipo)
              const TipoIcon = tipoInfo.icon

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    alert.estado === 'ACTIVA'
                      ? 'border-red-100 bg-red-50/40'
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg ${tipoInfo.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <TipoIcon className={`w-4 h-4 ${tipoInfo.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{getTipoBadge(alert.tipo).label}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estadoInfo.className}`}>
                        {estadoInfo.label}
                      </Badge>
                    </div>
                    {alert.descripcion && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.descripcion}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(alert.createdAt)}
                      {alert.user?.name && (
                        <>
                          <span className="mx-1">·</span>
                          {alert.user.name}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Emergency Detail Dialog (for other types) ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          {alertSent ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  Alerta Enviada
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  Tu alerta ha sido registrada. El equipo de seguridad ha sido notificado.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-emerald-700">Alerta enviada — Espere asistencia</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setDialogOpen(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                  Entendido
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Nueva Alerta de Emergencia
                </DialogTitle>
                <DialogDescription>
                  Describe la situación para que el equipo de respuesta pueda actuar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Tipo */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tipo de emergencia</label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prioridad */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Prioridad</label>
                  <Select value={prioridad} onValueChange={setPrioridad}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDAD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descripcion */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Descripción</label>
                  <Textarea
                    placeholder="Describe brevemente la emergencia..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* GPS */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Ubicación GPS</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={captureGps}
                    disabled={gpsLoading}
                    className="w-full gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    {gpsLoading
                      ? 'Obteniendo ubicación...'
                      : gpsLocation
                        ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
                        : 'Capturar ubicación actual'}
                  </Button>
                </div>

                {/* Photo */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Foto (opcional)</label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Tomar foto
                    </Button>
                    {photoName && (
                      <span className="text-xs text-slate-500 truncate max-w-[150px]">{photoName}</span>
                    )}
                  </div>
                  {photoBase64 && (
                    <div className="mt-2 relative inline-block">
                      <img src={photoBase64} alt="Vista previa" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => { setPhotoBase64(null); setPhotoName('') }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-slate-800 text-white rounded-full text-xs flex items-center justify-center hover:bg-slate-700"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="w-full sm:w-auto"
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handlePanicSubmit}
                  disabled={submitting}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Siren className="w-4 h-4 mr-2" />
                      Activar Alerta
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
