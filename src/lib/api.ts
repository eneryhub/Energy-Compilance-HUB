// Energy-Compliance Hub - API Client & Types

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

// ============ Token Storage ============

const TOKEN_KEY = 'ech_token'
const USER_KEY = 'ech_user'

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
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setUser(user: LoginResponse['user']): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// ============ PDF Download ============

export function downloadPdfFromBase64(base64Data: string, filename: string): void {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============ API Fetch ============

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken()
  const isFormData = options?.body instanceof FormData

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Only set Content-Type for JSON requests.
  // FormData MUST use the browser's auto-generated multipart/form-data boundary.
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  // Merge any custom headers (but don't override FormData boundary)
  if (options?.headers) {
    const customHeaders = options.headers as Record<string, string>
    for (const [key, value] of Object.entries(customHeaders)) {
      if (key.toLowerCase() === 'content-type' && isFormData) continue
      headers[key] = value
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error de servidor' }))
    throw new Error(data.error || `Error ${res.status}: Error de servidor`)
  }

  return res.json()
}
