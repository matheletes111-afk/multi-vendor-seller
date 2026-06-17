import { NextRequest, NextResponse } from "next/server"
import { createServiceSlotIfAllowed } from "@/lib/service-slots"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export const dynamic = "force-dynamic"

type SuccessResponse = { success: true; message: string; data: { serviceSlotId: string } }
type ErrorResponse = { success: false; error: string }

function unauthorized() {
  return NextResponse.json<ErrorResponse>(
    { success: false, error: "Unauthorized. Valid customer token required." },
    { status: 401 }
  )
}

/** POST /mobileapi/services/[id]/slots/reserve — body { startTime, endTime } ISO. Creates booked ServiceSlot. Auth: Bearer (customer). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const { id: serviceId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }
  const { startTime: startTimeStr, endTime: endTimeStr } = body as { startTime?: string; endTime?: string }
  if (typeof startTimeStr !== "string" || typeof endTimeStr !== "string") {
    return NextResponse.json(
      { success: false, error: "startTime and endTime required (ISO strings)" },
      { status: 400 }
    )
  }
  const startTime = new Date(startTimeStr)
  const endTime = new Date(endTimeStr)
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || startTime >= endTime) {
    return NextResponse.json({ success: false, error: "Invalid startTime or endTime" }, { status: 400 })
  }
  try {
    const { id } = await createServiceSlotIfAllowed(serviceId, startTime, endTime)
    return NextResponse.json({
      success: true,
      message: "Slot reserved",
      data: { serviceSlotId: id },
    })
  } catch (error: unknown) {
    const e = error as { code?: string }
    if (e?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "This slot was just booked by someone else" },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: false, error: "Slot not available" }, { status: 400 })
  }
}
