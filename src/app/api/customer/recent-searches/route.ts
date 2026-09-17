import { NextRequest } from "next/server"
import { GET as getRecentViews, POST as postRecentViews } from "../recent-views/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Backward compatibility alias for /api/customer/recent-searches.
 * Forwards requests to /api/customer/recent-views.
 */
export async function GET(request: NextRequest) {
  return getRecentViews(request)
}

export async function POST(request: NextRequest) {
  return postRecentViews(request)
}
