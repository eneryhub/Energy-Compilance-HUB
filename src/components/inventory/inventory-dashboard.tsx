'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, MapPin, AlertTriangle, Camera, Wifi, Download,
  Search, Filter, Eye, ChevronDown, RefreshCw, Plus, Minus,
  BarChart3, Boxes, Shield, CheckCircle2, XCircle, FileSpreadsheet,
  FileText, Loader2, ArrowUpDown, Clock, ImageOff, Activity,
  Upload, Trash2, MonitorSpeaker, Radio, Zap, ScanLine, X,
  Settings, CircuitBoard, Database, FlaskConical
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ==================== TYPES ====================

interface InvLocation {
  id: string
  name: string
  province: string | null
  city: string | null
  address: string | null
  isActive: boolean
}

interface InvItem {
  id: string
  name: string
  sku: string | null
  category: string
  unit: string
  thresholdMin: number
  thumbnailUrl: string | null
  isActive: boolean
}

interface InvDevice {
  id: string
  name: string
  type: 'CAMERA' | 'BEACON_GATEWAY'
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'
  ipAddress: string | null
  beaconUuid: string | null
  beaconMajor: number | null
  beaconMinor: number | null
  beaconRssi: number
  createdAt: string
  location?: { id: string; name: string; province: string | null }
}

interface StockRecord {
  id: string
  itemId: string
  locationId: string
  quantity: number
  cameraCount: number | null
  beaconCount: number | null
  lastCountedAt: string | null
  discrepancy: boolean
  notes: string | null
  item?: InvItem
  location?: InvLocation
}

interface AuditRecord {
  id: string
  itemName: string | null
  itemCount: number
  beaconCount: number | null
  confidence: number | null
  snapshotUrl: string | null
  rawImageUrl: string | null
  discrepancy: boolean
  createdAt: string
  device?: { name: string; type: string }
}

interface InventoryStats {
  totalStock: number
  lowStockAlerts: number
  activeDiscrepancies: number
  devicesOnline: number
}

// ==================== HELPERS ====================

function getStockStatus(quantity: number, thresholdMin: number): 'ok' | 'low' | 'critical' {
  if (quantity <= thresholdMin) return 'critical'
  if (quantity <= thresholdMin * 1.5) return 'low'
  return 'ok'
}

function statusConfig(status: 'ok' | 'low' | 'critical') {
  switch (status) {
    case 'ok':
      return { label: 'OK', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' }
    case 'low':
      return { label: 'Bajo', className: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' }
    case 'critical':
      return { label: 'Crítico', className: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' }
  }
}

function deviceStatusConfig(status: string) {
  switch (status) {
    case 'ONLINE': return { label: 'En Línea', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' }
    case 'OFFLINE': return { label: 'Desconectado', className: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' }
    case 'MAINTENANCE': return { label: 'Mantenimiento', className: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' }
    default: return { label: 'Desconocido', className: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-500' }
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

function deltaColor(delta: number): string {
  return Math.abs(delta) <= 2 ? 'text-amber-600' : 'text-red-600'
}

function deltaBg(delta: number): string {
  return Math.abs(delta) <= 2 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
}

function safeArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : []
}

// ==================== SKELETON LOADERS ====================

function KpiSkeleton() {
  return (
    <Card className="bg-white shadow-sm rounded-xl border-slate-200">
      <CardContent className="p-4 flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg bg-slate-100" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-16 bg-slate-100" />
          <Skeleton className="h-3 w-24 bg-slate-100" />
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
      ))}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export default function InventoryDashboard() {
  // ── State ──
  const [locations, setLocations] = useState<InvLocation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [stats, setStats] = useState<InventoryStats>({ totalStock: 0, lowStockAlerts: 0, activeDiscrepancies: 0, devicesOnline: 0 })
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([])
  const [discrepancies, setDiscrepancies] = useState<StockRecord[]>([])
  const [snapshots, setSnapshots] = useState<AuditRecord[]>([])
  const [devices, setDevices] = useState<InvDevice[]>([])
  const [items, setItems] = useState<InvItem[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [loadingLocations, setLoadingLocations] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingDiscrepancies, setLoadingDiscrepancies] = useState(true)
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [loadingItems, setLoadingItems] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<AuditRecord | null>(null)
  const [sortField, setSortField] = useState<'name' | 'quantity' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Dialog States ──
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)
  const [deviceForm, setDeviceForm] = useState({ name: '', type: 'CAMERA' as 'CAMERA' | 'BEACON_GATEWAY', locationId: '', ipAddress: '', beaconUuid: '', beaconMajor: '', beaconMinor: '', beaconRssi: '-70' })
  const [deviceSubmitting, setDeviceSubmitting] = useState(false)

  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [scanForm, setScanForm] = useState({ deviceId: '', itemId: '', imageBase64: '' })
  const [scanImagePreview, setScanImagePreview] = useState<string | null>(null)
  const [scanSubmitting, setScanSubmitting] = useState(false)
  const [scanResult, setScanResult] = useState<{
    count: number
    confidence: number
    observations: string
    detected: string[]
    discrepancy: boolean
    beaconCount: number | null
    detectedItem: string | null
    matchedItem: { id: string; name: string } | null
    isExactMatch: boolean
    isUserMismatch: boolean
    lowConfidence: boolean
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [locationForm, setLocationForm] = useState({ name: '', province: '', city: '', address: '' })
  const [locationSubmitting, setLocationSubmitting] = useState(false)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemForm, setItemForm] = useState({ name: '', sku: '', category: 'GENERAL', unit: 'unidad', thresholdMin: 5 })
  const [itemSubmitting, setItemSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // ── Data Fetching ──

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true)
    try {
      const data = await apiFetch<{ locations?: InvLocation[] } | InvLocation[]>('/inventory/locations')
      const arr = Array.isArray(data) ? data : safeArray((data as { locations?: InvLocation[] }).locations)
      const activeLocations = arr.filter((l: InvLocation) => l.isActive !== false)
      setLocations(activeLocations)
      if (activeLocations.length > 0 && !selectedLocationId) {
        setSelectedLocationId(activeLocations[0].id)
      }
    } catch { setLocations([]) }
    finally { setLoadingLocations(false) }
  }, [selectedLocationId])

  const fetchStats = useCallback(async (locId: string) => {
    setLoadingStats(true)
    try {
      const data = await apiFetch<InventoryStats>(`/inventory/stats?locationId=${locId}`)
      if (data && typeof data === 'object') {
        setStats({
          totalStock: typeof data.totalStock === 'number' ? data.totalStock : 0,
          lowStockAlerts: typeof data.lowStockAlerts === 'number' ? data.lowStockAlerts : 0,
          activeDiscrepancies: typeof data.activeDiscrepancies === 'number' ? data.activeDiscrepancies : 0,
          devicesOnline: typeof data.devicesOnline === 'number' ? data.devicesOnline : 0,
        })
      }
    } catch { setStats({ totalStock: 0, lowStockAlerts: 0, activeDiscrepancies: 0, devicesOnline: 0 }) }
    finally { setLoadingStats(false) }
  }, [])

  const fetchStock = useCallback(async (locId: string) => {
    setLoadingStock(true)
    try {
      const data = await apiFetch<{ stock?: StockRecord[] } | StockRecord[]>(`/inventory/stock?locationId=${locId}`)
      const arr = Array.isArray(data) ? data : safeArray((data as { stock?: StockRecord[] }).stock)
      setStockRecords(arr)
    } catch { setStockRecords([]) }
    finally { setLoadingStock(false) }
  }, [])

  const fetchDiscrepancies = useCallback(async (locId: string) => {
    setLoadingDiscrepancies(true)
    try {
      const data = await apiFetch<{ stock?: StockRecord[] } | StockRecord[]>(`/inventory/stock?locationId=${locId}&discrepancy=true`)
      const arr = Array.isArray(data) ? data : safeArray((data as { stock?: StockRecord[] }).stock)
      setDiscrepancies(arr)
    } catch { setDiscrepancies([]) }
    finally { setLoadingDiscrepancies(false) }
  }, [])

  const fetchSnapshots = useCallback(async (locId: string) => {
    setLoadingSnapshots(true)
    try {
      const data = await apiFetch<{ audits?: AuditRecord[] } | AuditRecord[]>(`/inventory/audit?locationId=${locId}&limit=5`)
      const arr = Array.isArray(data) ? data : safeArray((data as { audits?: AuditRecord[] }).audits)
      setSnapshots(arr)
    } catch { setSnapshots([]) }
    finally { setLoadingSnapshots(false) }
  }, [])

  const fetchDevices = useCallback(async (locId: string) => {
    setLoadingDevices(true)
    try {
      const data = await apiFetch<{ devices?: InvDevice[] } | InvDevice[]>(`/inventory/devices?locationId=${locId}`)
      const arr = Array.isArray(data) ? data : safeArray((data as { devices?: InvDevice[] }).devices)
      setDevices(arr)
    } catch { setDevices([]) }
    finally { setLoadingDevices(false) }
  }, [])

  const fetchItems = useCallback(async () => {
    setLoadingItems(true)
    try {
      const data = await apiFetch<{ items?: InvItem[] } | InvItem[]>('/inventory/items')
      const arr = Array.isArray(data) ? data : safeArray((data as { items?: InvItem[] }).items)
      setItems(arr.filter((i: InvItem) => i.isActive !== false))
    } catch { setItems([]) }
    finally { setLoadingItems(false) }
  }, [])

  const refreshAll = useCallback((locId: string) => {
    fetchStats(locId)
    fetchStock(locId)
    fetchDiscrepancies(locId)
    fetchSnapshots(locId)
    fetchDevices(locId)
  }, [fetchStats, fetchStock, fetchDiscrepancies, fetchSnapshots, fetchDevices])

  // ── Effects ──

  useEffect(() => { fetchLocations(); fetchItems() }, [fetchLocations, fetchItems])

  useEffect(() => {
    if (selectedLocationId) {
      refreshAll(selectedLocationId)
    } else {
      // No location selected — clear loading states so empty UI shows instead of skeletons
      setLoadingStats(false)
      setLoadingStock(false)
      setLoadingDiscrepancies(false)
      setLoadingSnapshots(false)
      setLoadingDevices(false)
      setStockRecords([])
      setDiscrepancies([])
      setSnapshots([])
      setDevices([])
    }
  }, [selectedLocationId, refreshAll])

  // ── Derived Data ──

  const categories = useMemo(() => {
    const cats = new Set<string>()
    stockRecords.forEach((r) => { if (r.item?.category) cats.add(r.item.category) })
    return Array.from(cats).sort()
  }, [stockRecords])

  const filteredStock = useMemo(() => {
    let result = stockRecords
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => r.item?.name?.toLowerCase().includes(q) || r.item?.sku?.toLowerCase().includes(q))
    }
    if (categoryFilter !== 'all') { result = result.filter((r) => r.item?.category === categoryFilter) }
    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name': return dir * (a.item?.name ?? '').localeCompare(b.item?.name ?? '')
        case 'quantity': return dir * (a.quantity - b.quantity)
        case 'status': {
          const sa = getStockStatus(a.quantity, a.item?.thresholdMin ?? 0)
          const sb = getStockStatus(b.quantity, b.item?.thresholdMin ?? 0)
          return dir * ({ critical: 0, low: 1, ok: 2 }[sa] - { critical: 0, low: 1, ok: 2 }[sb])
        }
        default: return 0
      }
    })
    return result
  }, [stockRecords, searchQuery, categoryFilter, sortField, sortDir])

  const handleSort = (field: 'name' | 'quantity' | 'status') => {
    if (sortField === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')) }
    else { setSortField(field); setSortDir('asc') }
  }

  const handleLocationChange = (locId: string) => {
    setSelectedLocationId(locId)
    setExpandedRowId(null)
    setSearchQuery('')
    setCategoryFilter('all')
  }

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!selectedLocationId || exporting) return
    setExporting(true)
    try {
      const res = await fetch(`/api/inventory/export?locationId=${selectedLocationId}&format=${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ech_token') || ''}` },
      })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario-reporte-${selectedLocationId}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { /* silent */ }
    finally { setExporting(false) }
  }

  const openSnapshotDialog = (record: AuditRecord) => { setSelectedSnapshot(record); setSnapshotDialogOpen(true) }

  // ── Device CRUD ──

  const handleAddDevice = async () => {
    if (!deviceForm.name.trim() || !deviceForm.locationId) return
    setDeviceSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: deviceForm.name.trim(),
        type: deviceForm.type,
        locationId: deviceForm.locationId,
      }
      if (deviceForm.type === 'CAMERA') {
        body.ipAddress = deviceForm.ipAddress.trim() || null
      } else {
        if (deviceForm.beaconUuid.trim()) body.beaconUuid = deviceForm.beaconUuid.trim()
        if (deviceForm.beaconMajor.trim()) body.beaconMajor = parseInt(deviceForm.beaconMajor, 10)
        if (deviceForm.beaconMinor.trim()) body.beaconMinor = parseInt(deviceForm.beaconMinor, 10)
        if (deviceForm.beaconRssi.trim()) body.beaconRssi = parseInt(deviceForm.beaconRssi, 10)
      }
      await apiFetch('/inventory/devices', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setDeviceDialogOpen(false)
      setDeviceForm({ name: '', type: 'CAMERA', locationId: '', ipAddress: '', beaconUuid: '', beaconMajor: '', beaconMinor: '', beaconRssi: '-70' })
      if (selectedLocationId) { fetchDevices(selectedLocationId); fetchStats(selectedLocationId) }
    } catch { /* handled silently */ }
    finally { setDeviceSubmitting(false) }
  }

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await apiFetch(`/inventory/devices/${deviceId}`, { method: 'DELETE' })
      if (selectedLocationId) { fetchDevices(selectedLocationId); fetchStats(selectedLocationId) }
    } catch { /* silent */ }
  }

  // ── Location CRUD ──

  const handleAddLocation = async () => {
    if (!locationForm.name.trim()) return
    setLocationSubmitting(true)
    try {
      const newLoc = await apiFetch<InvLocation>('/inventory/locations', {
        method: 'POST',
        body: JSON.stringify({ name: locationForm.name.trim(), province: locationForm.province.trim() || null, city: locationForm.city.trim() || null, address: locationForm.address.trim() || null }),
      })
      setLocationDialogOpen(false)
      setLocationForm({ name: '', province: '', city: '', address: '' })
      await fetchLocations()
      if (newLoc?.id) setSelectedLocationId(newLoc.id)
    } catch { /* silent */ }
    finally { setLocationSubmitting(false) }
  }

  // ── Item CRUD ──

  const handleAddItem = async () => {
    if (!itemForm.name.trim()) return
    setItemSubmitting(true)
    try {
      await apiFetch('/inventory/items', {
        method: 'POST',
        body: JSON.stringify({ name: itemForm.name.trim(), sku: itemForm.sku.trim() || null, category: itemForm.category, unit: itemForm.unit, thresholdMin: itemForm.thresholdMin }),
      })
      setItemDialogOpen(false)
      setItemForm({ name: '', sku: '', category: 'GENERAL', unit: 'unidad', thresholdMin: 5 })
      fetchItems()
    } catch { /* silent */ }
    finally { setItemSubmitting(false) }
  }

  // ── Simulate Scan ──

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('La imagen no puede superar 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setScanImagePreview(base64)
      setScanForm((prev) => ({ ...prev, imageBase64: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSimulateScan = async () => {
    if (!scanForm.imageBase64 || !selectedLocationId) return
    setScanSubmitting(true)
    setScanResult(null)
    try {
      const body: Record<string, unknown> = { image: scanForm.imageBase64, locationId: selectedLocationId }
      if (scanForm.deviceId) body.deviceId = scanForm.deviceId
      if (scanForm.itemId) {
        const item = items.find((i) => i.id === scanForm.itemId)
        if (item) body.itemName = item.name
      }
      const result = await apiFetch<{
        analysis: {
          count: number
          confidence: number
          observations: string
          detected: string[]
          discrepancy: boolean
          beaconCount: number | null
          detectedItem: string | null
          matchedItem: { id: string; name: string } | null
          isExactMatch: boolean
          isUserMismatch: boolean
          lowConfidence: boolean
        }
      }>('/inventory/snapshot', { method: 'POST', body: JSON.stringify(body) })
      if (result?.analysis) {
        setScanResult(result.analysis)
        refreshAll(selectedLocationId)
      }
    } catch { /* silent */ }
    finally { setScanSubmitting(false) }
  }

  const resetScanDialog = () => {
    setScanDialogOpen(false)
    setScanForm({ deviceId: '', itemId: '', imageBase64: '' })
    setScanImagePreview(null)
    setScanResult(null)
    setScanSubmitting(false)
  }

  // ── Seed Demo Data ──

  const handleSeedDemo = async () => {
    setSeeding(true)
    try {
      const result = await apiFetch<{ seeded?: boolean; message?: string; alreadySeeded?: boolean }>('/inventory/seed', { method: 'POST' })
      if (result?.seeded) {
        await fetchLocations()
        await fetchItems()
      }
    } catch { /* silent */ }
    finally { setSeeding(false) }
  }

  const handleClearSeed = async () => {
    setSeeding(true)
    try {
      await apiFetch('/inventory/seed', { method: 'DELETE' })
      setLocations([])
      setSelectedLocationId('')
      setDevices([])
      setStockRecords([])
      setDiscrepancies([])
      setSnapshots([])
      setStats({ totalStock: 0, lowStockAlerts: 0, activeDiscrepancies: 0, devicesOnline: 0 })
      await fetchLocations()
    } catch { /* silent */ }
    finally { setSeeding(false) }
  }

  // ── Selected location info ──
  const selectedLocation = locations.find((l) => l.id === selectedLocationId)

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ═══════ A) TOP BAR: Location Selector + Export ═══════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium whitespace-nowrap">Ubicacion:</span>
            </div>

            {loadingLocations ? (
              <Skeleton className="h-9 w-64 bg-slate-100 rounded-lg" />
            ) : locations.length === 0 ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLocationDialogOpen(true)} className="gap-2 border-dashed border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-200">
                  <Plus className="w-4 h-4" /> Crear almacen
                </Button>
                <Button variant="outline" size="sm" onClick={handleSeedDemo} disabled={seeding} className="gap-2 border-dashed border-cyan-200 text-cyan-600 hover:text-cyan-700 hover:border-cyan-300 bg-cyan-50">
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  Cargar Datos Demo
                </Button>
              </div>
            ) : (
              <Select value={selectedLocationId} onValueChange={handleLocationChange}>
                <SelectTrigger className="w-full sm:w-72 bg-white border-slate-200 text-slate-800">
                  <SelectValue placeholder="Seleccionar ubicacion" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-800">
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{loc.name}</span>
                        {loc.province && <span className="text-xs text-slate-500">- {loc.province}{loc.city ? `, ${loc.city}` : ''}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600" onClick={() => setLocationDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nueva ubicacion</TooltipContent>
            </Tooltip>

            {selectedLocation && !loadingLocations && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-emerald-600" onClick={() => refreshAll(selectedLocationId)} disabled={loadingStats}>
                  <RefreshCw className={cn('w-4 h-4', loadingStats && 'animate-spin')} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-cyan-600" disabled={seeding}>
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white border-slate-200 text-slate-800">
                    <DropdownMenuItem onClick={handleSeedDemo} className="gap-2 focus:bg-slate-100 focus:text-cyan-600 cursor-pointer">
                      <FlaskConical className="w-4 h-4" /> Cargar Datos Demo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleClearSeed} className="gap-2 focus:bg-slate-100 focus:text-red-600 cursor-pointer text-red-600">
                      <Trash2 className="w-4 h-4" /> Limpiar Datos Demo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Simulate Scan Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedLocationId}
                  onClick={() => { setScanForm((p) => ({ ...p, imageBase64: '' })); setScanImagePreview(null); setScanResult(null); setScanDialogOpen(true) }}
                  className="gap-2 border-cyan-300 text-cyan-700 hover:text-cyan-700 hover:border-cyan-400 bg-cyan-50 hover:bg-cyan-100"
                >
                  <ScanLine className="w-4 h-4" />
                  Simular Escaneo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Subir imagen para analisis IA</TooltipContent>
            </Tooltip>

            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting || !selectedLocationId} className="gap-2 border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 bg-white">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-slate-200 text-slate-800">
                <DropdownMenuItem onClick={() => handleExport('xlsx')} className="gap-2 focus:bg-slate-100 focus:text-emerald-600 cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 focus:bg-slate-100 focus:text-emerald-600 cursor-pointer">
                  <FileText className="w-4 h-4" /> Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ═══════ B) KPI Cards ═══════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingStats ? (<><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>) : (<>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0 }}>
              <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-emerald-200 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Boxes className="w-5 h-5 text-emerald-600" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.totalStock.toLocaleString('es-AR')}</p>
                    <p className="text-xs text-slate-500 truncate">Total en Stock</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-amber-200 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.lowStockAlerts}</p>
                    <p className="text-xs text-slate-500 truncate">Alertas de Stock Bajo</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-red-200 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center"><Shield className="w-5 h-5 text-red-600" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.activeDiscrepancies}</p>
                    <p className="text-xs text-slate-500 truncate">Discrepancias Activas</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
              <Card className="bg-white shadow-sm rounded-xl border-slate-200 hover:border-cyan-200 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center"><Wifi className="w-5 h-5 text-cyan-600" /></div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.devicesOnline}</p>
                    <p className="text-xs text-slate-500 truncate">Dispositivos en Linea</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>)}
        </div>

        {/* ═══════ DEVICE MANAGEMENT SECTION ═══════ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <Card className="bg-white shadow-sm rounded-xl border-slate-200">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircuitBoard className="w-5 h-5 text-cyan-600" />
                  <CardTitle className="text-base text-slate-900">Dispositivos del Almacen</CardTitle>
                  {!loadingDevices && (
                    <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">
                      {devices.length} dispositivo{devices.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-cyan-600" onClick={() => setDeviceDialogOpen(true)} disabled={!selectedLocationId}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Agregar dispositivo</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600" onClick={() => setItemDialogOpen(true)}>
                        <Package className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Agregar articulo</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingDevices ? (
                <TableSkeleton />
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <CircuitBoard className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-medium">Sin dispositivos vinculados</p>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Agrega camaras y beacons para monitorear este almacen
                  </p>
                  {selectedLocationId && (
                    <Button variant="outline" size="sm" onClick={() => setDeviceDialogOpen(true)} className="mt-3 gap-2 border-dashed border-cyan-300 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50">
                      <Plus className="w-3.5 h-3.5" /> Agregar Dispositivo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {devices.map((device, idx) => {
                    const dsc = deviceStatusConfig(device.status)
                    const isCamera = device.type === 'CAMERA'
                    return (
                      <motion.div
                        key={device.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-slate-300 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', isCamera ? 'bg-violet-50' : 'bg-orange-50')}>
                              {isCamera ? <Camera className="w-4 h-4 text-violet-600" /> : <Radio className="w-4 h-4 text-orange-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{device.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', isCamera ? 'border-violet-200 text-violet-600 bg-violet-50' : 'border-orange-200 text-orange-600 bg-orange-50')}>
                                  {isCamera ? 'Camara' : 'Gateway Beacon'}
                                </Badge>
                                <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', dsc.className)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full mr-1', dsc.dot)} />
                                  {dsc.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {device.type === 'CAMERA' && device.ipAddress && (
                          <p className="text-[10px] text-slate-400 mt-2 ml-[46px] font-mono">{device.ipAddress}</p>
                        )}
                        {device.type === 'BEACON_GATEWAY' && device.beaconUuid && (
                          <div className="mt-2 ml-[46px] space-y-0.5">
                            <p className="text-[10px] text-slate-400 font-mono truncate" title={device.beaconUuid}>
                              UUID: {device.beaconUuid.substring(0, 23)}...
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              {device.beaconMajor !== null && <span>Major: {device.beaconMajor}</span>}
                              {device.beaconMinor !== null && <span>Minor: {device.beaconMinor}</span>}
                              <span>RSSI: {device.beaconRssi ?? -70} dBm</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ═══════ C + D) Stock Grid + Discrepancy Panel ═══════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <Card className="bg-white shadow-sm rounded-xl border-slate-200">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-base text-slate-900">Inventario de Stock</CardTitle>
                    {!loadingStock && <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">{filteredStock.length} item{filteredStock.length !== 1 ? 's' : ''}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input placeholder="Buscar nombre o SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 text-xs bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 w-full sm:w-52" />
                    </div>
                    {categories.length > 0 && (
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-8 w-36 text-xs bg-white border-slate-200 text-slate-700">
                          <Filter className="w-3 h-3 mr-1 text-slate-400" /><SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 text-slate-800">
                          <SelectItem value="all"><span className="text-xs">Todas las categorias</span></SelectItem>
                          {categories.map((cat) => (<SelectItem key={cat} value={cat}><span className="text-xs">{cat}</span></SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {loadingStock ? (<div className="px-4 pb-4"><TableSkeleton /></div>) : filteredStock.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Package className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Sin articulos encontrados</p>
                    <p className="text-xs mt-1">{searchQuery || categoryFilter !== 'all' ? 'Intenta ajustar los filtros de busqueda' : 'No hay articulos registrados para esta ubicacion'}</p>
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 hover:bg-transparent">
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1">Articulo <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                          </TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">SKU</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Categoria</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 text-right" onClick={() => handleSort('quantity')}>
                            <div className="flex items-center gap-1 justify-end">Cantidad <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                          </TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell text-right">Min.</TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 text-center" onClick={() => handleSort('status')}>
                            <div className="flex items-center gap-1 justify-center">Estado <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                          </TableHead>
                          <TableHead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Ultimo Conteo</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStock.map((record, idx) => {
                          const item = record.item
                          const threshold = item?.thresholdMin ?? 0
                          const status = getStockStatus(record.quantity, threshold)
                          const cfg = statusConfig(status)
                          const isExpanded = expandedRowId === record.id
                          return (
                            <StockRow key={record.id} record={record} status={status} statusCfg={cfg} isExpanded={isExpanded} onToggle={() => setExpandedRowId(isExpanded ? null : record.id)} index={idx} />
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── D) Discrepancy Panel ── */}
          <div className="xl:col-span-1">
            <Card className="bg-white shadow-sm rounded-xl border-slate-200 h-full">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded flex items-center justify-center"><Activity className="w-4 h-4 text-amber-600" /></div>
                  <CardTitle className="text-base text-slate-900">Discrepancias</CardTitle>
                  {!loadingDiscrepancies && discrepancies.length > 0 && <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">{discrepancies.length}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {loadingDiscrepancies ? (<TableSkeleton />) : discrepancies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-30 text-emerald-600" />
                    <p className="text-xs font-medium">Sin discrepancias</p>
                    <p className="text-[11px] mt-1 text-slate-400">Todos los conteos coinciden</p>
                  </div>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 space-y-2">
                    {discrepancies.map((record) => {
                      const camCount = record.cameraCount ?? 0; const beaconCount = record.beaconCount ?? 0; const delta = camCount - beaconCount; const itemName = record.item?.name ?? 'Articulo desconocido'
                      return (
                        <motion.div key={record.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={cn('rounded-lg border p-3 transition-colors cursor-pointer hover:border-slate-200', deltaBg(delta))} onClick={() => { if (record.item?.thumbnailUrl) openSnapshotDialog({ id: record.id, itemName, itemCount: camCount, beaconCount, confidence: null, snapshotUrl: record.item.thumbnailUrl, rawImageUrl: null, discrepancy: true, createdAt: record.lastCountedAt ?? '' }) }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{itemName}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-1.5"><Camera className="w-3 h-3 text-slate-400" /><span className="text-xs text-slate-700 tabular-nums">{camCount}</span></div>
                                <span className="text-xs text-slate-400">vs</span>
                                <div className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-slate-400" /><span className="text-xs text-slate-700 tabular-nums">{beaconCount}</span></div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className={cn('text-sm font-bold tabular-nums', deltaColor(delta))}>{delta > 0 ? '+' : ''}{delta}</span>
                              <Badge variant="outline" className="mt-1 text-[9px] border-red-200 text-red-600 bg-red-50">{delta > 0 ? 'Sobrante' : delta < 0 ? 'Faltante' : 'OK'}</Badge>
                            </div>
                          </div>
                          {record.lastCountedAt && <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatTimestamp(record.lastCountedAt)}</p>}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══════ E) Recent Snapshots ═══════ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <Card className="bg-white shadow-sm rounded-xl border-slate-200">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-base text-slate-900">Ultimas Capturas de Auditoria</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingSnapshots ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-48 rounded-lg bg-slate-100" />))}</div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Camera className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-medium">Sin capturas recientes</p>
                  <p className="text-[11px] mt-1 text-slate-400">Usa &quot;Simular Escaneo&quot; para generar capturas con IA</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {snapshots.map((snap, idx) => (
                    <motion.div key={snap.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: idx * 0.05 }} className="group cursor-pointer" onClick={() => openSnapshotDialog(snap)}>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden hover:border-emerald-200 transition-all duration-200">
                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                          {snap.snapshotUrl || snap.rawImageUrl ? (
                            <img src={snap.snapshotUrl || snap.rawImageUrl || ''} alt={snap.itemName || 'Captura'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white"><ImageOff className="w-6 h-6 text-slate-400" /></div>
                          )}
                          {snap.confidence !== null && snap.confidence !== undefined && (
                            <div className="absolute top-1.5 right-1.5"><Badge className="text-[9px] bg-white text-slate-700 border-slate-200 backdrop-blur-sm">{Math.round(snap.confidence * 100)}% conf.</Badge></div>
                          )}
                          {snap.discrepancy && (
                            <div className="absolute top-1.5 left-1.5"><Badge className="text-[9px] bg-red-50 text-red-600 border-red-200 backdrop-blur-sm">Discrepancia</Badge></div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"><Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                        </div>
                        <div className="p-2.5 space-y-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{snap.itemName || 'Articulo'}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">Conteo IA: <span className="text-slate-800 font-medium tabular-nums">{snap.itemCount}</span></span>
                            {snap.beaconCount !== null && snap.beaconCount !== undefined && (
                              <span className="text-[10px] text-slate-500">Beacon: <span className="text-slate-800 font-medium tabular-nums">{snap.beaconCount}</span></span>
                            )}
                          </div>
                          {snap.createdAt && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatTimestamp(snap.createdAt)}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ═══════ DIALOGS ═══════ */}

        {/* ── Snapshot Detail Dialog ── */}
        <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
          <DialogContent className="max-w-lg bg-white border-slate-200 text-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base">Detalle de Captura</DialogTitle>
            </DialogHeader>
            {selectedSnapshot && (
              <div className="space-y-4">
                {(selectedSnapshot.snapshotUrl || selectedSnapshot.rawImageUrl) && (
                  <div className="rounded-lg overflow-hidden border border-slate-200">
                    <img src={selectedSnapshot.snapshotUrl || selectedSnapshot.rawImageUrl || ''} alt="Captura" className="w-full max-h-64 object-contain bg-slate-100" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Articulo</p>
                    <p className="text-sm font-medium text-slate-800">{selectedSnapshot.itemName || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conteo IA</p>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{selectedSnapshot.itemCount}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Beacon</p>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{selectedSnapshot.beaconCount ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Confianza</p>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{selectedSnapshot.confidence !== null ? `${Math.round(selectedSnapshot.confidence * 100)}%` : 'N/A'}</p>
                  </div>
                </div>
                {selectedSnapshot.discrepancy && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <p className="text-xs text-red-600">Discrepancia detectada entre conteo visual y beacon</p>
                  </div>
                )}
                {selectedSnapshot.device && (
                  <p className="text-[10px] text-slate-400">Dispositivo: {selectedSnapshot.device.name} ({selectedSnapshot.device.type})</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Add Device Dialog ── */}
        <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
          <DialogContent className="max-w-md bg-white border-slate-200 text-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <CircuitBoard className="w-5 h-5 text-cyan-600" />
                Agregar Dispositivo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Vincula una camara o gateway beacon al almacen seleccionado
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Nombre del Dispositivo</Label>
                <Input value={deviceForm.name} onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Camara Entrada Norte" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Tipo de Dispositivo</Label>
                <Select value={deviceForm.type} onValueChange={(v) => setDeviceForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-800">
                    <SelectItem value="CAMERA">
                      <div className="flex items-center gap-2"><Camera className="w-4 h-4 text-violet-600" /> Camara de Vision</div>
                    </SelectItem>
                    <SelectItem value="BEACON_GATEWAY">
                      <div className="flex items-center gap-2"><Radio className="w-4 h-4 text-orange-600" /> Gateway Beacon</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Almacen</Label>
                <Select value={deviceForm.locationId || selectedLocationId} onValueChange={(v) => setDeviceForm((p) => ({ ...p, locationId: v }))}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm">
                    <SelectValue placeholder="Seleccionar almacen" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-800">
                    {locations.map((loc) => (<SelectItem key={loc.id} value={loc.id}>{loc.name}{loc.province ? ` (${loc.province})` : ''}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {deviceForm.type === 'CAMERA' ? (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Direccion IP (opcional)</Label>
                  <Input value={deviceForm.ipAddress} onChange={(e) => setDeviceForm((p) => ({ ...p, ipAddress: e.target.value }))} placeholder="Ej: 192.168.1.100" className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono" />
                  <p className="text-[10px] text-slate-400">Direccion de red de la camara en la red local</p>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="w-4 h-4 text-orange-600" />
                    <Label className="text-xs font-medium text-orange-800">Configuracion Beacon BLE (iBeacon)</Label>
                  </div>
                  <p className="text-[10px] text-orange-600 leading-relaxed">
                    Ingresa los datos del beacon fisico instalado en la ubicacion. Los dispositivos deben estar dentro del rango del beacon para registrar movimientos.
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-700">UUID</Label>
                      <Input
                        value={deviceForm.beaconUuid}
                        onChange={(e) => setDeviceForm((p) => ({ ...p, beaconUuid: e.target.value }))}
                        placeholder="f7826da6-4fa3-4e98-8014-7c7a646e9c01"
                        className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono"
                        maxLength={36}
                      />
                      <p className="text-[10px] text-slate-400">Formato UUID v4 (36 caracteres con guiones)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-700">Major</Label>
                        <Input
                          value={deviceForm.beaconMajor}
                          onChange={(e) => setDeviceForm((p) => ({ ...p, beaconMajor: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="1"
                          className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono"
                          type="number"
                          min={0}
                          max={65535}
                        />
                        <p className="text-[10px] text-slate-400">0 - 65535</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-700">Minor</Label>
                        <Input
                          value={deviceForm.beaconMinor}
                          onChange={(e) => setDeviceForm((p) => ({ ...p, beaconMinor: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="1"
                          className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono"
                          type="number"
                          min={0}
                          max={65535}
                        />
                        <p className="text-[10px] text-slate-400">0 - 65535</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-700">RSSI (umbral de senal)</Label>
                      <Input
                        value={deviceForm.beaconRssi}
                        onChange={(e) => setDeviceForm((p) => ({ ...p, beaconRssi: e.target.value.replace(/[^0-9-]/g, '') }))}
                        placeholder="-70"
                        className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono"
                        type="number"
                        min={-100}
                        max={0}
                      />
                      <p className="text-[10px] text-slate-400">
                        Senal minima para considerar &quot;en rango&quot;. Mas cercano a 0 = mas fuerte. Recomendado: -50 a -80 dBm
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setDeviceDialogOpen(false)} className="text-slate-500">Cancelar</Button>
                <Button size="sm" onClick={handleAddDevice} disabled={deviceSubmitting || !deviceForm.name.trim()} className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white">
                  {deviceSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Vincular Dispositivo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Add Location Dialog ── */}
        <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <DialogContent className="max-w-md bg-white border-slate-200 text-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Nuevo Almacen
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Registra una nueva ubicacion de almacenamiento</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Nombre del Almacen</Label>
                <Input value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Deposito Central" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Provincia</Label>
                  <Input value={locationForm.province} onChange={(e) => setLocationForm((p) => ({ ...p, province: e.target.value }))} placeholder="Ej: Buenos Aires" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Ciudad</Label>
                  <Input value={locationForm.city} onChange={(e) => setLocationForm((p) => ({ ...p, city: e.target.value }))} placeholder="Ej: Bahia Blanca" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Direccion (opcional)</Label>
                <Input value={locationForm.address} onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))} placeholder="Ej: Av. Industrial 1234" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setLocationDialogOpen(false)} className="text-slate-500">Cancelar</Button>
                <Button size="sm" onClick={handleAddLocation} disabled={locationSubmitting || !locationForm.name.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                  {locationSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear Almacen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Add Item Dialog ── */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-md bg-white border-slate-200 text-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Nuevo Articulo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Registra un nuevo articulo para el inventario</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-slate-700">Nombre del Articulo</Label>
                <Input value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Casco de Seguridad" className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">SKU (opcional)</Label>
                  <Input value={itemForm.sku} onChange={(e) => setItemForm((p) => ({ ...p, sku: e.target.value }))} placeholder="Ej: EPP-001" className="h-9 bg-white border-slate-200 text-slate-800 text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Categoria</Label>
                  <Select value={itemForm.category} onValueChange={(v) => setItemForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                      {['GENERAL', 'EPP', 'HERRAMIENTAS', 'ELECTRICO', 'COMBUSTIBLE', 'LIMPIEZA', 'OFICINA'].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Unidad</Label>
                  <Select value={itemForm.unit} onValueChange={(v) => setItemForm((p) => ({ ...p, unit: v }))}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                      {['unidad', 'par', 'litro', 'kg', 'rollo', 'caja', 'metro'].map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Stock Minimo</Label>
                  <Input type="number" min={0} value={itemForm.thresholdMin} onChange={(e) => setItemForm((p) => ({ ...p, thresholdMin: parseInt(e.target.value) || 0 }))} className="h-9 bg-white border-slate-200 text-slate-800 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setItemDialogOpen(false)} className="text-slate-500">Cancelar</Button>
                <Button size="sm" onClick={handleAddItem} disabled={itemSubmitting || !itemForm.name.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                  {itemSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear Articulo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Simulate Scan Dialog ── */}
        <Dialog open={scanDialogOpen} onOpenChange={resetScanDialog}>
          <DialogContent className="max-w-lg bg-white border-slate-200 text-slate-800">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-cyan-600" />
                Simular Escaneo IA
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                La IA identifica automáticamente el tipo de articulo y cuenta las unidades visibles
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Image Upload Area */}
              <div
                className={cn(
                  'rounded-lg border-2 border-dashed transition-colors cursor-pointer',
                  scanImagePreview ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50'
                )}
                onClick={() => !scanImagePreview && fileInputRef.current?.click()}
              >
                {scanImagePreview ? (
                  <div className="relative">
                    <img src={scanImagePreview} alt="Preview" className="w-full max-h-56 object-contain rounded-t-lg bg-slate-100" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-full"
                      onClick={(e) => { e.stopPropagation(); setScanImagePreview(null); setScanForm((p) => ({ ...p, imageBase64: '' })); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Upload className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm font-medium">Haz clic para subir una imagen</p>
                    <p className="text-[11px] mt-1 text-slate-400">JPG, PNG - Maximo 10MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />

              {/* Item & Device Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Articulo (opcional)</Label>
                  <Select value={scanForm.itemId} onValueChange={(v) => setScanForm((p) => ({ ...p, itemId: v }))}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm">
                      <SelectValue placeholder="Seleccionar articulo" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                      {items.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700">Dispositivo (opcional)</Label>
                  <Select value={scanForm.deviceId} onValueChange={(v) => setScanForm((p) => ({ ...p, deviceId: v }))}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-sm">
                      <SelectValue placeholder="Seleccionar dispositivo" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                      {devices.map((dev) => (<SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Scan Result — Autonomous Detection */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    {/* Detected Item Header */}
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center',
                        scanResult.lowConfidence ? 'bg-amber-100' : 'bg-emerald-100'
                      )}>
                        {scanResult.lowConfidence
                          ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                          : <Zap className="w-4 h-4 text-emerald-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-800">Detección Autónoma IA</span>
                        {scanResult.detectedItem && (
                          <p className="text-xs text-slate-500 truncate">
                            IA detectó: <span className="font-medium text-cyan-700">{scanResult.detectedItem}</span>
                            {scanResult.matchedItem && !scanResult.isExactMatch && (
                              <span className="ml-1 text-slate-400">→ match: {scanResult.matchedItem.name}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Low Confidence Warning */}
                    {scanResult.lowConfidence && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700">Detección incierta</p>
                          <p className="text-[11px] text-amber-600 mt-0.5">Confianza del {Math.round(scanResult.confidence * 100)}% — por favor verifique manualmente el conteo.</p>
                        </div>
                      </div>
                    )}

                    {/* User Mismatch Warning */}
                    {scanResult.isUserMismatch && scanForm.itemId && (
                      <div className="rounded-lg bg-violet-50 border border-violet-200 p-2.5 flex items-start gap-2">
                        <Eye className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-violet-700">Discrepancia de identificación</p>
                          <p className="text-[11px] text-violet-600 mt-0.5">
                            La IA detectó <span className="font-semibold">{scanResult.detectedItem}</span> pero se esperaba ver un artículo diferente del catálogo.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white shadow-sm p-2.5 text-center">
                        <p className="text-[10px] text-slate-400 uppercase mb-0.5">Conteo IA</p>
                        <p className="text-lg font-bold text-emerald-600 tabular-nums">{scanResult.count}</p>
                      </div>
                      <div className="rounded-lg bg-white shadow-sm p-2.5 text-center">
                        <p className="text-[10px] text-slate-400 uppercase mb-0.5">Confianza</p>
                        <p className={cn(
                          'text-lg font-bold tabular-nums',
                          scanResult.lowConfidence ? 'text-amber-600' : 'text-slate-800'
                        )}>{Math.round(scanResult.confidence * 100)}%</p>
                      </div>
                      <div className="rounded-lg bg-white shadow-sm p-2.5 text-center">
                        <p className="text-[10px] text-slate-400 uppercase mb-0.5">Beacon</p>
                        <p className="text-lg font-bold text-slate-800 tabular-nums">{scanResult.beaconCount ?? '—'}</p>
                      </div>
                    </div>

                    {/* Beacon Discrepancy */}
                    {scanResult.discrepancy && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <p className="text-xs text-red-600">
                          Discrepancia: IA contó {scanResult.count} vs Beacon {scanResult.beaconCount ?? 0}
                        </p>
                      </div>
                    )}

                    {/* AI Observations */}
                    {scanResult.observations && (
                      <div className="rounded-lg bg-white shadow-sm p-2.5">
                        <p className="text-[10px] text-slate-400 uppercase mb-1">Observaciones IA</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{scanResult.observations}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={resetScanDialog} className="text-slate-500">Cerrar</Button>
                <Button size="sm" onClick={handleSimulateScan} disabled={scanSubmitting || !scanForm.imageBase64} className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white">
                  {scanSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                  Analizar con IA
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

// ==================== STOCK ROW COMPONENT ====================

function StockRow({
  record, status, statusCfg, isExpanded, onToggle, index
}: {
  record: StockRecord
  status: 'ok' | 'low' | 'critical'
  statusCfg: { label: string; className: string; dot: string }
  isExpanded: boolean
  onToggle: () => void
  index: number
}) {
  const item = record.item
  return (
    <>
      <TableRow className={cn('border-slate-200', isExpanded && 'bg-slate-50')} onClick={onToggle}>
        <TableCell className="py-2.5">
          <div className="flex items-center gap-2">
            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
            <span className="text-sm text-slate-800 font-medium truncate max-w-[180px]">{item?.name ?? 'Desconocido'}</span>
          </div>
        </TableCell>
        <TableCell className="py-2.5 hidden md:table-cell"><span className="text-xs text-slate-500 font-mono">{item?.sku ?? '—'}</span></TableCell>
        <TableCell className="py-2.5 hidden lg:table-cell"><Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 bg-slate-50">{item?.category ?? '—'}</Badge></TableCell>
        <TableCell className="py-2.5 text-right"><span className="text-sm font-semibold text-slate-900 tabular-nums">{record.quantity}</span> <span className="text-[10px] text-slate-400">{item?.unit ?? ''}</span></TableCell>
        <TableCell className="py-2.5 text-right hidden lg:table-cell"><span className="text-xs text-slate-500 tabular-nums">{item?.thresholdMin ?? '—'}</span></TableCell>
        <TableCell className="py-2.5 text-center">
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', statusCfg.className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full mr-1', statusCfg.dot)} />
            {statusCfg.label}
          </Badge>
        </TableCell>
        <TableCell className="py-2.5 hidden lg:table-cell"><span className="text-[11px] text-slate-500">{formatTimestamp(record.lastCountedAt)}</span></TableCell>
        <TableCell className="py-2.5"><ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isExpanded && 'rotate-180')} /></TableCell>
      </TableRow>
      <AnimatePresence>
        {isExpanded && (
          <TableRow className="bg-slate-50 border-slate-200">
            <TableCell colSpan={8} className="px-8 py-3">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conteo Camara (IA)</p>
                    <p className="text-sm font-semibold text-slate-800 tabular-nums">{record.cameraCount ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conteo Beacon</p>
                    <p className="text-sm font-semibold text-slate-800 tabular-nums">{record.beaconCount ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Discrepancia</p>
                    {record.discrepancy ? (
                      <Badge className="text-[10px] bg-red-50 text-red-600 border-red-200">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Si
                      </Badge>
                    ) : (
                      <span className="text-xs text-emerald-600">Sin discrepancia</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Ultimo Escaneo</p>
                    <p className="text-xs text-slate-500">{formatTimestamp(record.lastCountedAt)}</p>
                  </div>
                </div>
                {record.notes && (
                  <p className="text-[11px] text-slate-400 mt-2 italic">Notas: {record.notes}</p>
                )}
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  )
}
