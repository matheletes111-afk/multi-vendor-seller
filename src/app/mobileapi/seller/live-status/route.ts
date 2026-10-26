import { NextRequest } from "next/server"
import { getLiveStatusResponse } from "../../_helpers/live-status-helper"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/seller/live-status
 * Universal lightweight mobile endpoint for any seller role (Product, Service, Hotel, Restaurant) or Rider.
 * Reads live database state with zero caching.
 *
 * Header:
 *   Authorization: Bearer <accessToken>
 */
export async function GET(request: NextRequest) {
  return getLiveStatusResponse(request)
}
