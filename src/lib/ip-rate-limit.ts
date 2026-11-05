import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// In-memory fallback in case of transient database connection issues
interface MemoryRateLimitRecord {
  timestamps: number[]
}
const memoryFallbackStore = new Map<string, MemoryRateLimitRecord>()

/**
 * Extracts and sanitizes client IP from trusted reverse proxy and CDN headers.
 * Cloudflare's `cf-connecting-ip` cannot be spoofed by the client when behind Cloudflare.
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare True Client IP (highest trust when routed through Cloudflare)
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp && isValidIp(cfIp)) return cfIp

  const trueClientIp = request.headers.get("true-client-ip")?.trim()
  if (trueClientIp && isValidIp(trueClientIp)) return trueClientIp

  // 2. Standard X-Real-IP
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp && isValidIp(realIp)) return realIp

  // 3. X-Forwarded-For: Take the first (original client) IP and sanitize
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim()
    if (firstIp && isValidIp(firstIp)) return firstIp
  }

  return "127.0.0.1"
}

function isValidIp(ip: string): boolean {
  // Simple regex for valid IPv4 or IPv6
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/
  const ipv6Regex = /^[0-9a-fA-F:]+$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

export interface RateLimitOptions {
  maxRequests?: number      // Default: 3 requests
  windowSeconds?: number    // Default: 60 seconds (1 minute)
  action?: string           // e.g. "otp", "register", "login", "forgot_password"
}

export interface RateLimitResult {
  allowed: boolean
  clientIp: string
  remaining: number
  response?: NextResponse
}

/**
 * Checks and increments the IP rate limit using atomic PostgreSQL upsert in the DB.
 * Persists across server restarts, deploys, and multiple container instances.
 * Falls back gracefully to in-memory sliding window if DB has a momentary blip.
 */
export async function checkIpRateLimit(
  request: Request,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const maxRequests = options.maxRequests ?? 3
  const windowSeconds = options.windowSeconds ?? 60
  const action = options.action ?? "otp"
  const clientIp = getClientIp(request)
  const key = `ip:${action}:${clientIp}`
  const now = Date.now()

  try {
    const id = `ip_${action}_${clientIp.replace(/[^a-zA-Z0-9_]/g, "_")}`
    const expireAt = new Date(now + windowSeconds * 1000)

    // Atomic DB upsert on security_rate_limits
    const rows: any = await prisma.$queryRawUnsafe(`
      INSERT INTO "security_rate_limits" ("id", "key", "points", "expireAt", "createdAt", "updatedAt")
      VALUES ($1, $2, 1, $3, NOW(), NOW())
      ON CONFLICT ("key") DO UPDATE
      SET
        "points" = CASE
          WHEN "security_rate_limits"."expireAt" < NOW() THEN 1
          ELSE "security_rate_limits"."points" + 1
        END,
        "expireAt" = CASE
          WHEN "security_rate_limits"."expireAt" < NOW() THEN $3
          ELSE "security_rate_limits"."expireAt"
        END,
        "updatedAt" = NOW()
      RETURNING "points", "expireAt";
    `, id, key, expireAt)

    if (rows && rows.length > 0) {
      const points = Number(rows[0].points)
      const resetTimeSec = Math.max(1, Math.ceil((new Date(rows[0].expireAt).getTime() - now) / 1000))

      if (points > maxRequests) {
        return {
          allowed: false,
          clientIp,
          remaining: 0,
          response: NextResponse.json(
            {
              success: false,
              error: `Too many requests from your IP. Please wait ${resetTimeSec} seconds before trying again.`,
              retryAfter: resetTimeSec,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(resetTimeSec),
              },
            }
          ),
        }
      }

      return {
        allowed: true,
        clientIp,
        remaining: Math.max(0, maxRequests - points),
      }
    }
  } catch (dbError) {
    console.warn("[RateLimit] DB check failed, using in-memory fallback:", dbError)
  }

  // Fallback: In-memory sliding window
  const windowMs = windowSeconds * 1000
  let mem = memoryFallbackStore.get(key)
  if (!mem) {
    mem = { timestamps: [] }
    memoryFallbackStore.set(key, mem)
  }
  const cutoff = now - windowMs
  mem.timestamps = mem.timestamps.filter((t) => t > cutoff)

  if (mem.timestamps.length >= maxRequests) {
    const waitSec = Math.max(1, Math.ceil((mem.timestamps[0] + windowMs - now) / 1000))
    return {
      allowed: false,
      clientIp,
      remaining: 0,
      response: NextResponse.json(
        {
          success: false,
          error: `Too many requests. Please wait ${waitSec} seconds before trying again.`,
          retryAfter: waitSec,
        },
        { status: 429, headers: { "Retry-After": String(waitSec) } }
      ),
    }
  }

  mem.timestamps.push(now)
  return {
    allowed: true,
    clientIp,
    remaining: maxRequests - mem.timestamps.length,
  }
}
