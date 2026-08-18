'use client'

import { useState, useEffect, useRef } from 'react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Upload,
  Paperclip,
  Download,
  FileText,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, type HseDocument, type CreateDocumentRequest } from '@/lib/api'
import { uploadDocument, formatFileSize } from '@/lib/upload'

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

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDoc, setEditDoc] = useState<HseDocument | null>(null)

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<HseDocument | null>(null)

  // Add form state
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCriticality, setFormCriticality] = useState('NORMAL')
  const [formIssueDate, setFormIssueDate] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formHolder, setFormHolder] = useState('')
  const [formDescription, setFormDescription] = useState('')

  // File upload state (shared between add and edit)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string
    fileName: string
    fileSize: number
    mimeType: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCriticality, setEditCriticality] = useState('NORMAL')
  const [editIssueDate, setEditIssueDate] = useState('')
  const [editExpiryDate, setEditExpiryDate] = useState('')
  const [editHolder, setEditHolder] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editUploadedFile, setEditUploadedFile] = useState<{
    fileUrl: string
    fileName: string
    fileSize: number
    mimeType: string
  } | null>(null)
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null)
  const [editUploading, setEditUploading] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

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

  // ===== File handling =====

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate size client-side
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB')
      return
    }

    setSelectedFile(file)
    setUploadedFile(null)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadFile = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const result = await uploadDocument(selectedFile)
      setUploadedFile(result)
      setSelectedFile(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir archivo'
      alert(message)
    } finally {
      setUploading(false)
    }
  }

  // Edit file handling
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB')
      return
    }
    setEditSelectedFile(file)
  }

  const handleRemoveEditFile = () => {
    setEditSelectedFile(null)
    setEditUploadedFile(null)
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ''
    }
  }

  const handleUploadEditFile = async () => {
    if (!editSelectedFile) return
    setEditUploading(true)
    try {
      const result = await uploadDocument(editSelectedFile)
      setEditUploadedFile(result)
      setEditSelectedFile(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir archivo'
      alert(message)
    } finally {
      setEditUploading(false)
    }
  }

  // ===== CRUD Handlers =====

  const handleAddDocument = async () => {
    if (!formTitle || !formType || !formCategory) return

    // If a file was selected but not yet uploaded, upload it now
    let fileData = uploadedFile
    if (selectedFile && !uploadedFile) {
      setAdding(true)
      try {
        fileData = await uploadDocument(selectedFile)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al subir archivo'
        alert(message)
        setAdding(false)
        return
      }
    }

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
        ...(fileData ? {
          fileUrl: fileData.fileUrl,
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          mimeType: fileData.mimeType,
        } : {}),
      }
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setShowAddDialog(false)
      resetForm()
      loadDocuments()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear documento'
      alert(message)
    } finally {
      setAdding(false)
    }
  }

  const handleOpenEditDialog = (doc: HseDocument) => {
    setEditDoc(doc)
    setEditTitle(doc.title)
    setEditType(doc.documentType)
    setEditCategory(doc.category)
    setEditCriticality(doc.criticality)
    setEditIssueDate(doc.issueDate?.split('T')[0] || '')
    setEditExpiryDate(doc.expiryDate?.split('T')[0] || '')
    setEditHolder(doc.holderName || '')
    setEditDescription(doc.description || '')
    if (doc.fileUrl) {
      setEditUploadedFile({
        fileUrl: doc.fileUrl,
        fileName: doc.fileName || 'archivo',
        fileSize: doc.fileSize || 0,
        mimeType: doc.mimeType || 'application/octet-stream',
      })
    } else {
      setEditUploadedFile(null)
    }
    setEditSelectedFile(null)
    setEditUploading(false)
    setShowEditDialog(true)
  }

  const handleEditDocument = async () => {
    if (!editDoc || !editTitle || !editType || !editCategory) return

    // If a file was selected but not yet uploaded, upload it now
    let fileData = editUploadedFile
    if (editSelectedFile && !editUploadedFile) {
      setEditing(true)
      try {
        fileData = await uploadDocument(editSelectedFile)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al subir archivo'
        alert(message)
        setEditing(false)
        return
      }
    }

    setEditing(true)
    try {
      const updatePayload: Record<string, unknown> = {
        title: editTitle,
        documentType: editType,
        category: editCategory,
        criticality: editCriticality,
        issueDate: editIssueDate || null,
        expiryDate: editExpiryDate || null,
        holderName: editHolder || null,
        description: editDescription || null,
      }

      if (fileData) {
        updatePayload.fileUrl = fileData.fileUrl
        updatePayload.fileName = fileData.fileName
        updatePayload.fileSize = fileData.fileSize
        updatePayload.mimeType = fileData.mimeType
      }

      await apiFetch(`/documents/${editDoc.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      })
      setShowEditDialog(false)
      loadDocuments()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al editar documento'
      alert(message)
    } finally {
      setEditing(false)
    }
  }

  const handleConfirmDelete = (doc: HseDocument) => {
    setDeleteDoc(doc)
    setShowDeleteDialog(true)
  }

  const handleDeleteDocument = async () => {
    if (!deleteDoc) return
    setDeleting(true)
    try {
      await apiFetch(`/documents/${deleteDoc.id}`, { method: 'DELETE' })
      setShowDeleteDialog(false)
      setDeleteDoc(null)
      loadDocuments()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar documento'
      alert(message)
    } finally {
      setDeleting(false)
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
    setSelectedFile(null)
    setUploadedFile(null)
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return <FileText className="w-4 h-4" />
    if (mimeType.startsWith('image/')) return <FileText className="w-4 h-4 text-blue-500" />
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-4 h-4 text-blue-600" />
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="w-4 h-4 text-emerald-600" />
    return <FileText className="w-4 h-4" />
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Documento</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Titular</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 hidden lg:table-cell">Categoría</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Criticidad</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 hidden sm:table-cell">Vencimiento</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Archivo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Cargando documentos...
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-sm text-slate-400">
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
                              <p className="text-sm font-medium text-slate-700 max-w-[200px] lg:max-w-[250px] truncate">
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
                        <TableCell>
                          {doc.fileUrl ? (
                            <div className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-slate-600 truncate max-w-[100px]" title={doc.fileName || ''}>
                                  {doc.fileName || 'archivo'}
                                </span>
                                {doc.fileSize != null && (
                                  <span className="text-[9px] text-slate-400">
                                    {formatFileSize(doc.fileSize)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            {doc.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => window.open(doc.fileUrl!, '_blank')}
                                title="Descargar archivo"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                              onClick={() => handleOpenEditDialog(doc)}
                              title="Editar documento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleConfirmDelete(doc)}
                              title="Eliminar documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
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

      {/* ===== Add Document Dialog ===== */}
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

              <Separator />

              {/* File Upload Section */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Adjuntar Archivo
                </Label>
                <p className="text-[10px] text-slate-400">
                  PDF, imágenes (JPG, PNG), Word, Excel — Máximo 10 MB
                </p>

                {uploadedFile ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    {getFileIcon(uploadedFile.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{uploadedFile.fileName}</p>
                      <p className="text-[10px] text-slate-500">{formatFileSize(uploadedFile.fileSize)}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    {getFileIcon(selectedFile.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleUploadFile}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {uploading ? 'Subiendo...' : 'Subir'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-500">Haga clic para seleccionar un archivo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">o arrastre y suelte</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelect}
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
              disabled={!formTitle || !formType || !formCategory || adding || uploading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar Documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Document Dialog ===== */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" />
              Editar Documento
            </DialogTitle>
            <DialogDescription>Modifique los datos del documento</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Título del Documento *</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Tipo de Documento *</Label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
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
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
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
                    value={editCriticality}
                    onChange={(e) => setEditCriticality(e.target.value)}
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
                    value={editHolder}
                    onChange={(e) => setEditHolder(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Fecha de Emisión</Label>
                  <Input
                    type="date"
                    value={editIssueDate}
                    onChange={(e) => setEditIssueDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Fecha de Vencimiento</Label>
                  <Input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Descripción</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-sm min-h-[60px] resize-none"
                />
              </div>

              <Separator />

              {/* File Upload Section (Edit) */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Archivo Adjunto
                </Label>
                <p className="text-[10px] text-slate-400">
                  Suba un archivo nuevo para reemplazar el existente
                </p>

                {editUploadedFile ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    {getFileIcon(editUploadedFile.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{editUploadedFile.fileName}</p>
                      <p className="text-[10px] text-slate-500">{formatFileSize(editUploadedFile.fileSize)}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={handleRemoveEditFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : editSelectedFile ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    {getFileIcon(editSelectedFile.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{editSelectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{formatFileSize(editSelectedFile.size)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleUploadEditFile}
                      disabled={editUploading}
                    >
                      {editUploading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {editUploading ? 'Subiendo...' : 'Subir'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={handleRemoveEditFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-500">Haga clic para reemplazar el archivo</p>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleEditFileSelect}
                />
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditDocument}
              disabled={!editTitle || !editType || !editCategory || editing || editUploading}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteDoc(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Eliminar Documento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  ¿Está seguro de que desea eliminar este documento?
                </p>
                {deleteDoc && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">{deleteDoc.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {DOC_TYPES.find((t) => t.value === deleteDoc.documentType)?.label || deleteDoc.documentType}
                      {deleteDoc.holderName ? ` — ${deleteDoc.holderName}` : ''}
                    </p>
                    {deleteDoc.fileUrl && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        También se eliminará el archivo adjunto: {deleteDoc.fileName}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-red-600 font-medium">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
