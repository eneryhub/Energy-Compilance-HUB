'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  RefreshCw,
  Clock,
  Ban,
  Loader2,
  Info,
  ExternalLink,
} from 'lucide-react'
import { apiFetch, getToken } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────

interface ApiKeyInfo {
  id: string
  name: string
  keyPrefix: string
  permissions: string
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface JwtInfo {
  token: string
  type: string
  algorithm: string
  issuedAt: string
  expiresAt: string
  userId: string
  companyId: string
  role: string
  warning: string
}

// ── Component ──────────────────────────────────────────────

export default function ApiCredentialsManager() {
  const [activeSection, setActiveSection] = useState<'jwt' | 'apikey'>('jwt')
  const [jwtInfo, setJwtInfo] = useState<JwtInfo | null>(null)
  const [jwtVisible, setJwtVisible] = useState(false)
  const [jwtCopied, setJwtCopied] = useState(false)
  const [jwtLoading, setJwtLoading] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState('90')
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string; prefix: string } | null>(null)
  const [createdKeyCopied, setCreatedKeyCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // ── JWT Functions ────────────────────────────────────────

  const loadJwt = useCallback(async () => {
    setJwtLoading(true)
    try {
      const token = getToken()
      if (!token) {
        setJwtInfo(null)
        return
      }
      const res = await fetch('/api/auth/token', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setJwtInfo(data)
      }
    } catch {
      // ignore
    } finally {
      setJwtLoading(false)
    }
  }, [])

  const copyJwt = async () => {
    if (!jwtInfo) return
    await navigator.clipboard.writeText(jwtInfo.token)
    setJwtCopied(true)
    setTimeout(() => setJwtCopied(false), 2000)
  }

  // ── API Keys Functions ───────────────────────────────────

  const loadKeys = useCallback(async () => {
    setKeysLoading(true)
    try {
      const data = await apiFetch<{ keys: ApiKeyInfo[] }>('/api-keys')
      setApiKeys(data.keys || [])
    } catch {
      setApiKeys([])
    } finally {
      setKeysLoading(false)
    }
  }, [])

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          expiresInDays: parseInt(newKeyExpiry) || 90,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Error al crear la clave')
        return
      }
      const data = await res.json()
      setCreatedKey({ name: data.name, key: data.key, prefix: data.prefix })
      setShowCreateDialog(false)
      setNewKeyName('')
      setNewKeyExpiry('90')
      loadKeys()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la clave'
      alert(message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    if (!confirm('¿Revocar esta clave? Los dispositivos que la usen perderán acceso inmediatamente.')) return
    setRevokingId(id)
    try {
      await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      loadKeys()
    } catch {
      alert('Error al revocar la clave')
    } finally {
      setRevokingId(null)
    }
  }

  const copyCreatedKey = async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey.key)
    setCreatedKeyCopied(true)
    setTimeout(() => setCreatedKeyCopied(false), 2000)
  }

  // ── Load Data ────────────────────────────────────────────

  useEffect(() => {
    loadJwt()
    loadKeys()
  }, [loadJwt, loadKeys])

  // ── Render ───────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  return (
    <div className="space-y-4">
      {/* ── Section Toggle ──────────────────────────────── */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveSection('jwt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeSection === 'jwt'
              ? 'bg-white shadow-sm text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Token JWT
        </button>
        <button
          onClick={() => setActiveSection('apikey')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeSection === 'apikey'
              ? 'bg-white shadow-sm text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Key className="w-4 h-4" />
          API Keys
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0">
            {apiKeys.filter(k => k.isActive).length}
          </Badge>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════
          JWT TOKEN SECTION
          ═══════════════════════════════════════════════════ */}
      {activeSection === 'jwt' && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800 space-y-1">
              <p className="font-semibold">Token JWT (JSON Web Token)</p>
              <p className="text-emerald-700">
                Este token se genera automáticamente al iniciar sesión en la plataforma. 
                Tiene una validez de <strong>30 días</strong>. Para integraciones de sensores, 
                se recomienda usar <button onClick={() => setActiveSection('apikey')} className="underline font-semibold hover:text-emerald-900">API Keys</button> en su lugar.
              </p>
            </div>
          </div>

          {/* JWT Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Tu Token JWT Actual
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadJwt}
                    disabled={jwtLoading}
                    className="text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${jwtLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {jwtLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : jwtInfo ? (
                <>
                  {/* Token Display */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Token (Bearer)</Label>
                    <div className="relative">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
                        <code className="text-xs text-emerald-400 font-mono flex-1 overflow-x-auto whitespace-nowrap">
                          {jwtVisible
                            ? jwtInfo.token
                            : jwtInfo.token.substring(0, 20) + '••••••••••••••••••••••••••••••••••••••••' + jwtInfo.token.substring(jwtInfo.token.length - 10)
                          }
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setJwtVisible(!jwtVisible)}
                          className="h-7 w-7 text-slate-400 hover:text-white shrink-0"
                        >
                          {jwtVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          onClick={copyJwt}
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 flex-1"
                        >
                          {jwtCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar Token Completo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Token Metadata */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Algoritmo</p>
                      <p className="text-sm font-mono font-semibold text-slate-700">{jwtInfo.algorithm}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tipo</p>
                      <p className="text-sm font-mono font-semibold text-slate-700">{jwtInfo.type}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expira</p>
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(jwtInfo.expiresAt)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Empresa ID</p>
                      <p className="text-sm font-mono font-semibold text-slate-700 truncate">{jwtInfo.companyId}</p>
                    </div>
                  </div>

                  {/* How to use it */}
                  <div className="p-4 rounded-lg bg-slate-900 text-white">
                    <p className="text-xs font-semibold text-slate-300 mb-2">Cómo usarlo en tus integraciones:</p>
                    <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto">
{`# En header de cada petición HTTP:
Authorization: Bearer ${jwtInfo.token.substring(0, 30)}...

# Ejemplo con cURL:
curl -H "Authorization: Bearer TU_TOKEN" \\
  https://tu-plataforma.com/api/sensors/telemetry`}
                    </pre>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold">Importante</p>
                      <p>{jwtInfo.warning}</p>
                      <p className="mt-1">
                        Para integraciones de sensores que necesitan acceso permanente, usa{' '}
                        <button onClick={() => setActiveSection('apikey')} className="underline font-semibold">
                          API Keys
                        </button>.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Inicia sesión para ver tu token JWT</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          API KEYS SECTION
          ═══════════════════════════════════════════════════ */}
      {activeSection === 'apikey' && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900 text-white">
            <Key className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-emerald-300">API Keys para Sensores</p>
              <p className="text-slate-400">
                Las API Keys son credenciales estáticas diseñadas para dispositivos IoT, gateways y scripts de integración.
                No expiran con la sesión del usuario y se revocan manualmente.
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Claves API de tu Empresa</h3>
              <p className="text-xs text-slate-500">
                {apiKeys.filter(k => k.isActive).length} activa(s) de 10 máximas
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={apiKeys.filter(k => k.isActive).length >= 10}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva API Key
            </Button>
          </div>

          {/* Created Key Alert (show once) */}
          {createdKey && (
            <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-800">API Key creada: {createdKey.name}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-semibold">
                    GUARDA ESTA CLAVE AHORA — No se mostrará de nuevo
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 overflow-hidden">
                <code className="text-xs text-emerald-400 font-mono break-all">{createdKey.key}</code>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyCreatedKey}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 flex-1"
                >
                  {createdKeyCopied ? (
                    <><Check className="w-3 h-3 text-emerald-600" /> Copiada</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copiar Clave Completa</>
                  )}
                </Button>
                <Button
                  onClick={() => setCreatedKey(null)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-500"
                >
                  Cerrar
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 text-white">
                <p className="text-[10px] font-semibold text-slate-300 mb-1">Uso en HTTP Header:</p>
                <pre className="text-[11px] text-emerald-400 font-mono">
{`X-API-Key: ${createdKey.key}`}
                </pre>
              </div>
            </div>
          )}

          {/* Keys List */}
          {keysLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : apiKeys.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <Key className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No hay API Keys creadas</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Crea tu primera API Key para integrar sensores externos
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Crear API Key
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => {
                const expired = isExpired(key.expiresAt)
                const revoked = !key.isActive

                return (
                  <Card
                    key={key.id}
                    className={`border ${
                      revoked ? 'border-slate-200 opacity-60' :
                      expired ? 'border-amber-300' :
                      'border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-slate-500 shrink-0" />
                            <p className="text-sm font-semibold text-slate-800 truncate">{key.name}</p>
                            {revoked ? (
                              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                <Ban className="w-2.5 h-2.5 mr-0.5" />
                                Revocada
                              </Badge>
                            ) : expired ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                Expirada
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                Activa
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              {key.keyPrefix}
                            </code>
                            <code className="text-[10px] text-slate-400">
                              (solo se almacena el hash — la clave completa nunca se guarda)
                            </code>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Creada: {formatDate(key.createdAt)}
                            </span>
                            {key.lastUsedAt && (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" />
                                Último uso: {formatDate(key.lastUsedAt)}
                              </span>
                            )}
                            {key.expiresAt && (
                              <span className={`flex items-center gap-1 ${expired ? 'text-amber-600' : ''}`}>
                                {expired ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                Expira: {formatDate(key.expiresAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        {key.isActive && !expired && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={revokingId === key.id}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5 shrink-0"
                          >
                            {revokingId === key.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                            Revocar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* How API Keys work */}
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Cómo funcionan las API Keys
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">1</span>
                    <p className="text-xs font-semibold text-slate-700">Creas la clave</p>
                  </div>
                  <p className="text-[10px] text-slate-500">Se genera con prefijo <code className="font-mono bg-slate-100 px-1 rounded">ech_live_</code></p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">2</span>
                    <p className="text-xs font-semibold text-slate-700">La copias y configuras</p>
                  </div>
                  <p className="text-[10px] text-slate-500">En tu gateway, script o dispositivo IoT</p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">3</span>
                    <p className="text-xs font-semibold text-slate-700">Tu dispositivo envía datos</p>
                  </div>
                  <p className="text-[10px] text-slate-500">Via HTTP POST al endpoint de ingest con la key</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          CREATE API KEY DIALOG
          ═══════════════════════════════════════════════════ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" />
              Nueva API Key
            </DialogTitle>
            <DialogDescription>
              Crea una clave para integrar sensores externos. La clave completa solo se mostrará una vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                Nombre / Identificador
              </Label>
              <Input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ej: Gateway Planta Norte, Sensor Gas Zona A"
                className="text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Usa un nombre descriptivo para identificar el dispositivo o ubicación
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                Vigencia
              </Label>
              <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="90">90 días (recomendado)</SelectItem>
                  <SelectItem value="180">6 meses</SelectItem>
                  <SelectItem value="365">1 año</SelectItem>
                  <SelectItem value="0">Sin expiración</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || creating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Generar Clave
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
