/**
 * Standalone Socket.IO Server for Meeem Delivery Real-Time GPS Tracking & Sweeper
 * Run via: node socket-server.js
 */

const { Server } = require("socket.io")
const { PrismaClient } = require("@prisma/client")
const http = require("http")

const PORT = process.env.SOCKET_PORT || 3001
const NEXT_URL = process.env.NEXTJS_INTERNAL_URL || "http://localhost:3000"
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ""

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-internal-secret")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  // REST endpoint for forwarding internal rider location updates from Next.js REST API
  if (req.method === "POST" && req.url === "/internal/location") {
    let body = ""
    req.on("data", (chunk) => { body += chunk })
    req.on("end", () => {
      try {
        const data = JSON.parse(body)
        const { riderId, orderId, latitude, longitude, heading, speed } = data || {}
        if (riderId && latitude != null && longitude != null) {
          const numLat = Number(latitude)
          const numLng = Number(longitude)
          if (!isNaN(numLat) && !isNaN(numLng) && numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180) {
            if (orderId) {
              io.to(`order:${orderId}`).emit("order:rider_moved", {
                riderId,
                orderId,
                latitude: numLat,
                longitude: numLng,
                heading: heading || 0,
                speed: speed || 0,
                timestamp: Date.now(),
              })
            }
            io.to("admin:fleet").emit("rider:moved", {
              riderId,
              latitude: numLat,
              longitude: numLng,
              heading: heading || 0,
              speed: speed || 0,
              timestamp: Date.now(),
            })
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: false, error: "Invalid JSON" }))
      }
    })
    return
  }

  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", service: "meeem-socket-server" }))
    return
  }

  res.writeHead(404)
  res.end()
})

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// In-memory tracker for DB throttle: riderId -> lastDbWriteTimestamp
const lastDbWriteTime = new Map()

// Socket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization
  const riderId = socket.handshake.auth?.riderId
  // Allow connection and store context
  socket.data = { token, riderId }
  next()
})

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`)

  // Customer or Seller joins a specific order room to watch live rider GPS
  socket.on("join_order", ({ orderId }) => {
    if (orderId) {
      socket.join(`order:${orderId}`)
      console.log(`[Socket.IO] Socket ${socket.id} joined order:${orderId}`)
    }
  })

  // Admin joins live fleet monitoring room
  socket.on("join_fleet", () => {
    socket.join("admin:fleet")
    console.log(`[Socket.IO] Socket ${socket.id} joined admin:fleet`)
  })

  // Rider streams GPS coordinates (Web or Mobile)
  socket.on("rider:location_update", async (data) => {
    const { riderId, orderId, latitude, longitude, heading, speed } = data || {}
    if (!riderId || latitude == null || longitude == null) return

    // Basic Validation: lat [-90, 90], lng [-180, 180]
    const numLat = Number(latitude)
    const numLng = Number(longitude)
    if (isNaN(numLat) || numLat < -90 || numLat > 90 || isNaN(numLng) || numLng < -180 || numLng > 180) {
      return
    }

    // 1. INSTANT BROADCAST (<50ms) to customer/seller watching this delivery
    if (orderId) {
      io.to(`order:${orderId}`).emit("order:rider_moved", {
        riderId,
        orderId,
        latitude: numLat,
        longitude: numLng,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: Date.now(),
      })
    }

    // 2. INSTANT BROADCAST to admin fleet view
    io.to("admin:fleet").emit("rider:moved", {
      riderId,
      latitude: numLat,
      longitude: numLng,
      heading: heading || 0,
      speed: speed || 0,
      timestamp: Date.now(),
    })

    // 3. THROTTLED DATABASE UPDATE (every 30 seconds per rider)
    const now = Date.now()
    const lastWrite = lastDbWriteTime.get(riderId) || 0

    if (now - lastWrite > 30000) {
      lastDbWriteTime.set(riderId, now)
      try {
        await prisma.rider.updateMany({
          where: {
            OR: [{ id: riderId }, { userId: riderId }],
          },
          data: {
            currentLatitude: numLat,
            currentLongitude: numLng,
            heading: heading != null ? Number(heading) : undefined,
            speed: speed != null ? Number(speed) : undefined,
            lastLocationUpdate: new Date(),
            isOnline: true,
          },
        })
      } catch (err) {
        console.error(`[Socket.IO] DB location update error for rider ${riderId}:`, err.message)
      }
    }
  })

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`)
  })
})

// ── Background Sweeper for Stale 60s Offers & 30m No-Shows ──────────────────
async function runDispatchSweeper() {
  try {
    const url = new URL("/api/internal/dispatch-sweeper", NEXT_URL)
    const headers = { "Content-Type": "application/json" }
    if (INTERNAL_SECRET) {
      headers["x-internal-secret"] = INTERNAL_SECRET
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
    }).catch(() => null)

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.data?.staleOffersExpired > 0 || data.data?.noShowsCancelled > 0) {
        console.log(`[Sweeper] Sweeper executed: ${JSON.stringify(data.data)}`)
      }
    }
  } catch (err) {
    // Non-blocking catch
  }
}

// Run sweeper every 30 seconds
setInterval(runDispatchSweeper, 30 * 1000)

server.listen(PORT, () => {
  console.log(`🚀 [Socket.IO] Real-time Delivery GPS Server listening on port ${PORT}`)
})
