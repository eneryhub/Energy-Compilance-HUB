'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Shield,
  ShieldCheck,
  Loader2,
  Calendar,
  User,
  FileText,
  Sparkles,
  Brain,
  Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, downloadPdfFromBase64, type ComplianceCheck, type Permit } from '@/lib/api'
import { RISK_TYPES } from '@/lib/plans'
import { calculateDistance } from '@/lib/gps'
import SignaturePad from '@/components/signature/signature-pad'

export default function ApprovalPanel() {
  const [pendingPermits, setPendingPermits] = useState<Permit[]>([])
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null)
  const [compliance, setCompliance] = useState<ComplianceCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signatureGps, setSignatureGps] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const [aiReview, setAiReview] = useState<any>(null)
  const [aiReviewing, setAiReviewing] = useState(false)
  const [showAiReview, setShowAiReview] = useState(false)
  const [scadaSafety, setScadaSafety] = useState<{
    isSafe: boolean
    criticalSensors: Array<{ id: string; name: string; type: string; value: number; unit: string; threshold: number }>
  } | null>(null)
  const [approveJustification, setApproveJustification] = useState('')
  const [showApproveJustifyDialog, setShowApproveJustifyDialog] = useState(false)
  const [geofenceStatus, setGeofenceStatus] = useState<{ isOutside: boolean; distance: number; radius: number } | null>(null)

  useEffect(() => {
    loadData()
    // Check SCADA safety every 5 seconds
    const scadaInterval = setInterval(checkScadaSafety, 5000)
    return () => clearInterval(scadaInterval)
  }, [])

  const checkScadaSafety = async () => {
    try {
      const data = await apiFetch<{ isSafe: boolean; criticalSensors: any[] }>('/sensors/site-safe')
      setScadaSafety(data)
    } catch {
      // If SCADA check fails, allow operations (don't block on error)
      setScadaSafety({ isSafe: true, criticalSensors: [] })
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [permitsData, complianceData] = await Promise.all([
        apiFetch<Permit[]>('/permits?status=PENDING'),
        apiFetch<ComplianceCheck>('/compliance/check'),
      ])
      setPendingPermits(permitsData)
      setCompliance(complianceData)
      checkScadaSafety()
    } catch {
      setPendingPermits([
        {
          id: '1', permitNumber: 'PT-2024-0048', riskType: 'ALTURA', status: 'PENDING',
          safetyChecks: '{"has_harness":true,"has_anchor_point":true,"has_first_aid_kit":true}',
          technicianName: 'Carlos Mendoza', supervisorName: 'Ana Rodríguez',
          workLocation: 'Plataforma A, Nivel 3', workDescription: 'Revisión y mantenimiento de estructura metálica en plataforma superior. Se requiere inspección visual y torqueo de pernos.',
          workLatitude: 10.0726, workLongitude: -84.3125,
          createdByName: 'Carlos Mendoza', createdAt: new Date().toISOString(),
        },
        {
          id: '2', permitNumber: 'PT-2024-0051', riskType: 'ELECTRICO', status: 'PENDING',
          safetyChecks: '{"has_dielectric_ppe":true,"voltage_test_performed":true}',
          technicianName: 'Pedro Gómez', supervisorName: 'Ana Rodríguez',
          workLocation: 'Subestación B, Tablero TB-204', workDescription: 'Reemplazo de interruptor termomagnético de 200A',
          createdByName: 'Pedro Gómez', createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3', permitNumber: 'PT-2024-0052', riskType: 'CALIENTE', status: 'PENDING',
          safetyChecks: '{"has_fire_extinguisher":true,"has_first_aid_kit":true}',
          technicianName: 'Miguel Sánchez', supervisorName: 'Ana Rodríguez',
          workLocation: 'Taller de soldadura A', workDescription: 'Fabricación de soporte para tubería de vapor de 4 pulgadas',
          createdByName: 'Miguel Sánchez', createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ])
      setCompliance({
        isCompliant: false,
        expiredCritical: [
          { id: '1', title: 'Certificado de Capacitación', expiryDate: '2024-01-20', daysOverdue: 95, criticality: 'CRITICAL', holderName: null },
        ],
        expiringSoon: [],
        totalDocuments: 24,
        activeDocuments: 21,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAiReview = async () => {
    if (!selectedPermit) return
    setAiReviewing(true)
    try {
      const checks = parseSafetyChecks(selectedPermit.safetyChecks)
      const data = await apiFetch<{ review: any }>('/ai/review-permit', {
        method: 'POST',
        body: JSON.stringify({
          riskType: selectedPermit.riskType,
          riskLabel: RISK_TYPES[selectedPermit.riskType as keyof typeof RISK_TYPES]?.label || selectedPermit.riskType,
          workDescription: selectedPermit.workDescription,
          workLocation: selectedPermit.workLocation,
          safetyChecks: checks,
          technicianName: selectedPermit.technicianName,
          supervisorName: selectedPermit.supervisorName,
          hasPhotos: (selectedPermit.photosCount || 0) > 0,
          photosCount: selectedPermit.photosCount || 0,
        }),
      })
      setAiReview(data.review)
      setShowAiReview(true)
    } catch (err: any) {
      alert(err.message || 'Error al obtener revisión IA')
    } finally {
      setAiReviewing(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedPermit || !signatureData) return

    // Check geofence before sending
    if (geofenceStatus?.isOutside) {
      setShowApproveJustifyDialog(true)
      return
    }

    await executeApprove('')
  }

  const handleApproveWithJustification = async () => {
    if (!selectedPermit || !signatureData || approveJustification.trim().length < 10) return
    await executeApprove(approveJustification.trim())
  }

  const executeApprove = async (justification: string) => {
    setApproving(true)
    try {
      const body: Record<string, unknown> = {
        action: 'approve',
        signature: signatureData,
        gpsLatitude: signatureGps?.latitude,
        gpsLongitude: signatureGps?.longitude,
        gpsAccuracy: signatureGps?.accuracy,
      }
      if (justification) {
        body.approveJustification = justification
      }
      if (geofenceStatus?.isOutside) {
        body.geofenceJustification = justification
      }
      const result = await apiFetch<{ pdf?: string }>(`/permits/${selectedPermit!.id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // Download PDF if returned
      if (result.pdf) {
        downloadPdfFromBase64(result.pdf, `Permiso_${selectedPermit!.permitNumber}_Aprobado.pdf`)
      }
      setSuccessMessage(`Permiso ${selectedPermit!.permitNumber} aprobado exitosamente`)
      setShowSuccessDialog(true)
      setSelectedPermit(null)
      setSignatureData(null)
      setSignatureGps(null)
      setGeofenceStatus(null)
      setApproveJustification('')
      setShowApproveJustifyDialog(false)
      loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al aprobar permiso'
      alert(message)
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPermit || !rejectReason.trim()) return
    setRejecting(true)
    try {
      const body: Record<string, unknown> = {
        reason: rejectReason.trim(),
        gpsLatitude: signatureGps?.latitude,
        gpsLongitude: signatureGps?.longitude,
        gpsAccuracy: signatureGps?.accuracy,
      }
      if (geofenceStatus?.isOutside) {
        body.rejectGeofenceJustification = rejectReason.trim()
      }
      const result = await apiFetch<{ pdf?: string }>(`/permits/${selectedPermit.id}/reject`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // Download PDF if returned
      if (result.pdf) {
        downloadPdfFromBase64(result.pdf, `Permiso_${selectedPermit.permitNumber}_Rechazado.pdf`)
      }
      setSuccessMessage(`Permiso ${selectedPermit.permitNumber} rechazado`)
      setShowSuccessDialog(true)
      setSelectedPermit(null)
      setRejectReason('')
      setShowRejectDialog(false)
      setSignatureData(null)
      setSignatureGps(null)
      setGeofenceStatus(null)
      loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al rechazar permiso'
      alert(message)
    } finally {
      setRejecting(false)
    }
  }

  const isBlocked = (compliance && !compliance.isCompliant) || (scadaSafety && !scadaSafety.isSafe)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const parseSafetyChecks = (jsonStr: string): Record<string, boolean> => {
    try {
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }

  return (
    <div className="space-y-6">
      {/* Compliance Gate */}
      <AnimatePresence>
        {compliance && !compliance.isCompliant && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border-2 border-red-300 bg-red-50 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-red-800">OPERACIONES BLOQUEADAS</h3>
                <p className="text-sm text-red-700 mt-1">
                  Tiene {compliance.expiredCritical.length} documento(s) crítico(s) vencido(s). No puede aprobar permisos.
                </p>
                <div className="mt-3 space-y-2">
                  {compliance.expiredCritical.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-100/50 text-sm">
                      <div>
                        <p className="font-medium text-red-800">{doc.title}</p>
                        {doc.holderName && <p className="text-xs text-red-600">Titular: {doc.holderName}</p>}
                      </div>
                      <Badge className="bg-red-600 text-white text-xs shrink-0">{doc.daysOverdue} días vencido</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCADA Security Gate */}
      <AnimatePresence>
        {scadaSafety && !scadaSafety.isSafe && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border-2 border-red-400 bg-gradient-to-r from-slate-900 to-slate-950 p-5 text-white"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/30">
                <Shield className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  BLOQUEADO: Alerta SCADA Detectada
                </h3>
                <p className="text-sm text-red-200 mt-1">
                  El sistema SCADA ha detectado sensores fuera de rango. Las firmas están bloqueadas por seguridad.
                </p>
                <div className="mt-3 space-y-2">
                  {scadaSafety.criticalSensors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="font-medium text-red-100">{s.name}</span>
                        <span className="text-red-300 text-xs">({s.type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-red-100">{s.value} {s.unit}</span>
                        <Badge className="bg-red-600 text-white text-[10px]">Límite: {s.threshold} {s.unit}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                  Verifique el panel SCADA → Telemetría para monitorear los sensores en tiempo real.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {compliance && compliance.isCompliant && (!scadaSafety || scadaSafety.isSafe) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Cumplimiento HSE + SCADA: OK — Puede aprobar permisos</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Permits List */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Permisos Pendientes
                <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-auto">
                  {pendingPermits.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                {loading ? (
                  <div className="p-6 text-center text-sm text-slate-400">Cargando...</div>
                ) : pendingPermits.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    No hay permisos pendientes
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingPermits.map((permit) => {
                      const riskConfig = RISK_TYPES[permit.riskType as keyof typeof RISK_TYPES]
                      const isSelected = selectedPermit?.id === permit.id
                      return (
                        <button
                          key={permit.id}
                          onClick={() => { setSelectedPermit(permit); setSignatureData(null); setGeofenceStatus(null) }}
                          className={cn(
                            'w-full text-left p-3 hover:bg-slate-50 transition-colors',
                            isSelected && 'bg-emerald-50 border-l-2 border-emerald-500'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono font-semibold text-slate-700">
                              {permit.permitNumber}
                            </span>
                            <Badge
                              className="text-[10px] border"
                              style={{
                                backgroundColor: (riskConfig?.color || '#666') + '15',
                                color: riskConfig?.color || '#666',
                              }}
                            >
                              {riskConfig?.label?.split(' ').pop() || permit.riskType}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">{permit.technicianName}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {permit.workLocation}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Permit Details */}
        <div className="lg:col-span-2">
          {!selectedPermit ? (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Seleccione un permiso para revisar y aprobar/rechazar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Permit Info */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {selectedPermit.permitNumber}
                    <Badge className={cn('text-[10px]', selectedPermit.riskType === 'ALTURA' ? 'bg-red-100 text-red-700' : selectedPermit.riskType === 'ELECTRICO' ? 'bg-amber-100 text-amber-700' : selectedPermit.riskType === 'CONFINADO' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700')}>
                      {RISK_TYPES[selectedPermit.riskType as keyof typeof RISK_TYPES]?.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> Técnico
                      </p>
                      <p className="text-sm font-medium text-slate-700">{selectedPermit.technicianName}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Fecha
                      </p>
                      <p className="text-sm text-slate-700">{formatDate(selectedPermit.createdAt)}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Ubicación
                    </p>
                    <p className="text-sm text-slate-700">{selectedPermit.workLocation}</p>
                    {selectedPermit.workLatitude && selectedPermit.workLongitude && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        GPS: {selectedPermit.workLatitude.toFixed(6)}, {selectedPermit.workLongitude.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Descripción del Trabajo</p>
                    <p className="text-sm text-slate-700">{selectedPermit.workDescription}</p>
                  </div>

                  {/* Safety Checks */}
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Lista de Verificación
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(parseSafetyChecks(selectedPermit.safetyChecks)).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                          {value ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className={value ? 'text-emerald-700' : 'text-red-600'}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Photo Evidence */}
                  {selectedPermit.photos && (() => {
                    try {
                      const photos = JSON.parse(selectedPermit.photos)
                      if (Array.isArray(photos) && photos.length > 0) {
                        return (
                          <div className="p-3 rounded-lg bg-slate-50">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                              <Camera className="w-3 h-3" /> Evidencia Fotográfica ({photos.length})
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                              {photos.map((photo: any, i: number) => (
                                <div
                                  key={photo.id || i}
                                  className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                                  onClick={() => window.open(photo.data, '_blank')}
                                >
                                  <img
                                    src={photo.data}
                                    alt={photo.filename || `Foto ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-1">
                                    <p className="text-[9px] text-white truncate">
                                      {new Date(photo.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                    } catch { /* ignore */ }
                    return null
                  })()}

                </CardContent>
              </Card>

              {/* AI Safety Review */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      Revisión IA de Seguridad
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAiReview}
                      disabled={!selectedPermit || aiReviewing}
                      className="gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
                    >
                      {aiReviewing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {aiReviewing ? 'Analizando...' : 'Analizar con IA'}
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    DeepSeek AI analiza el permiso para detectar riesgos y dar recomendaciones
                  </CardDescription>
                </CardHeader>
                {aiReview && (
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold" style={{
                          color: aiReview.overallScore >= 80 ? '#10b981' : aiReview.overallScore >= 60 ? '#f59e0b' : '#ef4444'
                        }}>
                          {aiReview.overallScore}
                        </p>
                        <p className="text-[10px] text-slate-500">Puntuación</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn(
                            'text-[10px] border',
                            aiReview.recommendation === 'APROBAR' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            aiReview.recommendation === 'RECHAZAR' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          )}>
                            {aiReview.recommendation}
                          </Badge>
                          <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                            Riesgo: {aiReview.riskLevel}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">{aiReview.summary}</p>
                      </div>
                    </div>
                    {aiReview.findings && aiReview.findings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase text-slate-400 font-semibold">Hallazgos</p>
                        {aiReview.findings.map((f: any, i: number) => (
                          <div key={i} className={cn(
                            'flex items-start gap-2 p-2 rounded-lg text-xs',
                            f.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                            f.severity === 'warning' ? 'bg-amber-50 border border-amber-200' :
                            'bg-blue-50 border border-blue-200'
                          )}>
                            <Badge className={cn(
                              'text-[9px] mt-0.5 shrink-0',
                              f.severity === 'critical' ? 'bg-red-600 text-white' :
                              f.severity === 'warning' ? 'bg-amber-500 text-white' :
                              'bg-blue-500 text-white'
                            )}>
                              {f.severity === 'critical' ? 'CRITICO' : f.severity === 'warning' ? 'ALERTA' : 'INFO'}
                            </Badge>
                            <div>
                              <p className="text-slate-700">{f.description}</p>
                              <p className="text-slate-500 mt-0.5">{f.suggestion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Signature & Actions */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Aprobación del Supervisor</CardTitle>
                  <CardDescription className="text-xs">Firme para aprobar o rechaze con un motivo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SignaturePad
                    onSign={(data, gps) => {
                      setSignatureData(data)
                      setSignatureGps(gps)
                      // Compute geofence status when GPS is captured
                      if (gps && selectedPermit?.workLatitude && selectedPermit?.workLongitude) {
                        const effectiveRadius = selectedPermit.workRadius || 100
                        const distance = calculateDistance(
                          { latitude: gps.latitude, longitude: gps.longitude },
                          { latitude: selectedPermit.workLatitude, longitude: selectedPermit.workLongitude }
                        )
                        const isOutside = distance > effectiveRadius
                        setGeofenceStatus({
                          isOutside,
                          distance: Math.round(distance),
                          radius: effectiveRadius,
                        })
                      } else {
                        setGeofenceStatus(null)
                      }
                    }}
                    disabled={isBlocked}
                    label="Firma del Supervisor"
                  />

                  {/* Geofence Warning Indicator */}
                  {geofenceStatus?.isOutside && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200"
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-[10px]">
                          Fuera de Geocerca
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-700">
                        Supervisor a <strong>{geofenceStatus.distance}m</strong> del área de trabajo
                        (radio: {geofenceStatus.radius}m). Se requerirá justificación al aprobar/rechazar.
                      </p>
                    </motion.div>
                  )}
                  {geofenceStatus && !geofenceStatus.isOutside && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs text-emerald-700">
                        Dentro de la geocerca ({geofenceStatus.distance}m del área de trabajo, radio: {geofenceStatus.radius}m)
                      </p>
                    </motion.div>
                  )}

                  <Separator />

                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={!signatureData || isBlocked || approving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {approving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={isBlocked}
                      className="flex-1 gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Rechazar Permiso
            </DialogTitle>
            <DialogDescription className="sr-only">
              Indique el motivo del rechazo del permiso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Indique el motivo del rechazo del permiso <strong>{selectedPermit?.permitNumber}</strong>:
            </p>
            <Textarea
              placeholder="Escriba el motivo del rechazo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejecting}
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Justification Dialog (Geofence Violation) */}
      <Dialog open={showApproveJustifyDialog} onOpenChange={(open) => {
        setShowApproveJustifyDialog(open)
        if (!open) setApproveJustification('')
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Aprobación Fuera de Geocerca
            </DialogTitle>
            <DialogDescription className="sr-only">
              Justificación requerida para aprobar fuera del área de trabajo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Supervisor fuera del área de trabajo</p>
              </div>
              <p className="text-xs text-amber-700">
                Se detectó que se encuentra a <strong>{geofenceStatus?.distance}m</strong> del área del permiso{' '}
                <strong>{selectedPermit?.permitNumber}</strong> (radio permitido: {geofenceStatus?.radius}m).{' '}
                Debe proporcionar una justificación para continuar.
              </p>
            </div>
            <Textarea
              placeholder="Explique por qué está aprobando fuera del área de trabajo (mínimo 10 caracteres)..."
              value={approveJustification}
              onChange={(e) => setApproveJustification(e.target.value)}
              className="min-h-[100px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowApproveJustifyDialog(false)
                setApproveJustification('')
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleApproveWithJustification}
                disabled={approveJustification.trim().length < 10 || approving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprobar con Justificación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">Operación completada</DialogTitle>
            <DialogDescription className="sr-only">Resultado de la operación sobre el permiso</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-700">{successMessage}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
