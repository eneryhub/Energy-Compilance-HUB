'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Siren, MapPin, Camera, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { getToken, apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface ERCStats {
  activeAlerts: number
}

interface ERCAlert {
  id: string
  tipo: string
  descripcion: string
  estado: string
  prioridad: string
  ubicacion: string | null
  photoUrl: string | null
  createdAt: string
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
      return 'bg-red-100 text-red-700 border-red-200'
    case 'ATENDIDA':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-700'
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

export default function PanicButton() {
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
  const [stats, setStats] = useState<ERCStats | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<ERCAlert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Poll /api/erc/stats every 10 seconds
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<ERCStats>('/erc/stats')
      setStats(data)
    } catch {
      // silent
    }
  }, [])

  // Poll recent alerts (own alerts)
  const fetchRecentAlerts = useCallback(async () => {
    try {
      const data = await apiFetch<ERCAlert[]>('/erc/list?limit=5')
      setRecentAlerts(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setLoadingAlerts(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchRecentAlerts()
    const statsInterval = setInterval(fetchStats, 10000)
    const alertsInterval = setInterval(fetchRecentAlerts, 30000)
    return () => {
      clearInterval(statsInterval)
      clearInterval(alertsInterval)
    }
  }, [fetchStats, fetchRecentAlerts])

  // GPS capture
  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización')
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
        toast.success('Ubicación GPS capturada')
      },
      (err) => {
        setGpsLoading(false)
        toast.error('No se pudo obtener la ubicación GPS')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La foto no debe superar 5MB')
      return
    }
    setPhotoName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Open dialog and reset form
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

  // Submit alert
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const ubicacion = gpsLocation
        ? JSON.stringify({ lat: gpsLocation.lat, lng: gpsLocation.lng, accuracy: gpsLocation.accuracy })
        : null

      await apiFetch('/erc/alerts', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          descripcion,
          ubicacion,
          photoUrl: photoBase64,
          prioridad,
        }),
      })

      setAlertSent(true)
      toast.success('Alerta de emergencia enviada exitosamente')
      // Refresh stats and recent alerts
      fetchStats()
      fetchRecentAlerts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar la alerta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Active alerts banner */}
      {stats && stats.activeAlerts > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-center gap-3 animate-pulse">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {stats.activeAlerts} alerta{stats.activeAlerts !== 1 ? 's' : ''} activa{stats.activeAlerts !== 1 ? 's' : ''} en tu empresa
            </p>
            <p className="text-xs text-red-600 mt-0.5">Mantente alerta y sigue los protocolos de seguridad</p>
          </div>
        </div>
      )}

      {/* Panic Button */}
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-sm text-slate-500 mb-6">Toca el botón en caso de emergencia</p>
        <button
          onClick={openDialog}
          className="relative group"
          aria-label="Botón de pánico - Activar alerta de emergencia"
        >
          {/* Pulsing rings */}
          <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
          <span className="absolute inset-0 rounded-full bg-red-400/20 animate-pulse" style={{ animationDuration: '2s' }} />
          <span className="absolute -inset-4 rounded-full bg-red-300/10 animate-pulse" style={{ animationDuration: '3s' }} />
          {/* Button */}
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-2xl shadow-red-500/40 flex flex-col items-center justify-center gap-2 text-white transition-transform group-hover:scale-105 group-active:scale-95">
            <Siren className="w-12 h-12 sm:w-14 sm:h-14" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Pánico</span>
          </div>
        </button>
        {stats && stats.activeAlerts === 0 && (
          <p className="text-xs text-emerald-600 mt-6 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sin alertas activas en este momento
          </p>
        )}
      </div>

      <Separator />

      {/* Recent Alerts */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Mis alertas recientes</h3>
        {loadingAlerts ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="text-center py-8">
            <Siren className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No tienes alertas recientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAlerts.map((alert) => {
              const tipoInfo = getTipoBadge(alert.tipo)
              return (
                <Card key={alert.id} className="py-0 gap-0">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={tipoInfo.color}>
                            {alert.tipo}
                          </Badge>
                          <Badge
                            className={getEstadoBadge(alert.estado)}
                            variant="outline"
                          >
                            {alert.estado}
                          </Badge>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(alert.createdAt)}
                          </span>
                        </div>
                        {alert.descripcion && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{alert.descripcion}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Alert Confirmation Dialog */}
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
                  Tu alerta de emergencia ha sido registrada. El equipo de seguridad ha sido notificado.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-emerald-700">Alerta enviada — Espere asistencia</p>
                <p className="text-xs text-slate-500 text-center">
                  Un supervisor ha sido notificado. Mantente en un lugar seguro y espera instrucciones.
                </p>
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
                  Confirmar Alerta de Emergencia
                </DialogTitle>
                <DialogDescription>
                  Describe la situación para que el equipo de respuesta pueda actuar rápidamente.
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
                        ? `📍 ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
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
                      <img
                        src={photoBase64}
                        alt="Vista previa"
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoBase64(null)
                          setPhotoName('')
                        }}
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
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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
