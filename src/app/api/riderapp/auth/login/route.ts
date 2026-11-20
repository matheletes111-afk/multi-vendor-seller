import { checkIpRateLimit } from "@/lib/ip-rate-limit"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { verifyOtpLoginToken } from "@/lib/web-otp-login"
import { completeWebNextAuthLogin } from "@/lib/login-2fa"
import { ensureRiderProfile, isRiderSuspended } from "@/lib/rider-auth"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SELLER_PRODUCT: "Product Seller",
  SELLER_SERVICE: "Service Seller",
  SELLER_HOTEL: "Hotel Seller",
  SELLER_RESTAURANT: "Restaurant Seller",
  ADMIN: "Admin",
  RIDER: "Delivery Rider",
}

const RIDER_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  phoneCountryCode: true,
  name: true,
  password: true,
  role: true,
  isEmailVerified: true,
  rider: true,
} as const

export async function POST(request: Request) {
  try {
    // 🛡️ Security: Credential-stuffing & brute-force protection (Max 5 attempts/min per IP)
    const ipLimit = await checkIpRateLimit(request, { action: "login", maxRequests: 5, windowSeconds: 60 })
    if (!ipLimit.allowed) {
      return (ipLimit.response || NextResponse.json({ error: "Too many login attempts. Please wait 1 minute." }, { status: 429 })) as any
    }

    const body = await request.json().catch(() => ({}))
    const { email, password, otpLoginToken, callbackUrl, csrfToken } = body as {
      email?: string
      password?: string
      otpLoginToken?: string
      callbackUrl?: string
      csrfToken?: string
    }

    const rawIdentifier = (email || (body as any).phone || (body as any).identifier || "").trim()
    const rawCountryCode = ((body as any).phoneCountryCode || "").trim()
    const cleanOtpLoginToken = typeof otpLoginToken === "string" ? otpLoginToken.trim() : ""
    const hasOtpLoginToken = cleanOtpLoginToken.length > 0

    if ((!rawIdentifier && !hasOtpLoginToken) || (!password && !hasOtpLoginToken)) {
      return NextResponse.json(
        { error: "Email or mobile number, and password or OTP verification token are required" },
        { status: 400 }
      )
    }

    // ── Flow 1: Passwordless Web OTP Login (SMS OTP or Email OTP) ─────────────
    if (hasOtpLoginToken) {
      const otpPayload = verifyOtpLoginToken(cleanOtpLoginToken)
      if (!otpPayload || otpPayload.role !== UserRole.RIDER) {
        return NextResponse.json(
          { error: "Invalid or expired OTP login session. Please verify OTP again." },
          { status: 401 }
        )
      }

      let otpUser: any = null
      if (otpPayload.userId) {
        otpUser = await prisma.user.findFirst({
          where: { id: otpPayload.userId, role: UserRole.RIDER },
          select: RIDER_USER_SELECT,
        })
      } else if (otpPayload.email) {
        otpUser = await prisma.user.findFirst({
          where: { email: otpPayload.email.toLowerCase().trim(), role: UserRole.RIDER },
          select: RIDER_USER_SELECT,
        })
      } else if (otpPayload.phone) {
        const variants = getEquivalentPhoneVariants(otpPayload.phone, rawCountryCode)
        otpUser = await prisma.user.findFirst({
          where: {
            role: UserRole.RIDER,
            OR: [{ phone: { in: variants } }, { phone: otpPayload.phone }],
          },
          select: RIDER_USER_SELECT,
        })
      }

      if (!otpUser) {
        return NextResponse.json({ error: "Rider account not found." }, { status: 401 })
      }

      const riderProfile = await ensureRiderProfile(otpUser.id, otpUser.rider)
      if (!riderProfile) {
        return NextResponse.json(
          { error: "Rider profile not found. Please contact support." },
          { status: 403 }
        )
      }

      if (isRiderSuspended(riderProfile)) {
        return NextResponse.json(
          { error: "Your rider account has been suspended. Please contact support." },
          { status: 403 }
        )
      }

      return completeWebNextAuthLogin({
        request,
        user: { ...otpUser, rider: riderProfile },
        role: UserRole.RIDER,
        callbackUrl,
        defaultPath: "/riderapp",
        csrfToken,
      })
    }

    // ── Flow 2: Email / Mobile Number + Password (+ 2FA OTP challenge) ─────────
    const isEmailFormat = rawIdentifier.includes("@")
    let user: any = null

    if (isEmailFormat) {
      user = await prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
        select: RIDER_USER_SELECT,
      })
    } else {
      const phoneVariants = getEquivalentPhoneVariants(rawIdentifier, rawCountryCode)
      // Prefer RIDER account first in case a phone number exists under another role
      user = await prisma.user.findFirst({
        where: {
          role: UserRole.RIDER,
          OR: [{ phone: { in: phoneVariants } }, { phone: rawIdentifier }],
        },
        select: RIDER_USER_SELECT,
      })

      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            OR: [{ phone: { in: phoneVariants } }, { phone: rawIdentifier }],
          },
          select: RIDER_USER_SELECT,
        })
      }
    }

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isPasswordValid = await bcrypt.compare(password as string, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Role check (after validating password to avoid role enumeration before auth)
    if (user.role !== UserRole.RIDER) {
      const label = ROLE_LABELS[user.role] || user.role
      return NextResponse.json(
        { error: `This account is registered as a ${label}. Please sign in using the ${label} login portal.` },
        { status: 401 }
      )
    }

    // Verification check
    if (user.isEmailVerified === false) {
      return NextResponse.json(
        {
          error: "Please verify your account before logging in.",
          needsVerification: true,
          email: user.email,
          phone: user.phone,
          verifyUrl: user.email
            ? `/riderapp/verify-email?email=${encodeURIComponent(user.email)}`
            : `/riderapp/verify-email?phone=${encodeURIComponent(user.phone || rawIdentifier)}`,
        },
        { status: 403 }
      )
    }

    // Ensure Rider profile row exists (parity with mobileapi/rider/auth/login auto-heal)
    const riderProfile = await ensureRiderProfile(user.id, user.rider)
    if (!riderProfile) {
      return NextResponse.json(
        { error: "Rider profile not found. Please contact support." },
        { status: 403 }
      )
    }

    if (isRiderSuspended(riderProfile)) {
      return NextResponse.json(
        { error: "Your rider account has been suspended. Please contact support." },
        { status: 403 }
      )
    }

    // Require 2FA OTP verification for email/phone + password logins
    const { generateAndSendLogin2faOtp } = await import("@/lib/login-2fa")
    const otpResult = await generateAndSendLogin2faOtp(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
      },
      UserRole.RIDER
    )

    if (!otpResult.success) {
      return NextResponse.json(
        { error: otpResult.error || "Failed to send verification code. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(otpResult, { status: 200 })
  } catch (error) {
    console.error("Rider login API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    )
  }
}
