'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Flame,
  AlertTriangle,
  ShieldAlert,
  ThermometerSun,
  Activity,
  FileWarning,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'

interface HeatMapMatrix {
  location: string
  riskType: string
  permits: number
  rejected: number
  level: 'low' | 'medium' | 'high' | 'critical'
}

interface SensorRisk {
  location: string
  sensors: number
  critical: number
  warning: number
}

interface DocumentRisk {
  category: string
  expired: number
  expiring: number
  level: 'low' | 'medium' | 'high' | 'critical'
}

interface HeatMapData {
  matrix: HeatMapMatrix[]
  locations: string[]
  riskTypes: string[]
  sensorRisk: SensorRisk[]
  documentRisk: DocumentRisk[]
  summary: {
    totalPermits: number
    totalRejected: number
    totalExpired: number
    totalCriticalSensors: number
    totalLocations: number
    highRiskLocations: number
    overallLevel: string
  }
}

const RISK_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ALTURA: { label: 'Altura', color: 'text-red-600', bg: 'bg-red-100' },
  ELECTRICO: { label: 'Eléctrico', color: 'text-amber-600', bg: 'bg-amber-100' },
  CONFINADO: { label: 'Confinado', color: 'text-purple-600', bg: 'bg-purple-100' },
  CALIENTE: { label: 'Caliente', color: 'text-orange-600', bg: 'bg-orange-100' },
}

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Bajo' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Medio' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Alto' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Crítico' },
}

function getCellBg(level: string, count: number): string {
  if (count === 0) return 'bg-slate-50 text-slate-400'
  switch (level) {
    case 'critical': return 'bg-red-500 text-white'
    case 'high': return 'bg-orange-400 text-white'
    case 'medium': return 'bg-amber-300 text-slate-800'
    default: return 'bg-emerald-200 text-slate-800'
  }
}

export default function RiskHeatMap() {
  const [data, setData] = useState<HeatMapData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch<HeatMapData>('/risk-heatmap')
      setData(res)
    } catch (err) {
      console.error('Error loading risk heatmap:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!data || data.locations.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-16 text-center">
          <ThermometerSun className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">Sin datos suficientes</p>
          <p className="text-sm text-slate-400 mt-1">El mapa de calor se populated automáticamente con los datos de permisos, sensores y documentos de tu empresa.</p>
        </CardContent>
      </Card>
    )
  }

  const summary = data.summary
  const overallLevel = LEVEL_COLORS[summary.overallLevel] || LEVEL_COLORS.low

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Mapa de Calor de Riesgo
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Visualización de riesgo por ubicación y tipo de trabajo
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1.5 ${overallLevel.bg}`}>
              <ShieldAlert className={`w-4 h-4 ${overallLevel.text}`} />
            </div>
            <p className="text-lg font-bold text-slate-800 capitalize">{overallLevel.label}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Riesgo Global</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1.5 bg-blue-100">
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg font-bold text-slate-800">{summary.totalPermits}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Permisos Total</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1.5 bg-red-100">
              <FileWarning className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-lg font-bold text-slate-800">{summary.totalExpired}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Docs. Expirados</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1.5 bg-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-slate-800">{summary.totalCriticalSensors}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sensores Críticos</p>
          </CardContent>
        </Card>
      </div>

      {/* Heat Map Matrix */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Matriz de Riesgo — Permisos por Ubicación</CardTitle>
          <CardDescription>Intensidad de color basada en cantidad de permisos y rechazos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase min-w-[140px]">
                    Ubicación
                  </th>
                  {data.riskTypes.map((rt) => {
                    const info = RISK_TYPE_LABELS[rt]
                    return (
                      <th key={rt} className="text-center px-2 py-2 min-w-[90px]">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${info?.bg || 'bg-slate-100'} ${info?.color || 'text-slate-600'}`}>
                          {info?.label || rt}
                        </span>
                      </th>
                    )
                  })}
                  <th className="text-center px-2 py-2 text-[10px] font-semibold text-slate-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.locations.map((loc) => {
                  const locationMatrix = data.matrix.filter((m) => m.location === loc)
                  const totalPermits = locationMatrix.reduce((sum, m) => sum + m.permits, 0)
                  const totalRejected = locationMatrix.reduce((sum, m) => sum + m.rejected, 0)
                  const worstLevel = locationMatrix.reduce((worst, m) => {
                    const levels = { low: 0, medium: 1, high: 2, critical: 3 }
                    return levels[m.level] > levels[worst] ? m.level : worst
                  }, 'low' as string)

                  return (
                    <tr key={loc} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 truncate max-w-[120px]" title={loc}>
                            {loc}
                          </span>
                          {worstLevel !== 'low' && (
                            <Badge className={`text-[9px] px-1 py-0 ${LEVEL_COLORS[worstLevel]?.bg} ${LEVEL_COLORS[worstLevel]?.text} border-0 shrink-0`}>
                              {LEVEL_COLORS[worstLevel]?.label}
                            </Badge>
                          )}
                        </div>
                      </td>
                      {data.riskTypes.map((rt) => {
                        const cell = locationMatrix.find((m) => m.riskType === rt)
                        const count = cell?.permits || 0
                        const rejected = cell?.rejected || 0
                        const level = cell?.level || 'low'

                        return (
                          <td key={rt} className="px-1 py-1">
                            <div
                              className={`rounded-lg px-2 py-2 text-center transition-all hover:scale-105 ${getCellBg(level, count)}`}
                              title={`${loc} — ${RISK_TYPE_LABELS[rt]?.label}: ${count} permisos, ${rejected} rechazados`}
                            >
                              <div className="text-sm font-bold">{count}</div>
                              {rejected > 0 && (
                                <div className="text-[9px] opacity-80">✕{rejected}</div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center">
                        <span className="font-bold text-slate-700">{totalPermits}</span>
                        {totalRejected > 0 && (
                          <span className="text-[10px] text-red-500 ml-0.5">(✕{totalRejected})</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-500 uppercase font-semibold mr-1">Leyenda:</span>
            {[
              { bg: 'bg-emerald-200', label: 'Bajo (<5)' },
              { bg: 'bg-amber-300', label: 'Medio (5-9)' },
              { bg: 'bg-orange-400', label: 'Alto (10-19)' },
              { bg: 'bg-red-500', label: 'Crítico (20+)' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-4 h-3 rounded ${item.bg}`} />
                <span className="text-[10px] text-slate-600">{item.label}</span>
              </div>
            ))}
            <span className="text-[10px] text-slate-400 ml-2">✕ = rechazados</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row: Sensor Risk + Document Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sensor Risk by Location */}
        {data.sensorRisk.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Estado de Sensores por Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.sensorRisk.map((sr) => (
                  <div key={sr.location} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{sr.location}</p>
                      <p className="text-[10px] text-slate-500">{sr.sensors} sensor(es)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sr.critical > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                          {sr.critical} crítico(s)
                        </Badge>
                      )}
                      {sr.warning > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">
                          {sr.warning} alerta(s)
                        </Badge>
                      )}
                      {sr.critical === 0 && sr.warning === 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                          Normal
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Expiry Risk */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-red-500" />
              Riesgo de Documentos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.documentRisk.map((dr) => {
                const levelInfo = LEVEL_COLORS[dr.level] || LEVEL_COLORS.low
                return (
                  <div key={dr.category} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{dr.category}</span>
                      <Badge className={`text-[9px] px-1 py-0 border-0 ${levelInfo.bg} ${levelInfo.text}`}>
                        {levelInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {dr.expired > 0 && (
                        <span className="text-red-600 font-medium">{dr.expired} expirado(s)</span>
                      )}
                      {dr.expiring > 0 && (
                        <span className="text-amber-600">{dr.expiring} por expirar</span>
                      )}
                      {dr.expired === 0 && dr.expiring === 0 && (
                        <span className="text-emerald-600 font-medium">Al día</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
