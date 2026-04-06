// Energy-Compliance Hub — Offline-aware fetch wrapper
// Automatically queues API requests when offline and syncs when back online

'use client'

import { queueApiRequest } from '@/lib/offline/offline-queue'
import { cacheSensorData } from '@/lib/offline/offline-queue'

type ResourceType = 'permit' | 'document' | 'photo' | 'sensor' | 'general'

interface OfflineFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  resourceType?: ResourceType
  /** If true, data will be cached locally for offline reading */
  cacheResponse?: boolean
}

interface OfflineFetchResult<T = unknown> {
  data: T | null
  ok: boolean
  offline: boolean
  fromCache: boolean
  status: number
}

/**
 * Offline-aware fetch wrapper.
 * - When online: Makes the request normally. If it fails, queues for later.
 * - When offline: Queues the request immediately for later sync.
 * - For sensor data: Always caches the latest reading for offline display.
 */
export async function offlineFetch<T = unknown>(
  url: string,
  options: OfflineFetchOptions = {}
): Promise<OfflineFetchResult<T>> {
  const { resourceType = 'general', cacheResponse = false, body, ...fetchOptions } = options

  // For sensor GET requests — try to return cached data when offline
  if (resourceType === 'sensor' && options.method !== 'POST') {
    if (!navigator.onLine) {
      // Will try to get from SW cache (Service Worker handles this)
      // But we can also provide our own cached data
      try {
        const response = await fetch(url)
        const headers = response.headers
        
        // Check if SW returned offline data
        if (headers.get('X-Offline-Data') === 'true') {
          const data = await response.json()
          return {
            data: data as T,
            ok: true,
            offline: true,
            fromCache: true,
            status: response.status,
          }
        }
      } catch {
        // Network truly unavailable
      }
    }
  }

  // Online — make the request
  if (navigator.onLine) {
    try {
      const fetchBody = body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
      
      const response = await fetch(url, {
        ...fetchOptions,
        body: fetchBody,
        headers: {
          ...fetchOptions.headers,
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        },
      })

      if (response.ok) {
        // Cache successful sensor readings
        if (resourceType === 'sensor' && cacheResponse) {
          try {
            const data = await response.clone().json()
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item.id && item.value !== undefined) {
                  await cacheSensorData(
                    String(item.id),
                    item.companyId || '',
                    item.value,
                    item.unit || '',
                    item.status || 'NORMAL'
                  )
                }
              }
            }
          } catch {
            // Cache failure is non-critical
          }
        }

        const data = await response.json()
        return {
          data: data as T,
          ok: true,
          offline: false,
          fromCache: false,
          status: response.status,
        }
      } else {
        return {
          data: null,
          ok: false,
          offline: false,
          fromCache: false,
          status: response.status,
        }
      }
    } catch (error) {
      // Network error while supposedly online — queue the request
      console.warn(`[OfflineFetch] Request failed, queuing: ${url}`, error)
      
      if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
        await queueApiRequest(url, options.method || 'POST', body, resourceType)
      }

      return {
        data: null,
        ok: false,
        offline: true,
        fromCache: false,
        status: 0,
      }
    }
  }

  // Offline — queue mutation requests
  if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
    try {
      await queueApiRequest(url, options.method || 'POST', body, resourceType)
      console.log(`[OfflineFetch] Request queued for later sync: ${url}`)
    } catch (dbError) {
      console.error('[OfflineFetch] Failed to queue request:', dbError)
    }
  }

  return {
    data: null,
    ok: false,
    offline: true,
    fromCache: false,
    status: 0,
  }
}
