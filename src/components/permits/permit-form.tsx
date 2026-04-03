'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MapPin,
  Upload,
  Loader2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Flame,
  Zap,
  ArrowUp,
  Box,
  CheckCircle2,
  XCircle,
  FileDown,
  AlertCircle as AlertCircleIcon,
  Camera,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, type ComplianceCheck, type CreatePermitRequest } from '@/lib/api'
import { RISK_TYPES, getChecklistForRiskType } from '@/lib/plans'
import SignaturePad from '@/components/signature/signature-pad'
import PhotoEvidence, { type PhotoItem } from '@/components/photo/photo-evidence'

// Dynamic risk type from API
interface DynamicRiskType {
  id: string
  key: string
  label: string
  color: string
  icon?: string
  description?: string
}

interface DynamicChecklistItem {
  id: string
  riskTypeKey: string
  itemKey: string
  label: string
  required: boolean
  sortOrder: number
}

const FALLBACK_RISK_TYPES: DynamicRiskType[] = [
  { id: '', key: 'ALTURA', label: 'Trabajo en Altura', color: '#ef4444' },
  { id: '', key: 'ELECTRICO', label: 'Riesgo Eléctrico', color: '#f59e0b' },
  { id: '', key: 'CONFINADO', label: 'Espacio Confinado', color: '#8b5cf6' },
  { id: '', key: 'CALIENTE', label: 'Trabajo en Caliente', color: '#dc2626' },
]

const riskIconMap: Record<string, React.ComponentType<any>> = {
  ArrowUp, Zap, Box, Flame, AlertTriangle, Shield, Settings,
}

function getRiskIcon(iconName?: string): React.ComponentType<any> {
  return riskIconMap[iconName || ''] || AlertTriangle
}

interface PermitFormProps {
  onPermitCreated?: () => void
}

export default function PermitForm({ onPermitCreated }: PermitFormProps) {
  const [riskType, setRiskType] = useState<string>('')
  const [safetyChecks, setSafetyChecks] = useState<Record<string, boolean>>({})
  const [technicianName, setTechnicianName] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [workLocation, setWorkLocation] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [compliance, setCompliance] = useState<ComplianceCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signatureGps, setSignatureGps] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  // Dynamic risk types from API
  const [dynamicRiskTypes, setDynamicRiskTypes] = useState<DynamicRiskType[]>(FALLBACK_RISK_TYPES)
  const [dynamicChecklist, setDynamicChecklist] = useState<DynamicChecklistItem[]>([])
  const [activeChecklistItems, setActiveChecklistItems] = useState<DynamicChecklistItem[]>([])

  // Load dynamic risk types from API
  useEffect(() => {
    apiFetch<{ riskTypes: DynamicRiskType[]; checklistItems: DynamicChecklistItem[] }>('/risk-types?withChecklist=true')
      .then((data) => {
        if (data.riskTypes && data.riskTypes.length > 0) {
          setDynamicRiskTypes(data.riskTypes)
          setDynamicChecklist(data.checklistItems || [])
        }
      })
      .catch(() => {
        // Fallback to defaults from plans.ts
      })
  }, [])

  // When risk type changes, filter checklist
  useEffect(() => {
    const items = dynamicChecklist.filter(item => item.riskTypeKey === riskType)
    setActiveChecklistItems(items)
    const newChecks: Record<string, boolean> = {}
    items.forEach((item) => {
      newChecks[item.itemKey] = safetyChecks[item.itemKey] || false
    })
    setSafetyChecks(newChecks)
  }, [riskType, dynamicChecklist])

  const checklist = activeChecklistItems.length > 0
    ? activeChecklistItems.map(item => ({ key: item.itemKey, label: item.label, required: item.required }))
    : (riskType ? getChecklistForRiskType(riskType) : [])

  useEffect(() => {
    checkCompliance()
  }, [])

  const checkCompliance = async () => {
    try {
      const data = await apiFetch<ComplianceCheck>('/compliance/check')
      setCompliance(data)
    } catch {
      setCompliance({
        isCompliant: false,
        expiredCritical: [
          { id: '1', title: 'Certificado Médico', expiryDate: '2024-01-15', daysOverdue: 120, criticality: 'CRITICAL', holderName: 'Carlos Mendoza' },
        ],
        expiringSoon: [],
        totalDocuments: 24,
        activeDocuments: 21,
      })
    }
  }

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocalización no disponible en este navegador')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setLoading(false)
      },
      (err) => {
        console.error('GPS error:', err)
        alert('No se pudo obtener la ubicación GPS')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleCheckChange = (key: string, checked: boolean) => {
    setSafetyChecks((prev) => ({ ...prev, [key]: checked }))
  }

  const allRequiredChecked = checklist.every(
    (item) => !item.required || safetyChecks[item.key]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!riskType || !technicianName || !supervisorName || !workLocation || !workDescription) return
    if (!signatureData) {
      alert('Debe firmar el permiso antes de enviarlo')
      return
    }
    if (photos.length === 0) {
      alert('Debe adjuntar al menos 1 foto como evidencia')
      return
    }

    setSubmitting(true)
    try {
      const payload: CreatePermitRequest & { photos: PhotoItem[] } = {
        riskType,
        safetyChecks,
        technicianName,
        supervisorName,
        workLocation,
        workDescription,
        technicianSignature: signatureData,
        technicianSignatureGps: signatureGps || undefined,
        workLatitude: gpsCoords?.lat,
        workLongitude: gpsCoords?.lng,
        photos,
      }

      const data = await apiFetch<{ pdf: string; permitNumber: string }>('/permits', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      if (data.pdf) {
        setPdfData(data.pdf)
        setShowPdf(true)
      }

      onPermitCreated?.()
    } catch (err: any) {
      alert(err.message || 'Error al crear permiso')
    } finally {
      setSubmitting(false)
    }
  }

  const isBlocked = compliance && !compliance.isCompliant

  const selectedRiskType = dynamicRiskTypes.find(rt => rt.key === riskType)
  const riskLabel = selectedRiskType?.label || RISK_TYPES[riskType as keyof typeof RISK_TYPES]?.label || riskType
  const riskColor = selectedRiskType?.color || RISK_TYPES[riskType as keyof typeof RISK_TYPES]?.color || '#6366f1'
  const RiskIcon = selectedRiskType ? getRiskIcon(selectedRiskType.icon) : getRiskIcon()

  return (
    <div className="space-y-6">
      {/* Compliance Gate */}
      <AnimatePresence>
        {isBlocked && compliance && (
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
                  Tiene {compliance.expiredCritical.length} documento(s) crítico(s) vencido(s). No puede crear permisos hasta que se renueven.
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

      {compliance && compliance.isCompliant && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Cumplimiento HSE: OK — Puede crear permisos</span>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Risk Type Selector - Now dynamic */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Tipo de Riesgo
                  <Badge className="bg-violet-100 text-violet-700 text-[10px] ml-auto">Configurable</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {dynamicRiskTypes.map((rt) => {
                    const Icon = getRiskIcon(rt.icon)
                    const isSelected = riskType === rt.key
                    return (
                      <button
                        key={rt.key}
                        type="button"
                        onClick={() => setRiskType(rt.key)}
                        className={cn(
                          'flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all',
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        )}
                      >
                        <div className="p-1.5 rounded-md" style={{ backgroundColor: rt.color + '15' }}>
                          <Icon className="w-4 h-4" style={{ color: rt.color }} />
                        </div>
                        <span className={cn('text-xs font-medium', isSelected ? 'text-emerald-700' : 'text-slate-600')}>
                          {rt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Personal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tech-name" className="text-xs text-slate-600">Técnico</Label>
                  <Input id="tech-name" placeholder="Nombre del técnico" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="h-9 text-sm" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-name" className="text-xs text-slate-600">Supervisor</Label>
                  <Input id="sup-name" placeholder="Nombre del supervisor" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="h-9 text-sm" required />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Ubicación de Trabajo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="work-loc" className="text-xs text-slate-600">Descripción del lugar</Label>
                  <Input id="work-loc" placeholder="Ej: Plataforma A, Nivel 3, Área de bombas" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} className="h-9 text-sm" required />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={captureGps} disabled={loading} className="w-full gap-2 text-xs">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  {gpsCoords ? 'Actualizar GPS' : 'Capturar Coordenadas GPS'}
                </Button>
                {gpsCoords && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      GPS Capturado
                    </div>
                    <p className="text-emerald-600">Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}</p>
                    <p className="text-emerald-500 text-[10px]">Precisión: ±{gpsCoords.accuracy.toFixed(0)}m</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Evidence */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-rose-500" />
                  Evidencia Fotográfica
                </CardTitle>
                <CardDescription className="text-xs">Tome fotos del área de trabajo como evidencia obligatoria</CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoEvidence
                  photos={photos}
                  onPhotosChange={setPhotos}
                  maxPhotos={5}
                  required={true}
                  disabled={isBlocked}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Descripción del Trabajo</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Describa detalladamente el trabajo a realizar, incluyendo equipos, herramientas y procedimientos..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                  required
                />
              </CardContent>
            </Card>

            {/* Safety Checklist - Dynamic from API */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Lista de Verificación de Seguridad
                </CardTitle>
                <CardDescription className="text-xs">
                  {riskType ? `${checklist.length} items para ${riskLabel}` : 'Seleccione un tipo de riesgo'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!riskType ? (
                  <p className="text-sm text-slate-400 text-center py-4">Seleccione un tipo de riesgo para ver la lista de verificación</p>
                ) : (
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2 pr-2">
                      {checklist.map((item) => (
                        <label key={item.key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          <Checkbox checked={safetyChecks[item.key] || false} onCheckedChange={(checked) => handleCheckChange(item.key, !!checked)} className="mt-0.5" />
                          <div className="flex-1">
                            <span className="text-sm text-slate-700">{item.label}</span>
                            {item.required && <Badge className="ml-2 bg-red-100 text-red-600 text-[10px] px-1.5 py-0">Requerido</Badge>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Signature */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Firma del Técnico</CardTitle>
              </CardHeader>
              <CardContent>
                <SignaturePad
                  onSign={(data, gps) => { setSignatureData(data); setSignatureGps(gps) }}
                  disabled={isBlocked}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            disabled={submitting || isBlocked || !riskType || !allRequiredChecked || !signatureData || !technicianName || !supervisorName || !workLocation || !workDescription || photos.length === 0}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando Permiso...</>
            ) : (
              <><Upload className="w-4 h-4" /> Crear Permiso de Trabajo</>
            )}
          </Button>
        </div>
      </form>

      {/* PDF Dialog */}
      <Dialog open={showPdf} onOpenChange={setShowPdf}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Permiso Creado Exitosamente</DialogTitle>
            <DialogDescription className="sr-only">
              El permiso de trabajo ha sido creado y se muestra el documento PDF generado para descarga.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">El permiso ha sido creado y está pendiente de aprobación</span>
            </div>
            {pdfData && (
              <div className="border rounded-lg overflow-hidden">
                <iframe src={`data:application/pdf;base64,${pdfData}`} className="w-full h-[500px]" title="Permiso de Trabajo PDF" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPdf(false)}>Cerrar</Button>
              {pdfData && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => {
                  const link = document.createElement('a')
                  link.href = `data:application/pdf;base64,${pdfData}`
                  link.download = 'permiso-trabajo.pdf'
                  link.click()
                }}>
                  <FileDown className="w-4 h-4" /> Descargar PDF
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
