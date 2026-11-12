/**
 * Normalizes media URLs for public viewing.
 * S3 objects stored under private buckets/folders (like restaurant-onboarding/property)
 * respond with 403 Forbidden to direct browser requests.
 * This helper proxies them through /api/media/... which serves them with server S3 credentials.
 *
 * @param url Original S3 URL or relative URL
 * @param origin Optional site origin (e.g. "https://www.meeemsl.com") for mobile API responses
 */
export function toPublicMediaUrl(
  url: string | null | undefined,
  origin?: string | null
): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  const cleanOrigin = origin ? origin.replace(/\/+$/, "") : ""

  // If already relative, data URL, or external placeholder
  if (
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("images.unsplash.com")
  ) {
    if (trimmed.startsWith("/api/media/") && cleanOrigin) {
      return `${cleanOrigin}${trimmed}`
    }
    return trimmed
  }

  // Detect paths in S3 that require proxying due to 403 bucket restrictions
  const restrictedFolders = [
    "uploads/restaurant-onboarding/property",
    "uploads/hotel-onboarding/property",
  ]

  const isRestricted = restrictedFolders.some((folder) => trimmed.includes(folder))
  if (isRestricted) {
    const uploadsIndex = trimmed.indexOf("uploads/")
    if (uploadsIndex !== -1) {
      const key = trimmed.substring(uploadsIndex)
      const path = `/api/media/${key}`
      return cleanOrigin ? `${cleanOrigin}${path}` : path
    }
  }

  return trimmed
}

