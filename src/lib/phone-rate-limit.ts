import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "./twilio-sms"

const COOLDOWN_SECONDS = 60 // 60 seconds between OTP SMS to the same phone
const DAILY_SECONDS = 24 * 60 * 60 // 24 hours
const MAX_DAILY_SMS = 9 // Maximum 9 SMS OTPs per number per day (user requested)

// In-memory fallback tracking for phone number OTP throttling
interface MemoryPhoneHistory {
  lastSentAt: number
  sentTimestamps: number[]
}
const memoryPhoneStore = new Map<string, MemoryPhoneHistory>()

export interface PhoneLimitResult {
  allowed: boolean
  response?: NextResponse
}

/**
 * Standardizes any phone input into uniform E.164 representation
 * so local numbers (079...), 8-digit numbers (79...), and international (+232...)
 * always map to the exact same rate limit key.
 */
function getCanonicalPhoneKey(rawPhone: string): string {
  if (!rawPhone) return ""
  const normalized = normalizePhoneNumber(rawPhone, "+232")
  if (normalized) return normalized.replace(/\D/g, "")
  return rawPhone.replace(/\D/g, "")
}

/**
 * Checks cooldown (60s) and daily cap (max 9 SMS/day) for a target phone number using PostgreSQL DB.
 * Persists across server restarts, deploys, and container instances.
 */
export async function checkPhoneOtpLimit(rawPhone: string): Promise<PhoneLimitResult> {
  if (!rawPhone) return { allowed: true }
  const cleanPhone = getCanonicalPhoneKey(rawPhone)
  if (!cleanPhone) return { allowed: true }

  const now = Date.now()
  const cooldownKey = `phone_cooldown:${cleanPhone}`
  const dailyKey = `phone_daily:${cleanPhone}`

  try {
    // 1. Check 60-second cooldown in DB
    const cooldownId = `pc_${cleanPhone}`
    const cooldownExpireAt = new Date(now + COOLDOWN_SECONDS * 1000)

    const cooldownRows: any = await prisma.$queryRawUnsafe(`
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
    `, cooldownId, cooldownKey, cooldownExpireAt)

    if (cooldownRows && cooldownRows.length > 0) {
      const points = Number(cooldownRows[0].points)
      const waitSec = Math.max(1, Math.ceil((new Date(cooldownRows[0].expireAt).getTime() - now) / 1000))

      if (points > 1) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              success: false,
              error: `Please wait ${waitSec} seconds before requesting another OTP.`,
              retryAfter: waitSec,
            },
            { status: 429, headers: { "Retry-After": String(waitSec) } }
          ),
        }
      }
    }

    // 2. Check 24-hour daily limit in DB (max 9 SMS/day)
    const dailyId = `pd_${cleanPhone}`
    const dailyExpireAt = new Date(now + DAILY_SECONDS * 1000)

    const dailyRows: any = await prisma.$queryRawUnsafe(`
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
    `, dailyId, dailyKey, dailyExpireAt)

    if (dailyRows && dailyRows.length > 0) {
      const dailyPoints = Number(dailyRows[0].points)

      if (dailyPoints > MAX_DAILY_SMS) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              success: false,
              error: "Daily OTP verification limit (9/day) reached for this phone number. Please try again tomorrow.",
            },
            { status: 429 }
          ),
        }
      }
    }

    return { allowed: true }
  } catch (dbError) {
    console.warn("[PhoneRateLimit] DB check failed, using in-memory fallback:", dbError)
  }

  // Fallback: In-memory store
  let history = memoryPhoneStore.get(cleanPhone)
  if (!history) {
    history = { lastSentAt: 0, sentTimestamps: [] }
    memoryPhoneStore.set(cleanPhone, history)
  }

  if (now - history.lastSentAt < COOLDOWN_SECONDS * 1000) {
    const waitSec = Math.ceil((COOLDOWN_SECONDS * 1000 - (now - history.lastSentAt)) / 1000)
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Please wait ${waitSec} seconds before requesting another OTP.`,
          retryAfter: waitSec,
        },
        { status: 429, headers: { "Retry-After": String(waitSec) } }
      ),
    }
  }

  const cutoff = now - DAILY_SECONDS * 1000
  history.sentTimestamps = history.sentTimestamps.filter((t) => t > cutoff)

  if (history.sentTimestamps.length >= MAX_DAILY_SMS) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Daily OTP verification limit (9/day) reached for this phone number. Please try again tomorrow.",
        },
        { status: 429 }
      ),
    }
  }

  history.lastSentAt = now
  history.sentTimestamps.push(now)
  return { allowed: true }
}

/**
 * Backward compatibility stub — atomic DB check already tracks counts directly on checkPhoneOtpLimit.
 */
export function recordPhoneOtpSent(rawPhone: string): void {
  // DB record is atomically updated in checkPhoneOtpLimit
}
