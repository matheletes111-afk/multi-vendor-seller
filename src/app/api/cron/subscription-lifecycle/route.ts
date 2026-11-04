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

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Valid authorization secret (x-cron-secret header or ?secret= query) is required.",
        },
        { status: 401 }
      )
    }

    const { searchParams } = req.nextUrl
    const dryRun = searchParams.get("dryRun") === "true" // default false on GET if explicitly run by cron

    const sweepResult = await runSubscriptionLifecycleSweep({ dryRun })
    return NextResponse.json(sweepResult)
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
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Valid authorization secret (x-cron-secret header or ?secret= query) is required.",
        },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    const sweepResult = await runSubscriptionLifecycleSweep({ dryRun })
    return NextResponse.json(sweepResult)
  } catch (error: any) {
    console.error("[POST /api/cron/subscription-lifecycle] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

