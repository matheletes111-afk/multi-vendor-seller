import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import {
  getBulkCustomEmailRecipients,
  sendBulkCustomEmailChunk,
  type BulkSellerTypeFilter,
  type BulkSellerStatusFilter,
} from "@/lib/bulk-custom-email"

/**
 * GET /api/admin/sellers/send-bulk-custom-email
 * Preview recipients and counts based on sellerType and statusFilter (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sellerType = (searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase() as BulkSellerTypeFilter
    const statusFilter = (searchParams.get("status") || searchParams.get("statusFilter") || "ALL").toUpperCase() as BulkSellerStatusFilter
    const search = searchParams.get("search") || undefined
    const sellerIdsParam = searchParams.get("sellerIds")
    const sellerIds = sellerIdsParam ? sellerIdsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined

    const summary = await getBulkCustomEmailRecipients({
      sellerType,
      statusFilter,
      sellerIds,
      search,
    })

    return NextResponse.json({
      success: true,
      total: summary.total,
      byType: summary.byType,
      recipients: summary.recipients.slice(0, 100), // first 100 preview
    })
  } catch (error: any) {
    console.error("[Admin API] Error in bulk custom email preview:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to preview recipients" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/sellers/send-bulk-custom-email
 * Chunked dispatcher for bulk custom email broadcast (Admin only).
 * Handles batching via offset and limit to avoid HTTP timeout and rate limits.
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
    const sellerType = (body.sellerType || searchParams.get("sellerType") || "ALL").toUpperCase() as BulkSellerTypeFilter
    const statusFilter = (body.statusFilter || searchParams.get("statusFilter") || "ALL").toUpperCase() as BulkSellerStatusFilter
    const subject = (body.subject || "").trim()
    const message = (body.message || "").trim()
    const senderLabel = (body.senderLabel || "MEEEM Partner Operations").trim()
    const offset = Math.max(parseInt(body.offset || searchParams.get("offset") || "0", 10) || 0, 0)
    const limit = Math.min(Math.max(parseInt(body.limit || searchParams.get("limit") || "10", 10) || 10, 1), 50)
    const sellerIds = Array.isArray(body.sellerIds) && body.sellerIds.length > 0 ? body.sellerIds : undefined

    if (!dryRun) {
      if (!subject) {
        return NextResponse.json(
          { error: "Subject is required to send broadcast email" },
          { status: 400 }
        )
      }
      if (!message) {
        return NextResponse.json(
          { error: "Message body is required to send broadcast email" },
          { status: 400 }
        )
      }
    }

    // 1. Fetch matching recipients
    const summary = await getBulkCustomEmailRecipients({
      sellerType,
      statusFilter,
      sellerIds,
    })

    const totalEligible = summary.total
    const chunkRecipients = summary.recipients.slice(offset, offset + limit)

    // 2. Dispatch chunk
    const chunkResult = await sendBulkCustomEmailChunk({
      recipients: chunkRecipients,
      subject,
      message,
      senderLabel,
      dryRun,
    })

    const hasMore = offset + limit < totalEligible
    const nextOffset = hasMore ? offset + limit : null

    return NextResponse.json({
      success: true,
      dryRun,
      totalEligible,
      offset,
      limit,
      processed: chunkResult.processed,
      sent: chunkResult.sent,
      failed: chunkResult.failed,
      hasMore,
      nextOffset,
      results: chunkResult.results,
    })
  } catch (error: any) {
    console.error("[Admin API] Error in bulk custom email chunk:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process bulk custom email" },
      { status: 500 }
    )
  }
}
