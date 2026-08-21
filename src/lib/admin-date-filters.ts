export type TimeframePreset = "all" | "today" | "daily" | "weekly" | "monthly" | "specific" | "custom"

export interface DateFilterParams {
  timeframe?: string | null
  specificDate?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface PrismaDateFilter {
  gte?: Date
  lte?: Date
}

/**
 * Safely parses date strings formatted as YYYY-MM-DD or ISO strings
 * into local day boundary objects without UTC timezone day shifts.
 */
function parseDayBoundaries(dateStr: string): { startOfDay: Date; endOfDay: Date } | null {
  if (!dateStr || !dateStr.trim()) return null
  const cleaned = dateStr.trim()

  // Match YYYY-MM-DD format
  const ymdMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10) - 1
    const day = parseInt(ymdMatch[3], 10)

    const start = new Date(year, month, day, 0, 0, 0, 0)
    const end = new Date(year, month, day, 23, 59, 59, 999)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { startOfDay: start, endOfDay: end }
    }
  }

  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return null

  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { startOfDay: start, endOfDay: end }
}

/**
 * Builds a Prisma-compatible date range filter for createdAt fields
 * Supporting Daily/Today, Weekly (last 7 days), Monthly (last 30 days),
 * Specific single date, or custom startDate - endDate ranges.
 */
export function buildDateRangeFilter(params: DateFilterParams): PrismaDateFilter | undefined {
  const { timeframe, specificDate, startDate, endDate } = params
  const tf = (timeframe || "").toLowerCase().trim()

  const now = new Date()

  // 1. Specific single date
  if (specificDate && specificDate.trim()) {
    const parsed = parseDayBoundaries(specificDate)
    if (parsed) {
      return { gte: parsed.startOfDay, lte: parsed.endOfDay }
    }
  }

  // 2. Preset Timeframes
  if (tf === "today" || tf === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { gte: start, lte: end }
  }

  if (tf === "weekly" || tf === "this_week" || tf === "7days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0)
    return { gte: start, lte: now }
  }

  if (tf === "monthly" || tf === "this_month" || tf === "30days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0)
    return { gte: start, lte: now }
  }

  // 3. Custom Date Range
  const filter: PrismaDateFilter = {}
  if (startDate && startDate.trim()) {
    const parsedStart = parseDayBoundaries(startDate)
    if (parsedStart) {
      filter.gte = parsedStart.startOfDay
    }
  }

  if (endDate && endDate.trim()) {
    const parsedEnd = parseDayBoundaries(endDate)
    if (parsedEnd) {
      filter.lte = parsedEnd.endOfDay
    }
  }

  if (filter.gte || filter.lte) {
    return filter
  }

  return undefined
}
