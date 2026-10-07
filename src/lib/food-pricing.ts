/**
 * Shared food pricing helpers.
 * DB stores `price` (regular MRP) and `discount` (amount off). Customers pay price - discount.
 */

export function effectiveFoodPrice(price: number, discount?: number | null): number {
  return Math.max(0, price - (discount || 0))
}

/** Reads the selling price field from form data. Keeps empty string "" (meaning "clear discount"). */
export function readSellingPriceField(formData: FormData): string | null {
  for (const key of ["sellingPrice", "selling_price", "discount"]) {
    const v = formData.get(key)
    if (v !== null && typeof v === "string") return v
  }
  return null
}

export type DiscountResult =
  | { ok: true; discount: number | undefined } // undefined => field not provided
  | { ok: false; error: string }

/**
 * Converts a seller-entered selling price into a stored discount amount.
 * - null  => not provided (undefined discount)
 * - ""    => cleared (discount 0)
 * - value => must be > 0 and <= price
 */
export function computeFoodDiscount(
  price: number,
  rawSellingPrice: string | number | null | undefined
): DiscountResult {
  if (rawSellingPrice === null || rawSellingPrice === undefined) {
    return { ok: true, discount: undefined }
  }

  if (typeof rawSellingPrice === "number") {
    if (isNaN(rawSellingPrice) || rawSellingPrice <= 0) {
      return { ok: false, error: "Selling price must be greater than 0" }
    }
    if (rawSellingPrice > price) {
      return { ok: false, error: `Selling price (${rawSellingPrice}) cannot exceed regular price (${price})` }
    }
    return { ok: true, discount: Math.round((price - rawSellingPrice) * 100) / 100 }
  }

  const str = String(rawSellingPrice)
  const trimmed = str.trim()
  if (trimmed === "") return { ok: true, discount: 0 }

  const sellingPrice = parseFloat(trimmed)
  if (isNaN(sellingPrice) || sellingPrice <= 0) {
    return { ok: false, error: "Selling price must be greater than 0" }
  }
  if (sellingPrice > price) {
    return { ok: false, error: `Selling price (${sellingPrice}) cannot exceed regular price (${price})` }
  }
  return { ok: true, discount: Math.round((price - sellingPrice) * 100) / 100 }
}

/**
 * Collects gallery image URLs sent as `imageUrls` (repeated field, JSON array string, or pipe/newline list).
 * Only http(s) URLs are accepted; capped at 10.
 */
export function readImageUrlsField(formData: FormData): string[] {
  const out: string[] = []
  for (const entry of formData.getAll("imageUrls")) {
    if (typeof entry !== "string") continue
    const s = entry.trim()
    if (!s) continue
    if (s.startsWith("[")) {
      try {
        const arr = JSON.parse(s)
        if (Array.isArray(arr)) arr.forEach((u) => typeof u === "string" && out.push(u.trim()))
        continue
      } catch {
        // fall through to delimiter split
      }
    }
    s.split(/[\n|]+/).forEach((u) => out.push(u.trim()))
  }
  return Array.from(new Set(out.filter((u) => /^https?:\/\//i.test(u)))).slice(0, 10)
}
