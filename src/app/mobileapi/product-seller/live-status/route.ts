import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { getLiveStatusResponse } from "../../_helpers/live-status-helper"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/live-status
 * Dedicated Product Seller mobile live status endpoint.
 *
 * Header:
 *   Authorization: Bearer <accessToken>
 */
export async function GET(request: NextRequest) {
  return getLiveStatusResponse(request, UserRole.SELLER_PRODUCT)
}
