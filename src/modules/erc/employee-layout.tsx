'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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

// ============ Types ============

interface EmployeeLayoutProps {
  user: { name: string; email: string; companyName: string }
  onLogout: () => void
}

interface AlertItem {
  id: string
  tipo: string
  estado: string
  createdAt: string
}

interface ReportFormData {
  categoria: string
  prioridad: string
  descripcion: string
}

// ============ Helpers ============

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'hace un momento'
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`
  return `hace ${Math.floor(diffSec / 86400)} d`
}

function estadoBadge(estado: string) {
  switch (estado) {
    case 'ATENDIDA':
      return <Badge className="bg-emerald-600 text-white border-0">{estado}</Badge>
    case 'ACTIVA':
      return <Badge className="bg-amber-500 text-white border-0">{estado}</Badge>
    case 'PENDIENTE':
      return <Badge className="bg-slate-500 text-white border-0">{estado}</Badge>
    default:
      return <Badge variant="outline">{estado}</Badge>
  }
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case 'PANICO':
      return 'Pánico'
    case 'MEDICA':
      return 'Médica'
    case 'INCENDIO':
      return 'Incendio'
    default:
      return tipo
  }
}

// ============ Component ============

export function EmployeeLayout({ user, onLogout }: EmployeeLayoutProps) {
  const { toast } = useToast()

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

  // Recent alerts state
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  // ============ Fetch recent alerts ============

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiFetch<AlertItem[]>('/erc/alerts?limit=5')
      setRecentAlerts(data)
    } catch {
      // Silently fail — alerts are secondary
    } finally {
      setLoadingAlerts(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Poll every 10 seconds to check for status changes
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 10000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  // ============ Panic alert handler ============

  const handleActivateAlert = async () => {
    setSendingAlert(true)
    try {
      // Get GPS location
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
        // GPS not available — continue without location
      }

      await apiFetch('/erc/alerts', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'PANICO',
          ubicacion,
        }),
      })

      setAlertSent(true)
      toast({
        title: 'Alerta enviada exitosamente',
        description: 'Esperando respuesta del equipo de emergencia...',
      })

      // Reset the "sent" state after 5 seconds
      setTimeout(() => setAlertSent(false), 5000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar alerta'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSendingAlert(false)
    }
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
      await apiFetch('/erc/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...reportForm,
          foto: 'Foto no disponible',
        }),
      })

      toast({
        title: 'Reporte enviado',
        description: 'Su hallazgo HSE ha sido registrado exitosamente.',
      })

      setReportForm({ categoria: '', prioridad: '', descripcion: '' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar reporte'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmittingReport(false)
    }
  }

  // ============ Render ============

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.companyName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-700/50 shrink-0"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6 pb-8">
        {/* ── Card 1: Panic Button ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-red-500/30 bg-slate-800/60 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Botón de Emergencia
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={sendingAlert || alertSent}
                    className={`
                      relative flex flex-col items-center justify-center
                      w-[140px] h-[140px] rounded-full
                      text-white font-bold text-sm
                      transition-all duration-300
                      focus:outline-none focus:ring-4 focus:ring-red-500/50
                      active:scale-95
                      disabled:opacity-70 disabled:cursor-not-allowed
                      ${
                        alertSent
                          ? 'bg-emerald-600 shadow-lg shadow-emerald-500/30'
                          : sendingAlert
                            ? 'bg-red-800 shadow-lg shadow-red-500/20'
                            : 'bg-red-600 shadow-lg shadow-red-500/40 animate-pulse'
                      }
                    `}
                  >
                    {sendingAlert ? (
                      <Loader2 className="w-10 h-10 animate-spin mb-1" />
                    ) : alertSent ? (
                      <CheckCircle2 className="w-10 h-10 mb-1" />
                    ) : (
                      <Siren className="w-10 h-10 mb-1" />
                    )}
                    <span className="text-[11px] leading-tight text-center mt-0.5">
                      {sendingAlert
                        ? 'ENVIANDO...'
                        : alertSent
                          ? 'ENVIADA'
                          : 'ACTIVAR ALERTA'}
                    </span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-400">
                      ¿Confirma activar alerta de emergencia?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Se notificará al equipo de emergencia de{' '}
                      <span className="text-white font-medium">{user.companyName}</span>{' '}
                      con su ubicación actual.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleActivateAlert}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Confirmar Alerta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {alertSent && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-emerald-400 text-sm flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Esperando respuesta...
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Card 2: Reportar Hallazgo HSE ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-400 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Reportar Hallazgo HSE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReportSubmit} className="space-y-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Categoría</Label>
                  <Select
                    value={reportForm.categoria}
                    onValueChange={(val) =>
                      setReportForm((prev) => ({ ...prev, categoria: val }))
                    }
                  >
                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="CONDICION_INSEGURA">Condición Insegura</SelectItem>
                      <SelectItem value="ACTO_INSEGURO">Acto Inseguro</SelectItem>
                      <SelectItem value="CUASI_ACCIDENTE">Cuasi Accidente</SelectItem>
                      <SelectItem value="INCIDENTE_AMBIENTAL">Incidente Ambiental</SelectItem>
                      <SelectItem value="MEJORA">Mejora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Prioridad</Label>
                  <Select
                    value={reportForm.prioridad}
                    onValueChange={(val) =>
                      setReportForm((prev) => ({ ...prev, prioridad: val }))
                    }
                  >
                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="MEDIA">Media</SelectItem>
                      <SelectItem value="BAJA">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Descripción</Label>
                  <Textarea
                    value={reportForm.descripcion}
                    onChange={(e) =>
                      setReportForm((prev) => ({ ...prev, descripcion: e.target.value }))
                    }
                    placeholder="Describa el hallazgo..."
                    rows={3}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                  />
                </div>

                {/* Photo placeholder */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    onClick={() =>
                      toast({
                        description: 'Función de foto no disponible en este momento.',
                      })
                    }
                  >
                    <Camera className="w-4 h-4 mr-1.5" />
                    Adjuntar Foto
                  </Button>
                  <span className="text-xs text-slate-500">Opcional</span>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submittingReport ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Reporte
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── My Recent Alerts ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Mis Alertas Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAlerts ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : recentAlerts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No hay alertas registradas
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-700/40 border border-slate-700/50"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-medium text-white truncate">
                          {tipoLabel(alert.tipo)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {timeAgo(alert.createdAt)}
                        </span>
                      </div>
                      {estadoBadge(alert.estado)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
