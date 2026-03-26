/** Availability from Service.weeklyAvailability JSON; slots computed from this. Booked slots stored in ServiceSlot. */

import { prisma } from "@/lib/prisma"

export type DayAvailability = { unavailable: boolean; shiftStart: string; shiftEnd: string }

export function parseWeeklyAvailability(json: unknown): DayAvailability[] | null {
  if (!Array.isArray(json) || json.length !== 7) return null
  return json.map((d) => ({
    unavailable: Boolean(d?.unavailable),
    shiftStart: typeof d?.shiftStart === "string" ? d.shiftStart : "09:00",
    shiftEnd: typeof d?.shiftEnd === "string" ? d.shiftEnd : "17:00",
  }))
}

function parseTimeHHmm(s: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!match) return { hours: 9, minutes: 0 }
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)))
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)))
  return { hours, minutes }
}

/** Compute slot windows for one day from availability. Uses UTC. */
export function slotsForDay(
  date: Date,
  dayAvailability: DayAvailability,
  durationMinutes: number
): { startTime: Date; endTime: Date }[] {
  if (dayAvailability.unavailable) return []
  const start = parseTimeHHmm(dayAvailability.shiftStart)
  const end = parseTimeHHmm(dayAvailability.shiftEnd)
  const startMinutes = start.hours * 60 + start.minutes
  let endMinutes = end.hours * 60 + end.minutes
  if (endMinutes <= startMinutes) endMinutes += 24 * 60

  const out: { startTime: Date; endTime: Date }[] = []
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()

  for (let t = startMinutes; t + durationMinutes <= endMinutes; t += durationMinutes) {
    const sh = Math.floor(t / 60) % 24
    const sm = t % 60
    const eh = Math.floor((t + durationMinutes) / 60) % 24
    const em = (t + durationMinutes) % 60
    const startTime = new Date(Date.UTC(year, month, day, sh, sm, 0, 0))
    const endTime = new Date(Date.UTC(year, month, day, eh, em, 0, 0))
    out.push({ startTime, endTime })
  }
  return out
}

const DEFAULT_DURATION_MINUTES = 60

export function computeSlotsInRange(
  weeklyAvailabilityJson: unknown,
  durationMinutes: number | null,
  fromDate: Date,
  toDate: Date,
  now: Date
): { startTime: Date; endTime: Date }[] {
  const availability = parseWeeklyAvailability(weeklyAvailabilityJson)
  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : DEFAULT_DURATION_MINUTES
  if (!availability) return []

  const from = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0))
  const to = new Date(Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999))
  const result: { startTime: Date; endTime: Date }[] = []

  for (let t = from.getTime(); t <= to.getTime(); t += 24 * 60 * 60 * 1000) {
    const date = new Date(t)
    const dayOfWeek = date.getUTCDay()
    const dayAvailability = availability[dayOfWeek]
    const slots = slotsForDay(date, dayAvailability, duration)
    for (const slot of slots) {
      if (slot.startTime.getTime() >= now.getTime()) result.push(slot)
    }
  }
  return result
}

/** Parse YYYY-MM-DD calendar date for slot range queries. */
export function parseServiceDateKey(s: string): Date | null {
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

/**
 * Available slots for a service in [from, to] (inclusive calendar days), excluding booked ServiceSlot rows.
 * Matches GET /api/customer/services/[id]/slots behaviour.
 */
export async function getAvailableServiceSlotsList(
  serviceId: string,
  fromStr: string | null,
  toStr: string | null
): Promise<
  | { ok: true; slots: { startTime: string; endTime: string }[] }
  | { ok: false; error: string; status: number }
> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, weeklyAvailability: true, duration: true },
  })
  if (!service) {
    return { ok: true, slots: [] }
  }

  const now = new Date()
  const fromDate = fromStr ? parseServiceDateKey(fromStr) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!fromDate) {
    return { ok: false, error: "Invalid from/to dates", status: 400 }
  }
  const toEnd = toStr ? parseServiceDateKey(toStr) : new Date(fromDate)
  if (!toEnd) {
    return { ok: false, error: "Invalid from/to dates", status: 400 }
  }
  if (!toStr) {
    toEnd.setDate(toEnd.getDate() + 13)
  }

  if (fromDate > toEnd) {
    return { ok: false, error: "Invalid from/to dates", status: 400 }
  }

  const computed = computeSlotsInRange(service.weeklyAvailability, service.duration, fromDate, toEnd, now)

  const fromUtc = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0))
  const toUtc = new Date(
    Date.UTC(toEnd.getFullYear(), toEnd.getMonth(), toEnd.getDate(), 23, 59, 59, 999)
  )

  const booked = await prisma.serviceSlot.findMany({
    where: {
      serviceId,
      startTime: { gte: fromUtc, lte: toUtc },
    },
    select: { startTime: true },
  })
  const bookedStarts = new Set(booked.map((s) => s.startTime.getTime()))

  const available = computed.filter((s) => !bookedStarts.has(s.startTime.getTime()))

  const slots = available.map((s) => ({
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
  }))

  return { ok: true, slots }
}

/** Create a ServiceSlot (booked) if the slot is allowed by weeklyAvailability. Returns id or throws. Used by reserve API and cart/merge. */
export async function createServiceSlotIfAllowed(
  serviceId: string,
  startTime: Date,
  endTime: Date
): Promise<{ id: string }> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, weeklyAvailability: true, duration: true },
  })
  if (!service) {
    throw new Error("Service not found")
  }
  const slotDate = new Date(startTime)
  slotDate.setUTCHours(0, 0, 0, 0)
  const now = new Date()
  const allowed = computeSlotsInRange(
    service.weeklyAvailability,
    service.duration,
    slotDate,
    slotDate,
    now
  )
  const allowedStarts = new Set(allowed.map((s) => s.startTime.getTime()))
  if (!allowedStarts.has(startTime.getTime())) {
    throw new Error("Slot not available for booking")
  }
  const slot = await prisma.serviceSlot.create({
    data: { serviceId, startTime, endTime, isBooked: true },
  })
  return { id: slot.id }
}
