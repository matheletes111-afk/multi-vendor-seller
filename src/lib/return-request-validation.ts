export const MIN_RETURN_REASON_LENGTH = 10
export const MAX_RETURN_REASON_LENGTH = 2000
export const MIN_RETURN_IMAGES = 1
export const MAX_RETURN_IMAGES = 4

function isAllowedImageUrl(u: string): boolean {
  if (u.length > 2048) return false
  if (u.startsWith("/")) return true
  try {
    const parsed = new URL(u)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export function parseReturnImagesJson(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((u): u is string => typeof u === "string").map((s) => s.trim()).filter(Boolean)
}

export function validateReturnReason(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim()
  if (v.length < MIN_RETURN_REASON_LENGTH) {
    return {
      ok: false,
      error: `Please describe why you are returning this item (at least ${MIN_RETURN_REASON_LENGTH} characters).`,
    }
  }
  if (v.length > MAX_RETURN_REASON_LENGTH) {
    return { ok: false, error: `Reason is too long (max ${MAX_RETURN_REASON_LENGTH} characters).` }
  }
  return { ok: true, value: v }
}

export function validateReturnImageUrls(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Add at least one photo of the product (packaging or issue)." }
  }
  const urls = raw.filter((u): u is string => typeof u === "string").map((s) => s.trim()).filter(Boolean)
  if (urls.length < MIN_RETURN_IMAGES) {
    return { ok: false, error: `Add at least ${MIN_RETURN_IMAGES} image${MIN_RETURN_IMAGES === 1 ? "" : "s"}.` }
  }
  if (urls.length > MAX_RETURN_IMAGES) {
    return { ok: false, error: `You can add at most ${MAX_RETURN_IMAGES} images.` }
  }
  for (const u of urls) {
    if (!isAllowedImageUrl(u)) {
      return { ok: false, error: "One or more image URLs are invalid." }
    }
  }
  return { ok: true, value: urls }
}
