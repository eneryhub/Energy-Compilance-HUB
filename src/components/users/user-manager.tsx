'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Shield,
  Eye,
  HardHat,
  ClipboardCheck,
  Loader2,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Filter,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { apiFetch } from '@/lib/api'
import { getUser } from '@/lib/api'
import { toast } from 'sonner'

// ============ Types ============

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt?: string | null
  avatarUrl?: string | null
  phone?: string | null
  createdAt: string
  updatedAt?: string
  _count?: {
    permitsCreated?: number
    permitsApproved?: number
    permitsRejected?: number
    documents?: number
  }
}

interface UsersResponse {
  users: UserItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface SubscriptionLimits {
  users: { current: number; max: number; percent: number }
}

const ROLES = [
  { value: 'ADMIN', label: 'Administrador', icon: Shield, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'SUPERVISOR', label: 'Supervisor', icon: ClipboardCheck, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'MANAGER', label: 'Gerente', icon: Eye, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'TECHNICIAN', label: 'Técnico', icon: HardHat, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'VIEWER', label: 'Observador', icon: Eye, color: 'bg-purple-100 text-purple-700 border-purple-200' },
]

const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.value, r]))

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleBadge(role: string) {
  const r = ROLE_MAP[role]
  if (!r) return <Badge variant="outline">{role}</Badge>
  const Icon = r.icon
  return (
    <Badge className={`${r.color} border gap-1 text-[11px]`}>
      <Icon className="w-3 h-3" />
      {r.label}
    </Badge>
  )
}

function getRoleIcon(role: string) {
  const r = ROLE_MAP[role]
  return r ? r.icon : Users
}

// ============ Create/Edit Form Dialog ============

interface FormData {
  name: string
  email: string
  role: string
  phone: string
  password: string
  confirmPassword: string
}

function UserFormDialog({
  open,
  onClose,
  editingUser,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editingUser: UserItem | null
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    role: 'TECHNICIAN',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [showSalesModal, setShowSalesModal] = useState(false)

  const isEditing = !!editingUser

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
          phone: editingUser.phone || '',
          password: '',
          confirmPassword: '',
        })
      } else {
        setForm({ name: '', email: '', role: 'TECHNICIAN', phone: '', password: '', confirmPassword: '' })
      }
      setError('')
      setSaving(false)
    }
  }, [open, editingUser])

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSubmit = async () => {
    // Validation
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido')
      return
    }
    if (!isEditing && !form.password) {
      setError('La contraseña es requerida para nuevos usuarios')
      return
    }
    if (form.password && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          phone: form.phone.trim() || null,
        }
        if (form.password) body.password = form.password
        await apiFetch(`/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(body) })
        toast.success('Usuario actualizado correctamente')
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            phone: form.phone.trim() || null,
            password: form.password,
          }),
        })
        toast.success('Usuario creado correctamente')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error del servidor'
      if (message.includes('SUBSCRIPTION_LIMIT_ENTERPRISE')) {
        setShowSalesModal(true)
      } else if (message.includes('SUBSCRIPTION_LIMIT')) {
        setError('Límite de usuarios alcanzado. Actualiza tu plan de suscripción.')
      } else if (message.includes('ya existe')) {
        setError('Ya existe un usuario con este email en la empresa.')
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Pencil className="w-5 h-5 text-emerald-600" /> : <UserPlus className="w-5 h-5 text-emerald-600" />}
            {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Editando datos de ${editingUser?.name}`
              : 'Agrega un nuevo miembro a tu equipo de trabajo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="Ej: juan@empresa.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select value={form.role} onValueChange={(v) => updateField('role', v)} disabled={saving}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => {
                  const Icon = r.icon
                  return (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {r.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ej: +54 11 1234-5678"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Contraseña {isEditing ? '(dejar vacío para no cambiar)' : '*'}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={isEditing ? 'Nueva contraseña' : 'Mínimo 6 caracteres'}
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              disabled={saving}
            />
          </div>

          {form.password && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repetir contraseña"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                disabled={saving}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ===== Enterprise Sales Contact Modal ===== */}
    <Dialog open={showSalesModal} onOpenChange={setShowSalesModal}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Límite de Plan Alcanzado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm font-semibold text-amber-800">
              Límite de plan alcanzado (500/500)
            </p>
            <p className="text-sm text-amber-700 mt-2">
              Para ampliar su capacidad de usuarios, contacte con nuestro equipo de ventas en:
            </p>
            <a
              href="mailto:ventas@energycompliancehub.com"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-amber-800 hover:text-amber-900 underline"
            >
              <Mail className="w-4 h-4" />
              ventas@energycompliancehub.com
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Nuestro equipo comercial le ayudará a encontrar la solución que mejor se adapte a las necesidades de su organización.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={() => setShowSalesModal(false)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ============ Main UserManager Component ============

export default function UserManager() {
  const currentUser = getUser()

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Toggle active
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (searchTerm) params.set('search', searchTerm)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('active', statusFilter)

      const data = await apiFetch<UsersResponse>(`/users?${params.toString()}`)
      setUsers(data.users)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      console.error('Error fetching users:', err)
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, roleFilter, statusFilter])

  const fetchLimits = useCallback(async () => {
    try {
      const data = await apiFetch<{ limits: SubscriptionLimits }>('/subscription')
      setLimits(data.limits)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchLimits() }, [fetchLimits])

  const handleToggleActive = async (user: UserItem) => {
    setTogglingId(user.id)
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario reactivado')
      fetchUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      toast.error(message)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Usuario eliminado correctamente')
      setDeleteTarget(null)
      fetchUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const hasActiveFilters = searchTerm || roleFilter !== 'all' || statusFilter !== 'all'

  const isSelf = (user: UserItem) => currentUser?.id === user.id

  // Stats
  const totalActive = users.filter((u) => u.isActive).length
  const admins = users.filter((u) => u.role === 'ADMIN' && u.isActive).length
  const supervisors = users.filter((u) => u.role === 'SUPERVISOR' && u.isActive).length
  const technicians = users.filter((u) => u.role === 'TECHNICIAN' && u.isActive).length

  if (loading && users.length === 0) {
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
            <Users className="w-5 h-5 text-emerald-600" />
            Gestión de Usuarios
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Administra el personal de tu empresa
          </p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{totalActive}</p>
              <p className="text-[10px] text-slate-500">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{admins}</p>
              <p className="text-[10px] text-slate-500">Admins</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{supervisors}</p>
              <p className="text-[10px] text-slate-500">Supervisores</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <HardHat className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{technicians}</p>
              <p className="text-[10px] text-slate-500">Técnicos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Usage Limit Warning */}
      {limits && limits.users.percent >= 90 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {limits.users.percent >= 100
              ? `Límite alcanzado: ${limits.users.current}/${limits.users.max} usuarios. No puedes crear más usuarios.`
              : `Casi al límite: ${limits.users.current}/${limits.users.max} usuarios. Considera actualizar tu plan.`}
          </span>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="w-4 h-4 mr-1 text-slate-400" />
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-slate-500">
                <XCircle className="w-4 h-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Personal ({limits ? `${limits.users.current}/${limits.users.max}` : users.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No se encontraron usuarios</p>
              <p className="text-xs mt-1">
                {hasActiveFilters ? 'Intenta con otros filtros' : 'Crea el primer usuario para comenzar'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {users.map((user) => {
                const RoleIcon = getRoleIcon(user.role)
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      user.isActive
                        ? 'bg-white hover:bg-slate-50 border-slate-100'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 opacity-70'
                    }`}
                  >
                    {/* Avatar */}
                    <Avatar className={`w-10 h-10 shrink-0 ${user.isActive ? 'bg-emerald-600' : 'bg-slate-400'}`}>
                      <AvatarFallback className="text-white text-xs font-bold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${user.isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                          {user.name}
                        </p>
                        {getRoleBadge(user.role)}
                        {isSelf(user) && (
                          <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px]">Tú</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1 hidden sm:flex">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Calendar className="w-3 h-3" />
                          {new Date(user.createdAt).toLocaleDateString('es')}
                        </span>
                      </div>
                    </div>

                    {/* Activity */}
                    <div className="hidden md:flex flex-col items-end gap-1 text-[10px] text-slate-400 shrink-0">
                      {user._count && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          {user._count.permitsCreated || 0} permisos
                        </span>
                      )}
                      {user.lastLoginAt && (
                        <span>
                          Último acceso: {new Date(user.lastLoginAt).toLocaleDateString('es')}
                        </span>
                      )}
                    </div>

                    {/* Status indicator */}
                    <div className={`shrink-0 ${togglingId === user.id ? 'opacity-50' : ''}`}>
                      {togglingId === user.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      ) : (
                        <div className={`w-2.5 h-2.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      )}
                    </div>

                    {/* Actions */}
                    {!isSelf(user) && currentUser?.role === 'ADMIN' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                            {user.isActive ? (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <Unlock className="w-4 h-4 mr-2" />
                                Reactivar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(user)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 text-xs"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <UserFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        editingUser={null}
        onSaved={() => { fetchUsers(); fetchLimits() }}
      />

      {/* Edit Dialog */}
      <UserFormDialog
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        editingUser={editingUser}
        onSaved={() => { fetchUsers(); setEditingUser(null) }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Usuario
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{deleteTarget?.name}</strong>? 
              El usuario será desactivado y no podrá acceder al sistema. Los permisos y documentos 
              asociados se conservarán en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sí, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
