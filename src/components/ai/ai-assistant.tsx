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

// ── Shared global state: isSpeaking flag ──
// Uses a simple global variable + custom event so AppShell or other
// components can read the speaking state without prop drilling.
let _isSpeaking = false
const _listeners = new Set<() => void>()

function setIsSpeaking(val: boolean) {
  _isSpeaking = val
  _listeners.forEach((fn) => fn())
}

export function useIsSpeaking() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])
  return _isSpeaking
}

// ── Props ──
interface AIAssistantProps {
  currentView: ViewType
}

// ── Audio cache on client (blob URLs) ──
const clientAudioCache = new Map<string, string>()

// ── Component ──
export default function AIAssistant({ currentView }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('ech-ai-muted') === 'true'
  })
  const [isSpeaking, setIsSpeakingLocal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [hasPlayed, setHasPlayed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const description = MODULE_DESCRIPTIONS[currentView] || ''

  // Persist mute preference
  useEffect(() => {
    localStorage.setItem('ech-ai-muted', String(isMuted))
  }, [isMuted])

  // Sync local speaking state with global
  useEffect(() => {
    setIsSpeaking(isSpeakingLocal)
  }, [isSpeakingLocal])

  // Play TTS for current module description
  const speak = useCallback(async (text: string) => {
    if (!text || isMuted) return

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
    }

    setIsLoading(true)
    setIsSpeakingLocal(false)
    setDisplayText(text)

    const cacheKey = `${currentView}_${text.slice(0, 50)}`

    try {
      let blobUrl: string | null = null

      // Check client cache
      const cached = clientAudioCache.get(cacheKey)
      if (cached) {
        blobUrl = cached
      } else {
        // Fetch audio from backend proxy
        abortRef.current = new AbortController()
        const res = await fetch('/api/ai/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.slice(0, 1024), // API limit
            voice: 'kazi',
            speed: 1.0,
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) throw new Error('TTS failed')

        const blob = await res.blob()
        blobUrl = URL.createObjectURL(blob)
        clientAudioCache.set(cacheKey, blobUrl)

        // Limit cache size
        if (clientAudioCache.size > 30) {
          const firstKey = clientAudioCache.keys().next().value
          if (firstKey) {
            const oldUrl = clientAudioCache.get(firstKey)
            if (oldUrl) URL.revokeObjectURL(oldUrl)
            clientAudioCache.delete(firstKey)
          }
        }
      }

      // Play audio
      const audio = new Audio(blobUrl)
      audioRef.current = audio

      audio.onplay = () => {
        setIsSpeakingLocal(true)
        setIsLoading(false)
      }
      audio.onended = () => {
        setIsSpeakingLocal(false)
        audioRef.current = null
      }
      audio.onerror = () => {
        setIsSpeakingLocal(false)
        setIsLoading(false)
        audioRef.current = null
      }

      await audio.play()
      setHasPlayed(true)
    } catch {
      // Aborted or network error — silent fail
      setIsLoading(false)
      setIsSpeakingLocal(false)
    }
  }, [currentView, isMuted])

  // Auto-play when module changes (only if not muted and not already speaking)
  useEffect(() => {
    if (!isMuted && description && currentView) {
      setHasPlayed(false)
      const timer = setTimeout(() => {
        speak(description)
      }, 800) // Small delay for page transition to complete
      return () => clearTimeout(timer)
    }
  }, [currentView]) // intentionally only trigger on currentView

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsMutedLocal(!isMuted)
  }

  // Rename to avoid confusion with state setter
  const setIsMutedLocal = (val: boolean) => {
    setIsMuted(val)
  }

  const handleReplay = () => {
    speak(description)
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeakingLocal(false)
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
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-80 max-h-[200px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 relative"
            >
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
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
                {isSpeaking && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <VoiceWaves />
                    Hablando...
                  </span>
                )}
              </div>

              {/* Description text */}
              <p className="text-sm text-slate-700 leading-relaxed pr-4 max-h-[140px] overflow-y-auto">
                {displayText || description}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                {isSpeaking ? (
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
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    {isLoading ? 'Generando...' : 'Reproducir'}
                  </button>
                )}
                <button
                  onClick={toggleMute}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isMuted
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  )}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      Silenciado
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      Silenciar
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB (Floating Action Button) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2',
            isOpen
              ? 'bg-slate-700 text-white focus:ring-slate-400'
              : isSpeaking
                ? 'bg-emerald-500 text-white focus:ring-emerald-300 shadow-emerald-500/25 shadow-lg'
                : isMuted
                  ? 'bg-slate-400 text-white focus:ring-slate-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-300'
          )}
          aria-label={isOpen ? 'Cerrar guía' : 'Abrir guía de voz'}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6" />
              {/* Voice wave rings when speaking */}
              {isSpeaking && (
                <>
                  <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                  <span className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-[voice-ring_1.5s_ease-out_infinite]" />
                </>
              )}
            </>
          )}
        </button>

        {/* Mute indicator badge */}
        {isMuted && !isOpen && (
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
      `}</style>
    </>
  )
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
      <style jsx>{`
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
    </span>
  )
}

// ── cn helper (inline to avoid import dependency) ──
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
