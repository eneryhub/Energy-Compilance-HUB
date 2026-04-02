'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface PhotoItem {
  id: number
  data: string
  filename: string
  timestamp: string
}

interface PhotoEvidenceProps {
  photos: PhotoItem[]
  onPhotosChange: (photos: PhotoItem[]) => void
  maxPhotos?: number
  required?: boolean
  disabled?: boolean
}

export default function PhotoEvidence({ photos, onPhotosChange, maxPhotos = 5, required = true, disabled }: PhotoEvidenceProps) {
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [stream])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
      setShowCamera(true)
      setError(null)
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  const takePicture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const photoData = canvas.toDataURL('image/jpeg', 0.8)
    const photo: PhotoItem = {
      id: Date.now(),
      data: photoData,
      filename: `foto_${Date.now()}.jpg`,
      timestamp: new Date().toISOString(),
    }
    onPhotosChange([...photos, photo])
    stopCamera()
  }

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null) }
    setShowCamera(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Solo se permiten imágenes'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe exceder 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const photo: PhotoItem = {
          id: Date.now(),
          data: ev.target.result as string,
          filename: file.name,
          timestamp: new Date().toISOString(),
        }
        onPhotosChange([...photos, photo])
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removePhoto = (id: number) => {
    onPhotosChange(photos.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-rose-500" />
          <p className="text-sm font-medium text-slate-700">Evidencia Fotográfica</p>
          {required && <span className="text-red-500 text-xs">*Obligatorio</span>}
        </div>
        <Badge variant="outline" className={cn('text-[10px]', photos.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : '')}>
          {photos.length}/{maxPhotos} fotos
        </Badge>
      </div>

      {/* Photo Gallery */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
            <img src={photo.data} alt="Evidencia" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              disabled={disabled}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] p-1 truncate">
              {new Date(photo.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {photos.length < maxPhotos && !showCamera && (
          <>
            <button
              type="button"
              onClick={startCamera}
              disabled={disabled}
              className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-rose-300 hover:bg-rose-50/50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] text-slate-400">Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-rose-300 hover:bg-rose-50/50 transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] text-slate-400">Subir</span>
            </button>
          </>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Tomar Foto de Evidencia</p>
              <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="p-3 flex gap-2">
              <Button type="button" onClick={takePicture} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white">
                <Camera className="w-4 h-4 mr-2" /> Capturar
              </Button>
              <Button type="button" variant="outline" onClick={stopCamera} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {required && photos.length === 0 && (
        <p className="text-[10px] text-amber-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Debe adjuntar al menos 1 foto como evidencia
        </p>
      )}

      {photos.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {photos.length} foto(s) adjuntada(s)
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
