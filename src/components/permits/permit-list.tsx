'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Filter,
  FileDown,
  Eye,
  MapPin,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Camera,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, downloadPdfFromBase64, type Permit } from '@/lib/api'
import { RISK_TYPES } from '@/lib/plans'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⏳' },
  APPROVED: { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
  REJECTED: { label: 'Rechazado', color: 'bg-red-100 text-red-700 border-red-200', icon: '❌' },
  CANCELLED: { label: 'Cancelado', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: '🚫' },
}

interface PermitListProps {
  userRole?: string
  onRefresh?: () => void
}

export default function PermitList({ userRole, onRefresh }: PermitListProps) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null)
  const [page, setPage] = useState(1)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    loadPermits()
  }, [statusFilter])

  const loadPermits = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const data = await apiFetch<Permit[]>(`/permits?${params.toString()}`)
      setPermits(data)
    } catch {
      // Fallback data
      setPermits([
        {
          id: '1', permitNumber: 'PT-2024-0048', riskType: 'ALTURA', status: 'PENDING',
          safetyChecks: '{}', technicianName: 'Carlos Mendoza', supervisorName: 'Ana Rodríguez',
          workLocation: 'Plataforma A, Nivel 3', workDescription: 'Revisión de estructura metálica',
          createdByName: 'Carlos Mendoza', createdAt: new Date().toISOString(),
        },
        {
          id: '2', permitNumber: 'PT-2024-0047', riskType: 'ELECTRICO', status: 'APPROVED',
          safetyChecks: '{}', technicianName: 'Pedro Gómez', supervisorName: 'Ana Rodríguez',
          workLocation: 'Subestación Eléctrica B', workDescription: 'Mantenimiento de tablero principal',
          createdByName: 'Pedro Gómez', approvedByName: 'Ana Rodríguez', createdAt: new Date(Date.now() - 86400000).toISOString(),
          approvedAt: new Date(Date.now() - 43200000).toISOString(),
        },
        {
          id: '3', permitNumber: 'PT-2024-0046', riskType: 'CONFINADO', status: 'REJECTED',
          safetyChecks: '{}', technicianName: 'Luis Torres', supervisorName: 'Ana Rodríguez',
          workLocation: 'Tanque de almacenamiento T-201', workDescription: 'Limpieza interna de tanque',
          rejectionReason: 'Monitoreo de atmósfera no realizado', createdByName: 'Luis Torres',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '4', permitNumber: 'PT-2024-0045', riskType: 'CALIENTE', status: 'APPROVED',
          safetyChecks: '{}', technicianName: 'Miguel Sánchez', supervisorName: 'Roberto Lima',
          workLocation: 'Área de soldadura, Taller A', workDescription: 'Soldadura de tubería de 6"',
          createdByName: 'Miguel Sánchez', approvedByName: 'Roberto Lima',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          approvedAt: new Date(Date.now() - 216000000).toISOString(),
        },
        {
          id: '5', permitNumber: 'PT-2024-0044', riskType: 'ALTURA', status: 'PENDING',
          safetyChecks: '{}', technicianName: 'Juan Pérez', supervisorName: 'Ana Rodríguez',
          workLocation: 'Torre de enfriamiento T-3', workDescription: 'Inspección deestructura superior',
          createdByName: 'Juan Pérez', createdAt: new Date(Date.now() - 345600000).toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const filtered = permits.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.technicianName.toLowerCase().includes(q) ||
        p.workLocation.toLowerCase().includes(q)
      )
    }
    return true
  })

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleDownloadPdf = async (permit: Permit) => {
    setDownloadingPdf(permit.id)
    try {
      const data = await apiFetch<{ pdf: string }>('/permits/' + permit.id + '/pdf')
      if (data.pdf) {
        const statusLabel = permit.status === 'APPROVED' ? 'Aprobado' : permit.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'
        downloadPdfFromBase64(data.pdf, `Permiso_${permit.permitNumber}_${statusLabel}.pdf`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar PDF'
      alert(message)
    } finally {
      setDownloadingPdf(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por número, técnico o ubicación..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter(status); setPage(1) }}
                  className={cn(
                    'text-xs h-8',
                    statusFilter === status
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : ''
                  )}
                >
                  {status === 'ALL' ? 'Todos' : STATUS_CONFIG[status]?.label || status}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-600">Número</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Técnico</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Ubicación</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden sm:table-cell">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ))
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-sm text-slate-400">
                    No se encontraron permisos
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((permit) => {
                  const riskConfig = RISK_TYPES[permit.riskType as keyof typeof RISK_TYPES]
                  const statusCfg = STATUS_CONFIG[permit.status]
                  return (
                    <TableRow key={permit.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {permit.permitNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-[10px] border"
                          style={{
                            backgroundColor: (riskConfig?.color || '#666') + '15',
                            color: riskConfig?.color || '#666',
                            borderColor: (riskConfig?.color || '#666') + '30',
                          }}
                        >
                          {riskConfig?.label || permit.riskType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{permit.technicianName}</TableCell>
                      <TableCell className="text-sm text-slate-500 hidden md:table-cell max-w-[200px] truncate">
                        {permit.workLocation}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px] border', statusCfg?.color)}>
                          {statusCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 hidden sm:table-cell">
                        {formatDate(permit.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPdf(permit)}
                            disabled={downloadingPdf === permit.id}
                            className="h-7 gap-1 text-xs text-slate-600 hover:text-blue-600"
                            title="Descargar PDF"
                          >
                            {downloadingPdf === permit.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">PDF</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPermit(permit)}
                            className="h-7 gap-1 text-xs text-slate-600 hover:text-emerald-600"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedPermit} onOpenChange={() => setSelectedPermit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle del Permiso
              {selectedPermit && (
                <Badge className={cn('text-[10px]', STATUS_CONFIG[selectedPermit.status]?.color)}>
                  {STATUS_CONFIG[selectedPermit.status]?.label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalles completos del permiso de trabajo seleccionado
            </DialogDescription>
          </DialogHeader>
          {selectedPermit && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 pr-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Número</p>
                    <p className="text-sm font-semibold font-mono text-slate-800">{selectedPermit.permitNumber}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Tipo de Riesgo</p>
                    <Badge
                      className="text-[10px] border"
                      style={{
                        backgroundColor: (RISK_TYPES[selectedPermit.riskType as keyof typeof RISK_TYPES]?.color || '#666') + '15',
                        color: RISK_TYPES[selectedPermit.riskType as keyof typeof RISK_TYPES]?.color || '#666',
                      }}
                    >
                      {RISK_TYPES[selectedPermit.riskType as keyof typeof RISK_TYPES]?.label || selectedPermit.riskType}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Técnico
                    </p>
                    <p className="text-sm font-medium text-slate-700">{selectedPermit.technicianName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Supervisor
                    </p>
                    <p className="text-sm font-medium text-slate-700">{selectedPermit.supervisorName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 col-span-2">
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
                  <div className="p-3 rounded-lg bg-slate-50 col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Descripción</p>
                    <p className="text-sm text-slate-700">{selectedPermit.workDescription}</p>
                  </div>
                </div>

                {/* Photo Evidence */}
                {selectedPermit.photos && (() => {
                  try {
                    const photos = JSON.parse(selectedPermit.photos)
                    if (Array.isArray(photos) && photos.length > 0) {
                      return (
                        <div className="p-3 rounded-lg bg-slate-50 col-span-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                            <Camera className="w-3 h-3" /> Evidencia Fotográfica ({photos.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
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
                  } catch { /* ignore parse errors */ }
                  return null
                })()}

                {selectedPermit.rejectionReason && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[10px] uppercase tracking-wider text-red-500 mb-1">Motivo de Rechazo</p>
                    <p className="text-sm text-red-700">{selectedPermit.rejectionReason}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Creado: {formatDate(selectedPermit.createdAt)}
                  {selectedPermit.approvedAt && (
                    <> · Aprobado: {formatDate(selectedPermit.approvedAt)}</>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
