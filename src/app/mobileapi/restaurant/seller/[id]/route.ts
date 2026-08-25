import { NextRequest } from "next/server"
import { GET as getRestaurantDetail } from "@/app/mobileapi/restaurants/[id]/route"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/restaurant/seller/:id
 * Alias forwarding to /mobileapi/restaurants/:id
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return getRestaurantDetail(request, props)
}
