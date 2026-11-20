import { NextRequest, NextResponse } from "next/server"
import { runSubscriptionLifecycleSweep } from "@/lib/subscription-lifecycle"

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  const envInternalSecret = process.env.INTERNAL_API_SECRET?.trim()
  const envCronSecret = process.env.CRON_SECRET?.trim()

  if (!envInternalSecret && !envCronSecret) {
    if (process.env.NODE_ENV === "development") {
      return true
    }
    return false
  }

  const headerInternalSecret = req.headers.get("x-internal-secret")?.trim()
  if (headerInternalSecret && (headerInternalSecret === envInternalSecret || headerInternalSecret === envCronSecret)) {
    return true
  }

  const headerCronSecret = req.headers.get("x-cron-secret")?.trim()
  if (headerCronSecret && (headerCronSecret === envInternalSecret || headerCronSecret === envCronSecret)) {
    return true
  }

  const authHeader = req.headers.get("authorization")?.trim()
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim()
    if (token === envInternalSecret || token === envCronSecret) {
      return true
    }
  }

  const querySecret = req.nextUrl.searchParams.get("secret")?.trim()
  if (querySecret && (querySecret === envInternalSecret || querySecret === envCronSecret)) {
    return true
  }

  return false
}

async function handleLifecycleRequest(req: NextRequest, dryRun: boolean, method: "GET" | "POST") {
  if (!isAuthorized(req)) {
    console.warn(`[${method} /api/cron/subscription-lifecycle] Unauthorized request rejected (401)`)
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Valid authorization secret (x-internal-secret, x-cron-secret header, Bearer token, or ?secret= query) is required.",
      },
      { status: 401 }
    )
  }

  const startTime = Date.now()
  const sweepResult = await runSubscriptionLifecycleSweep({ dryRun })
  const durationMs = Date.now() - startTime

  console.log(`[${method} /api/cron/subscription-lifecycle] Sweep completed`, {
    success: sweepResult.success,
    dryRun,
    durationMs,
    stalePendingFailedCount: sweepResult.stalePendingFailedCount,
    expiredCount: sweepResult.expiredCount,
    promotedCount: sweepResult.promotedCount,
    remindersSent: sweepResult.remindersSent,
    errorCount: sweepResult.errors.length,
  })

  return NextResponse.json(
    { ...sweepResult, durationMs },
    { status: sweepResult.success ? 200 : 500 }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const dryRun = searchParams.get("dryRun") === "true" // default false on GET if explicitly run by cron
    return await handleLifecycleRequest(req, dryRun, "GET")
  } catch (error: any) {
    console.error("[GET /api/cron/subscription-lifecycle] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedBody =
      typeof rawBody === "string"
        ? await Promise.resolve().then(() => JSON.parse(rawBody)).catch(() => ({}))
        : rawBody
    const dryRun = parsedBody?.dryRun === true
    return await handleLifecycleRequest(req, dryRun, "POST")
  } catch (error: any) {
    console.error("[POST /api/cron/subscription-lifecycle] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
