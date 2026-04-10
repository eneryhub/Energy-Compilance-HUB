// Energy-Compliance Hub - API Client & Types
// Optimized for large PDF ingestion (900+ pages)

const API_BASE = '/api'

// ============ Types ============

export interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    companyId: string
    companyName?: string
  }
}

export interface Permit {
  id: string
  permitNumber: string
  riskType: string
  status: string
  safetyChecks: string
  technicianName: string
  supervisorName: string
  workLocation: string
  workDescription: string
  technicianSignature?: string | null
  supervisorSignature?: string | null
  photos?: string | null
  photosCount?: number
  createdById?: string | null
  createdByName?: string | null
  createdByRole?: string | null
  approvedById?: string | null
  approvedByName?: string | null
  rejectedById?: string | null
  rejectedByName?: string | null
  workLatitude?: number | null
  workLongitude?: number | null
  workRadius?: number
  workLocationId?: string | null
  locationSource?: string
  approvedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  approveJustification?: string | null
  createdAt: string
  updatedAt?: string
}

export interface ComplianceCheck {
  isCompliant: boolean
  expiredCritical: Array<{
    id: string
    title: string
    documentType: string
    criticality: string
    expiryDate: string | null
    holderName: string | null
    daysOverdue: number
  }>
  expiringSoon: Array<{
    id: string
    title: string
    documentType: string
    criticality: string
    expiryDate: string | null
    holderName: string | null
    daysRemaining: number
  }>
  totalDocuments: number
  activeDocuments?: number
  expiredCount?: number
  criticalExpiredCount?: number
}

export interface HseDocument {
  id: string
  title: string
  documentType: string
  category: string
  criticality: string
  status: string
  issueDate?: string | null
  expiryDate?: string | null
  holderName?: string | null
  description?: string | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  createdAt: string
  updatedAt?: string
}

export interface CreatePermitRequest {
  riskType: string
  safetyChecks: Record<string, boolean>
  technicianName: string
  supervisorName: string
  workLocation: string
  workDescription: string
  technicianSignature?: string | null
  technicianSignatureGps?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  workLatitude?: number
  workLongitude?: number
  photos?: Array<{
    id: number
    data: string
    filename: string
    timestamp: string
  }>
  locationData?: {
    latitude: number
    longitude: number
    radius?: number
    source?: string
    type?: string
    id?: string
  }
}

export interface CreateDocumentRequest {
  title: string
  documentType: string
  category: string
  criticality: string
  issueDate?: string
  expiryDate?: string
  holderName?: string
  description?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
}

export interface DashboardStats {
  totalPermits: number
  pendingApprovals: number
  approvedPermits: number
  rejectedPermits: number
  activeDocuments: number
  expiredDocuments: number
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT'
  recentActivity: Array<{
    id: string
    action: string
    description: string
    timestamp: string
  }>
}

// ============ PDF Ingestion Types ============

export interface IngestRequest {
  title: string
  documentType?: string
  /** Texto plano (alternativa a pdfBase64) */
  content?: string
  /** PDF codificado en base64 */
  pdfBase64?: string
}

export interface IngestProgress {
  phase: 'reading' | 'uploading' | 'processing' | 'done' | 'error'
  percent: number
  message: string
}

export interface IngestResult {
  success: boolean
  documentTitle: string
  documentType: string
  pagesProcessed: number
  totalPages: number
  chunksCreated: number
  chunksEmbedded: number
  chunksInserted: number
  skipped: number
  processingTimeSeconds: number
  errors?: string[]
  warnings?: string[]
}

// ============ Token Storage ============

const TOKEN_KEY = 'ech_token'
const USER_KEY  = 'ech_user'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getUser(): LoginResponse['user'] | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function setUser(user: LoginResponse['user']): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// ============ PDF Download ============

export function downloadPdfFromBase64(base64Data: string, filename: string): void {
  const byteCharacters = atob(base64Data)
  const byteArray = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i)
  }
  const blob = new Blob([byteArray], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============ PDF → Base64 (cliente, sin bloquear el hilo principal) ============

/**
 * Lee un File de PDF y lo convierte a base64 usando FileReader.
 * No bloquea el hilo principal — es async y basado en eventos.
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => {
      const result = reader.result as string
      // Elimina el prefijo "data:application/pdf;base64,"
      const b64 = result.split(',')[1]
      if (!b64) reject(new Error('No se pudo extraer el base64 del archivo'))
      else resolve(b64)
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo PDF'))
    reader.readAsDataURL(file)
  })
}

/**
 * Sube un PDF para ingesta en Paperclip con reporte de progreso.
 *
 * Uso:
 * ```ts
 * for await (const progress of uploadPdfForIngestion(file, { title: 'Manual HSE' })) {
 *   console.log(progress.message, progress.percent)
 * }
 * ```
 */
export async function* uploadPdfForIngestion(
  file: File,
  opts: { title: string; documentType?: string },
  signal?: AbortSignal,
): AsyncGenerator<IngestProgress, IngestResult, void> {
  // ── Fase 1: Leer el PDF ───────────────────────────────────────────────────
  yield { phase: 'reading', percent: 5, message: 'Leyendo archivo PDF...' }

  let pdfBase64: string
  try {
    pdfBase64 = await readFileAsBase64(file)
  } catch (err: any) {
    yield { phase: 'error', percent: 0, message: `Error al leer el archivo: ${err.message}` }
    throw err
  }

  const sizeMB = Math.round(file.size / 1_048_576)
  yield { phase: 'uploading', percent: 15, message: `Enviando PDF (${sizeMB} MB) al servidor...` }

  // ── Fase 2: Enviar al servidor ────────────────────────────────────────────
  let res: Response
  try {
    res = await fetch(`${API_BASE}/ai/paperclip/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken() ?? ''}`,
      },
      body: JSON.stringify({
        title:        opts.title,
        documentType: opts.documentType ?? 'documento',
        pdfBase64,
      } satisfies IngestRequest),
      signal,
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      yield { phase: 'error', percent: 0, message: 'Ingesta cancelada por el usuario.' }
      throw err
    }
    yield { phase: 'error', percent: 0, message: `Error de red: ${err.message}` }
    throw err
  } finally {
    // Liberar el base64 de RAM (puede ser muy grande)
    ;(pdfBase64 as any) = null
  }

  yield { phase: 'processing', percent: 40, message: 'Procesando páginas y generando embeddings...' }

  // ── Fase 3: Parsear respuesta ─────────────────────────────────────────────
  let result: IngestResult
  try {
    const json = await res.json()

    if (!res.ok) {
      const errMsg = json?.error ?? `Error ${res.status} del servidor`
      yield { phase: 'error', percent: 0, message: errMsg }
      throw new Error(errMsg)
    }

    result = json as IngestResult
  } catch (err: any) {
    if (err?.name === 'SyntaxError') {
      const fallbackMsg = `El servidor devolvió una respuesta no JSON (status ${res.status}).`
      yield { phase: 'error', percent: 0, message: fallbackMsg }
      throw new Error(fallbackMsg)
    }
    throw err
  }

  yield { phase: 'done', percent: 100, message: `✅ ${result.chunksInserted} fragmentos indexados en ${result.processingTimeSeconds}s` }

  return result
}

// ============ API Fetch ============

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token       = getToken()
  const isFormData  = options?.body instanceof FormData

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (options?.headers) {
    const custom = options.headers as Record<string, string>
    for (const [k, v] of Object.entries(custom)) {
      if (k.toLowerCase() === 'content-type' && isFormData) continue
      headers[k] = v
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        const data = await res.json()
        throw new Error(data.error || data.details || data.hint || `Error ${res.status}`)
      } catch (err) {
        if (err instanceof Error) throw err
      }
    }
    throw new Error(`Error ${res.status} del servidor. Si el problema persiste, contacta al soporte.`)
  }

  return res.json()
}

// ============ API Fetch with Meta (Service Worker offline detection) ============

export interface FetchMeta {
  offline:   boolean
  cached:    boolean
  timestamp: string
}

export interface FetchWithMetaResult<T> {
  data: T
  meta: FetchMeta
}

export async function apiFetchWithMeta<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<FetchWithMetaResult<T>> {
  const token      = getToken()
  const isFormData = options?.body instanceof FormData

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  if (!isFormData) headers['Content-Type'] = 'application/json'

  if (options?.headers) {
    const custom = options.headers as Record<string, string>
    for (const [k, v] of Object.entries(custom)) {
      if (k.toLowerCase() === 'content-type' && isFormData) continue
      headers[k] = v
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error de servidor' }))
    throw new Error(data.error || `Error ${res.status}`)
  }

  const data = await res.json() as T
  const offline = res.headers.get('x-sw-cache') === 'HIT' || !navigator.onLine

  return {
    data,
    meta: {
      offline,
      cached:    res.headers.get('x-vercel-cache') === 'HIT',
      timestamp: new Date().toISOString(),
    },
  }
}