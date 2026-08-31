import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { runSellerOnboardingReminderSweep } from "@/lib/seller-onboarding-reminder"

/**
 * GET /api/admin/sellers/send-onboarding-reminders
 * Preview or test run the seller onboarding reminder sweep (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get("dryRun") !== "false" // default to preview/dryRun for GET
    const sellerType = (searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase() as
      | "ALL"
      | "PRODUCT"
      | "SERVICE"
      | "HOTEL"
      | "RESTAURANT"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500)
    const freeMonths = parseInt(searchParams.get("freeMonths") || "2", 10) || 2

    const result = await runSellerOnboardingReminderSweep({
      dryRun,
      sellerType,
      limit,
      freeMonths,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Admin API] Error in onboarding reminder sweep:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process reminder sweep" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/sellers/send-onboarding-reminders
 * Trigger live or dry-run seller onboarding reminder emails (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const { searchParams } = new URL(request.url)
    const dryRun = body.dryRun === true || searchParams.get("dryRun") === "true"
    const sellerType = (body.sellerType || searchParams.get("sellerType") || "ALL").toUpperCase() as
      | "ALL"
      | "PRODUCT"
      | "SERVICE"
      | "HOTEL"
      | "RESTAURANT"
    const limit = Math.min(Math.max(parseInt(body.limit || searchParams.get("limit") || "100", 10) || 100, 1), 500)
    const freeMonths = parseInt(body.freeMonths || searchParams.get("freeMonths") || "2", 10) || 2

    const result = await runSellerOnboardingReminderSweep({
      dryRun,
      sellerType,
      limit,
      freeMonths,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Admin API] Error in onboarding reminder sweep:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to trigger reminder sweep" },
      { status: 500 }
    )
  }
}
