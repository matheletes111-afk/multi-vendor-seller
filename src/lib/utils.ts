import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return "NLe " + new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}

/** Format slot time range from ISO strings (UTC). Use for service order slot display. */
export function formatSlotTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart)
  const e = new Date(isoEnd)
  const hh = (d: Date) => String(d.getUTCHours()).padStart(2, "0")
  const mm = (d: Date) => String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh(s)}:${mm(s)} – ${hh(e)}:${mm(e)} UTC`
}

export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

export function extractFoodImages(raw: unknown): string[] {
  if (!raw) return []

  if (Array.isArray(raw)) {
    const result: string[] = []
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        result.push(item.trim())
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        const url = obj.url || obj.src || obj.path || obj.image
        if (typeof url === "string" && url.trim()) {
          result.push(url.trim())
        }
      }
    }
    return result
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []

    if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed)
        return extractFoodImages(parsed)
      } catch {
        // Fall through
      }
    }

    if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:") || trimmed.includes(".")) {
      return [trimmed]
    }
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    const url = obj.url || obj.src || obj.path || obj.image
    if (typeof url === "string" && url.trim()) {
      return [url.trim()]
    }
  }

  return []
}