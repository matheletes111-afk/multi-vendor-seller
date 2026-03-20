import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import {
  getCustomerOrderDetail,
  type CustomerOrderKind,
} from "@/app/mobileapi/customer/orders/_helpers/order-helpers"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"

export const dynamic = "force-dynamic"

interface SuccessResponse {
  success: true
  message: string
  data: OrderDetailApi
}

interface ErrorResponse {
  success: false
  error: string
}

function unauthorized() {
  return NextResponse.json<ErrorResponse>({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
}

const kind: CustomerOrderKind = "service"

/** GET /mobileapi/customer/orders/services/details/[id] — service order details for current customer. Auth: Bearer token. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const auth = getMobileCustomerAuth(request)
    if (!auth.ok) return unauthorized()

    const { id: orderId } = await params

    const order = await getCustomerOrderDetail({ userId: auth.userId, orderId, kind })
    if (!order) {
      return NextResponse.json<ErrorResponse>({ success: false, error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: "Order details fetched successfully",
      data: order,
    })
  } catch (error) {
    console.error("Mobile service order details error:", error)
    return NextResponse.json<ErrorResponse>({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

