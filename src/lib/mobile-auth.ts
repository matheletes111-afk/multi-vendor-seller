/**
 * Mobile App Request Authentication & Integrity Validator
 * Prevents automated curl / Python scripts from hitting mobile API endpoints directly.
 */

export interface MobileAuthResult {
  allowed: boolean
  error?: string
}

/**
 * Validates request authenticity from Meeem Mobile Apps (React Native / Flutter / Android / iOS).
 * Looks for headers: `x-meeem-app-token`, `x-app-key`, or `x-api-key`.
 * 
 * Production Zero-Downtime Design:
 * 1. If client sends a token, it MUST match MOBILE_APP_SECRET (blocks malicious / forged tokens).
 * 2. If client sends NO token:
 *    - If ENFORCE_MOBILE_APP_SECRET="true": rejects with 401.
 *    - Otherwise: allows with fallback (protects existing live Play Store users until app update is released).
 * 3. All requests remain strictly protected by PostgreSQL IP Rate Limit (3 req/min) & Phone limits (60s cooldown, 9 SMS/day).
 */
export function verifyMobileAppRequest(request: Request): MobileAuthResult {
  const expectedSecret = process.env.MOBILE_APP_SECRET?.trim()

  // If secret is not configured at all, pass through
  if (!expectedSecret) {
    return { allowed: true }
  }

  const token =
    request.headers.get("x-meeem-app-token")?.trim() ||
    request.headers.get("x-app-key")?.trim() ||
    request.headers.get("x-api-key")?.trim()

  // If token is provided, it must be valid
  if (token) {
    if (token !== expectedSecret) {
      return {
        allowed: false,
        error: "Invalid mobile client authentication token.",
      }
    }
    return { allowed: true }
  }

  // If no token is provided: check if strict enforcement is enabled
  const isEnforced = process.env.ENFORCE_MOBILE_APP_SECRET === "true"
  if (isEnforced) {
    return {
      allowed: false,
      error: "Missing mobile client authentication token. Please update your Meeem app.",
    }
  }

  // Graceful transition for legacy mobile app builds currently on users' devices
  return { allowed: true }
}
