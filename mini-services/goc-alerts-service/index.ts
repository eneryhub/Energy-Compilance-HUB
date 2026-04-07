// ============================================================
// GOC ALERTS WEBSOCKET SERVICE
// Real-time alert broadcasting for the Global Operations Center
// Port: 3005
// ============================================================

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3005

// In-memory ring buffer of last 50 alerts (for late joiners)
const recentAlerts: Array<Record<string, unknown>> = []
const MAX_RECENT = 50

// Create HTTP server first
const httpServer = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/push') {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString())
        // Broadcast to all connected GOC dashboards
        io.emit('goc:alert', payload)
        // Store in ring buffer
        recentAlerts.unshift(payload)
        if (recentAlerts.length > MAX_RECENT) recentAlerts.pop()
        // Also emit stats update
        io.emit('goc:stats', {
          totalAlerts: recentAlerts.length,
          unacknowledged: recentAlerts.filter((a: any) => !a.isAcknowledged).length,
          critical: recentAlerts.filter((a: any) => a.severity === 'CRITICAL').length,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', port: PORT, connectedClients: io.engine.clientsCount }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found' }))
    }
  })
})

// Attach Socket.IO to the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

// ── WebSocket connections ──────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[GOC-WS] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`)

  // Send recent alerts on connect (so late joiners see history)
  socket.emit('goc:recent', recentAlerts)

  // Send current stats
  socket.emit('goc:stats', {
    totalAlerts: recentAlerts.length,
    unacknowledged: recentAlerts.filter((a: any) => !a.isAcknowledged).length,
    critical: recentAlerts.filter((a: any) => a.severity === 'CRITICAL').length,
  })

  socket.on('disconnect', (reason) => {
    console.log(`[GOC-WS] Client disconnected: ${socket.id} (${reason})`)
  })
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`[GOC-WS] Global Operations Center Alert Service running on port ${PORT}`)
})
