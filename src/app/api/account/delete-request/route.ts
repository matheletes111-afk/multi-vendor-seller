import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await auth()
    const body = await req.json().catch(() => ({}))
    const { role, panelSlug, reason, feedback, panelSettingsUrl } = body

    if (!reason) {
      return NextResponse.json(
        { error: "Reason for deletion is required." },
        { status: 400 }
      )
    }

    const ticketId = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
    const requestTimestamp = new Date().toISOString()

    const requestRecord = {
      ticketId,
      timestamp: requestTimestamp,
      userId: session?.user?.id || "guest-or-unauthenticated",
      userEmail: session?.user?.email || "not-provided",
      role: role || "CUSTOMER",
      panelSlug: panelSlug || "customer",
      reason,
      feedback: feedback || "",
      panelSettingsUrl: panelSettingsUrl || "",
      status: "PENDING_REVIEW",
    }

    console.log("[ACCOUNT_DELETION_REQUEST]", JSON.stringify(requestRecord, null, 2))

    return NextResponse.json({
      success: true,
      message: "Account deletion request received successfully.",
      ticketId,
      scheduledReviewDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
  } catch (error: any) {
    console.error("[ACCOUNT_DELETION_ERROR]", error)
    return NextResponse.json(
      { error: "Internal server error processing deletion request." },
      { status: 500 }
    )
  }
}
