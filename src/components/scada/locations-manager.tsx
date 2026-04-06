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
      const body = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        verificationMethod: form.verificationMethod || null,
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Gestión de Ubicaciones</h2>
            <p className="text-xs text-slate-500">
              {locations.length} ubicación(es) registrada(s)
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm"
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
              <div className="py-16 flex flex-col items-center gap-2">
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
                  <p className="text-xs text-slate-400 mt-1">
                    Agregue ubicaciones para asociar sensores y permisos
                  </p>
                )}
                {!search && (
                  <Button
                    onClick={handleOpenCreate}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
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
                      className="flex items-start justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-50 mt-0.5 shrink-0">
                          <Building2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {loc.name}
                            </p>
                            {totalRelated > 0 && (
                              <Badge className="text-[10px] bg-slate-100 text-slate-500 shrink-0">
                                {loc._count?.sensors || 0} sensor(es) • {loc._count?.permits || 0} permiso(s)
                              </Badge>
                            )}
                          </div>
                          {loc.address && (
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {loc.address}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Navigation className="w-3 h-3" />
                              {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Wifi className="w-3 h-3" />
                              Radio: {loc.radiusMeters}m
                            </span>
                            {loc.verificationMethod && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <VerifIcon className="w-3 h-3" />
                                {verifMethod?.label || loc.verificationMethod}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300 mt-1">
                            Creada: {new Date(loc.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
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
            <DialogDescription>
              {editingId
                ? 'Modifique los datos de la ubicación de trabajo.'
                : 'Registre una nueva ubicación para asociar sensores y permisos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Plataforma A, Nivel 3"
                className="text-sm"
              />
            </div>

            {/* Address */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Dirección (Opcional)</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Ej: Planta Industrial Norte, Sector 4"
                className="text-sm"
              />
            </div>

            {/* GPS Coordinates */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-slate-600">Coordenadas GPS *</Label>
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
                <div>
                  <Label className="text-[10px] text-slate-400 mb-1 block">Latitud</Label>
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
                <div>
                  <Label className="text-[10px] text-slate-400 mb-1 block">Longitud</Label>
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
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Coordenadas válidas
                </p>
              )}
            </div>

            {/* Radius */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Radio de Geocerca (metros)</Label>
              <Input
                type="number"
                min="10"
                max="10000"
                value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
                placeholder="100"
                className="text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Área circular alrededor del punto GPS (10 - 10,000m)
              </p>
            </div>

            {/* Verification Method */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Método de Verificación</Label>
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
                  <p className="text-xs text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <Separator />
            <div className="flex justify-end gap-2">
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
                disabled={saving || !form.name.trim() || !form.latitude || !form.longitude}
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
