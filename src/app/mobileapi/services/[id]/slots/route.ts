import { NextRequest, NextResponse } from "next/server"
import { getAvailableServiceSlotsList } from "@/lib/service-slots"

export const dynamic = "force-dynamic"

type SuccessResponse = {
  success: true
  message: string
  data: { slots: { startTime: string; endTime: string }[] }
}
type ErrorResponse = { success: false; error: string }

/** GET /mobileapi/services/[id]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD — same slot rules as web /api/customer/services/[id]/slots. Public. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: serviceId } = await params
    const { searchParams } = new URL(request.url)
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")

    const result = await getAvailableServiceSlotsList(serviceId, fromStr, toStr)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      message: "Slots fetched successfully",
      data: { slots: result.slots },
    })
  } catch (error) {
    console.error("Mobile service slots API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
