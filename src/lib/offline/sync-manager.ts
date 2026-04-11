// Energy-Compliance Hub — Offline Sync Manager
// Manages offline data queuing, background sync, and service worker communication

import { offlineDB } from '@/lib/offline/offline-queue'

type EventCallback = (...args: any[]) => void

class SyncManager {
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private swRegistration: ServiceWorkerRegistration | null = null
  private isInitialized = false

  /**
   * Initialize the sync manager — registers service worker and sets up listeners
   */
  async init(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return
    this.isInitialized = true

    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        console.log('[SyncManager] Service Worker registered')

        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, data } = event.data || {}

          switch (type) {
            case 'SYNC_STARTED':
              this.emit('sync-start', data)
              break
            case 'SYNC_COMPLETE':
              this.emit('sync-complete', data)
              break
            case 'SYNC_ERROR':
              this.emit('sync-error', data)
              break
          }
        })

        // Listen for online/offline to trigger auto-sync
        window.addEventListener('online', () => {
          this.autoSync()
        })
      }
    } catch (error) {
      console.warn('[SyncManager] Service Worker registration failed:', error)
    }
  }

  /**
   * Queue an API request for offline sync
   */
  queueRequest(url: string, method: string, body: any, headers?: Record<string, string>): void {
    const pending = this.getPendingRequests()
    pending.push({
      url,
      method,
      body,
      headers,
      timestamp: Date.now(),
    })
    localStorage.setItem('ech-pending-sync', JSON.stringify(pending))
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): any[] {
    try {
      const stored = localStorage.getItem('ech-pending-sync')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  /**
   * Get count of pending requests
   */
  getPendingCount(): number {
    return this.getPendingRequests().length
  }

  /**
   * Clear all pending requests
   */
  clearPending(): void {
    localStorage.removeItem('ech-pending-sync')
  }

  /**
   * Remove a specific pending request by index
   */
  removePending(index: number): void {
    const pending = this.getPendingRequests()
    pending.splice(index, 1)
    localStorage.setItem('ech-pending-sync', JSON.stringify(pending))
  }

  /**
   * Perform a fetch with automatic offline fallback
   * If online: makes the request normally
   * If offline: queues the request for later sync
   */
  async fetchWithOffline(url: string, options: RequestInit = {}): Promise<Response> {
    if (navigator.onLine) {
      try {
        const response = await fetch(url, options)
        return response
      } catch (error) {
        // Network error — fall back to queueing
        console.warn('[SyncManager] Network request failed, queuing for offline sync:', url)
        this.queueRequest(
          url,
          options.method || 'GET',
          options.body ? JSON.parse(options.body as string) : null,
          options.headers as Record<string, string> | undefined
        )
        // Return a mock response indicating offline
        return new Response(
          JSON.stringify({
            error: 'offline',
            message: 'Sin conexion. La operacion se sincronizara automaticamente.',
            queued: true,
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Offline — queue the request
    this.queueRequest(
      url,
      options.method || 'GET',
      options.body ? JSON.parse(options.body as string) : null,
      options.headers as Record<string, string> | undefined
    )

    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Sin conexion. La operacion se sincronizara automaticamente.',
        queued: true,
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    )
  }

  /**
   * Drain IndexedDB offline queue (the primary queue used by offlineFetch)
   */
  private async drainIndexedDBQueue(): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    try {
      const items = await offlineDB.getQueue()

      for (const item of items) {
        try {
          console.log(`[SyncManager] Replaying queued ${item.method} ${item.url} (retry ${item.retryCount}/${item.maxRetries}, type: ${item.resourceType})`)

          const response = await fetch(item.url, {
            method: item.method || 'POST',
            headers: item.headers || {},
            body: item.body || undefined,
          })

          if (response.ok) {
            success++
            console.log(`[SyncManager] Sync OK: ${item.method} ${item.url}`)
            // Remove successfully synced item from queue
            if (item.id != null) {
              await offlineDB.removeFromQueue(item.id)
            }
          } else {
            // Log error details for debugging
            const errBody = await response.text().catch(() => '(unreadable)')
            console.warn(`[SyncManager] Sync FAILED: ${item.method} ${item.url} → ${response.status} ${errBody.substring(0, 500)}`)
            failed++
            // Increment retry count
            if (item.id != null) {
              await offlineDB.incrementRetry(item.id)
            }
          }
        } catch (err) {
          console.warn(`[SyncManager] Sync ERROR: ${item.method} ${item.url}`, err)
          failed++
          if (item.id != null) {
            await offlineDB.incrementRetry(item.id)
          }
        }
      }
    } catch (dbError) {
      console.warn('[SyncManager] IndexedDB queue drain failed:', dbError)
    }

    return { success, failed }
  }

  /**
   * Trigger auto-sync when coming back online
   */
  private async autoSync(): Promise<void> {
    const pending = this.getPendingRequests()

    // Also drain IndexedDB queue (primary queue for offlineFetch)
    const idbResult = await this.drainIndexedDBQueue()

    if (pending.length === 0 && idbResult.success === 0 && idbResult.failed === 0) return

    console.log(`[SyncManager] Auto-syncing ${pending.length} localStorage + ${idbResult.success + idbResult.failed} IndexedDB pending requests`)

    let success = idbResult.success
    let failed = idbResult.failed
    const remaining: any[] = []

    for (const item of pending) {
      try {
        const response = await fetch(item.url, {
          method: item.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...item.headers,
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        })

        if (response.ok) {
          success++
        } else {
          remaining.push(item)
          failed++
        }
      } catch {
        remaining.push(item)
        failed++
      }
    }

    // Update pending queue
    localStorage.setItem('ech-pending-sync', JSON.stringify(remaining))

    const total = pending.length + idbResult.success + idbResult.failed

    // Emit event with results
    this.emit('sync-complete', { success, failed, total })

    // Notify service worker
    if (this.swRegistration) {
      this.swRegistration.active?.postMessage({
        type: 'SYNC_COMPLETE',
        data: { success, failed },
      })
    }
  }

  /**
   * Force sync all pending requests
   */
  async syncAll(): Promise<{ success: number; failed: number }> {
    const pending = this.getPendingRequests()

    // Also drain IndexedDB queue
    const idbResult = await this.drainIndexedDBQueue()

    if (pending.length === 0 && idbResult.success === 0 && idbResult.failed === 0) return { success: 0, failed: 0 }

    this.emit('sync-start', { count: pending.length + idbResult.success + idbResult.failed })

    let success = idbResult.success
    let failed = idbResult.failed
    const remaining: any[] = []

    for (const item of pending) {
      try {
        const response = await fetch(item.url, {
          method: item.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...item.headers,
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        })

        if (response.ok) {
          success++
        } else {
          remaining.push(item)
          failed++
        }
      } catch {
        remaining.push(item)
        failed++
      }
    }

    localStorage.setItem('ech-pending-sync', JSON.stringify(remaining))

    const result = { success, failed, total: pending.length + idbResult.success + idbResult.failed }
    this.emit('sync-complete', result)

    return result
  }

  /**
   * Register a background sync tag with the service worker
   */
  async registerBackgroundSync(tag: string): Promise<void> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        await (registration as any).sync.register(tag)
        console.log(`[SyncManager] Background sync registered: ${tag}`)
      } catch (error) {
        console.warn('[SyncManager] Background sync registration failed:', error)
      }
    }
  }

  // === Event Emitter ===

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args)
      } catch (error) {
        console.error(`[SyncManager] Error in event handler for "${event}":`, error)
      }
    })
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear()
    this.swRegistration = null
    this.isInitialized = false
  }
}

// Singleton instance
export const syncManager = new SyncManager()
