import { NextRequest, NextResponse } from "next/server"
import { GET as inAppGet, POST as inAppPost } from "./in-app/route"
import { POST as publicPost } from "./public/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/mobile/support
 * Convenience alias for GET /api/mobile/support/in-app
 */
export async function GET(req: NextRequest) {
  return inAppGet(req)
}

/**
 * POST /api/mobile/support
 * Routes to either public or in-app support based on source parameter ("PUBLIC" | "IN_APP", default: "IN_APP")
 */
export async function POST(req: NextRequest) {
  try {
    const clone = req.clone()
    const body = await clone.json().catch(() => ({}))
    if (body.source === "PUBLIC") {
      return publicPost(req)
    }
    return inAppPost(req)
  } catch {
    return inAppPost(req)
  }
}
