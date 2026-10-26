import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { getLiveStatusResponse } from "../../_helpers/live-status-helper"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/service-seller/live-status
 * Dedicated Service Seller mobile live status endpoint.
 *
 * Header:
 *   Authorization: Bearer <accessToken>
 */
export async function GET(request: NextRequest) {
  return getLiveStatusResponse(request, UserRole.SELLER_SERVICE)
}
