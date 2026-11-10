import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { getCustomerOrderDetail } from "../_helpers/order-helpers"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileCustomerAuth(request)
  if (!authStatus.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const typeRaw = request.nextUrl.searchParams.get("type")
  const kind = typeRaw === "service" ? ("service" as const) : typeRaw === "product" ? ("product" as const) : undefined

  try {
    const order = await getCustomerOrderDetail({
      userId: authStatus.userId,
      orderId: id,
      kind,
    })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (error) {
    console.error("Mobile getCustomerOrderDetail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
