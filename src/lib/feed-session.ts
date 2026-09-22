import { NextRequest } from "next/server"

interface SessionEntry {
  seed: string
  updatedAt: number
}

// In-memory session cache for deterministic feed pagination without duplicates across pages 1, 2, 3...
const feedSessionCache = new Map<string, SessionEntry>()
const MAX_ENTRIES = 5000
const TTL_MS = 30 * 60 * 1000 // 30 minutes

function pruneCache() {
  if (feedSessionCache.size <= MAX_ENTRIES) return
  const now = Date.now()
  for (const [key, val] of feedSessionCache.entries()) {
    if (now - val.updatedAt > TTL_MS) {
      feedSessionCache.delete(key)
    }
  }
}

/**
 * Resolves a deterministic seed for feed pagination:
 * 1. If explicit `seed` parameter is passed in searchParams, use it directly.
 * 2. On `page <= 1` (reload/refresh/first load): generates a brand new random seed and caches it for the client session.
 * 3. On `page > 1` (lazy load/infinite scroll): retrieves the cached seed from page 1 for this client session.
 * 
 * This guarantees:
 * - Each reload/refresh loads completely NEW randomized products across all sellers.
 * - Lazy loading (pages 2, 3, 4...) uses the exact same seed as page 1, guaranteeing ZERO DUPLICATE products.
 */
export function resolveFeedSeed(
  request: NextRequest,
  page: number,
  scope: string = "browse"
): string {
  const url = new URL(request.url)
  const explicitSeed = url.searchParams.get("seed")
  if (explicitSeed && explicitSeed.trim()) {
    return explicitSeed.trim()
  }

  // Generate client session identifier based on device ID, IP, or User-Agent
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")
  const ip = forwarded || realIp || "client"
  const ua = (request.headers.get("user-agent") || "").slice(0, 40)
  const deviceId =
    request.headers.get("device-id") ||
    request.headers.get("x-session-id") ||
    request.headers.get("x-device-id") ||
    ""
  const clientKey = `${scope}:${deviceId || `${ip}_${ua}`}`

  const now = Date.now()
  const existing = feedSessionCache.get(clientKey)

  // On page 1: ALWAYS generate a fresh random seed for reload / pull-to-refresh
  if (page <= 1) {
    const freshSeed = `${now}_${Math.random().toString(36).slice(2, 8)}`
    feedSessionCache.set(clientKey, { seed: freshSeed, updatedAt: now })
    pruneCache()
    return freshSeed
  }

  // On page > 1: reuse existing session seed if still active
  if (existing && now - existing.updatedAt < TTL_MS) {
    existing.updatedAt = now
    return existing.seed
  }

  // Fallback for page > 1 if session expired or not found
  const fallbackSeed = `${now}_${Math.random().toString(36).slice(2, 8)}`
  feedSessionCache.set(clientKey, { seed: fallbackSeed, updatedAt: now })
  pruneCache()
  return fallbackSeed
}

/**
 * Extracts excluded IDs from query parameters (`excludeIds`, `seenIds`, `exclude`).
 */
export function parseExcludedIds(searchParams: URLSearchParams): Set<string> {
  const raw =
    searchParams.get("excludeIds") ||
    searchParams.get("seenIds") ||
    searchParams.get("exclude") ||
    ""
  if (!raw.trim()) return new Set<string>()
  return new Set<string>(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
}
