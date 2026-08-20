import { NextRequest, NextResponse } from "next/server"
import { GET as getCustomerHotel } from "@/app/mobileapi/customer/hotels/[id]/route"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/hotels/:id
 * Direct route alias forwarding to hotel detail and reviews logic.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return getCustomerHotel(request, props)
}
