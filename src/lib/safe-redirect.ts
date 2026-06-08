/**
 * Checks if a given redirect URL is safe to redirect to.
 * A URL is safe if:
 * 1. It is a local relative path starting with '/' but not starting with '//' or '/\' or containing backslashes.
 * 2. It is an absolute URL whose origin matches the allowed base origin or the browser's current origin.
 */
export function isSafeRedirectUrl(url: string | null | undefined, baseOrigin?: string): boolean {
  if (!url) return false

  // 1. Safe relative paths (must start with '/' and not contain backslashes or double-slashes)
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") && !url.includes("\\")) {
    return true
  }

  // 2. Absolute URL checks
  try {
    const parsed = new URL(url)

    if (baseOrigin) {
      try {
        const baseParsed = new URL(baseOrigin)
        if (parsed.origin === baseParsed.origin) {
          return true
        }
      } catch {
        // Fallback: exact string matching to prevent substring/subdomain matching bypasses
        if (baseOrigin === parsed.origin || baseOrigin === parsed.host) {
          return true
        }
      }
    }

    if (typeof window !== "undefined" && window.location) {
      if (parsed.origin === window.location.origin) {
        return true
      }
    }
  } catch {
    // If it fails URL parsing, it is either relative (which would have passed check 1) or completely malformed/unsafe.
  }

  return false
}

/**
 * Returns the provided URL if it is safe, otherwise falls back to a default URL.
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  defaultUrl: string,
  baseOrigin?: string
): string {
  if (isSafeRedirectUrl(url, baseOrigin)) {
    return url as string
  }
  return defaultUrl
}
