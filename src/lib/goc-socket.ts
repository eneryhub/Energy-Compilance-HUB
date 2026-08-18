// ============================================================
// GOC WebSocket Client Helper
// Pushes alerts to the GOC Alerts WebSocket service (port 3005)
// Non-blocking: failures are silently ignored
// ============================================================

const GOC_WS_PORT = 3005

interface GOCWSPayload {
  id: string
  companyId: string
  companyName?: string
  type: string
  severity: string
  title: string
  message: string
  metadata: string | null
  isAcknowledged: boolean
  isEnterprise?: boolean
  errorCode?: string
  relatedEntityId?: string | null
  relatedEntityType?: string | null
  createdAt: string
}

/**
 * Push an alert to the GOC WebSocket service via HTTP relay.
 * The GOC mini-service exposes a POST /push endpoint that broadcasts to connected clients.
 * This avoids direct Socket.IO client dependency in the Next.js server.
 */
export async function pushToGOC(payload: GOCWSPayload): Promise<void> {
  try {
    const url = `http://localhost:${GOC_WS_PORT}/push`
    const controller = new AbortController()
    // 2 second timeout — don't block the caller
    const timeout = setTimeout(() => controller.abort(), 2000)

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch {
    // GOC service not running — silently ignore
    // Alerts are still persisted in DB and can be fetched via REST API
  }
}
