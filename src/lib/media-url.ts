import { extractFoodImages } from "@/lib/utils"

type RequestLike = {
  headers: { get(name: string): string | null }
  url?: string
  nextUrl?: { origin?: string }
}

const RESTRICTED_MEDIA_FOLDERS = [
  "uploads/restaurant-onboarding/property",
  "uploads/hotel-onboarding/property",
  "uploads/onboarding/store",
]

function isLocalHostname(host: string): boolean {
  const clean = host.split(":")[0]?.toLowerCase() || ""
  return clean === "localhost" || clean === "127.0.0.1" || clean === "0.0.0.0" || clean === "::1"
}

/**
 * Resolves the externally reachable public origin (protocol + host) from a Request,
 * handling reverse proxies (AWS Amplify, CloudFront, ALB, NGINX) where `request.nextUrl.origin`
 * can otherwise report `http://localhost:3000`.
 */
export function getRequestPublicOrigin(request?: RequestLike | null): string {
  const envOrigin = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  ).replace(/\/+$/, "")

  if (request) {
    const rawForwardedHost =
      request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
    const host = rawForwardedHost.split(",")[0]?.trim() || ""
    const rawForwardedProto = request.headers.get("x-forwarded-proto") || ""
    const proto = rawForwardedProto.split(",")[0]?.trim().toLowerCase()

    if (host && !isLocalHostname(host)) {
      const resolvedProto = proto === "http" || proto === "https" ? proto : "https"
      return `${resolvedProto}://${host}`
    }

    const candidateUrl = request.nextUrl?.origin || request.url
    if (candidateUrl) {
      try {
        const parsed = new URL(candidateUrl)
        if (!isLocalHostname(parsed.hostname)) {
          return parsed.origin
        }
        if (host && isLocalHostname(host) && !envOrigin) {
          return `${proto || parsed.protocol.replace(":", "") || "http"}://${host}`
        }
        if (!envOrigin) {
          return parsed.origin
        }
      } catch {
        // Ignore unparseable URL
      }
    }

    if (host && isLocalHostname(host) && !envOrigin) {
      return `${proto || "http"}://${host}`
    }
  }

  return envOrigin || "https://meeemsl.com"
}

/**
 * Normalizes media URLs for public viewing across Web & Mobile apps.
 * - Rewrites private S3 onboarding/property URLs to `/api/media/...` (with optional absolute origin).
 * - Resolves relative `/uploads/...`, `/icons/...`, `/api/media/...` paths to full URLs when `origin` is provided.
 * - Normalizes whitespace / protocol-relative URLs and unwraps single JSON-array strings safely.
 */
export function toPublicMediaUrl(
  url: string | null | undefined,
  origin?: string | null
): string | null {
  if (!url || typeof url !== "string") return null
  let trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const extracted = extractFoodImages(trimmed)
    trimmed = extracted[0]?.trim() || ""
    if (!trimmed) return null
  }

  const cleanOrigin = origin ? origin.replace(/\/+$/, "") : ""

  if (trimmed.startsWith("data:")) {
    return trimmed
  }

  if (trimmed.startsWith("//")) {
    trimmed = `https:${trimmed}`
  }

  if (trimmed.includes("images.unsplash.com")) {
    return trimmed.replace(/ /g, "%20")
  }

  // Re-anchor any already-proxied `/api/media/uploads/...` URL to the caller's public origin
  const mediaMarker = "/api/media/"
  const mediaIndex = trimmed.indexOf(mediaMarker)
  if (trimmed.startsWith(mediaMarker) || (mediaIndex !== -1 && cleanOrigin)) {
    const mediaPath = trimmed.slice(mediaIndex).replace(/ /g, "%20")
    return cleanOrigin ? `${cleanOrigin}${mediaPath}` : mediaPath
  }

  // Keep valid pre-signed S3 URLs intact
  if (trimmed.includes("X-Amz-Signature")) {
    return trimmed
  }

  // Detect paths in S3 that require proxying due to 403 bucket restrictions
  const isRestricted = RESTRICTED_MEDIA_FOLDERS.some((folder) => trimmed.includes(folder))
  if (isRestricted) {
    const uploadsIndex = trimmed.indexOf("uploads/")
    if (uploadsIndex !== -1) {
      const key = trimmed.substring(uploadsIndex).replace(/ /g, "%20")
      const path = `/api/media/${key}`
      return cleanOrigin ? `${cleanOrigin}${path}` : path
    }
  }

  // Bare S3 key without leading slash or protocol (e.g. "uploads/foods/item.webp")
  if (trimmed.startsWith("uploads/")) {
    const path = `/api/media/${trimmed.replace(/ /g, "%20")}`
    return cleanOrigin ? `${cleanOrigin}${path}` : path
  }

  // Relative local paths (e.g. "/uploads/...", "/icons/food.png") -> absolute URL when origin is given
  if (trimmed.startsWith("/")) {
    const safePath = trimmed.replace(/ /g, "%20")
    return cleanOrigin ? `${cleanOrigin}${safePath}` : safePath
  }

  // Ensure S3 bucket URLs always use HTTPS (required by iOS ATS / Android cleartext rules)
  if (/^http:\/\/[^/]*amazonaws\.com\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, "https://")
  }

  return trimmed.replace(/ /g, "%20")
}

/**
 * Extracts and normalizes an array of media URLs (from Json, string[], or JSON string) for Web/Mobile.
 */
export function toPublicMediaUrlList(
  raw: unknown,
  origin?: string | null
): string[] {
  const extracted = extractFoodImages(raw)
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of extracted) {
    const normalized = toPublicMediaUrl(item, origin)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      out.push(normalized)
    }
  }
  return out
}

/**
 * Extracts and normalizes the first media URL from any images field (array, JSON string, object, or string).
 */
export function toFirstPublicMediaUrl(
  raw: unknown,
  origin?: string | null
): string | null {
  const list = toPublicMediaUrlList(raw, origin)
  return list[0] ?? null
}

/**
 * Picks and normalizes the cover/hero image for a restaurant from its priority fields.
 */
export function resolveRestaurantCoverUrl(
  restaurant: {
    mainPhoto?: string | null
    banner?: string | null
    logo?: string | null
    user?: { image?: string | null } | null
  },
  origin?: string | null
): string | null {
  return (
    toPublicMediaUrl(
      restaurant.mainPhoto || restaurant.banner || restaurant.logo || restaurant.user?.image || null,
      origin
    ) ?? null
  )
}

/**
 * Normalizes all image fields on a hotel record and selects the best cover image (`image_url` / `coverImage`).
 */
export function normalizeHotelMedia(
  hotel: {
    banner?: string | null
    logo?: string | null
    images?: unknown
    hotelSeller?: {
      logo?: string | null
      banner?: string | null
      mainPhoto?: string | null
    } | null
  },
  origin?: string | null
): {
  images: string[]
  banner: string | null
  logo: string | null
  coverImage: string | null
} {
  const rawImages = toPublicMediaUrlList(hotel.images, origin)
  const banner = toPublicMediaUrl(hotel.banner, origin)
  const logo = toPublicMediaUrl(hotel.logo || hotel.hotelSeller?.logo, origin)
  const sellerFallback = toPublicMediaUrl(
    hotel.hotelSeller?.banner || hotel.hotelSeller?.mainPhoto || hotel.hotelSeller?.logo,
    origin
  )
  const coverImage = banner || rawImages[0] || logo || sellerFallback || null
  const images = rawImages.length > 0 ? rawImages : coverImage ? [coverImage] : []
  return { images, banner, logo, coverImage }
}

/**
 * Normalizes nested `hotelSeller` media fields (`logo`, `banner`, `mainPhoto`) for public JSON responses.
 */
export function normalizeHotelSellerMedia<
  T extends { logo?: string | null; banner?: string | null; mainPhoto?: string | null }
>(hotelSeller: T | null | undefined, origin?: string | null): T | null | undefined {
  if (!hotelSeller) return hotelSeller
  return {
    ...hotelSeller,
    logo: toPublicMediaUrl(hotelSeller.logo, origin),
    banner: toPublicMediaUrl(hotelSeller.banner, origin),
    mainPhoto: toPublicMediaUrl(hotelSeller.mainPhoto, origin),
  }
}

