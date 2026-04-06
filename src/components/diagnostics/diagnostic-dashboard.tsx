'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Activity,
  Shield,
  Database,
  Server,
  FileText,
  CreditCard,
  Lock,
  BarChart3,
  Cpu,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────

interface TestResult {
  id: string
  category: string
  name: string
  status: 'pass' | 'warn' | 'fail' | 'skip'
  duration: number
  message: string
  details?: string
  suggestion?: string
  timestamp: string
}

interface SystemInfo {
  nodeVersion: string
  runtime: string
  platform: string
  databaseProvider: string
  projectRoot: string
  envKeys: string[]
}

interface DiagnosticReport {
  runId: string
  startedAt: string
  completedAt: string
  totalDuration: number
  summary: {
    total: number
    pass: number
    warn: number
    fail: number
    skip: number
  }
  tests: TestResult[]
  systemInfo: SystemInfo
}

type FilterType = 'all' | 'fail' | 'warn' | 'pass' | 'skip'

// ── Category Icons ─────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Base de Datos': Database,
  'Autenticacion': Lock,
  'API Endpoints': Server,
  SCADA: Activity,
  'Cumplimiento HSE': Shield,
  'Suscripcion': CreditCard,
  Entorno: Cpu,
  Seguridad: Shield,
  Estadisticas: BarChart3,
}

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  return CATEGORY_ICONS[category] || Activity
}

// ── Component ──────────────────────────────────────────────

export default function DiagnosticDashboard() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    setLoading(true)
    setFilter('all')
    try {
      const data = await apiFetch<DiagnosticReport>('/diagnostics')
      setReport(data)

      // Auto-expand categories that have failures
      const categoriesWithFailures = new Set<string>()
      for (const test of data.tests) {
        if (test.status === 'fail' && test.suggestion) {
          categoriesWithFailures.add(test.category)
        }
      }
      setExpandedCategories(categoriesWithFailures)
    } catch {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }, [])

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Toggle test expansion (for suggestion)
  const toggleTest = (testId: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
  }

  // Filter tests
  const filteredTests = report?.tests.filter((test) => {
    if (filter === 'all') return true
    return test.status === filter
  }) ?? []

  // Group tests by category
  const categories = report
    ? Array.from(new Set(filteredTests.map((t) => t.category)))
    : []

  const categoryStats = report
    ? categories.map((cat) => {
        const tests = report.tests.filter((t) => t.category === cat)
        return {
          name: cat,
          pass: tests.filter((t) => t.status === 'pass').length,
          warn: tests.filter((t) => t.status === 'warn').length,
          fail: tests.filter((t) => t.status === 'fail').length,
          skip: tests.filter((t) => t.status === 'skip').length,
          total: tests.length,
        }
      })
    : []

  // Health score
  const healthScore = report
    ? Math.round(
        ((report.summary.pass + report.summary.skip * 0.5) /
          Math.max(report.summary.total, 1)) *
          100
      )
    : 0

  const healthColor =
    healthScore >= 90 ? 'text-emerald-600' : healthScore >= 70 ? 'text-amber-600' : 'text-red-600'

  const healthBg =
    healthScore >= 90
      ? 'bg-emerald-50 border-emerald-200'
      : healthScore >= 70
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200'

  const healthBarColor =
    healthScore >= 90 ? 'bg-emerald-500' : healthScore >= 70 ? 'bg-amber-500' : 'bg-red-500'

  // Suggestions list
  const suggestions = report?.tests.filter((t) => t.suggestion) ?? []

  // Export report as .txt
  const exportReport = () => {
    if (!report) return
    const lines: string[] = []
    lines.push('═══════════════════════════════════════════════════')
    lines.push('  Energy-Compliance Hub — Informe de Diagnostico')
    lines.push('═══════════════════════════════════════════════════')
    lines.push('')
    lines.push(`ID de ejecucion: ${report.runId}`)
    lines.push(`Fecha: ${new Date(report.startedAt).toLocaleString('es')}`)
    lines.push(`Duracion total: ${report.totalDuration}ms`)
    lines.push('')
    lines.push('── Informacion del Sistema ──────────────────────')
    lines.push(`Runtime: ${report.systemInfo.runtime}`)
    lines.push(`Node.js: ${report.systemInfo.nodeVersion}`)
    lines.push(`Plataforma: ${report.systemInfo.platform}`)
    lines.push(`Base de datos: ${report.systemInfo.databaseProvider}`)
    lines.push('')
    lines.push('── Resumen ──────────────────────────────────────')
    lines.push(`Total: ${report.summary.total} | OK: ${report.summary.pass} | Advertencias: ${report.summary.warn} | Fallos: ${report.summary.fail} | Omitidos: ${report.summary.skip}`)
    lines.push(`Puntuacion de salud: ${healthScore}%`)
    lines.push('')
    lines.push('── Resultados por Categoria ─────────────────────')
    lines.push('')

    const grouped = new Map<string, TestResult[]>()
    for (const test of report.tests) {
      const list = grouped.get(test.category) ?? []
      list.push(test)
      grouped.set(test.category, list)
    }

    for (const [category, tests] of grouped) {
      lines.push(`[${category}]`)
      for (const test of tests) {
        const icon = test.status === 'pass' ? 'OK' : test.status === 'warn' ? '!!' : test.status === 'fail' ? 'XX' : '--'
        lines.push(`  [${icon}] ${test.name}: ${test.message} (${test.duration}ms)`)
        if (test.suggestion) {
          lines.push(`       -> Sugerencia: ${test.suggestion}`)
        }
      }
      lines.push('')
    }

    if (suggestions.length > 0) {
      lines.push('── Sugerencias y Correcciones ──────────────────')
      lines.push('')
      for (const s of suggestions) {
        lines.push(`* [${s.category}] ${s.name}`)
        lines.push(`  ${s.suggestion}`)
        lines.push('')
      }
    }

    lines.push('═══════════════════════════════════════════════════')
    lines.push(`  Generado: ${new Date().toLocaleString('es')}`)
    lines.push('═══════════════════════════════════════════════════')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagnostico-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Status icon ──────────────────────────────────────────

  const StatusIcon = ({ status }: { status: TestResult['status'] }) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      case 'skip':
        return <span className="w-4 h-4 text-slate-400 shrink-0 text-[10px] font-bold">—</span>
    }
  }

  const StatusBadge = ({ status }: { status: TestResult['status'] }) => {
    const styles = {
      pass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      warn: 'bg-amber-100 text-amber-700 border-amber-200',
      fail: 'bg-red-100 text-red-700 border-red-200',
      skip: 'bg-slate-100 text-slate-500 border-slate-200',
    }
    const labels = {
      pass: 'OK',
      warn: 'WARN',
      fail: 'FAIL',
      skip: 'SKIP',
    }
    return (
      <Badge className={cn('text-[9px] px-1.5 py-0 border', styles[status])}>
        {labels[status]}
      </Badge>
    )
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900">
            <Stethoscope className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Diagnostico del Sistema</h2>
            <p className="text-xs text-slate-500">
              Verifica el estado de todos los modulos de la plataforma
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportReport}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar TXT
            </Button>
          )}
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {report ? 'Re-ejecutar' : 'Ejecutar Diagnostico'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!report && !loading && (
        <Card className="border-slate-200">
          <CardContent className="py-16 text-center">
            <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Diagnostico no ejecutado</p>
            <p className="text-xs text-slate-400 mt-1">
              Haga clic en &quot;Ejecutar Diagnostico&quot; para analizar el estado del sistema
            </p>
            <Button
              onClick={runDiagnostics}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Activity className="w-4 h-4" />
              Ejecutar Ahora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !report && (
        <Card className="border-slate-200">
          <CardContent className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Ejecutando diagnosticos...</p>
            <p className="text-xs text-slate-400 mt-1">
              Analizando base de datos, APIs, seguridad y mas
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {report && (
        <>
          {/* ── Health Score + Summary Cards ───────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Health Score */}
            <Card className={cn('border-2 col-span-1 sm:col-span-2 lg:col-span-1', healthBg)}>
              <CardContent className="p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Puntuacion de Salud
                </p>
                <p className={cn('text-4xl font-bold', healthColor)}>{healthScore}%</p>
                <div className="mt-2 h-2 rounded-full bg-white/60 overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', healthBarColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${healthScore}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {report.summary.total} pruebas · {report.totalDuration}ms
                </p>
              </CardContent>
            </Card>

            {/* Pass */}
            <Card className="border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{report.summary.pass}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Correctos</p>
                </div>
              </CardContent>
            </Card>

            {/* Warn */}
            <Card className="border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{report.summary.warn}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Advertencias</p>
                </div>
              </CardContent>
            </Card>

            {/* Fail */}
            <Card className="border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">{report.summary.fail}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fallos</p>
                </div>
              </CardContent>
            </Card>

            {/* Skip */}
            <Card className="border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="w-5 h-5 text-slate-400 text-xs font-bold flex items-center justify-center">
                    —
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-500">{report.summary.skip}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Omitidos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Stacked Progress Bar ───────────────────────── */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <p className="text-xs font-semibold text-slate-600">Distribucion General</p>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex bg-slate-100">
                {report.summary.pass > 0 && (
                  <div
                    className="bg-emerald-500 h-full transition-all duration-700"
                    style={{
                      width: `${(report.summary.pass / report.summary.total) * 100}%`,
                    }}
                  />
                )}
                {report.summary.warn > 0 && (
                  <div
                    className="bg-amber-500 h-full transition-all duration-700"
                    style={{
                      width: `${(report.summary.warn / report.summary.total) * 100}%`,
                    }}
                  />
                )}
                {report.summary.fail > 0 && (
                  <div
                    className="bg-red-500 h-full transition-all duration-700"
                    style={{
                      width: `${(report.summary.fail / report.summary.total) * 100}%`,
                    }}
                  />
                )}
                {report.summary.skip > 0 && (
                  <div
                    className="bg-slate-300 h-full transition-all duration-700"
                    style={{
                      width: `${(report.summary.skip / report.summary.total) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-500">Correctos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-slate-500">Advertencias</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[10px] text-slate-500">Fallos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] text-slate-500">Omitidos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── System Info ────────────────────────────────── */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-slate-500" />
                <p className="text-xs font-semibold text-slate-600">Informacion del Sistema</p>
                <Badge className="text-[9px] bg-slate-100 text-slate-500 ml-auto">
                  {report.runId.split('-').slice(1).join('-').toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Runtime</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{report.systemInfo.runtime}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Node.js</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{report.systemInfo.nodeVersion}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Base de Datos</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{report.systemInfo.databaseProvider}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Duracion</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{report.totalDuration}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Filter Buttons ─────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-slate-500 font-medium mr-1">Filtrar:</p>
            {[
              { key: 'all' as FilterType, label: 'Todos', count: report.summary.total },
              { key: 'fail' as FilterType, label: 'Fallos', count: report.summary.fail, color: 'text-red-600' },
              { key: 'warn' as FilterType, label: 'Advertencias', count: report.summary.warn, color: 'text-amber-600' },
              { key: 'pass' as FilterType, label: 'Correctos', count: report.summary.pass, color: 'text-emerald-600' },
              { key: 'skip' as FilterType, label: 'Omitidos', count: report.summary.skip },
            ].map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'text-xs gap-1 h-7',
                  filter === f.key
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : '',
                  f.count === 0 && filter !== f.key && 'opacity-40'
                )}
                disabled={f.count === 0 && filter !== f.key}
              >
                {f.label}
                <Badge
                  className={cn(
                    'text-[9px] px-1.5 py-0',
                    filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                    f.color && filter !== f.key && f.color
                  )}
                >
                  {f.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* ── Category Results ───────────────────────────── */}
          <div className="space-y-3">
            {categoryStats.map((cat) => {
              const CatIcon = getCategoryIcon(cat.name)
              const catTests = filteredTests.filter((t) => t.category === cat.name)
              const isExpanded = expandedCategories.has(cat.name)

              return (
                <Card key={cat.name} className="border-slate-200 overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded-md bg-slate-100">
                      <CatIcon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{cat.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {cat.pass} OK · {cat.warn} WARN · {cat.fail} FAIL · {cat.skip} SKIP
                      </p>
                    </div>
                    {/* Mini status badges */}
                    <div className="flex items-center gap-1">
                      {cat.fail > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0">
                          {cat.fail} fail
                        </Badge>
                      )}
                      {cat.warn > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0">
                          {cat.warn} warn
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {/* Category Tests */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Separator className="bg-slate-100" />
                        <ScrollArea className="max-h-[400px]">
                          <div className="divide-y divide-slate-50">
                            {catTests.map((test) => {
                              const hasSuggestion = !!test.suggestion
                              const isTestExpanded = expandedTests.has(test.id)

                              return (
                                <div key={test.id} className="px-4 py-2.5">
                                  <div className="flex items-start gap-2.5">
                                    <StatusIcon status={test.status} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-xs font-medium text-slate-700">
                                          {test.name}
                                        </p>
                                        <StatusBadge status={test.status} />
                                        {test.duration > 0 && (
                                          <span className="text-[9px] text-slate-400 font-mono">
                                            {test.duration}ms
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        {test.message}
                                      </p>
                                      {hasSuggestion && (
                                        <button
                                          onClick={() => toggleTest(test.id)}
                                          className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 hover:text-amber-700 font-medium"
                                        >
                                          <Lightbulb className="w-3 h-3" />
                                          {isTestExpanded ? 'Ocultar sugerencia' : 'Ver sugerencia'}
                                          {isTestExpanded ? (
                                            <ChevronDown className="w-3 h-3" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                      {isTestExpanded && hasSuggestion && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200"
                                        >
                                          <p className="text-[11px] text-amber-800 leading-relaxed">
                                            {test.suggestion}
                                          </p>
                                        </motion.div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )
            })}
          </div>

          {/* ── Suggestions Summary ────────────────────────── */}
          {suggestions.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  Resumen de Sugerencias y Correcciones
                  <Badge className="bg-amber-200 text-amber-800 text-[10px] ml-auto">
                    {suggestions.length} accion(es)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {suggestions.map((s, i) => {
                    const CatIcon = getCategoryIcon(s.category)
                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-amber-200"
                      >
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-amber-600 w-4">{i + 1}.</span>
                          <StatusIcon status={s.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CatIcon className="w-3 h-3 text-slate-500" />
                            <p className="text-xs font-medium text-slate-700">{s.name}</p>
                          </div>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            {s.suggestion}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Timestamp Footer ───────────────────────────── */}
          <div className="text-center">
            <p className="text-[10px] text-slate-400">
              Diagnostico ejecutado: {new Date(report.startedAt).toLocaleString('es')} · Duracion:{' '}
              {report.totalDuration}ms
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Run ID: {report.runId}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
