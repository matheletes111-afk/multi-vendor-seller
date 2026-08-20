import { NextRequest, NextResponse } from "next/server"
import { GET as getCustomerFood } from "@/app/mobileapi/customer/foods/[id]/route"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/food/:id
 * Direct route alias forwarding to food detail and reviews logic.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return getCustomerFood(request, props)
}
