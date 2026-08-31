import { NextRequest, NextResponse } from "next/server"
import { runSellerOnboardingReminderSweep } from "@/lib/seller-onboarding-reminder"

function isAuthorized(req: NextRequest): boolean {
  const envInternalSecret = process.env.INTERNAL_API_SECRET?.trim()
  const envCronSecret = process.env.CRON_SECRET?.trim()

  // If no secret is configured in production, block by default
  if (!envInternalSecret && !envCronSecret) {
    if (process.env.NODE_ENV === "development") {
      return true
    }
    return false
  }

  // Check header 'x-internal-secret'
  const headerInternalSecret = req.headers.get("x-internal-secret")?.trim()
  if (headerInternalSecret && (headerInternalSecret === envInternalSecret || headerInternalSecret === envCronSecret)) {
    return true
  }

  // Check header 'x-cron-secret'
  const headerCronSecret = req.headers.get("x-cron-secret")?.trim()
  if (headerCronSecret && (headerCronSecret === envInternalSecret || headerCronSecret === envCronSecret)) {
    return true
  }

  // Check header 'authorization: Bearer <secret>'
  const authHeader = req.headers.get("authorization")?.trim()
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim()
    if (token === envInternalSecret || token === envCronSecret) {
      return true
    }
  }

  // Check query parameter '?secret=<secret>'
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
          message: "Valid authorization secret (x-internal-secret header or ?secret= query) is required.",
        },
        { status: 401 }
      )
    }

    const { searchParams } = req.nextUrl
    const dryRun = searchParams.get("dryRun") === "true" || searchParams.get("preview") === "true"
    const sellerType = (searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase() as
      | "ALL"
      | "PRODUCT"
      | "SERVICE"
      | "HOTEL"
      | "RESTAURANT"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500)
    const freeMonths = parseInt(searchParams.get("freeMonths") || "2", 10) || 2
    const customBaseUrl = searchParams.get("baseUrl")?.trim() || undefined

    const startTime = Date.now()
    const result = await runSellerOnboardingReminderSweep({
      dryRun,
      sellerType,
      limit,
      freeMonths,
      baseUrl: customBaseUrl,
    })
    const durationMs = Date.now() - startTime

    return NextResponse.json({
      ...result,
      durationMs,
      message: dryRun
        ? `[Dry Run] Found ${result.stats.pendingTotal} pending sellers. No emails sent.`
        : `Successfully processed ${result.stats.pendingTotal} pending sellers. Sent ${result.stats.sentTotal} emails, ${result.stats.failedTotal} failed.`,
    })
  } catch (error: any) {
    console.error("[Cron: Seller Onboarding Reminder] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to execute seller onboarding reminder sweep",
      },
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
          message: "Valid authorization secret (x-internal-secret header or ?secret= query) is required.",
        },
        { status: 401 }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const { searchParams } = req.nextUrl
    const dryRun =
      body.dryRun === true ||
      searchParams.get("dryRun") === "true" ||
      searchParams.get("preview") === "true"
    const sellerType = (body.sellerType || searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase() as
      | "ALL"
      | "PRODUCT"
      | "SERVICE"
      | "HOTEL"
      | "RESTAURANT"
    const limit = Math.min(
      Math.max(parseInt(body.limit || searchParams.get("limit") || "100", 10) || 100, 1),
      500
    )
    const freeMonths = parseInt(body.freeMonths || searchParams.get("freeMonths") || "2", 10) || 2
    const customBaseUrl = body.baseUrl || searchParams.get("baseUrl")?.trim() || undefined

    const startTime = Date.now()
    const result = await runSellerOnboardingReminderSweep({
      dryRun,
      sellerType,
      limit,
      freeMonths,
      baseUrl: customBaseUrl,
    })
    const durationMs = Date.now() - startTime

    return NextResponse.json({
      ...result,
      durationMs,
      message: dryRun
        ? `[Dry Run] Found ${result.stats.pendingTotal} pending sellers. No emails sent.`
        : `Successfully processed ${result.stats.pendingTotal} pending sellers. Sent ${result.stats.sentTotal} emails, ${result.stats.failedTotal} failed.`,
    })
  } catch (error: any) {
    console.error("[Cron: Seller Onboarding Reminder] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to execute seller onboarding reminder sweep",
      },
      { status: 500 }
    )
  }
}
