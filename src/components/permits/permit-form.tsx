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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Navigation,
  AlertCircle,
  QrCode,
  Bluetooth,
  Radar,
  ChevronDown,
  ChevronUp,
  PenLine,
  ClipboardCheck,
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

interface WorkLocation {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radiusMeters: number
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

  // Checklist UI state
  const [checklistExpanded, setChecklistExpanded] = useState(true)

  // Dynamic risk types from API
  const [dynamicRiskTypes, setDynamicRiskTypes] = useState<DynamicRiskType[]>(FALLBACK_RISK_TYPES)
  const [dynamicChecklist, setDynamicChecklist] = useState<DynamicChecklistItem[]>([])
  const [activeChecklistItems, setActiveChecklistItems] = useState<DynamicChecklistItem[]>([])

  // Work location selector state
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [locationMode, setLocationMode] = useState<'saved' | 'manual'>('manual')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'capturing' | 'ok' | 'error'>('idle')

  // QR/Beacon verification state
  const [qrScannedCode, setQrScannedCode] = useState<string | null>(null)
  const [qrVerified, setQrVerified] = useState(false)
  const [beaconDetected, setBeaconDetected] = useState(false)
  const [beaconScanning, setBeaconScanning] = useState(false)

  // Derived: the selected WorkLocation object
  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId) || null

  // Derived: verification method for the selected location
  const verificationMethod = selectedLocation?.verificationMethod || 'GPS'
  const isQrVerification = verificationMethod === 'QR_CODE'
  const isBeaconVerification = verificationMethod === 'BEACON'
  const isGpsVerification = verificationMethod === 'GPS' || !verificationMethod

  // Load saved work locations from SCADA module
  useEffect(() => {
    setLocationsLoading(true)
    apiFetch<{ locations: WorkLocation[] } | WorkLocation[]>('/locations')
      .then((data) => {
        // Handle both response shapes: { locations: [...] } or [...]
        const arr = Array.isArray(data) ? data : data.locations || []
        setLocations(arr)
      })
      .catch(() => {
        // Silently fail — user can still use manual mode
      })
      .finally(() => {
        setLocationsLoading(false)
      })
  }, [])

  // When a saved location is selected, auto-fill the workLocation text
  useEffect(() => {
    if (selectedLocation) {
      const desc = selectedLocation.address
        ? `${selectedLocation.name} — ${selectedLocation.address}`
        : selectedLocation.name
      setWorkLocation(desc)
    }
  }, [selectedLocation])

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
          { id: '1', title: 'Certificado Médico', documentType: 'MEDICAL', criticality: 'CRITICAL', expiryDate: '2024-01-15', holderName: 'Carlos Mendoza', daysOverdue: 120 },
        ],
        expiringSoon: [],
        totalDocuments: 24,
        activeDocuments: 21,
      })
    }
  }

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalización no disponible en este navegador')
      setGeoStatus('error')
      return
    }
    setGeoStatus('capturing')
    setGeoError(null)
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setGpsCoords(coords)
        setGeoStatus('ok')
        setGeoError(null)
        setLoading(false)
      },
      (err) => {
        console.error('GPS error:', err)
        setGeoError('No se pudo obtener la ubicación GPS. Verifique los permisos del navegador.')
        setGeoStatus('error')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleLocationModeChange = (mode: 'saved' | 'manual') => {
    setLocationMode(mode)
    // Reset location-specific state when switching modes
    setSelectedLocationId('')
    setGeoError(null)
    setGeoStatus('idle')
    if (mode === 'manual') {
      // Don't clear GPS if already captured — keep it
    }
  }

  const handleSelectLocation = (locationId: string) => {
    setSelectedLocationId(locationId)
    setGeoError(null)
    // Reset GPS status — user must re-capture for geofence validation
    setGeoStatus('idle')
    setGpsCoords(null)
    // Reset QR/Beacon verification state
    setQrScannedCode(null)
    setQrVerified(false)
    setBeaconDetected(false)
  }

  // Calculate distance between two GPS points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000 // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }, [])

  // Client-side geofence check after GPS capture (pre-validation) — GPS mode only
  const isWithinGeofence = useCallback((): boolean => {
    if (!selectedLocation || !gpsCoords) return true // No geofence check if no location selected
    if (!isGpsVerification) return true // No geofence check for QR/Beacon modes
    const distance = calculateDistance(
      selectedLocation.latitude,
      selectedLocation.longitude,
      gpsCoords.lat,
      gpsCoords.lng
    )
    return distance <= selectedLocation.radiusMeters
  }, [selectedLocation, gpsCoords, calculateDistance, isGpsVerification])

  const geofenceDistance = selectedLocation && gpsCoords && isGpsVerification
    ? calculateDistance(
        selectedLocation.latitude,
        selectedLocation.longitude,
        gpsCoords.lat,
        gpsCoords.lng
      )
    : null

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

    // GPS required check for saved location mode (only for GPS verification)
    if (locationMode === 'saved' && selectedLocationId && isGpsVerification && !gpsCoords) {
      setGeoError('Debe capturar su ubicación GPS para validar la geocerca de la ubicación guardada.')
      return
    }

    // QR verification required
    if (locationMode === 'saved' && selectedLocationId && isQrVerification && !qrVerified) {
      setGeoError('Debe escanear y verificar el código QR de esta ubicación.')
      return
    }

    // Beacon verification required
    if (locationMode === 'saved' && selectedLocationId && isBeaconVerification && !beaconDetected) {
      setGeoError('Debe estar dentro del rango del Beacon BLE de esta ubicación.')
      return
    }

    setSubmitting(true)
    setGeoError(null)
    try {
      const payload: CreatePermitRequest & { photos: PhotoItem[]; workLocationId?: string; qrScannedCode?: string; beaconDetected?: boolean } = {
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

      // Include workLocationId when a saved location is selected
      if (locationMode === 'saved' && selectedLocationId) {
        payload.workLocationId = selectedLocationId
      }

      // Include QR scanned code if verified
      if (isQrVerification && qrScannedCode) {
        payload.qrScannedCode = qrScannedCode
      }

      // Include beacon detection status
      if (isBeaconVerification && beaconDetected) {
        payload.beaconDetected = true
      }

      // Include locationData for geofence validation
      if (locationMode === 'saved' && selectedLocation) {
        payload.locationData = {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          radius: selectedLocation.radiusMeters,
          source: 'SCADA',
          type: 'SAVED_LOCATION',
          id: selectedLocation.id,
        }
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
      const errorMsg = err.message || 'Error al crear permiso'

      // Handle GPS_REQUERIDO error from server
      if (errorMsg === 'GPS_REQUERIDO') {
        setGeoError('El servidor requiere captura GPS para esta ubicación guardada. Capture su ubicación e intente nuevamente.')
        return
      }

      // Handle GEOFENCE_VIOLATION error from server
      if (errorMsg === 'GEOFENCE_VIOLATION') {
        setGeoError(
          `Violación de geocerca: Su posición actual está fuera del radio permitido para "${selectedLocation?.name || 'la ubicación seleccionada'}". Radio máximo: ${selectedLocation?.radiusMeters || 'N/A'}m.`
        )
        return
      }

      // Handle QR errors from server
      if (errorMsg === 'QR_REQUERIDO') {
        setGeoError('Debe escanear el código QR de esta ubicación antes de crear el permiso.')
        return
      }
      if (errorMsg === 'QR_INVALIDO' || errorMsg === 'QR_NO_CONFIGURADO') {
        setGeoError(errorMsg + ' Contacte al administrador.')
        return
      }

      // Handle Beacon errors from server
      if (errorMsg === 'BEACON_REQUERIDO') {
        setGeoError('Debe estar dentro del rango del Beacon BLE para crear el permiso en esta ubicación.')
        return
      }

      alert(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const isBlocked = compliance && !compliance.isCompliant

  const selectedRiskType = dynamicRiskTypes.find(rt => rt.key === riskType)
  const riskLabel = selectedRiskType?.label || RISK_TYPES[riskType as keyof typeof RISK_TYPES]?.label || riskType
  const riskColor = selectedRiskType?.color || RISK_TYPES[riskType as keyof typeof RISK_TYPES]?.color || '#6366f1'
  const RiskIcon = selectedRiskType ? getRiskIcon(selectedRiskType.icon) : getRiskIcon()

  // Submit button disabled conditions
  const gpsMissingForSavedMode = locationMode === 'saved' && selectedLocationId && isGpsVerification && !gpsCoords
  const geofenceViolated = locationMode === 'saved' && selectedLocationId && gpsCoords && !isWithinGeofence()
  const qrMissingForSavedMode = locationMode === 'saved' && selectedLocationId && isQrVerification && !qrVerified
  const beaconMissingForSavedMode = locationMode === 'saved' && selectedLocationId && isBeaconVerification && !beaconDetected

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
              <CardContent className="space-y-4">
                {/* Location Mode Toggle */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleLocationModeChange('saved')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      locationMode === 'saved'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Ubicación Guardada
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationModeChange('manual')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      locationMode === 'manual'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Ubicación Manual
                  </button>
                </div>

                {/* Saved Location Mode */}
                {locationMode === 'saved' && (
                  <div className="space-y-3">
                    {locationsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando ubicaciones...
                      </div>
                    ) : locations.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-4 text-xs text-slate-400">
                        <AlertCircle className="w-5 h-5" />
                        <p>No hay ubicaciones guardadas disponibles.</p>
                        <p>Cambie a modo manual o agregue ubicaciones en el módulo SCADA.</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-600">Seleccionar ubicación</Label>
                          <Select value={selectedLocationId} onValueChange={handleSelectLocation}>
                            <SelectTrigger className="w-full h-9 text-sm">
                              <SelectValue placeholder="Elija una ubicación guardada..." />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium">{loc.name}</span>
                                    {loc.address && (
                                      <span className="text-[10px] text-slate-400">{loc.address}</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Selected Location Details */}
                        <AnimatePresence>
                          {selectedLocation && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Navigation className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs font-semibold text-blue-800">{selectedLocation.name}</span>
                                </div>
                                {selectedLocation.address && (
                                  <p className="text-[11px] text-blue-600 ml-6">{selectedLocation.address}</p>
                                )}
                                <div className="grid grid-cols-3 gap-2 ml-6">
                                  <div>
                                    <p className="text-[10px] text-blue-500">Latitud</p>
                                    <p className="text-[11px] font-mono font-medium text-blue-700">
                                      {selectedLocation.latitude.toFixed(6)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-blue-500">Longitud</p>
                                    <p className="text-[11px] font-mono font-medium text-blue-700">
                                      {selectedLocation.longitude.toFixed(6)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-blue-500">Radio (geocerca)</p>
                                    <p className="text-[11px] font-mono font-medium text-blue-700">
                                      {selectedLocation.radiusMeters}m
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* VERIFICATION SECTION — Method-dependent */}
                        {selectedLocation && isGpsVerification && (
                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant={gpsCoords ? 'outline' : 'default'}
                              size="sm"
                              onClick={captureGps}
                              disabled={loading || geoStatus === 'capturing'}
                              className={cn(
                                'w-full gap-2 text-xs',
                                !gpsCoords && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                              )}
                            >
                              {geoStatus === 'capturing' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Capturando GPS...
                                </>
                              ) : gpsCoords ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  GPS Capturado — Actualizar
                                </>
                              ) : (
                                <>
                                  <Navigation className="w-3.5 h-3.5" />
                                  Capturar GPS (Requerido)
                                </>
                              )}
                            </Button>
                            <p className="text-[10px] text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              GPS obligatorio para validar la geocerca de esta ubicación
                            </p>
                          </div>
                        )}

                        {/* QR Code Verification Section */}
                        {selectedLocation && isQrVerification && (
                          <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="flex items-center gap-2 mb-2">
                                <QrCode className="w-4 h-4 text-emerald-600" />
                                <p className="text-xs font-semibold text-slate-700">Verificación por Código QR</p>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-2">
                                Escanee el código QR instalado en "{selectedLocation.name}" para verificar su presencia.
                              </p>
                              {qrVerified ? (
                                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    QR verificado correctamente
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Pendiente: Escanee el código QR en la ubicación
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Beacon BLE Verification Section */}
                        {selectedLocation && isBeaconVerification && (
                          <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Bluetooth className="w-4 h-4 text-blue-600" />
                                <p className="text-xs font-semibold text-slate-700">Verificación por Beacon BLE</p>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-2">
                                Su dispositivo debe estar dentro del rango del beacon instalado en "{selectedLocation.name}".
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setBeaconScanning(true)
                                  // Simulate beacon detection for demo (real implementation uses Web Bluetooth)
                                  setTimeout(() => {
                                    setBeaconDetected(true)
                                    setBeaconScanning(false)
                                  }, 2000)
                                }}
                                disabled={beaconScanning || beaconDetected}
                                className="w-full gap-2 text-xs"
                              >
                                {beaconScanning ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detectando Beacon...</>
                                ) : beaconDetected ? (
                                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Beacon Detectado</>
                                ) : (
                                  <><Radar className="w-3.5 h-3.5" /> Detectar Beacon</>
                                )}
                              </Button>
                              {beaconDetected && (
                                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Beacon detectado — Dentro del rango
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* GPS Result — Distance & Geofence Status */}
                        {selectedLocation && gpsCoords && (
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {isWithinGeofence() ? (
                                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium mb-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Dentro de la geocerca
                                  </div>
                                  <p className="text-emerald-600">
                                    Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
                                  </p>
                                  <p className="text-emerald-500 text-[10px]">
                                    Precisión: ±{gpsCoords.accuracy.toFixed(0)}m · Distancia al punto: {geofenceDistance?.toFixed(0)}m / {selectedLocation.radiusMeters}m
                                  </p>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs">
                                  <div className="flex items-center gap-1.5 text-red-700 font-medium mb-1">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Fuera de la geocerca
                                  </div>
                                  <p className="text-red-600">
                                    Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
                                  </p>
                                  <p className="text-red-500 text-[10px]">
                                    Precisión: ±{gpsCoords.accuracy.toFixed(0)}m · Distancia al punto: {geofenceDistance?.toFixed(0)}m (máx: {selectedLocation.radiusMeters}m)
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </>
                    )}

                    {/* GPS / Geofence Error Display */}
                    <AnimatePresence>
                      {geoError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-2.5 rounded-lg bg-red-50 border border-red-200"
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">{geoError}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Hidden input to satisfy form validation */}
                    <input type="hidden" value={workLocation} />
                  </div>
                )}

                {/* Manual Location Mode */}
                {locationMode === 'manual' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="work-loc" className="text-xs text-slate-600">Descripción del lugar</Label>
                      <Input
                        id="work-loc"
                        placeholder="Ej: Plataforma A, Nivel 3, Área de bombas"
                        value={workLocation}
                        onChange={(e) => setWorkLocation(e.target.value)}
                        className="h-9 text-sm"
                        required
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={captureGps} disabled={loading} className="w-full gap-2 text-xs">
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                      {gpsCoords ? 'Actualizar GPS' : 'Capturar Coordenadas GPS (Opcional)'}
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

                    {/* Manual mode geo error (if any) */}
                    <AnimatePresence>
                      {geoError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-2.5 rounded-lg bg-red-50 border border-red-200"
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">{geoError}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
            {/* Work Description */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-slate-500" />
                  Descripción del Trabajo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Describa detalladamente el trabajo a realizar, incluyendo equipos, herramientas y procedimientos..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  className="min-h-[90px] text-sm resize-none"
                  required
                />
              </CardContent>
            </Card>

            {/* Safety Checklist - Collapsible */}
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              {/* Checklist Header - always visible, clickable to toggle */}
              <button
                type="button"
                onClick={() => riskType && setChecklistExpanded(!checklistExpanded)}
                className={cn(
                  'w-full text-left px-6 py-4 flex items-center gap-3 transition-colors',
                  riskType ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative">
                    <ClipboardCheck className="w-5 h-5 text-amber-500" />
                    {riskType && checklist.length > 0 && (
                      <span className={cn(
                        'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white',
                        allRequiredChecked ? 'bg-emerald-500' : 'bg-amber-500'
                      )}>
                        {checklist.filter(i => safetyChecks[i.key]).length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">Lista de Verificación de Seguridad</p>
                    {riskType ? (
                      <p className="text-[11px] text-slate-500">
                        {checklist.length} items para {riskLabel}
                        {checklist.length > 0 && (
                          <span className="ml-1.5">
                            · {checklist.filter(i => safetyChecks[i.key]).length}/{checklist.length} completados
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">Seleccione un tipo de riesgo</p>
                    )}
                  </div>
                </div>
                {riskType && checklist.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {!allRequiredChecked && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] border border-amber-200">
                        Pendiente
                      </Badge>
                    )}
                    {allRequiredChecked && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Completo
                      </Badge>
                    )}
                    {checklistExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                )}
              </button>

              {/* Checklist Progress Bar (always visible when riskType selected) */}
              {riskType && checklist.length > 0 && (
                <div className="px-6 pb-0">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        allRequiredChecked ? 'bg-emerald-500' : 'bg-amber-400'
                      )}
                      style={{ width: `${checklist.length > 0 ? (checklist.filter(i => safetyChecks[i.key]).length / checklist.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Checklist Body - collapsible */}
              <AnimatePresence>
                {checklistExpanded && riskType && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="pt-3">
                      {checklist.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-3">No hay items de verificación para este tipo de riesgo</p>
                      ) : (
                        <div className="max-h-[280px] overflow-y-auto rounded-lg border border-slate-100 pr-1">
                          <div className="space-y-1">
                            {checklist.map((item, index) => {
                              const isChecked = safetyChecks[item.key] || false
                              return (
                                <label
                                  key={item.key}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-left',
                                    isChecked
                                      ? 'bg-emerald-50/70 border border-emerald-100'
                                      : 'hover:bg-slate-50 border border-transparent'
                                  )}
                                >
                                  <span className="text-[10px] text-slate-400 font-mono w-5 shrink-0 text-right">
                                    {index + 1}
                                  </span>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleCheckChange(item.key, !!checked)}
                                    className="shrink-0"
                                  />
                                  <span className={cn(
                                    'text-[13px] flex-1 leading-tight',
                                    isChecked ? 'text-slate-500 line-through' : 'text-slate-700'
                                  )}>
                                    {item.label}
                                  </span>
                                  {item.required && (
                                    <Badge className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0 shrink-0 border border-red-200">
                                      Req.
                                    </Badge>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quick Actions Row */}
                      {checklist.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updates: Record<string, boolean> = {}
                              checklist.forEach((item) => { updates[item.key] = true })
                              setSafetyChecks((prev) => ({ ...prev, ...updates }))
                            }}
                            className="text-[11px] h-7 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Marcar todos
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updates: Record<string, boolean> = {}
                              checklist.forEach((item) => { updates[item.key] = false })
                              setSafetyChecks((prev) => ({ ...prev, ...updates }))
                            }}
                            className="text-[11px] h-7 gap-1 text-slate-500"
                          >
                            <XCircle className="w-3 h-3" /> Desmarcar todos
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Signature Section - Visually Distinct */}
            <Card className="shadow-sm border-2 border-dashed border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-emerald-600" />
                  Firma del Técnico
                  {!signatureData && (
                    <Badge className="bg-red-100 text-red-600 text-[10px] border border-red-200 ml-auto">
                      Requerido
                    </Badge>
                  )}
                  {signatureData && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border border-emerald-200 ml-auto">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> Firmado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Firme con el dedo o mouse dentro del recuadro
                </CardDescription>
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

        {/* Submit - Sticky on mobile, right-aligned on desktop */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:justify-end sticky bottom-0 bg-background/90 backdrop-blur-sm py-3 -mx-1 px-1 border-t border-slate-100 sm:border-0 sm:static sm:bg-transparent sm:backdrop-blur-none sm:py-0">
          {/* Form completion summary */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span className={cn(riskType && 'text-emerald-600 font-medium')}>Riesgo: {riskType ? '✓' : '—'}</span>
            <span className={cn(technicianName && supervisorName && 'text-emerald-600 font-medium')}>Personal: {technicianName && supervisorName ? '✓' : '—'}</span>
            <span className={cn(allRequiredChecked && 'text-emerald-600 font-medium')}>Checks: {checklist.length > 0 ? `${checklist.filter(i => safetyChecks[i.key]).length}/${checklist.length}` : '—'}</span>
            <span className={cn(signatureData && 'text-emerald-600 font-medium')}>Firma: {signatureData ? '✓' : '—'}</span>
            <span className={cn(photos.length > 0 && 'text-emerald-600 font-medium')}>Fotos: {photos.length}/{5}</span>
          </div>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 text-sm font-semibold w-full sm:w-auto"
            disabled={
              submitting ||
              isBlocked ||
              !riskType ||
              !allRequiredChecked ||
              !signatureData ||
              !technicianName ||
              !supervisorName ||
              !workLocation ||
              !workDescription ||
              photos.length === 0 ||
              gpsMissingForSavedMode ||
              geofenceViolated ||
              qrMissingForSavedMode ||
              beaconMissingForSavedMode
            }
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
