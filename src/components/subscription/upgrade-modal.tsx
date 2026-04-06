'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles, ArrowRight, Check } from 'lucide-react'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduleName: string
  upsellMessage: string
  currentPlan: string
  onUpgrade: () => void
}

const BUSINESS_FEATURES = [
  'SCADA Telemetría en tiempo real',
  'IA Predictiva con análisis avanzado',
  'Reportes analíticos avanzados',
  'API de acceso para integraciones',
  'Validación por geocerca',
  'Soporte prioritario',
  'Hasta 50 usuarios',
]

export default function UpgradeModal({
  open,
  onOpenChange,
  moduleName,
  upsellMessage,
  currentPlan,
  onUpgrade,
}: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Lock className="w-7 h-7 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            <span className="flex items-center justify-center gap-2">
              Módulo Pro
              <Sparkles className="w-5 h-5 text-amber-500" />
            </span>
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {upsellMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Current vs Required Plan */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-center flex-1">
              <p className="text-xs text-slate-500 uppercase font-medium">Plan Actual</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">
                {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 mx-3" />
            <div className="text-center flex-1">
              <p className="text-xs text-amber-600 uppercase font-medium">Requerido</p>
              <p className="text-sm font-bold text-amber-600 mt-0.5">Business</p>
            </div>
          </div>

          {/* Business Features */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Con el plan Business obtienes:</p>
            <ul className="space-y-1.5">
              {BUSINESS_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Price */}
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-xs text-emerald-600 font-medium">Plan Business</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">$499<span className="text-sm font-normal text-emerald-600">/mes</span></p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Ahora no
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
              onClick={() => {
                onOpenChange(false)
                onUpgrade()
              }}
            >
              <Sparkles className="w-4 h-4" />
              Actualizar Plan
            </Button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            También puedes contactar a ventas para el plan Enterprise con funciones ilimitadas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
