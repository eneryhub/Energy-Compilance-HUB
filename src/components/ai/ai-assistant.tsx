'use client'

// ═══════════════════════════════════════════════════════════════
// AI Assistant — Interactive Voice Guide
// Zero-risk: Pure UI add-on. Does NOT touch Prisma, business logic,
// or any existing component internals. Only reads currentView prop.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, MessageCircle, X, Loader2 } from 'lucide-react'
import type { ViewType } from '@/components/layout/app-shell'

// ── Module Descriptions (Spanish) — brief, clear, < 500 chars each ──
const MODULE_DESCRIPTIONS: Record<ViewType, string> = {
  dashboard:
    'Bienvenido al Dashboard principal. Aquí encontrarás un resumen de toda tu operación: permisos activos, documentos pendientes, alertas de seguridad y el estado de cumplimiento HSE de tu empresa.',

  permits:
    'Este es el módulo de Permisos de Trabajo. Aquí puedes crear, consultar y gestionar los permisos necesarios para realizar trabajos de alto riesgo. Cada permiso sigue un flujo de aprobación configurable.',

  documents:
    'Documentos HSE es tu repositorio centralizado. Aquí subes y organizas los documentos de Seguridad, Salud y Medio Ambiente: procedimientos, certificados, inspecciones y más.',

  approval:
    'El Panel de Aprobaciones te permite revisar y aprobar o rechazar permisos pendientes. Los supervisores y gerentes reciben aquí las solicitudes de permisos de trabajo.',

  'risk-types':
    'En Riesgos puedes configurar las matrices de evaluación de riesgos de tu operación. Define categorías, niveles de probabilidad y severidad para estandarizar los análisis.',

  locations:
    'Ubicaciones te permite gestionar los sitios operativos de tu empresa: plataformas, plantas, campos. Puedes generar códigos QR para cada ubicación.',

  scada:
    'SCADA es el módulo de telemetría en tiempo real. Monitorea los sensores conectados a tus instalaciones, consulta lecturas actuales e históricas, y configura alertas por umbrales.',

  predictive:
    'IA Predictiva utiliza modelos de inteligencia artificial para anticipar problemas operativos. Analiza datos históricos de sensores y permisos para detectar patrones de riesgo.',

  reports:
    'Reportes te permite generar informes analíticos de tu operación: cumplimiento HSE, tendencias de permisos, estadísticas de incidentes y más.',

  'risk-map':
    'El Mapa de Riesgo muestra visualmente las zonas de mayor peligro en tus instalaciones mediante mapas de calor interactivos.',

  paperclip:
    'Paperclip IA es tu asistente inteligente. Puedes hacer preguntas sobre tus documentos, permisos y procedimientos HSE, y obtener respuestas basadas en tu base de conocimiento.',

  erc:
    'Seguridad en Campo es la interfaz para empleados de campo. Aquí pueden reportar incidentes, emergencias y condiciones inseguras en tiempo real.',

  'erc-monitor':
    'El Monitor de Incidentes muestra en tiempo real las alertas de seguridad reportadas desde el campo. Permite ver, clasificar y dar seguimiento a cada incidente.',

  subscription:
    'En Suscripción puedes gestionar tu plan: consultar el periodo de prueba, renovar, o cambiar entre los planes Starter, Business y Enterprise.',

  audit:
    'Auditoría registra todas las acciones realizadas en la plataforma: quién hizo qué y cuándo. Ideal para trazabilidad y cumplimiento regulatorio.',

  users:
    'Usuarios permite administrar las cuentas de tu equipo: invitar nuevos usuarios, asignar roles como Supervisor o Técnico, y gestionar permisos de acceso.',

  system:
    'Plataforma muestra información del sistema: estado de la base de datos, uso de almacenamiento, configuración general y métricas de rendimiento.',

  'user-manual':
    'El Manual de Usuario contiene guías paso a paso para utilizar cada módulo de la plataforma. Ideal para la capacitación de nuevos usuarios.',

  'technical-manual':
    'El Manual Técnico documenta la arquitectura del sistema, las integraciones con sensores SCADA, y la configuración técnica de la plataforma.',

  diagnostics:
    'Diagnóstico ejecuta pruebas automatizadas sobre la plataforma: verifica la conexión a la base de datos, el estado de la API, y la integridad del sistema.',

  goc:
    'El Global Operations Center es el centro de mando global para super administradores. Proporciona visibilidad de todas las empresas y operaciones del sistema.',

  'admin-portal-hq':
    'Centro de Mando es el panel exclusivo del Super Administrador. Aquí gestionas todas las empresas del sistema, revisas auditorías globales y configuras parámetros de la plataforma.',
}

// ── Shared global state for cross-component speaking status ──
let _globalIsSpeaking = false
const _globalListeners = new Set<() => void>()

function _setGlobalSpeaking(val: boolean) {
  _globalIsSpeaking = val
  _globalListeners.forEach((fn) => fn())
}

export function useIsSpeaking() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1)
    _globalListeners.add(fn)
    return () => { _globalListeners.delete(fn) }
  }, [])
  return _globalIsSpeaking
}

// ── Props ──
interface AIAssistantProps {
  currentView: ViewType
}

// ── Audio cache on client (blob URLs) ──
const _audioBlobCache = new Map<string, string>()

// ── cn helper (inline to avoid circular imports) ──
function clsx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Voice Waves Mini Component ──
function VoiceWaves() {
  return (
    <span className="inline-flex items-center gap-[2px] h-3">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-emerald-500 rounded-full animate-[voice-bar_0.8s_ease-in-out_infinite]"
          style={{
            height: '8px',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}

// ── Main Component ──
export default function AIAssistant({ currentView }: AIAssistantProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('ech-ai-muted') === 'true'
  })
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [guideText, setGuideText] = useState('')
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const abortCtrlRef = useRef<AbortController | null>(null)

  // Retry guard — max 1 attempt per module change (no retry loop)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 1
  const lastViewRef = useRef<ViewType>(currentView)

  const description = MODULE_DESCRIPTIONS[currentView] || ''

  // Persist mute preference
  useEffect(() => {
    localStorage.setItem('ech-ai-muted', String(muted))
  }, [muted])

  // Sync local speaking → global
  useEffect(() => {
    _setGlobalSpeaking(speaking)
  }, [speaking])

  // Play TTS for given text (with retry guard — max 1 attempt per module change)
  const playDescription = useCallback(async (text: string) => {
    if (!text || muted) return

    // Stop any currently playing audio
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
    }

    setLoading(true)
    setSpeaking(false)
    setGuideText(text)

    const cacheKey = `${currentView}_${text.slice(0, 50)}`

    try {
      let blobUrl: string | null = null

      // Check client cache first
      const cachedUrl = _audioBlobCache.get(cacheKey)
      if (cachedUrl) {
        blobUrl = cachedUrl
      } else {
        // Fetch audio from backend proxy
        abortCtrlRef.current = new AbortController()
        const res = await fetch('/api/ai/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.slice(0, 1024),
            voice: 'kazi',
            speed: 1.0,
          }),
          signal: abortCtrlRef.current.signal,
        })

        if (!res.ok) {
          // Read server error body for diagnostics
          let serverMsg = 'Error desconocido'
          try {
            const errBody = await res.json()
            serverMsg = errBody.error || errBody.message || JSON.stringify(errBody)
          } catch { /* response not JSON */ }
          console.error('[AI Assistant] TTS server error:', res.status, serverMsg)
          throw new Error(serverMsg)
        }

        const blob = await res.blob()
        blobUrl = URL.createObjectURL(blob)
        _audioBlobCache.set(cacheKey, blobUrl)

        // Limit cache size to prevent memory leak
        if (_audioBlobCache.size > 30) {
          const oldestKey = _audioBlobCache.keys().next().value
          if (oldestKey) {
            const oldUrl = _audioBlobCache.get(oldestKey)
            if (oldUrl) URL.revokeObjectURL(oldUrl)
            _audioBlobCache.delete(oldestKey)
          }
        }
      }

      // Success — reset retry counter
      retryCountRef.current = 0

      // Create and play audio element
      const audio = new Audio(blobUrl)
      audioElRef.current = audio

      audio.onplay = () => {
        setSpeaking(true)
        setLoading(false)
      }
      audio.onended = () => {
        setSpeaking(false)
        audioElRef.current = null
      }
      audio.onerror = () => {
        setSpeaking(false)
        setLoading(false)
        audioElRef.current = null
      }

      await audio.play()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User-triggered abort — silent
      } else {
        retryCountRef.current += 1
        if (retryCountRef.current <= MAX_RETRIES) {
          console.warn('[AI Assistant] TTS failed, retry', retryCountRef.current, '/', MAX_RETRIES, ':', err)
          // Exponential backoff: 2s, 4s
          const delay = Math.pow(2, retryCountRef.current) * 1000
          setTimeout(() => playDescription(text), delay)
        } else {
          console.error('[AI Assistant] TTS failed after', MAX_RETRIES, 'retries. Giving up for this module.')
        }
      }
      setLoading(false)
      setSpeaking(false)
    }
  }, [currentView, muted])

  // Auto-play when module changes — reset retry counter for new view
  useEffect(() => {
    if (!muted && description && currentView) {
      // New view: reset retry counter
      retryCountRef.current = 0
      lastViewRef.current = currentView
      const timer = setTimeout(() => {
        playDescription(description)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [currentView]) // intentionally only trigger on currentView change

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause()
      }
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort()
      }
    }
  }, [])

  const handleToggleMute = () => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
    setSpeaking(false)
    setMuted((prev) => !prev)
  }

  const handleReplay = () => {
    playDescription(description)
  }

  const handleStop = () => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
    setSpeaking(false)
  }

  // Don't render during SSR or if no description
  if (!description) return null

  return (
    <>
      {/* ── Floating Bubble Button ── */}
      <motion.div
        className="fixed bottom-6 right-6 z-[999998] flex flex-col items-end gap-2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      >
        {/* Speech Card (tooltip) */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-80 max-h-[200px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 relative"
            >
              {/* Close button */}
              <button
                onClick={() => setPanelOpen(false)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar guía"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Module label */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Guía IA
                </span>
                {speaking && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <VoiceWaves />
                    Hablando...
                  </span>
                )}
              </div>

              {/* Description text */}
              <p className="text-sm text-slate-700 leading-relaxed pr-4 max-h-[140px] overflow-y-auto">
                {guideText || description}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                {speaking ? (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    Detener
                  </button>
                ) : (
                  <button
                    onClick={handleReplay}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    {loading ? 'Generando...' : 'Reproducir'}
                  </button>
                )}
                <button
                  onClick={handleToggleMute}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    muted
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  )}
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  {muted ? 'Silenciado' : 'Silenciar'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB (Floating Action Button) */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={clsx(
            'relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2',
            panelOpen
              ? 'bg-slate-700 text-white focus:ring-slate-400'
              : speaking
                ? 'bg-emerald-500 text-white focus:ring-emerald-300 shadow-emerald-500/25 shadow-lg'
                : muted
                  ? 'bg-slate-400 text-white focus:ring-slate-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-300'
          )}
          aria-label={panelOpen ? 'Cerrar guía' : 'Abrir guía de voz'}
        >
          {panelOpen ? (
            <X className="w-6 h-6" />
          ) : loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6" />
              {speaking && (
                <>
                  <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                  <span className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-[voice-ring_1.5s_ease-out_infinite]" />
                </>
              )}
            </>
          )}
        </button>

        {/* Mute indicator badge */}
        {muted && !panelOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <VolumeX className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </motion.div>

      {/* ── Voice Wave CSS Keyframes ── */}
      <style jsx global>{`
        @keyframes voice-ring {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        @keyframes voice-bar {
          0%,
          100% {
            height: 3px;
          }
          50% {
            height: 12px;
          }
        }
      `}</style>
    </>
  )
}
