// Energy-Compliance Hub — API Key Management Library
// Generates, validates, and manages API keys for sensor integrations

import { db } from '@/lib/db'

const API_KEY_PREFIX = 'ech_live_'

/**
 * Generate a random API key string: ech_live_xxxxxxxxxxxxxxxx
 */
function generateRawKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${API_KEY_PREFIX}${result}`
}

/**
 * Hash an API key using SHA-256 for secure storage.
 * Uses Web Crypto API (crypto.subtle) when available,
 * falls back to Node.js crypto for Edge Runtime compatibility.
 */
async function hashKey(key: string): Promise<string> {
  // Try Web Crypto API first (available in Node.js 20+ and modern runtimes)
  if (typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function') {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(key)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fall through to Node.js crypto
    }
  }

  // Fallback: Node.js crypto module (works in all Node.js versions and Vercel Serverless)
  const nodeCrypto = await import('node:crypto')
  const hash = nodeCrypto.createHash('sha256').update(key).digest('hex')
  return hash
}

/**
 * Create a new API key for a company
 * Returns the full key (only shown once) and stores only the hash
 */
export async function createApiKey(params: {
  companyId: string
  userId: string
  name: string
  expiresAt?: Date
}): Promise<{ id: string; name: string; key: string; prefix: string }> {
  // Defensive: ensure required fields exist before hitting Prisma
  if (!params.userId || !params.companyId || !params.name) {
    throw new Error('Faltan datos obligatorios (userId, companyId, name). Cierra sesión y vuelve a iniciar sesión.')
  }

  const rawKey = generateRawKey()
  const keyHash = await hashKey(rawKey)
  const keyPrefix = rawKey.substring(0, API_KEY_PREFIX.length + 8) + '...'

  const record = await db.apiKey.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      name: params.name,
      keyPrefix: keyPrefix,
      keyHash,
      expiresAt: params.expiresAt || null,
    },
  })

  return {
    id: record.id,
    name: record.name,
    key: rawKey, // Full key — only returned once!
    prefix: keyPrefix,
  }
}

/**
 * Validate an API key from a request header
 * Returns the ApiKey record if valid, null otherwise
 */
export async function validateApiKey(rawKey: string): Promise<{
  id: string
  companyId: string
  name: string
  permissions: string
} | null> {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    console.warn('[ApiKey] Rejected: missing or wrong prefix', { prefix: rawKey?.substring(0, 20) || '(empty)' })
    return null
  }

  const keyHash = await hashKey(rawKey)
  console.log('[ApiKey] Looking up hash:', keyHash.substring(0, 16) + '...')

  const record = await db.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
    },
  })

  if (!record) {
    console.warn('[ApiKey] No matching active key found in DB', { hashPrefix: keyHash.substring(0, 16) })
    return null
  }

  // Check expiration
  if (record.expiresAt && record.expiresAt < new Date()) {
    return null
  }

  // Update last used timestamp (fire-and-forget)
  db.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    id: record.id,
    companyId: record.companyId,
    name: record.name,
    permissions: record.permissions,
  }
}

/**
 * List all API keys for a company (hashed only, never full keys)
 */
export async function listApiKeys(companyId: string) {
  return db.apiKey.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string, companyId: string): Promise<boolean> {
  try {
    const record = await db.apiKey.findFirst({
      where: { id, companyId },
    })
    if (!record) return false

    await db.apiKey.update({
      where: { id },
      data: { isActive: false },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(id: string, companyId: string): Promise<boolean> {
  try {
    const record = await db.apiKey.findFirst({
      where: { id, companyId },
    })
    if (!record) return false

    await db.apiKey.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}
