'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Eraser, Check, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  onSign: (signatureData: string, gps: { latitude: number; longitude: number; accuracy: number } | null) => void
  disabled?: boolean
  label?: string
}

export default function SignaturePad({ onSign, disabled, label = 'Firma Digital' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [gps, setGps] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const gpsCaptured = useRef(false)
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  // Capture GPS on mount — only setState inside async callbacks
  useEffect(() => {
    if (gpsCaptured.current) return
    gpsCaptured.current = true

    if (!navigator.geolocation) {
      // Use setTimeout to avoid synchronous setState in effect
      const id = setTimeout(() => setGpsStatus('error'), 0)
      return () => clearTimeout(id)
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setGpsStatus('ok')
      },
      () => {
        const id = setTimeout(() => setGpsStatus('error'), 0)
        // Can't easily clean up here, but the timeout is 0
        void id
        setGpsStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.parentElement?.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = rect?.width || 400
    const height = 160

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e293b'

    // Draw guide line
    ctx.beginPath()
    ctx.moveTo(20, height - 30)
    ctx.lineTo(width - 20, height - 30)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.stroke()

    // Reset pen style
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e293b'

    contextRef.current = ctx
  }, [])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = getCoordinates(e)
    contextRef.current?.beginPath()
    contextRef.current?.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    e.preventDefault()
    const { x, y } = getCoordinates(e)
    contextRef.current?.lineTo(x, y)
    contextRef.current?.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = contextRef.current
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.clearRect(0, 0, width, height)

    // Redraw guide line
    ctx.beginPath()
    ctx.moveTo(20, height - 30)
    ctx.lineTo(width - 20, height - 30)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.stroke()

    // Reset pen style
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e293b'

    setHasSignature(false)
    onSign('', null)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return
    const dataUrl = canvas.toDataURL('image/png')
    onSign(dataUrl, gps)
  }

  return (
    <div className={cn('space-y-3', disabled && 'opacity-60 pointer-events-none')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <div className="flex items-center gap-2">
          {gpsStatus === 'loading' && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              GPS...
            </div>
          )}
          {gpsStatus === 'ok' && gps && (
            <Badge variant="outline" className="text-[10px] gap-1 py-0 px-1.5 bg-emerald-50 border-emerald-200 text-emerald-700">
              <MapPin className="w-3 h-3" />
              {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
              <span className="text-emerald-500">±{gps.accuracy.toFixed(0)}m</span>
            </Badge>
          )}
          {gpsStatus === 'error' && (
            <Badge variant="outline" className="text-[10px] gap-1 py-0 px-1.5 bg-amber-50 border-amber-200 text-amber-700">
              <AlertTriangle className="w-3 h-3" />
              GPS no disponible
            </Badge>
          )}
        </div>
      </div>

      <div className="relative rounded-lg border-2 border-dashed border-slate-200 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-300 italic">Firme aquí con el dedo o mouse</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={!hasSignature}
          className="gap-1.5 text-xs text-slate-500 hover:text-red-500"
        >
          <Eraser className="w-3.5 h-3.5" />
          Borrar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!hasSignature || disabled}
          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-3.5 h-3.5" />
          Confirmar Firma
        </Button>
      </div>
    </div>
  )
}
