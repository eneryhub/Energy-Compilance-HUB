'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Activity,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'

// ============ Types ============

interface SensorPrediction {
  sensorId: string
  sensorName: string
  type: string
  currentValue: number
  unit: string
  trend: 'rising' | 'falling' | 'stable'
  failureProbability: number // 0-100
  maintenanceDays: number
  recommendation: string
}

interface PredictiveResponse {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  sensors: SensorPrediction[]
  analyzedAt: string
}

// ============ Helpers ============

function getRiskColor(risk: string) {
  switch (risk) {
    case 'LOW':
      return 'border-emerald-300 bg-emerald-50'
    case 'MEDIUM':
      return 'border-amber-300 bg-amber-50'
    case 'HIGH':
      return 'border-orange-400 bg-orange-50'
    case 'CRITICAL':
      return 'border-red-400 bg-red-50'
    default:
      return 'border-slate-300 bg-slate-50'
  }
}

function getRiskBadgeVariant(risk: string) {
  switch (risk) {
    case 'LOW':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'CRITICAL':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getRiskLabel(risk: string) {
  switch (risk) {
    case 'LOW': return 'Bajo'
    case 'MEDIUM': return 'Medio'
    case 'HIGH': return 'Alto'
    case 'CRITICAL': return 'Cr\u00edtico'
    default: return risk
  }
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case 'LOW': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />
    case 'MEDIUM': return <AlertTriangle className="w-6 h-6 text-amber-500" />
    case 'HIGH': return <AlertTriangle className="w-6 h-6 text-orange-500" />
    case 'CRITICAL': return <ShieldAlert className="w-6 h-6 text-red-500" />
    default: return <Activity className="w-6 h-6 text-slate-500" />
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'rising': return <TrendingUp className="w-4 h-4 text-red-500" />
    case 'falling': return <TrendingDown className="w-4 h-4 text-emerald-500" />
    case 'stable': return <Minus className="w-4 h-4 text-slate-400" />
    default: return <Minus className="w-4 h-4 text-slate-400" />
  }
}

function getTrendLabel(trend: string) {
  switch (trend) {
    case 'rising': return 'Subiendo'
    case 'falling': return 'Bajando'
    case 'stable': return 'Estable'
    default: return trend
  }
}

function getProbabilityColor(prob: number) {
  if (prob < 25) return 'bg-emerald-500'
  if (prob < 50) return 'bg-amber-500'
  if (prob < 75) return 'bg-orange-500'
  return 'bg-red-500'
}

function getSensorTypeIcon(type: string) {
  switch (type) {
    case 'PRESION': return '$\u03A8$'
    case 'TEMPERATURA': return '\u{1F321}\uFE0F'
    case 'GAS': return '\u{1F4A8}'
    case 'VOLTAJE': return '\u26A1'
    default: return '\u{1F4E1}'
  }
}

// ============ Animation variants ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
}

// ============ Loading Skeleton ============

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ============ Empty State ============

function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Brain className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">
        Sin datos de predicci\u00f3n
      </h3>
      <p className="text-sm text-slate-500 max-w-md">
        {message}
      </p>
    </motion.div>
  )
}

// ============ Main Component ============

export default function PredictiveDashboard() {
  const [data, setData] = useState<PredictiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<PredictiveResponse>('/predictive/insights')
      setData(response)
    } catch (err: any) {
      setError(err.message || 'Error al obtener an\u00e1lisis predictivo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              An\u00e1lisis Predictivo con IA
            </h2>
            <p className="text-xs text-slate-500">
              Mantenimiento preventivo basado en inteligencia artificial
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInsights}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Activity className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 leading-relaxed">
          La IA analiza las tendencias de los \u00faltimos 100 registros de telemetr\u00eda de cada sensor
          para generar predicciones de mantenimiento preventivo.
        </p>
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}

      {error && !loading && (
        <EmptyState message={error} />
      )}

      {data && !loading && !error && (
        <>
          {data.sensors.length === 0 ? (
            <EmptyState message="No hay sensores activos con suficientes datos de telemetr\u00eda para generar predicciones. Aseg\u00farese de tener sensores configurados y funcionando." />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Overall Risk Level Card */}
              <motion.div variants={cardVariants}>
                <Card className={`border-2 ${getRiskColor(data.overallRisk)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getRiskIcon(data.overallRisk)}
                        <div>
                          <p className="text-sm font-medium text-slate-600">
                            Nivel de Riesgo General
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getRiskBadgeVariant(data.overallRisk)}>
                              {getRiskLabel(data.overallRisk)}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {data.analyzedAt
                                ? `Actualizado: ${new Date(data.analyzedAt).toLocaleString('es-ES')}`
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="max-w-md">
                        <p className="text-sm text-slate-700">{data.summary}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Per-Sensor Prediction Cards */}
              <motion.div variants={cardVariants}>
                <h3 className="text-base font-semibold text-slate-800 mb-4">
                  Predicciones por Sensor
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.sensors.map((sensor) => (
                    <motion.div key={sensor.sensorId} variants={cardVariants}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl" role="img">
                                {getSensorTypeIcon(sensor.type)}
                              </span>
                              <div>
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                  {sensor.sensorName}
                                </CardTitle>
                                <p className="text-xs text-slate-500">{sensor.type}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getTrendIcon(sensor.trend)}
                              <span className="text-xs text-slate-500">
                                {getTrendLabel(sensor.trend)}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-4">
                          {/* Current Value */}
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-slate-800">
                              {sensor.currentValue.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-500">{sensor.unit}</span>
                          </div>

                          {/* Failure Probability Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-600">
                                Probabilidad de falla
                              </span>
                              <span className={`text-xs font-bold ${
                                sensor.failureProbability < 25
                                  ? 'text-emerald-600'
                                  : sensor.failureProbability < 50
                                    ? 'text-amber-600'
                                    : sensor.failureProbability < 75
                                      ? 'text-orange-600'
                                      : 'text-red-600'
                              }`}>
                                {sensor.failureProbability}%
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${getProbabilityColor(sensor.failureProbability)}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${sensor.failureProbability}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                              />
                            </div>
                          </div>

                          {/* Maintenance Days */}
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-4 h-4 ${
                              sensor.maintenanceDays <= 7
                                ? 'text-red-500'
                                : sensor.maintenanceDays <= 30
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                            }`} />
                            <span className="text-xs text-slate-600">
                              Mantenimiento preventivo en:{' '}
                              <strong className={
                                sensor.maintenanceDays <= 7
                                  ? 'text-red-600'
                                  : sensor.maintenanceDays <= 30
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                              }>
                                {sensor.maintenanceDays <= 0 ? 'Inmediato' : `${sensor.maintenanceDays} d\u00edas`}
                              </strong>
                            </span>
                          </div>

                          {/* AI Recommendation */}
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {sensor.recommendation}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
