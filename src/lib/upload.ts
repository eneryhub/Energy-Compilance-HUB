// Energy-Compliance Hub - File Upload Helper

import { getToken } from './api'

export interface UploadResult {
  fileUrl: string
  fileName: string
  fileSize: number
  mimeType: string
}

/**
 * Upload a document file to the server.
 * Uses raw fetch with FormData (not apiFetch which sets Content-Type to JSON).
 */
export async function uploadDocument(file: File): Promise<UploadResult> {
  const token = getToken()

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error al subir archivo' }))
    throw new Error(data.error || `Error ${res.status}: Error al subir archivo`)
  }

  const data = await res.json()
  return data as UploadResult
}

/**
 * Format a file size in bytes to a human-readable string.
 * Examples: "1.5 MB", "250 KB", "1.2 GB", "512 B"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
