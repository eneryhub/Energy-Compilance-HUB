'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  Zap,
  ArrowUp,
  Box,
  Flame,
  Hexagon,
  Search,
  GripVertical,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  Palette,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api'

interface RiskType {
  id: string
  key: string
  label: string
  color: string
  description?: string | null
  icon: string
  isActive: boolean
  sortOrder: number
  checklist?: ChecklistItem[]
}

interface ChecklistItem {
  id: string
  itemKey: string
  label: string
  required: boolean
  sortOrder: number
  isActive: boolean
}

const ICON_OPTIONS = [
  { value: 'AlertTriangle', label: 'Alerta', icon: AlertTriangle },
  { value: 'Zap', label: 'Eléctrico', icon: Zap },
  { value: 'ArrowUp', label: 'Altura', icon: ArrowUp },
  { value: 'Flame', label: 'Caliente', icon: Flame },
  { value: 'Box', label: 'Confinado', icon: Box },
  { value: 'Hexagon', label: 'Químico', icon: Hexagon },
  { value: 'ShieldAlert', label: 'Radiación', icon: ShieldAlert },
]

const COLOR_PRESETS = [
  '#ef4444', '#f59e0b', '#f97316', '#8b5cf6',
  '#dc2626', '#059669', '#0891b2', '#6366f1',
  '#ec4899', '#14b8a6', '#84cc16', '#78716c',
]

export default function RiskTypeManager() {
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)

  // Form state
  const [editForm, setEditForm] = useState<Partial<RiskType>>({})
  const [createForm, setCreateForm] = useState({ key: '', label: '', color: '#ef4444', description: '', icon: 'AlertTriangle' })
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemRequired, setNewItemRequired] = useState(false)

  // Processing
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)

  const fetchRiskTypes = useCallback(async () => {
    try {
      const res = await apiFetch<{ riskTypes: RiskType[] }>('/risk-types?withChecklist=true')
      setRiskTypes(res.riskTypes || [])
    } catch (err) {
      console.error('Error fetching risk types:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRiskTypes() }, [fetchRiskTypes])

  const filtered = riskTypes.filter(
    (rt) =>
      rt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rt.key.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreate = async () => {
    if (!createForm.key.trim() || !createForm.label.trim()) return
    setSaving(true)
    try {
      await apiFetch('/risk-types', {
        method: 'POST',
        body: JSON.stringify({
          key: createForm.key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          label: createForm.label,
          color: createForm.color,
          description: createForm.description || undefined,
          icon: createForm.icon,
        }),
      })
      setShowCreateDialog(false)
      setCreateForm({ key: '', label: '', color: '#ef4444', description: '', icon: 'AlertTriangle' })
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editForm.id) return
    setSaving(true)
    try {
      await apiFetch(`/risk-types/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: editForm.label,
          color: editForm.color,
          description: editForm.description,
          icon: editForm.icon,
          isActive: editForm.isActive,
        }),
      })
      setShowEditDialog(false)
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editForm.id) return
    setDeleting(true)
    try {
      await apiFetch(`/risk-types/${editForm.id}`, { method: 'DELETE' })
      setShowDeleteDialog(false)
      setExpandedId(null)
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemLabel.trim() || !expandedId) return
    setAddingItem(true)
    try {
      await apiFetch(`/risk-types/${expandedId}/items`, {
        method: 'POST',
        body: JSON.stringify({ label: newItemLabel, required: newItemRequired }),
      })
      setNewItemLabel('')
      setNewItemRequired(false)
      setShowAddItemDialog(false)
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAddingItem(false)
    }
  }

  const handleToggleItem = async (riskTypeId: string, itemKey: string, newRequired: boolean) => {
    setTogglingItem(itemKey)
    try {
      // Find the item's id first
      const rt = riskTypes.find((r) => r.id === riskTypeId)
      const item = rt?.checklist?.find((c) => c.itemKey === itemKey)
      if (!item) return
      // Use the items API to toggle required
      await apiFetch(`/risk-types/${riskTypeId}/items`, {
        method: 'POST',
        body: JSON.stringify({ label: item.label, required: newRequired, itemKey: item.itemKey, sortOrder: item.sortOrder }),
      })
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setTogglingItem(null)
    }
  }

  const handleDeleteItem = async (riskTypeId: string, itemKey: string) => {
    setDeletingItem(itemKey)
    try {
      await apiFetch(`/risk-types/${riskTypeId}/items?itemKey=${itemKey}`, { method: 'DELETE' })
      await fetchRiskTypes()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeletingItem(null)
    }
  }

  const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find((o) => o.value === iconName)
    return found ? found.icon : AlertTriangle
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Tipos de Riesgo
          </h2>
          <p className="text-sm text-slate-500 mt-1">Configura los tipos de riesgo y listas de verificación de seguridad</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-4 h-4" />
          Nuevo Tipo de Riesgo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{riskTypes.length}</p>
              <p className="text-[11px] text-slate-500">Tipos de riesgo</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {riskTypes.reduce((sum, rt) => sum + (rt.checklist?.length || 0), 0)}
              </p>
              <p className="text-[11px] text-slate-500">Campos de verificación</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {riskTypes.reduce((sum, rt) => sum + (rt.checklist?.filter((c) => c.required).length || 0), 0)}
              </p>
              <p className="text-[11px] text-slate-500">Campos obligatorios</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Hexagon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {riskTypes.filter((rt) => rt.isActive).length}
              </p>
              <p className="text-[11px] text-slate-500">Activos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar tipo de riesgo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Risk Types List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No se encontraron tipos de riesgo</p>
            <p className="text-xs mt-1">Crea uno nuevo para comenzar</p>
          </div>
        ) : (
          filtered.map((rt) => {
            const isExpanded = expandedId === rt.id
            const IconComp = getIconComponent(rt.icon)
            return (
              <Card key={rt.id} className={`overflow-hidden transition-all ${!rt.isActive ? 'opacity-60' : ''}`}>
                {/* Risk Type Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : rt.id)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: rt.color + '20' }}>
                    <IconComp className="w-5 h-5" style={{ color: rt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{rt.label}</span>
                      <Badge className="text-[10px] px-1.5 py-0 font-mono" variant="outline">{rt.key}</Badge>
                      {!rt.isActive && (
                        <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px]">Inactivo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {rt.checklist?.length || 0} campos de verificación
                      {rt.description ? ` · ${rt.description}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rt.color }} />
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="p-4 space-y-3">
                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <CheckSquare className="w-4 h-4" />
                          Lista de Verificación de Seguridad
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); setEditForm(rt); setShowEditDialog(true) }}
                          >
                            <Edit3 className="w-3 h-3" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); setEditForm(rt); setShowDeleteDialog(true) }}
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </Button>
                        </div>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-1.5">
                        {rt.checklist && rt.checklist.length > 0 ? (
                          rt.checklist
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: item.required ? '#ef4444' : '#94a3b8' }}
                                  />
                                  <span className="text-sm text-slate-700">{item.label}</span>
                                  {item.required && (
                                    <Badge className="bg-red-100 text-red-600 border-0 text-[10px] px-1.5 py-0">
                                      Obligatorio
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                                    title={item.required ? 'Marcar opcional' : 'Marcar obligatorio'}
                                    onClick={() => handleToggleItem(rt.id, item.itemKey, !item.required)}
                                    disabled={togglingItem === item.itemKey}
                                  >
                                    {togglingItem === item.itemKey ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                    ) : item.required ? (
                                      <ToggleRight className="w-4 h-4 text-red-500" />
                                    ) : (
                                      <ToggleLeft className="w-4 h-4 text-slate-300" />
                                    )}
                                  </button>
                                  <button
                                    className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                    title="Eliminar campo"
                                    onClick={() => handleDeleteItem(rt.id, item.itemKey)}
                                    disabled={deletingItem === item.itemKey}
                                  >
                                    {deletingItem === item.itemKey ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="text-center py-6 text-slate-400 text-sm">
                            No hay campos de verificación. Agrega uno para comenzar.
                          </div>
                        )}
                      </div>

                      {/* Add Item Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 border-dashed text-emerald-600 hover:bg-emerald-50"
                        onClick={() => setShowAddItemDialog(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Campo de Verificación
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Create Risk Type Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Nuevo Tipo de Riesgo
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo tipo de riesgo con su lista de verificación personalizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Clave</Label>
                <Input
                  placeholder="Ej: EXCAVACION"
                  value={createForm.key}
                  onChange={(e) => setCreateForm({ ...createForm, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-slate-400">Identificador único (mayúsculas, sin espacios)</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nombre</Label>
                <Input
                  placeholder="Ej: Trabajo en Excavación"
                  value={createForm.label}
                  onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Descripción (opcional)</Label>
              <Input
                placeholder="Descripción del tipo de riesgo"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCreateForm({ ...createForm, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${createForm.color === color ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Icono</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Ic = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setCreateForm({ ...createForm, icon: opt.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        createForm.icon === opt.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <Ic className="w-4 h-4" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleCreate}
              disabled={saving || !createForm.key.trim() || !createForm.label.trim()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear Tipo de Riesgo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Risk Type Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              Editar Tipo de Riesgo
            </DialogTitle>
            <DialogDescription className="sr-only">
              Modifica los datos del tipo de riesgo seleccionado, incluyendo nombre, color, icono y estado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Clave</Label>
              <Input value={editForm.key || ''} disabled className="font-mono text-sm bg-slate-100" />
              <p className="text-[10px] text-slate-400">La clave no se puede modificar</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Nombre</Label>
              <Input
                value={editForm.label || ''}
                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Descripción</Label>
              <Input
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descripción del tipo de riesgo"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditForm({ ...editForm, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${editForm.color === color ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Icono</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Ic = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, icon: opt.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        editForm.icon === opt.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <Ic className="w-4 h-4" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <Label className="text-sm">Estado activo</Label>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar Tipo de Riesgo
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{editForm.label}</strong>? Se eliminarán todos los campos de verificación asociados.
              No se puede eliminar si hay permisos que usan este tipo de riesgo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sí, Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Checklist Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Agregar Campo de Verificación
            </DialogTitle>
            <DialogDescription>
              Nuevo campo para la lista de seguridad del tipo de riesgo seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Texto del campo</Label>
              <Input
                placeholder="Ej: Extintor disponible en el área"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <Label className="text-sm">Campo obligatorio</Label>
                <p className="text-[10px] text-slate-400">Si está activado, el permiso no se puede enviar sin marcar este campo</p>
              </div>
              <Switch checked={newItemRequired} onCheckedChange={setNewItemRequired} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleAddItem}
              disabled={addingItem || !newItemLabel.trim()}
            >
              {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
