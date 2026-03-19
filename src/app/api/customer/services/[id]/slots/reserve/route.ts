import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServiceSlotIfAllowed } from "@/lib/service-slots"
import { UserRole } from "@prisma/client"

/** POST .../slots/reserve — body { startTime, endTime } ISO. Creates ServiceSlot (booked), returns { id }. 409 if already taken. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: serviceId } = await params
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const { startTime: startTimeStr, endTime: endTimeStr } = body as { startTime?: string; endTime?: string }
  if (typeof startTimeStr !== "string" || typeof endTimeStr !== "string") {
    return NextResponse.json({ error: "startTime and endTime required (ISO strings)" }, { status: 400 })
  }
  const startTime = new Date(startTimeStr)
  const endTime = new Date(endTimeStr)
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || startTime >= endTime) {
    return NextResponse.json({ error: "Invalid startTime or endTime" }, { status: 400 })
  }
  try {
    const { id } = await createServiceSlotIfAllowed(serviceId, startTime, endTime)
    return NextResponse.json({ id })
  } catch (error: unknown) {
    const e = error as { code?: string }
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "This slot was just booked by someone else" }, { status: 409 })
    }
    return NextResponse.json({ error: "Slot not available" }, { status: 400 })
  }
}
