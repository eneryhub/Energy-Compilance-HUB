'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Siren,
  LogOut,
  Send,
  Camera,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ImagePlus,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useSyncExternalStore } from 'react'

// ============ Types ============

interface EmployeeLayoutProps {
  user: { name: string; email: string; companyName: string }
  onLogout: () => void
}

interface AlertItem {
  id: string
  tipo: string
  estado: string
  prioridad: string
  createdAt: string
  descripcion?: string | null
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

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'hace un momento'
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`
  return `hace ${Math.floor(diffSec / 86400)} d`
}

function estadoConfig(estado: string) {
  switch (estado) {
    case 'ATENDIDA':
      return { label: 'Atendida', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'ACTIVA':
      return { label: 'Activa', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'DESCARTADA':
      return { label: 'Descartada', className: 'bg-slate-100 text-slate-500 border-slate-200' }
    default:
      return { label: estado, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  }
}

function prioridadConfig(prioridad: string) {
  switch (prioridad) {
    case 'ALTA':
      return { label: 'Alta', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'MEDIA':
      return { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'BAJA':
      return { label: 'Baja', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    default:
      return { label: prioridad, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  }
}

function tipoConfig(tipo: string) {
  switch (tipo) {
    case 'PANICO':
      return { label: 'Pánico', icon: Siren, color: 'text-red-600', bg: 'bg-red-50' }
    case 'INCENDIO':
      return { label: 'Incendio', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' }
    case 'DERRAME':
      return { label: 'Derrame', icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' }
    case 'MEDICA':
      return { label: 'Médica', icon: ShieldCheck, color: 'text-sky-600', bg: 'bg-sky-50' }
    default:
      return { label: tipo, icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-50' }
  }
}

// ============ Component ============

export function EmployeeLayout({ user, onLogout }: EmployeeLayoutProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot)

  // Panic button state
  const [sendingAlert, setSendingAlert] = useState(false)
  const [alertSent, setAlertSent] = useState(false)

  // Report form state
  const [reportForm, setReportForm] = useState<ReportFormData>({
    categoria: '',
    prioridad: '',
    descripcion: '',
  })
  const [submittingReport, setSubmittingReport] = useState(false)

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  // Recent alerts state
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  // UI state
  const [showReportForm, setShowReportForm] = useState(false)
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)

  // ============ GPS location ============

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { /* GPS denied — ignore */ },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // ============ Fetch recent alerts ============

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiFetch<AlertItem[]>('/erc/alerts?limit=10')
      setRecentAlerts(data)
    } catch {
      // Silently fail
    } finally {
      setLoadingAlerts(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 15000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  // ============ Panic alert handler ============

  const handleActivateAlert = async () => {
    setSendingAlert(true)
    try {
      let ubicacion: { lat: number; lng: number; accuracy: number } | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          })
        })
        ubicacion = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
      } catch {
        // GPS not available
      }

      await apiFetch('/erc/alerts', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'PANICO', ubicacion }),
      })

      setAlertSent(true)
      toast({
        title: 'Alerta enviada',
        description: 'El equipo de emergencia fue notificado con tu ubicación.',
      })
      setTimeout(() => setAlertSent(false), 8000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar alerta'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSendingAlert(false)
    }
  }

  // ============ Photo handler ============

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'La foto no debe superar los 5 MB.',
        variant: 'destructive',
      })
      return
    }

    setPhotoFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    setPhotoPreview(null)
    setPhotoFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ============ Report form handler ============

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportForm.categoria || !reportForm.prioridad || !reportForm.descripcion.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Complete categoría, prioridad y descripción.',
        variant: 'destructive',
      })
      return
    }

    setSubmittingReport(true)
    try {
      // Build body
      const body: Record<string, unknown> = { ...reportForm }

      // If photo, convert to base64
      if (photoFile && photoPreview) {
        // Extract base64 data from data URL
        const base64Data = photoPreview.split(',')[1]
        body.fotoUrl = `data:${photoFile.type};base64,${base64Data}`
      }

      // Add GPS location if available
      if (gpsLocation) {
        body.ubicacion = gpsLocation
      }

      await apiFetch('/erc/reports', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      toast({
        title: 'Reporte enviado',
        description: 'Su hallazgo HSE fue registrado exitosamente.',
      })

      setReportForm({ categoria: '', prioridad: '', descripcion: '' })
      setPhotoPreview(null)
      setPhotoFile(null)
      setShowReportForm(false)
      fetchAlerts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar reporte'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSubmittingReport(false)
    }
  }

  // ============ Stats ============

  const activeAlerts = recentAlerts.filter((a) => a.estado === 'ACTIVA').length

  // ============ Render ============

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 py-3 max-w-xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user.companyName}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 truncate">{user.name}</p>
                <div className={`flex items-center gap-1 text-[10px] ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline text-xs">Salir</span>
          </Button>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 px-4 py-5 max-w-xl mx-auto w-full space-y-5 pb-10">

        {/* ── Active Alerts Banner ── */}
        <AnimatePresence>
          {activeAlerts > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Siren className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-800">
                    {activeAlerts} alerta{activeAlerts !== 1 ? 's' : ''} activa{activeAlerts !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Emergencia en curso — revisa el historial abajo
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Emergency Panic Button ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                Alerta de Emergencia
              </CardTitle>
              {gpsLocation && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 pl-9">
                  <MapPin className="w-3 h-3" />
                  GPS activo ({gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)})
                </p>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-center py-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    disabled={sendingAlert || alertSent}
                    className={`
                      relative flex flex-col items-center justify-center
                      w-[130px] h-[130px] rounded-full
                      text-white font-bold text-sm
                      transition-all duration-300 cursor-pointer
                      focus:outline-none focus:ring-4 focus:ring-red-500/30
                      disabled:opacity-70 disabled:cursor-not-allowed
                      ${alertSent
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                        : sendingAlert
                          ? 'bg-red-800 shadow-lg shadow-red-500/20'
                          : 'bg-red-600 shadow-lg shadow-red-500/40 hover:bg-red-500 hover:shadow-red-500/50'
                      }
                    `}
                  >
                    {/* Outer ring pulse */}
                    {!sendingAlert && !alertSent && (
                      <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />
                    )}
                    {sendingAlert ? (
                      <Loader2 className="w-10 h-10 animate-spin mb-1" />
                    ) : alertSent ? (
                      <CheckCircle2 className="w-10 h-10 mb-1" />
                    ) : (
                      <Siren className="w-10 h-10 mb-1" />
                    )}
                    <span className="text-[11px] leading-tight text-center mt-0.5 font-medium">
                      {sendingAlert ? 'ENVIANDO...' : alertSent ? 'RECIBIDA' : 'PULSAR ALERTA'}
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
                      Se notificará inmediatamente al equipo de emergencia de{' '}
                      <strong>{user.companyName}</strong> con tu ubicación GPS actual.
                      Solo usa este botón en situaciones de emergencia real.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleActivateAlert}
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
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Quick Actions Row ── */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setShowReportForm(!showReportForm)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Reportar Hallazgo</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Condición insegura, acto inseguro, etc.</p>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-3">
              <User className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{user.email}</p>
            <Badge className="mt-2 bg-orange-100 text-orange-700 text-[10px] border-0">
              Empleado de Campo
            </Badge>
          </motion.div>
        </div>

        {/* ── Report HSE Form (Expandable) ── */}
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
                    {/* Category & Priority row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Categoría *</Label>
                        <Select
                          value={reportForm.categoria}
                          onValueChange={(val) =>
                            setReportForm((prev) => ({ ...prev, categoria: val }))
                          }
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
                          onValueChange={(val) =>
                            setReportForm((prev) => ({ ...prev, prioridad: val }))
                          }
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
                      <Label className="text-xs font-medium text-slate-600">
                        Descripción del hallazgo *
                      </Label>
                      <Textarea
                        value={reportForm.descripcion}
                        onChange={(e) =>
                          setReportForm((prev) => ({ ...prev, descripcion: e.target.value }))
                        }
                        placeholder="Describa detalladamente lo observado, ubicación dentro de la planta, personal involucrado..."
                        rows={4}
                        className="text-sm resize-none"
                      />
                    </div>

                    {/* Photo Section */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600">
                        Foto evidencia
                        <span className="text-slate-400 font-normal ml-1">(recomendado)</span>
                      </Label>

                      {/* Hidden file input — capture="environment" opens rear camera on mobile */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />

                      {photoPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                          <img
                            src={photoPreview}
                            alt="Foto evidencia"
                            className="w-full h-48 object-cover"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                            onClick={removePhoto}
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
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all p-6 flex flex-col items-center gap-2"
                        >
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <ImagePlus className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">
                            Tocar para tomar foto
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Se abrirá la cámara de tu dispositivo
                          </p>
                        </motion.button>
                      )}
                    </div>

                    {/* GPS info */}
                    {gpsLocation && (
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

        {/* ── Recent Alerts / Activity Log ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAlerts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : recentAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Sin actividad</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Las alertas y reportes aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {recentAlerts.map((alert) => {
                    const tc = tipoConfig(alert.tipo)
                    const ec = estadoConfig(alert.estado)
                    const pc = prioridadConfig(alert.prioridad)
                    const TipoIcon = tc.icon

                    return (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                          alert.estado === 'ACTIVA'
                            ? 'border-red-100 bg-red-50/40'
                            : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg ${tc.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <TipoIcon className={`w-4 h-4 ${tc.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{tc.label}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ec.className}`}>
                              {ec.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pc.className}`}>
                              {pc.label}
                            </Badge>
                          </div>
                          {alert.descripcion && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.descripcion}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(alert.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-slate-100 bg-white py-3 mt-auto">
        <p className="text-center text-[10px] text-slate-400">
          Energy-Compliance Hub · Seguridad en Campo · v2.0
        </p>
      </footer>
    </div>
  )
}
