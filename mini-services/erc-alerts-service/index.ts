// ============================================================
// ERC ALERTS WEBSOCKET SERVICE
// Real-time Emergency Response Center alerts using Socket.IO
// Port: 3004
// ============================================================

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3004

// ── Per-company tracking ───────────────────────────────────

// Map of companyId -> Set of socket ids currently connected
const companyRooms = new Map<string, Set<string>>()

// Map of socket id -> companyId (to clean up on disconnect)
const socketCompanyMap = new Map<string, string>()

function getCompanyConnectionCount(companyId: string): number {
  return companyRooms.get(companyId)?.size ?? 0
}

function getCompanyRoomStats(): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const [companyId, sockets] of companyRooms) {
    stats[companyId] = sockets.size
  }
  return stats
}

// ── HTTP server for health check ───────────────────────────

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'erc-alerts-service',
        port: PORT,
        connectedClients: io.engine.clientsCount,
        companyRooms: getCompanyRoomStats(),
        uptime: process.uptime(),
      }),
    )
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found' }))
  }
})

// ── Socket.IO server ───────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

// ── WebSocket connection handling ───────────────────────────

io.on('connection', (socket) => {
  console.log(`[ERC-WS] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`)

  // ── Join company room ──────────────────────────────────
  socket.on('join-company', (data: { companyId: string }) => {
    const { companyId } = data

    if (!companyId) {
      console.warn(`[ERC-WS] join-company rejected — missing companyId from ${socket.id}`)
      return
    }

    // Leave previous room if switching companies
    const previousCompany = socketCompanyMap.get(socket.id)
    if (previousCompany && previousCompany !== companyId) {
      socket.leave(previousCompany)
      const prevSockets = companyRooms.get(previousCompany)
      if (prevSockets) {
        prevSockets.delete(socket.id)
        if (prevSockets.size === 0) companyRooms.delete(previousCompany)
      }
      console.log(`[ERC-WS] ${socket.id} left room ${previousCompany}`)
    }

    // Join the new company room
    socket.join(companyId)
    socketCompanyMap.set(socket.id, companyId)

    // Track connection count
    if (!companyRooms.has(companyId)) {
      companyRooms.set(companyId, new Set())
    }
    companyRooms.get(companyId)!.add(socket.id)

    const count = getCompanyConnectionCount(companyId)
    console.log(`[ERC-WS] ${socket.id} joined company room "${companyId}" (${count} clients in room)`)

    // Send the active connection count back to the joining client
    socket.emit('room-joined', {
      companyId,
      connectionCount: count,
      totalActiveRooms: companyRooms.size,
    })
  })

  // ── New emergency alert ────────────────────────────────
  socket.on('new-alert', (data: { companyId: string; alert: unknown }) => {
    const { companyId, alert } = data

    if (!companyId) {
      console.warn(`[ERC-WS] new-alert rejected — missing companyId from ${socket.id}`)
      return
    }

    const count = getCompanyConnectionCount(companyId)
    console.log(`[ERC-WS] New emergency alert for "${companyId}" from ${socket.id}, broadcasting to ${count - 1} other clients`)

    // Broadcast to all clients in the company room EXCEPT the sender
    socket.to(companyId).emit('emergency-alert', {
      alert,
      timestamp: new Date().toISOString(),
      sourceSocketId: socket.id,
    })
  })

  // ── Alert status update (attended/resolved) ────────────
  socket.on('alert-updated', (data: { companyId: string; alert: unknown }) => {
    const { companyId, alert } = data

    if (!companyId) {
      console.warn(`[ERC-WS] alert-updated rejected — missing companyId from ${socket.id}`)
      return
    }

    const count = getCompanyConnectionCount(companyId)
    console.log(`[ERC-WS] Alert status changed for "${companyId}" from ${socket.id}, broadcasting to ${count - 1} other clients`)

    // Broadcast to all clients in the company room EXCEPT the sender
    socket.to(companyId).emit('alert-status-changed', {
      alert,
      timestamp: new Date().toISOString(),
      sourceSocketId: socket.id,
    })
  })

  // ── Disconnect ─────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[ERC-WS] Client disconnected: ${socket.id} (${reason}, total: ${io.engine.clientsCount})`)

    // Clean up company room tracking
    const companyId = socketCompanyMap.get(socket.id)
    if (companyId) {
      const sockets = companyRooms.get(companyId)
      if (sockets) {
        sockets.delete(socket.id)
        const remaining = sockets.size
        console.log(`[ERC-WS] Room "${companyId}" now has ${remaining} client(s)`)
        if (remaining === 0) {
          companyRooms.delete(companyId)
          console.log(`[ERC-WS] Room "${companyId}" removed (empty)`)
        }
      }
      socketCompanyMap.delete(socket.id)
    }
  })
})

// ── Start server ────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[ERC-WS] Emergency Response Center Alert Service running on port ${PORT}`)
  console.log(`[ERC-WS] Health check: http://localhost:${PORT}/health`)
})
