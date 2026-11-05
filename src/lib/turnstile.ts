/**
 * Cloudflare Turnstile Server-Side Token Verification
 * Documentation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export interface TurnstileVerifyResult {
  success: boolean
  error?: string
}

/**
 * Validates a Cloudflare Turnstile challenge token sent from a web client.
 * If TURNSTILE_SECRET_KEY is not configured (e.g. local dev), it gracefully passes with a warning.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim()

  // Graceful fallback for local development or before environment keys are configured
  if (!secretKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("⚠️ [Turnstile] TURNSTILE_SECRET_KEY is not set. Bypassing check in development.")
      return { success: true }
    }
    // In production without key, allow fallback or fail-open with alert
    console.warn("⚠️ [Turnstile] TURNSTILE_SECRET_KEY missing in production environment.")
    return { success: true }
  }

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      success: false,
      error: "Bot challenge required. Please complete the verification challenge.",
    }
  }

  try {
    const formData = new URLSearchParams()
    formData.append("secret", secretKey)
    formData.append("response", token.trim())
    if (remoteIp) {
      formData.append("remoteip", remoteIp)
    }

    const res = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    const data = await res.json().catch(() => null)

    if (data?.success) {
      return { success: true }
    }

    const errorCodes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].join(", ") : "verification_failed"
    console.warn(`[Turnstile] Challenge failed: ${errorCodes}`)

    return {
      success: false,
      error: "Security verification failed. Please refresh and try again.",
    }
  } catch (err: any) {
    console.error("[Turnstile] Verification error:", err)
    // Fail closed on network error to protect against bot flood
    return {
      success: false,
      error: "Unable to verify security challenge. Please try again.",
    }
  }
}

