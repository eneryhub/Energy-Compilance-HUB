'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

// Listen for the beforeinstallprompt event at module level
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    // Dispatch custom event so multiple hook instances stay in sync
    window.dispatchEvent(new CustomEvent('pwa-install-available'))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent('pwa-installed'))
  })
}

function getInitialPWAState() {
  if (typeof window === 'undefined') return { standalone: false, installed: false, canInstall: false }

  const isStandaloneMode =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')

  if (isStandaloneMode) {
    return { standalone: true, installed: true, canInstall: false }
  }

  return { standalone: false, installed: false, canInstall: !!deferredPrompt }
}

export function usePWAInstall() {
  const initial = getInitialPWAState()
  const [canInstall, setCanInstall] = useState(initial.canInstall)
  const [isInstalled, setIsInstalled] = useState(initial.installed)
  const [isStandalone] = useState(initial.standalone)

  useEffect(() => {
    // Listen for custom events
    const handleAvailable = () => setCanInstall(true)
    const handleInstalled = () => {
      setIsInstalled(true)
      setCanInstall(false)
    }

    window.addEventListener('pwa-install-available', handleAvailable)
    window.addEventListener('pwa-installed', handleInstalled)

    return () => {
      window.removeEventListener('pwa-install-available', handleAvailable)
      window.removeEventListener('pwa-installed', handleInstalled)
    }
  }, [])

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
      setCanInstall(false)
      deferredPrompt = null
      return true
    }

    return false
  }, [])

  const dismissPrompt = useCallback(() => {
    setCanInstall(false)
    deferredPrompt = null
  }, [])

  return {
    canInstall,
    isInstalled,
    isStandalone,
    installApp,
    dismissPrompt,
  }
}
