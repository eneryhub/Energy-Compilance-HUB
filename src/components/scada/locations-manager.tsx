// ====================== LocationsManager.tsx ======================
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Navigation,
  Building2,
  Wifi,
  QrCode,
  Crosshair,
  Search,
  AlertTriangle,
  CheckCircle2,
  Radar,
  Download,
  RefreshCw,
  Bluetooth,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────

interface Location {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  verificationMethod: string | null
  createdAt: string
  _count?: {
    sensors: number
    permits: number
  }
}

interface LocationForm {
  name: string
  address: string
  latitude: string
  longitude: string
  radiusMeters: string
  verificationMethod: string
  beaconUuid: string
  beaconMajor: string
  beaconMinor: string
  beaconRssi: string
}

const VERIFICATION_METHODS = [
  { value: 'GPS', label: 'GPS Automático', icon: Crosshair },
  { value: 'QR_CODE', label: 'Código QR', icon: QrCode },
  { value: 'BEACON', label: 'Beacon BLE', icon: Radar },
]

const emptyForm: LocationForm = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  radiusMeters: '100',
  verificationMethod: 'GPS',
  beaconUuid: '',
  beaconMajor: '1',
  beaconMinor: '1',
  beaconRssi: '-70',
}

// ── Component ──────────────────────────────────────────────

interface LocationsManagerProps {
  onLocationsChanged?: () => void
}

export default function LocationsManager({ onLocationsChanged }: LocationsManagerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<LocationForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [gettingGps, setGettingGps] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // QR Code state
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [qrGenerating, setQrGenerating] = useState(false)

  // ── QR Code generation ───────────────────────────────

  const handleGenerateQr = async (locationId: string) => {
    setQrGenerating(true)
    try {
      const data = await apiFetch<{ qrCodeDataUrl: string }>(`/locations/${locationId}/qr`)
      setQrImageUrl(data.qrCodeDataUrl)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar QR'
      setError(message)
    } finally {
      setQrGenerating(false)
    }
  }

  const handleDownloadQr = () => {
    if (!qrImageUrl) return
    const link = document.createElement('a')
    link.download = 'ech-qr-code.png'
    link.href = qrImageUrl
    link.click()
  }

  // ── Load locations ──────────────────────────────────

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ locations: Location[] }>('/locations')
      setLocations(data.locations || [])
    } catch {
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // ── GPS detection ──────────────────────────────────

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }
    setGettingGps(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((f) => ({
          ...f,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }))
        setGettingGps(false)
      },
      (err) => {
        setGettingGps(false)
        switch (err.code) {
          case 1:
            setError('Permiso de ubicación denegado. Actívalo en la configuración del navegador.')
            break
          case 2:
            setError('No se pudo determinar tu ubicación')
            break
          case 3:
            setError('Tiempo de espera agotado al obtener ubicación')
            break
          default:
            setError('Error al obtener ubicación')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // ── Create / Update ────────────────────────────────

  const handleSave = async () => {
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    const radius = parseInt(form.radiusMeters) || 100

    if (!form.name.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitud inválida (debe estar entre -90 y 90)')
      return
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setError('Longitud inválida (debe estar entre -180 y 180)')
      return
    }
    if (radius < 10 || radius > 10000) {
      setError('El radio debe estar entre 10 y 10000 metros')
      return
    }

    setError(null)
    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        verificationMethod: form.verificationMethod || null,
      }

      // Include Beacon fields if method is BEACON
      if (form.verificationMethod === 'BEACON') {
        body.beaconUuid = form.beaconUuid.trim()
        body.beaconMajor = parseInt(form.beaconMajor) || 0
        body.beaconMinor = parseInt(form.beaconMinor) || 0
        body.beaconRssi = parseInt(form.beaconRssi) || -70
      }

      if (editingId) {
        await apiFetch(`/locations/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch('/locations', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }

      setShowDialog(false)
      setEditingId(null)
      setForm(emptyForm)
      loadLocations()
      onLocationsChanged?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar ubicación'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────

  const handleDelete = async (loc: Location) => {
    const relatedTotal = (loc._count?.sensors || 0) + (loc._count?.permits || 0)
    const msg = relatedTotal > 0
      ? `¿Eliminar "${loc.name}"? Tiene ${relatedTotal} elemento(s) asociado(s) que también se eliminarán.`
      : `¿Eliminar la ubicación "${loc.name}"?`

    if (!confirm(msg)) return

    setDeletingId(loc.id)
    try {
      const res = await apiFetch<{ error?: string }>(`/locations/${loc.id}`, {
        method: 'DELETE',
      })
      if (res.error) {
        alert(res.error)
      } else {
        loadLocations()
        onLocationsChanged?.()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar'
      alert(message)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Edit ───────────────────────────────────────────

  const handleEdit = (loc: Location) => {
    setEditingId(loc.id)
    setForm({
      name: loc.name,
      address: loc.address || '',
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radiusMeters: String(loc.radiusMeters),
      verificationMethod: loc.verificationMethod || 'GPS',
      beaconUuid: '',
      beaconMajor: '1',
      beaconMinor: '1',
      beaconRssi: '-70',
    })
    setShowDialog(true)
    setError(null)
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowDialog(true)
  }

  // ── Filter ─────────────────────────────────────────

  const filtered = locations.filter((loc) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      loc.name.toLowerCase().includes(q) ||
      (loc.address && loc.address.toLowerCase().includes(q))
    )
  })

  // ── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 shrink-0">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Gestión de Ubicaciones</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {locations.length} ubicación(es) registrada(s)
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Ubicación
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar ubicación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white"
        />
      </div>

      {/* Location List */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[520px]">
            {loading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <p className="text-sm text-slate-400">Cargando ubicaciones...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {search ? 'No se encontraron ubicaciones' : 'No hay ubicaciones registradas'}
                </p>
                {!search && (
                  <p className="text-xs text-slate-400 mt-2">
                    Agregue ubicaciones para asociar sensores y permisos
                  </p>
                )}
                {!search && (
                  <Button
                    onClick={handleOpenCreate}
                    className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Crear Ubicación
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((loc, index) => {
                  const totalRelated = (loc._count?.sensors || 0) + (loc._count?.permits || 0)
                  const verifMethod = VERIFICATION_METHODS.find((m) => m.value === loc.verificationMethod)
                  const VerifIcon = verifMethod?.icon || Crosshair

                  return (
                    <motion.div
                      key={loc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="px-4 py-4 sm:px-5 sm:py-5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: icon + content */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-50 mt-0.5 shrink-0">
                            <Building2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Name + related badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
                                {loc.name}
                              </p>
                              {totalRelated > 0 && (
                                <Badge className="text-[10px] bg-slate-100 text-slate-500 shrink-0 leading-none">
                                  {loc._count?.sensors || 0}s · {loc._count?.permits || 0}p
                                </Badge>
                              )}
                            </div>

                            {/* Address */}
                            {loc.address && (
                              <p className="text-xs text-slate-500 leading-relaxed truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {loc.address}
                              </p>
                            )}

                            {/* Metadata grid: coordinates, radius, verification */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5 leading-relaxed">
                                <Navigation className="w-3 h-3 shrink-0" />
                                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1.5 leading-relaxed">
                                <Wifi className="w-3 h-3 shrink-0" />
                                Radio: {loc.radiusMeters}m
                              </span>
                              {loc.verificationMethod && (
                                <span className="text-xs text-slate-400 flex items-center gap-1.5 leading-relaxed">
                                  <VerifIcon className="w-3 h-3 shrink-0" />
                                  {verifMethod?.label || loc.verificationMethod}
                                </span>
                              )}
                            </div>

                            {/* Created date */}
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              Creada: {new Date(loc.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                          {/* QR Code action button */}
                          {loc.verificationMethod === 'QR_CODE' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                setQrImageUrl(null)
                                await handleGenerateQr(loc.id)
                                setEditingId(loc.id)
                                setForm((f) => ({ ...f, verificationMethod: 'QR_CODE' }))
                                setShowDialog(true)
                                setError(null)
                              }}
                              disabled={qrGenerating}
                              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              title="Generar/Ver Código QR"
                            >
                              {qrGenerating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <QrCode className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(loc)}
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {deletingId === loc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(loc)}
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDialog(false)
          setEditingId(null)
          setForm(emptyForm)
          setError(null)
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="w-5 h-5 text-emerald-600" />
                  Editar Ubicación
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Nueva Ubicación
                </>
              )}
            </DialogTitle>
            <DialogDescription className="mt-1.5">
              {editingId
                ? 'Modifique los datos de la ubicación de trabajo.'
                : 'Registre una nueva ubicación para asociar sensores y permisos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Plataforma A, Nivel 3"
                className="text-sm"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Dirección (Opcional)</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Ej: Planta Industrial Norte, Sector 4"
                className="text-sm"
              />
            </div>

            {/* GPS Coordinates */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-600">Coordenadas GPS *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetGPS}
                  disabled={gettingGps}
                  className="gap-1.5 text-[11px] h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {gettingGps ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Crosshair className="w-3 h-3" />
                  )}
                  {gettingGps ? 'Obteniendo...' : 'Mi Ubicación'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Latitud</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    min="-90"
                    max="90"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="10.0726"
                    className="text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Longitud</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    min="-180"
                    max="180"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="-84.3125"
                    className="text-sm font-mono"
                  />
                </div>
              </div>
              {form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)) && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Coordenadas válidas
                </p>
              )}
            </div>

            {/* Radius */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Radio de Geocerca (metros)</Label>
              <Input
                type="number"
                min="10"
                max="10000"
                value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
                placeholder="100"
                className="text-sm"
              />
              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                Área circular alrededor del punto GPS (10 - 10,000m)
              </p>
            </div>

            {/* Verification Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Método de Verificación</Label>
              <Select value={form.verificationMethod} onValueChange={(v) => setForm((f) => ({ ...f, verificationMethod: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERIFICATION_METHODS.map((m) => {
                    const Icon = m.icon
                    return (
                      <SelectItem key={m.value} value={m.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          {m.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* QR Code info (when method is QR_CODE) */}
            {form.verificationMethod === 'QR_CODE' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <p className="text-xs font-semibold text-slate-700">Verificación por Código QR</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Al crear la ubicación, se genera automáticamente un código QR único.
                  Los técnicos deben escanearlo para crear permisos. Puedes regenerarlo y descargarlo después.
                </p>
                {qrImageUrl && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <img src={qrImageUrl} alt="QR Code" className="w-48 h-48 rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={handleDownloadQr} className="text-xs gap-1.5">
                      <Download className="w-3 h-3" />
                      Descargar PNG
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Beacon BLE config (when method is BEACON) */}
            {form.verificationMethod === 'BEACON' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-semibold text-slate-700">Configuración Beacon BLE (iBeacon)</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ingresa los datos del beacon físico instalado en la ubicación.
                  Los técnicos deben estar dentro del rango del beacon para crear permisos.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500 font-medium">UUID del Beacon *</Label>
                    <Input
                      value={form.beaconUuid}
                      onChange={(e) => setForm((f) => ({ ...f, beaconUuid: e.target.value }))}
                      placeholder="f7826da6-4fa3-4e98-8014-7c7a646e9c01"
                      className="text-xs font-mono"
                    />
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">Formato UUID v4 (36 caracteres con guiones)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Major (0-65535)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="65535"
                        value={form.beaconMajor}
                        onChange={(e) => setForm((f) => ({ ...f, beaconMajor: e.target.value }))}
                        placeholder="1"
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Minor (0-65535)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="65535"
                        value={form.beaconMinor}
                        onChange={(e) => setForm((f) => ({ ...f, beaconMinor: e.target.value }))}
                        placeholder="1"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500 font-medium">RSSI umbral (dBm)</Label>
                    <Input
                      type="number"
                      min="-100"
                      max="0"
                      value={form.beaconRssi}
                      onChange={(e) => setForm((f) => ({ ...f, beaconRssi: e.target.value }))}
                      placeholder="-70"
                      className="text-xs font-mono"
                    />
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      Señal mínima para considerar &quot;en rango&quot;. Más cercano a 0 = más fuerte.
                      Recomendado: -50 a -80 dBm.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <Separator />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => {
                setShowDialog(false)
                setEditingId(null)
                setForm(emptyForm)
                setError(null)
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name.trim() ||
                  !form.latitude ||
                  !form.longitude ||
                  (form.verificationMethod === 'BEACON' && !form.beaconUuid.trim())
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingId ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {editingId ? 'Guardar Cambios' : 'Crear Ubicación'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}