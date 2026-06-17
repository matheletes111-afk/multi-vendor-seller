import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { listCustomerOrders } from "@/app/mobileapi/customer/orders/_helpers/order-helpers"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"

export const dynamic = "force-dynamic"

interface SuccessResponse {
  success: true
  message: string
  data: { orders: OrderDetailApi[]; total: number; page: number; pageSize: number }
}

interface ErrorResponse {
  success: false
  error: string
}

function unauthorized() {
  return NextResponse.json<ErrorResponse>({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
}

/** GET /mobileapi/customer/orders/products/list — customer product orders list. Auth: Bearer token. */
export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) return unauthorized()

    const url = new URL(request.url)
    const pageRaw = url.searchParams.get("page")
    const page = (() => {
      const n = pageRaw ? Number(pageRaw) : 1
      if (!Number.isFinite(n) || n < 1) return 1
      return Math.floor(n)
    })()
    const pageSize = 10

    const result = await listCustomerOrders({ userId: auth.userId, kind: "product", page, pageSize })

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: "Product orders fetched successfully",
      data: result,
    })
  } catch (error) {
    console.error("Mobile product orders list error:", error)
    return NextResponse.json<ErrorResponse>({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

