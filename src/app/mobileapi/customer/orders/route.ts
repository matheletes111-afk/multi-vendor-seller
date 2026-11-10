import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { listCustomerOrders } from "./_helpers/order-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = await getMobileCustomerAuth(request)
  if (!authStatus.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.max(1, parseInt(searchParams.get("perPage") ?? searchParams.get("pageSize") ?? "10", 10) || 10)
  const typeRaw = searchParams.get("type")
  const kind = typeRaw === "service" ? "service" : "product"

  try {
    const result = await listCustomerOrders({
      userId: authStatus.userId,
      kind,
      page,
      pageSize,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Mobile listCustomerOrders error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
