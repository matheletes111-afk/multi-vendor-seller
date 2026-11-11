import { NextResponse } from "next/server"
import { checkIpRateLimit, getClientIp } from "./ip-rate-limit"
import { checkPhoneOtpLimit, recordPhoneOtpSent } from "./phone-rate-limit"
import { verifyTurnstileToken } from "./turnstile"
import { verifyMobileAppRequest } from "./mobile-auth"

export interface SecurityGuardOptions {
  action: string // e.g. "register", "phone_otp", "email_otp", "forgot_password", "resend_otp"
  isMobile?: boolean
  phone?: string | null
  turnstileToken?: string | null
  requireTurnstile?: boolean // Explicit override: set to false to skip Turnstile (e.g. resend OTP), or true to enforce
  maxRequests?: number // default 3 per minute
  windowSeconds?: number // default 60
}

export interface SecurityGuardResult {
  allowed: boolean
  clientIp: string
  response?: NextResponse
  recordSuccess: () => void
}

/**
 * Unified multi-layer security guard:
 * 1. IP Sliding Window Rate Limit (max 3 req/min by default) -> 429
 * 2. Bot Protection (Mobile app signature or Cloudflare Turnstile token) -> 401/403
 * 3. Phone SMS Cooldown (60s) & Daily Quota (max 4 SMS/day) -> 429
 */
export async function validateRequestSecurity(
  request: Request,
  options: SecurityGuardOptions
): Promise<SecurityGuardResult> {
  const {
    action,
    isMobile = false,
    phone,
    turnstileToken,
    maxRequests = 3,
    windowSeconds = 60,
  } = options

  // 1. IP Rate Limiting (Protects both Web & Mobile)
  const ipCheck = await checkIpRateLimit(request, {
    maxRequests,
    windowSeconds,
    action,
  })

  if (!ipCheck.allowed) {
    return {
      allowed: false,
      clientIp: ipCheck.clientIp,
      response: ipCheck.response,
      recordSuccess: () => {},
    }
  }

  const clientIp = ipCheck.clientIp

  // 2. Bot Protection: Mobile vs Web
  if (isMobile) {
    const mobileCheck = verifyMobileAppRequest(request)
    if (!mobileCheck.allowed) {
      return {
        allowed: false,
        clientIp,
        response: NextResponse.json(
          {
            success: false,
            error: mobileCheck.error || "Unauthorized mobile application request.",
          },
          { status: 401 }
        ),
        recordSuccess: () => {},
      }
    }
  } else {
    // Web: Cloudflare Turnstile Verification
    // Automatically skip Turnstile on resend/cooldown endpoints unless explicitly enabled
    const isResendAction = action === "resend_otp" || action === "resend-2fa" || action === "resend_2fa"
    const shouldCheckTurnstile =
      options.requireTurnstile !== undefined ? options.requireTurnstile : !isResendAction

    if (shouldCheckTurnstile) {
      // Check token from options or request headers
      const token =
        turnstileToken ||
        request.headers.get("cf-turnstile-response") ||
        request.headers.get("x-turnstile-token")

      const turnstileCheck = await verifyTurnstileToken(token, clientIp)
      if (!turnstileCheck.success) {
        return {
          allowed: false,
          clientIp,
          response: NextResponse.json(
            {
              success: false,
              error: turnstileCheck.error || "Security verification failed.",
            },
            { status: 403 }
          ),
          recordSuccess: () => {},
        }
      }
    }
  }

  // 3. Phone Cooldown & Daily SMS Quota Check (if a phone number is provided)
  if (phone) {
    const phoneCheck = await checkPhoneOtpLimit(phone)
    if (!phoneCheck.allowed) {
      return {
        allowed: false,
        clientIp,
        response: phoneCheck.response,
        recordSuccess: () => {},
      }
    }
  }

  return {
    allowed: true,
    clientIp,
    recordSuccess: () => {
      if (phone) {
        recordPhoneOtpSent(phone)
      }
    },
  }
}

