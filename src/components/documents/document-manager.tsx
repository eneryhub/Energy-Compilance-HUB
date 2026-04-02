'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
  Plus,
  Filter,
  FolderOpen,
  AlertTriangle,
  FileCheck,
  FileWarning,
  FileX,
  Calendar,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, type HseDocument, type CreateDocumentRequest } from '@/lib/api'

const CRITICALITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítico', color: 'bg-red-100 text-red-700 border-red-200' },
  NORMAL: { label: 'Normal', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  LOW: { label: 'Bajo', color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Vigente', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  EXPIRED: { label: 'Vencido', color: 'bg-red-100 text-red-700 border-red-200' },
  REVOKED: { label: 'Revocado', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_RENEWAL: { label: 'Renovación', color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const DOC_TYPES = [
  { value: 'certificado_medico', label: 'Certificado Médico' },
  { value: 'licencia_operativa', label: 'Licencia Operativa' },
  { value: 'permiso_ambiental', label: 'Permiso Ambiental' },
  { value: 'capacitacion_seguridad', label: 'Capacitación en Seguridad' },
  { value: 'curso_altura', label: 'Curso Trabajo en Altura' },
  { value: 'curso_electrico', label: 'Curso Riesgo Eléctrico' },
  { value: 'curso_confinado', label: 'Curso Espacio Confinado' },
  { value: 'curso_caliente', label: 'Curso Trabajo en Caliente' },
  { value: 'seguro_rst', label: 'Seguro RST' },
  { value: 'otro', label: 'Otro' },
]

const CATEGORIES = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'EQUIPOS', label: 'Equipos' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'AMBIENTAL', label: 'Ambiental' },
]

export default function DocumentManager() {
  const [documents, setDocuments] = useState<HseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [criticalityFilter, setCriticalityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Add form state
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCriticality, setFormCriticality] = useState('NORMAL')
  const [formIssueDate, setFormIssueDate] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formHolder, setFormHolder] = useState('')
  const [formDescription, setFormDescription] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<HseDocument[]>('/documents')
      setDocuments(data)
    } catch {
      // Fallback data
      const now = new Date()
      setDocuments([
        {
          id: '1', title: 'Certificado Médico - Carlos Mendoza', documentType: 'certificado_medico',
          category: 'PERSONAL', criticality: 'CRITICAL', status: 'EXPIRED',
          issueDate: '2023-01-15', expiryDate: '2024-01-15', holderName: 'Carlos Mendoza',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '2', title: 'Certificado Médico - Ana Rodríguez', documentType: 'certificado_medico',
          category: 'PERSONAL', criticality: 'CRITICAL', status: 'ACTIVE',
          issueDate: '2024-06-01', expiryDate: '2025-06-01', holderName: 'Ana Rodríguez',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '3', title: 'Licencia Operativa - Planta Principal', documentType: 'licencia_operativa',
          category: 'LEGAL', criticality: 'CRITICAL', status: 'ACTIVE',
          issueDate: '2024-01-01', expiryDate: '2025-12-31',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '4', title: 'Curso Trabajo en Altura - Pedro Gómez', documentType: 'curso_altura',
          category: 'PERSONAL', criticality: 'NORMAL', status: 'PENDING_RENEWAL',
          issueDate: '2023-08-15', expiryDate: '2024-08-15', holderName: 'Pedro Gómez',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '5', title: 'Permiso Ambiental - Operaciones 2024', documentType: 'permiso_ambiental',
          category: 'AMBIENTAL', criticality: 'CRITICAL', status: 'ACTIVE',
          issueDate: '2024-01-01', expiryDate: '2025-01-01',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '6', title: 'Seguro RST - Empresa S.A.', documentType: 'seguro_rst',
          category: 'LEGAL', criticality: 'NORMAL', status: 'ACTIVE',
          issueDate: '2024-03-01', expiryDate: '2025-03-01',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '7', title: 'Curso Riesgo Eléctrico - Luis Torres', documentType: 'curso_electrico',
          category: 'PERSONAL', criticality: 'NORMAL', status: 'EXPIRED',
          issueDate: '2022-10-01', expiryDate: '2023-10-01', holderName: 'Luis Torres',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
        {
          id: '8', title: 'Capacitación Primeros Auxilios', documentType: 'capacitacion_seguridad',
          category: 'PERSONAL', criticality: 'LOW', status: 'ACTIVE',
          issueDate: '2024-09-01', expiryDate: '2025-09-01',
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const filtered = documents.filter((doc) => {
    if (categoryFilter !== 'ALL' && doc.category !== categoryFilter) return false
    if (criticalityFilter !== 'ALL' && doc.criticality !== criticalityFilter) return false
    if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.holderName?.toLowerCase().includes(q)) ||
        doc.documentType.toLowerCase().includes(q)
      )
    }
    return true
  })

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  const stats = {
    total: documents.length,
    active: documents.filter((d) => d.status === 'ACTIVE').length,
    expired: documents.filter((d) => d.status === 'EXPIRED').length,
    criticalExpired: documents.filter((d) => d.status === 'EXPIRED' && d.criticality === 'CRITICAL').length,
  }

  const getDaysUntilExpiry = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getExpiryWarning = (doc: HseDocument) => {
    if (doc.status === 'EXPIRED') {
      const days = Math.abs(getDaysUntilExpiry(doc.expiryDate!))
      return { type: 'expired' as const, days }
    }
    if (doc.expiryDate) {
      const days = getDaysUntilExpiry(doc.expiryDate)
      if (days <= 30) {
        return { type: 'expiring' as const, days }
      }
    }
    return null
  }

  const handleAddDocument = async () => {
    if (!formTitle || !formType || !formCategory) return
    setAdding(true)
    try {
      const payload: CreateDocumentRequest = {
        title: formTitle,
        documentType: formType,
        category: formCategory,
        criticality: formCriticality,
        issueDate: formIssueDate || undefined,
        expiryDate: formExpiryDate || undefined,
        holderName: formHolder || undefined,
        description: formDescription || undefined,
      }
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setShowAddDialog(false)
      resetForm()
      loadDocuments()
    } catch (err: any) {
      alert(err.message || 'Error al crear documento')
    } finally {
      setAdding(false)
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormType('')
    setFormCategory('')
    setFormCriticality('NORMAL')
    setFormIssueDate('')
    setFormExpiryDate('')
    setFormHolder('')
    setFormDescription('')
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-[10px] text-slate-500">Total Docs</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <FileCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.active}</p>
                <p className="text-[10px] text-slate-500">Vigentes</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <FileWarning className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.expired}</p>
                <p className="text-[10px] text-slate-500">Vencidos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={cn('shadow-sm border', stats.criticalExpired > 0 ? 'border-red-200' : 'border-slate-200')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stats.criticalExpired > 0 ? 'bg-red-50' : 'bg-slate-50')}>
                <FileX className={cn('w-5 h-5', stats.criticalExpired > 0 ? 'text-red-600' : 'text-slate-400')} />
              </div>
              <div>
                <p className={cn('text-xl font-bold', stats.criticalExpired > 0 ? 'text-red-700' : 'text-slate-800')}>
                  {stats.criticalExpired}
                </p>
                <p className="text-[10px] text-slate-500">Críticos Vencidos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por título, titular o tipo..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                className="h-8 text-xs border rounded-md px-2 bg-white"
              >
                <option value="ALL">Todas Categorías</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={criticalityFilter}
                onChange={(e) => { setCriticalityFilter(e.target.value); setPage(1) }}
                className="h-8 text-xs border rounded-md px-2 bg-white"
              >
                <option value="ALL">Toda Criticidad</option>
                {Object.entries(CRITICALITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="h-8 text-xs border rounded-md px-2 bg-white"
              >
                <option value="ALL">Todo Estado</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </Button>
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
                <TableHead className="text-xs font-semibold text-slate-600">Documento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Titular</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden lg:table-cell">Categoría</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Criticidad</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 hidden sm:table-cell">Vencimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando documentos...
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-slate-400">
                    No se encontraron documentos
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((doc) => {
                  const critCfg = CRITICALITY_CONFIG[doc.criticality] || CRITICALITY_CONFIG.NORMAL
                  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.ACTIVE
                  const warning = getExpiryWarning(doc)
                  return (
                    <TableRow
                      key={doc.id}
                      className={cn(
                        'hover:bg-slate-50 transition-colors',
                        warning?.type === 'expired' && doc.criticality === 'CRITICAL' && 'bg-red-50/50',
                        warning?.type === 'expiring' && 'bg-amber-50/50'
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {warning?.type === 'expired' && doc.criticality === 'CRITICAL' && (
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          {warning?.type === 'expiring' && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-700 max-w-[250px] truncate">
                              {doc.title}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {DOC_TYPES.find((t) => t.value === doc.documentType)?.label || doc.documentType}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 hidden md:table-cell">
                        {doc.holderName || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                          {doc.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px] border', critCfg.color)}>
                          {critCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px] border', statusCfg.color)}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-xs text-slate-600">
                          {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('es') : '—'}
                        </div>
                        {warning && (
                          <Badge
                            className={cn(
                              'text-[10px] mt-0.5',
                              warning.type === 'expired'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'
                            )}
                          >
                            {warning.type === 'expired'
                              ? `${warning.days} días vencido`
                              : `Vence en ${warning.days}d`}
                          </Badge>
                        )}
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
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Document Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Agregar Documento HSE
            </DialogTitle>
            <DialogDescription>Complete los datos del nuevo documento</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Título del Documento *</Label>
                <Input
                  placeholder="Ej: Certificado Médico - Juan Pérez"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Tipo de Documento *</Label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full h-9 text-sm border rounded-md px-3 bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Categoría *</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 text-sm border rounded-md px-3 bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Criticidad</Label>
                  <select
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value)}
                    className="w-full h-9 text-sm border rounded-md px-3 bg-white"
                  >
                    <option value="LOW">Bajo</option>
                    <option value="NORMAL">Normal</option>
                    <option value="CRITICAL">Crítico</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Titular</Label>
                  <Input
                    placeholder="Nombre del titular"
                    value={formHolder}
                    onChange={(e) => setFormHolder(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Fecha de Emisión</Label>
                  <Input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Fecha de Vencimiento</Label>
                  <Input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Descripción</Label>
                <Textarea
                  placeholder="Descripción opcional..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="text-sm min-h-[60px] resize-none"
                />
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddDocument}
              disabled={!formTitle || !formType || !formCategory || adding}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar Documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
