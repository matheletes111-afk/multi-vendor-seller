import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeSlotsInRange } from "@/lib/service-slots"

/** GET .../slots?from=YYYY-MM-DD&to=YYYY-MM-DD — available slots from weeklyAvailability JSON, excluding rows in ServiceSlot (booked). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serviceId } = await params
  const { searchParams } = new URL(request.url)
  const fromStr = searchParams.get("from")
  const toStr = searchParams.get("to")

  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, weeklyAvailability: true, duration: true, serviceType: true },
  })
  if (!service || service.serviceType !== "APPOINTMENT") {
    return NextResponse.json([])
  }

  const now = new Date()
  const fromDate = fromStr ? parseDate(fromStr) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const toDate = toStr ? parseDate(toStr) : new Date(fromDate ?? now)
  if (toDate) toDate.setDate(toDate.getDate() + 13)

  if (!fromDate || !toDate || fromDate > toDate) {
    return NextResponse.json({ error: "Invalid from/to dates" }, { status: 400 })
  }

  const computed = computeSlotsInRange(
    service.weeklyAvailability,
    service.duration,
    fromDate,
    toDate,
    now
  )

  const fromUtc = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0))
  const toUtc = new Date(Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999))

  const booked = await prisma.serviceSlot.findMany({
    where: {
      serviceId,
      startTime: { gte: fromUtc, lte: toUtc },
    },
    select: { startTime: true },
  })
  const bookedStarts = new Set(booked.map((s) => s.startTime.getTime()))

  const available = computed.filter((s) => !bookedStarts.has(s.startTime.getTime()))

  const list = available.map((s) => ({
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
  }))

  return NextResponse.json(list)
}

function parseDate(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!match) return null
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10) - 1
  const d = parseInt(match[3], 10)
  if (m < 0 || m > 11 || d < 1 || d > 31) return null
  const date = new Date(y, m, d)
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null
  return date
}
