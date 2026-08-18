// Energy-Compliance Hub — PWA Install Prompt
// Shows "Install App" button when the app is not yet installed as a PWA

'use client'

import { usePWAInstall } from '@/hooks/use-pwa-install'
import { Download, X, Smartphone, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function InstallPrompt() {
  const { canInstall, isInstalled, isStandalone, installApp, dismissPrompt } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Don't show if: already installed, running as standalone, or dismissed
  if (isInstalled || isStandalone || !canInstall || dismissed) {
    return null
  }

  const handleInstall = async () => {
    setInstalling(true)
    const accepted = await installApp()
    if (!accepted) {
      setInstalling(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    dismissPrompt()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-4 z-50 sm:left-auto sm:right-4 sm:w-80"
      >
        <div className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 overflow-hidden flex-shrink-0">
              <img
                src="/icons/icon-192x192.png"
                alt="ECH"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Instalar Energy-Compliance</p>
              <p className="text-[10px] text-slate-400">Acceso rapido desde tu pantalla de inicio</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Movil</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>Escritorio</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                {installing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Instalando...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Instalar App
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-xs text-slate-400"
              >
                Mas tarde
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
