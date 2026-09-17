import { randomInt } from "crypto"
import jwt from "jsonwebtoken"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendLogin2faSms } from "@/lib/twilio-sms"
import { sendLogin2faEmail } from "@/lib/email"

const LOGIN_2FA_SECRET =
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.JWT_SECRET_KEY?.trim() ||
  process.env.MOBILE_JWT_SECRET_KEY?.trim() ||
  "meeem-login-2fa-default-secret"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const MAX_ATTEMPTS = 5

export interface PreAuthTokenPayload {
  type: "login-2fa-challenge"
  userId: string
  role: UserRole
}

export function maskPhoneNumber(phone?: string | null): string | null {
  if (!phone) return null
  const cleaned = phone.trim()
  if (cleaned.length <= 4) return cleaned
  const last4 = cleaned.slice(-4)
  const prefix = cleaned.startsWith("+") ? cleaned.slice(0, 4) : cleaned.slice(0, 2)
  return `${prefix} •••• ${last4}`
}

export function maskEmailAddress(email?: string | null): string | null {
  if (!email) return null
  const cleaned = email.trim().toLowerCase()
  const atIndex = cleaned.indexOf("@")
  if (atIndex <= 1) return cleaned
  const name = cleaned.slice(0, atIndex)
  const domain = cleaned.slice(atIndex)
  const visibleLen = Math.min(2, name.length)
  return `${name.slice(0, visibleLen)}•••••${domain}`
}

export function createPreAuthToken(userId: string, role: UserRole): string {
  const payload: PreAuthTokenPayload = {
    type: "login-2fa-challenge",
    userId,
    role,
  }
  return jwt.sign(payload, LOGIN_2FA_SECRET, { expiresIn: "10m" })
}

export function verifyPreAuthToken(token: string): PreAuthTokenPayload | null {
  try {
    if (!token) return null
    const decoded = jwt.verify(token, LOGIN_2FA_SECRET) as jwt.JwtPayload & Partial<PreAuthTokenPayload>
    if (decoded?.type !== "login-2fa-challenge" || !decoded.userId || !decoded.role) {
      return null
    }
    return {
      type: "login-2fa-challenge",
      userId: decoded.userId,
      role: decoded.role as UserRole,
    }
  } catch {
    return null
  }
}

export type Login2faGenerateSuccess = {
  success: true
  requiresOtp: true
  preAuthToken: string
  channels: Array<"SMS" | "EMAIL">
  maskedPhone: string | null
  maskedEmail: string | null
  expiresIn: number
  resendCooldown: number
  message: string
  error?: string
  cooldownRemaining?: number
  sessionExpired?: boolean
  codeExpired?: boolean
}

export type Login2faError = {
  success: false
  error: string
  cooldownRemaining?: number
  sessionExpired?: boolean
  codeExpired?: boolean
}

export type Login2faVerifySuccess = {
  success: true
  user: any
  error?: string
  sessionExpired?: boolean
  codeExpired?: boolean
}

export type Login2faVerifyError = {
  success: false
  error: string
  sessionExpired?: boolean
  codeExpired?: boolean
  user?: any
}

export type Login2faVerifyResult = Login2faVerifySuccess | Login2faVerifyError

export type Login2faGenerateResult = Login2faGenerateSuccess | Login2faError

export async function generateAndSendLogin2faOtp(
  user: {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
    phoneCountryCode?: string | null
  },
  role: UserRole,
  options?: { isResend?: boolean }
): Promise<Login2faGenerateResult> {
  const now = new Date()

  // If resend, check cooldown
  if (options?.isResend) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { loginOtpSentAt: true },
    })
    if (existing?.loginOtpSentAt) {
      const elapsed = now.getTime() - existing.loginOtpSentAt.getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return {
          success: false,
          error: `Please wait ${waitSec} second(s) before requesting another code.`,
          cooldownRemaining: waitSec,
        }
      }
    }
  }

  // Generate 6-digit cryptographically secure OTP
  const otp = randomInt(100000, 999999).toString()

  const hasEmail = Boolean(user.email && user.email.trim().length > 0)
  const hasPhone = Boolean(user.phone && user.phone.trim().length > 0)

  const channels: Array<"SMS" | "EMAIL"> = []

  // Delivery logic:
  // - If email present: send to phone SMS AND email (if phone present)
  // - If email NOT present: send to phone SMS
  // - If phone not present but email present: send to email
  if (hasEmail && hasPhone) {
    channels.push("SMS", "EMAIL")
  } else if (hasPhone && !hasEmail) {
    channels.push("SMS")
  } else if (hasEmail) {
    channels.push("EMAIL")
  } else {
    return {
      success: false,
      error: "No valid mobile number or email address found for this account.",
    }
  }

  // Update DB with OTP and reset attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginOtp: otp,
      loginOtpExpires: new Date(now.getTime() + OTP_EXPIRY_MS),
      loginOtpSentAt: now,
      loginOtpAttempts: 0,
    },
  })

  let smsDispatched = false
  let emailDispatched = false

  // Dispatch SMS
  if (channels.includes("SMS") && user.phone) {
    try {
      const smsSuccess = await sendLogin2faSms({
        to: user.phone,
        countryCode: user.phoneCountryCode,
        otp,
        name: user.name,
      })
      if (smsSuccess) {
        smsDispatched = true
      }
    } catch (smsErr) {
      console.error("[Login 2FA] SMS dispatch error:", smsErr)
    }
  }

  // Dispatch Email
  if (channels.includes("EMAIL") && user.email) {
    try {
      const emailResult = await sendLogin2faEmail({
        to: user.email,
        otp,
        name: user.name,
      })
      if (emailResult && (emailResult as any).success) {
        emailDispatched = true
      }
    } catch (emailErr) {
      console.error("[Login 2FA] Email dispatch error:", emailErr)
    }
  }

  // If no channel succeeded, rollback saved OTP from DB and return an error
  if (!smsDispatched && !emailDispatched) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginOtp: null,
          loginOtpExpires: null,
        },
      })
    } catch (dbErr) {
      console.error("[Login 2FA] Failed to rollback OTP after dispatch failure:", dbErr)
    }

    return {
      success: false,
      error: "Failed to deliver verification code via SMS or email. Please try again.",
    }
  }

  // Use the channels that actually succeeded
  const successfulChannels: Array<"SMS" | "EMAIL"> = []
  if (smsDispatched) successfulChannels.push("SMS")
  if (emailDispatched) successfulChannels.push("EMAIL")

  const preAuthToken = createPreAuthToken(user.id, role)

  let message = "Verification code sent to your registered mobile number and email."
  if (successfulChannels.length === 1 && successfulChannels[0] === "SMS") {
    message = "Verification code sent to your registered mobile number."
  } else if (successfulChannels.length === 1 && successfulChannels[0] === "EMAIL") {
    message = "Verification code sent to your registered email address."
  }

  return {
    success: true,
    requiresOtp: true,
    preAuthToken,
    channels: successfulChannels,
    maskedPhone: successfulChannels.includes("SMS") ? maskPhoneNumber(user.phone) : null,
    maskedEmail: successfulChannels.includes("EMAIL") ? maskEmailAddress(user.email) : null,
    expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
    resendCooldown: Math.floor(RESEND_COOLDOWN_MS / 1000),
    message,
  }
}

export async function verifyLogin2faOtp({
  preAuthToken,
  otp,
}: {
  preAuthToken: string
  otp: string
}): Promise<Login2faVerifyResult> {
  const payload = verifyPreAuthToken(preAuthToken)
  if (!payload) {
    return {
      success: false,
      error: "Verification session expired or invalid. Please log in again.",
      sessionExpired: true,
    }
  }

  const cleanOtp = (otp || "").trim()
  if (!cleanOtp || cleanOtp.length !== 6) {
    return {
      success: false,
      error: "Please enter a valid 6-digit verification code.",
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      seller: true,
      hotelSeller: true,
      restaurantSeller: true,
      rider: true,
    },
  })

  if (!user || user.role !== payload.role) {
    return {
      success: false,
      error: "User not found or role mismatch. Please log in again.",
      sessionExpired: true,
    }
  }

  if (user.loginOtpAttempts >= MAX_ATTEMPTS) {
    // Invalidate OTP on too many attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { loginOtp: null, loginOtpExpires: null },
    })
    return {
      success: false,
      error: "Too many incorrect attempts. Please sign in again to request a new code.",
      sessionExpired: true,
    }
  }

  const now = new Date()
  if (!user.loginOtp || !user.loginOtpExpires || user.loginOtpExpires < now) {
    return {
      success: false,
      error: "Verification code has expired. Please request a new code.",
      codeExpired: true,
    }
  }

  if (user.loginOtp !== cleanOtp) {
    const newAttempts = user.loginOtpAttempts + 1
    await prisma.user.update({
      where: { id: user.id },
      data: { loginOtpAttempts: newAttempts },
    })
    const remaining = MAX_ATTEMPTS - newAttempts
    return {
      success: false,
      error:
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : "Too many incorrect attempts. Please sign in again.",
      sessionExpired: remaining <= 0,
    }
  }

  // OTP is correct! Clear OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginOtp: null,
      loginOtpExpires: null,
      loginOtpSentAt: null,
      loginOtpAttempts: 0,
    },
  })

  return {
    success: true,
    user,
  }
}

export async function resendLogin2faOtp({
  preAuthToken,
}: {
  preAuthToken: string
}): Promise<Login2faGenerateResult> {
  const payload = verifyPreAuthToken(preAuthToken)
  if (!payload) {
    return {
      success: false,
      error: "Verification session expired. Please log in again.",
      sessionExpired: true,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneCountryCode: true,
      role: true,
    },
  })

  if (!user || user.role !== payload.role) {
    return {
      success: false,
      error: "User not found. Please log in again.",
      sessionExpired: true,
    }
  }

  return generateAndSendLogin2faOtp(user, user.role, { isResend: true })
}

export async function completeWebNextAuthLogin({
  request,
  user,
  role,
  callbackUrl,
  defaultPath,
  csrfToken,
}: {
  request: Request
  user: any
  role: UserRole
  callbackUrl?: string
  defaultPath: string
  csrfToken?: string
}) {
  const { NextRequest, NextResponse } = await import("next/server")
  const { POST: nextAuthPost, GET: nextAuthGet } = await import(
    "@/app/api/nextauth/[...nextauth]/route"
  )
  const { getSafeRedirectUrl } = await import("@/lib/safe-redirect")
  const { createOtpLoginToken } = await import("@/lib/web-otp-login")

  const origin = new URL(request.url).origin
  const host = request.headers.get("host") ?? new URL(request.url).host
  const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, defaultPath, origin)

  let effectiveCsrfToken = csrfToken
  let cookie = request.headers.get("cookie") ?? ""

  if (!effectiveCsrfToken || !cookie.includes("authjs.csrf-token")) {
    try {
      const csrfReq = new NextRequest(`${origin}/api/nextauth/csrf`, {
        headers: { Host: host, ...(cookie ? { Cookie: cookie } : {}) },
      })
      const csrfRes = await nextAuthGet(csrfReq as any)
      const csrfData = await csrfRes.json().catch(() => ({}))
      if (csrfData?.csrfToken) {
        effectiveCsrfToken = csrfData.csrfToken
      }
      const setCookies = csrfRes.headers.getSetCookie?.() || []
      if (setCookies.length > 0) {
        const cookiePairs = setCookies.map((c) => c.split(";")[0].trim())
        cookie = cookie ? `${cookie}; ${cookiePairs.join("; ")}` : cookiePairs.join("; ")
      }
    } catch (err) {
      console.warn("Failed to auto-fetch CSRF token:", err)
    }
  }

  const otpLoginToken = createOtpLoginToken(user.email || user.phone, role, {
    userId: user.id,
    phone: user.phone,
    email: user.email,
  })

  const form = new URLSearchParams({
    email: user.email || user.phone || "",
    password: "__OTP_LOGIN__",
    role,
    callbackUrl: validatedCallbackUrl,
    otpLoginToken,
    ...(effectiveCsrfToken && { csrfToken: effectiveCsrfToken }),
  })

  const nextauthRequest = new NextRequest(`${origin}/api/nextauth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
      Host: host,
      ...(cookie && { Cookie: cookie }),
    },
    body: form.toString(),
  })

  const res = await nextAuthPost(nextauthRequest as any)
  const location = res.headers.get("Location") ?? ""
  let nextAuthUrl = location
  if (!nextAuthUrl) {
    try {
      const body = await res.clone().json().catch(() => ({}))
      nextAuthUrl = typeof body?.url === "string" ? body.url : ""
    } catch {
      /* ignore */
    }
  }

  const isErrorRedirect =
    nextAuthUrl.includes("error=") ||
    nextAuthUrl.includes("login") ||
    nextAuthUrl.includes("registration")

  if (isErrorRedirect) {
    let msg = "Failed to establish session. Please try again."
    try {
      const err = new URL(nextAuthUrl, origin).searchParams.get("error")
      if (err) msg = err
    } catch {}
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  let finalRedirect = getSafeRedirectUrl(nextAuthUrl || callbackUrl, defaultPath, origin)

  if (role === UserRole.SELLER_PRODUCT && user.seller && !user.seller.onboardingCompleted) {
    finalRedirect = "/product-seller/onboarding"
  } else if (role === UserRole.SELLER_SERVICE && user.seller && !user.seller.onboardingCompleted) {
    finalRedirect = "/service-seller/onboarding"
  } else if (role === UserRole.SELLER_HOTEL && user.hotelSeller && !user.hotelSeller.onboardingCompleted) {
    finalRedirect = "/hotel-seller/onboarding"
  } else if (role === UserRole.SELLER_RESTAURANT && user.restaurantSeller && !user.restaurantSeller.onboardingCompleted) {
    finalRedirect = "/restaurant-seller/onboarding"
  } else if (role === UserRole.RIDER && user.rider?.isFirstLogin) {
    finalRedirect = "/riderapp/change-password?first=true"
  }

  const headers = new Headers()
  res.headers.getSetCookie?.().forEach((c: string) => headers.append("Set-Cookie", c))
  return NextResponse.json({ success: true, url: finalRedirect }, { status: 200, headers })
}
