import { NextRequest, NextResponse } from "next/server"
import { getAvailableServiceSlotsList } from "@/lib/service-slots"

/** GET .../slots?from=YYYY-MM-DD&to=YYYY-MM-DD — available slots from weeklyAvailability JSON, excluding rows in ServiceSlot (booked). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serviceId } = await params
  const { searchParams } = new URL(request.url)
  const fromStr = searchParams.get("from")
  const toStr = searchParams.get("to")

  const result = await getAvailableServiceSlotsList(serviceId, fromStr, toStr)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.slots)
}
