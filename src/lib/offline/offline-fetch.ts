// Energy-Compliance Hub — Offline-aware fetch wrapper
// Automatically queues API requests when offline and syncs when back online

'use client'

import { queueApiRequest } from '@/lib/offline/offline-queue'
import { cacheSensorData } from '@/lib/offline/offline-queue'
import { getToken } from '@/lib/api'

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

/** Check if a fetch response is a synthetic offline response from the Service Worker */
function isOfflineResponse(response: Response, bodyText: string): boolean {
  if (response.status === 503) return true
  try {
    const json = JSON.parse(bodyText)
    if (json && json.offline === true) return true
  } catch { /* not JSON */ }
  return false
}

/**
 * Offline-aware fetch wrapper.
 * - When online: Makes the request normally. If it fails, queues for later.
 * - When offline: Queues the request immediately for later sync.
 * - For sensor data: Always caches the latest reading for offline display.
 * - Handles `navigator.onLine === true` but actual network down (503/SW synthetic responses).
 */
export async function offlineFetch<T = unknown>(
  url: string,
  options: OfflineFetchOptions = {}
): Promise<OfflineFetchResult<T>> {
  const { resourceType = 'general', cacheResponse = false, body, ...fetchOptions } = options

  // Determine if this is a mutation (needs queuing when offline)
  const isMutation = options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE'

  // ── Step 1: Try to make the request ──
  // We always try, regardless of navigator.onLine (which is unreliable).
  try {
    const fetchBody = body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
    const token = typeof window !== 'undefined' ? getToken() : null

    const response = await fetch(url, {
      ...fetchOptions,
      body: fetchBody,
      headers: {
        ...fetchOptions.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
    })

    // ── Step 2a: Success ──
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
    }

    // ── Step 2b: Non-OK response — check if it's an offline indicator ──
    const responseText = await response.text()
    const offline = isOfflineResponse(response, responseText)

    if (offline && isMutation) {
      // Server/SW says offline → queue the mutation
      console.warn(`[OfflineFetch] Server returned offline indicator (${response.status}), queuing: ${url}`)
      await queueApiRequest(url, options.method || 'POST', body, resourceType)
      return { data: null, ok: false, offline: true, fromCache: false, status: 0 }
    }

    if (offline && !isMutation) {
      // GET request got offline response — try to return cached data from SW
      try {
        const jsonData = JSON.parse(responseText)
        return { data: jsonData as T, ok: false, offline: true, fromCache: true, status: response.status }
      } catch {
        return { data: null, ok: false, offline: true, fromCache: false, status: response.status }
      }
    }

    // Real server error (401, 403, 404, 422, 500, etc.)
    return { data: null, ok: false, offline: false, fromCache: false, status: response.status }
  } catch (error) {
    // ── Step 2c: Network error (fetch threw) ──
    console.warn(`[OfflineFetch] Network error, queuing: ${url}`, error)

    if (isMutation) {
      await queueApiRequest(url, options.method || 'POST', body, resourceType)
    }

    return { data: null, ok: false, offline: true, fromCache: false, status: 0 }
  }
}
