'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Shield, Mail, Lock, Loader2, Building2 } from 'lucide-react'
import { apiFetch, setToken, setUser } from '@/lib/api'
import type { LoginResponse } from '@/lib/api'

interface LoginFormProps {
  onLogin: (user: LoginResponse['user']) => void
  onSwitchToRegister: () => void
}

export default function LoginForm({ onLogin, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(data.token)
      setUser(data.user)
      onLogin(data.user)
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Energy-Compliance Hub</h1>
          <p className="text-slate-400 mt-1">Plataforma de gestión HSE y permisos de trabajo</p>
        </div>

        <Card className="shadow-2xl border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Iniciar Sesión</CardTitle>
            <CardDescription className="text-slate-400">
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={onSwitchToRegister}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                ¿No tiene cuenta? Regístrese aquí
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Building2 className="w-3.5 h-3.5" />
                <span>Demo: admin@energy.com / admin123</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

interface RegisterFormProps {
  onRegister: () => void
  onSwitchToLogin: () => void
}

export function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, companyName }),
      })
      onRegister()
    } catch (err: any) {
      setError(err.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Energy-Compliance Hub</h1>
          <p className="text-slate-400 mt-1">Crear una nueva cuenta</p>
        </div>

        <Card className="shadow-2xl border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Registro</CardTitle>
            <CardDescription className="text-slate-400">
              Complete los datos para crear su cuenta de empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reg-name" className="text-slate-300">Nombre completo</Label>
                <Input
                  id="reg-name"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-company" className="text-slate-300">Nombre de la empresa</Label>
                <Input
                  id="reg-company"
                  placeholder="Mi Empresa S.A."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-slate-300">Correo electrónico</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-slate-300">Contraseña</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={onSwitchToLogin}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                ¿Ya tiene cuenta? Inicie sesión
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
