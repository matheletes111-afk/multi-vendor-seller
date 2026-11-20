import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { validateRequestSecurity } from "@/lib/security-guard"
import { sendLoginOtpEmail } from "@/lib/email"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { createOtpLoginToken } from "@/lib/web-otp-login"

const EMAIL_OTP_EXPIRY_MS = 10 * 60 * 1000
const EMAIL_OTP_COOLDOWN_MS = 60 * 1000

export function isRiderSuspended(
  rider?: { isSuspended?: boolean | null; status?: string | null } | null
): boolean {
  return Boolean(rider && (rider.isSuspended || rider.status === "SUSPENDED"))
}

/**
 * Ensures a verified RIDER user has a corresponding `riders` record.
 * Auto-heals missing rows instead of hard-blocking login.
 */
export async function ensureRiderProfile<T extends Record<string, any> | null | undefined>(
  userId: string,
  existingRider?: T
) {
  if (existingRider) return existingRider
  try {
    return await prisma.rider.create({
      data: {
        userId,
        isApproved: false,
        isSuspended: false,
        status: "PENDING",
        createdByAdmin: false,
        onboardingCompleted: false,
        isFirstLogin: true,
      },
    })
  } catch (err) {
    // Handle concurrent creation race cleanly
    return await prisma.rider.findUnique({ where: { userId } })
  }
}

export async function upsertRiderDeviceToken(
  riderId: string,
  existingDeviceTokens: unknown,
  opts: {
    deviceId?: string
    platform?: "android" | "ios" | "web"
    deviceToken?: string
    userAgent?: string
  }
) {
  const { deviceId, platform, deviceToken, userAgent } = opts
  if (!deviceToken && !deviceId) return

  try {
    const tokenToStore = deviceToken || deviceId!
    const existingTokens: any[] = Array.isArray(existingDeviceTokens)
      ? (existingDeviceTokens as any[])
      : []

    const now = new Date().toISOString()
    const otherTokens = existingTokens.filter(
      (t) => t && t.token !== tokenToStore && t.deviceId !== deviceId
    )

    const newEntry = {
      token: tokenToStore,
      deviceId: deviceId || null,
      platform: platform || "android",
      userAgent: userAgent || null,
      lastActiveAt: now,
      createdAt: now,
    }

    await prisma.rider.update({
      where: { id: riderId },
      data: {
        deviceTokens: [...otherTokens, newEntry],
      },
    })
  } catch (err) {
    console.warn("Failed to register rider device token:", err)
  }
}

function formatError(isMobile: boolean, error: string, status: number, extra?: Record<string, any>) {
  return NextResponse.json(
    isMobile ? { success: false, error, ...extra } : { error, ...extra },
    { status }
  )
}

/**
 * Shared handler for sending Rider Email Login OTP (Web & Mobile).
 */
export async function handleRiderEmailOtpSend(
  request: Request,
  { isMobile }: { isMobile: boolean }
) {
  try {
    const body = await request.json().catch(() => ({}))

    const sec = await validateRequestSecurity(request, {
      action: "email_otp",
      isMobile,
      turnstileToken: body.turnstileToken || body["cf-turnstile-response"],
    })
    if (!sec.allowed) {
      return (sec.response ||
        formatError(isMobile, "Too many requests. Please wait.", 429)) as NextResponse
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) {
      return formatError(isMobile, "Email is required.", 400)
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.RIDER },
      select: {
        id: true,
        name: true,
        isEmailVerified: true,
        emailOtpSentAt: true,
        rider: {
          select: {
            id: true,
            isSuspended: true,
            status: true,
          },
        },
      },
    })

    if (!user) {
      return formatError(isMobile, "No rider account found with this email.", 404)
    }

    if (!user.isEmailVerified) {
      return formatError(
        isMobile,
        "Please verify your account first before Email OTP login.",
        403,
        {
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: isMobile
            ? "/mobileapi/rider/auth/verify-otp"
            : `/riderapp/verify-email?email=${encodeURIComponent(email)}`,
          ...(isMobile ? { data: { email } } : { email }),
        }
      )
    }

    if (isRiderSuspended(user.rider)) {
      return formatError(
        isMobile,
        "Your rider account has been suspended. Please contact support.",
        403,
        isMobile ? { isSuspended: true, authStatus: "SUSPENDED" } : undefined
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < EMAIL_OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((EMAIL_OTP_COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return formatError(
        isMobile,
        `Please wait ${waitSec} seconds before requesting another OTP.`,
        429,
        { waitTime: waitSec }
      )
    }

    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: otp,
        emailVerificationExpires: new Date(Date.now() + EMAIL_OTP_EXPIRY_MS),
        emailOtpSentAt: now,
      },
    })

    const mailResult = await sendLoginOtpEmail({ to: email, otp, name: user.name })
    if (mailResult && (mailResult as any).success === false) {
      throw (mailResult as any).error || new Error("Failed to dispatch login OTP email.")
    }

    if (isMobile) {
      return NextResponse.json(
        {
          success: true,
          message: "Login OTP sent to your email.",
          data: {
            email,
            expiresIn: EMAIL_OTP_EXPIRY_MS / 1000,
            resendCooldown: EMAIL_OTP_COOLDOWN_MS / 1000,
          },
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { message: "Login OTP sent to your email." },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Rider email-otp send error:", error)
    return formatError(isMobile, error?.message || "Internal server error", 500)
  }
}

/**
 * Shared handler for verifying Rider Email Login OTP (Web & Mobile).
 */
export async function handleRiderEmailOtpVerify(
  request: Request,
  { isMobile }: { isMobile: boolean }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

    if (!email || !otp) {
      return formatError(isMobile, "Email and OTP are required.", 400)
    }
    if (!/^\d{6}$/.test(otp)) {
      return formatError(isMobile, "OTP must be 6 digits.", 400)
    }

    const rateLimitKey = `${email}:${isMobile ? "mobile-" : ""}rider-email-verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return formatError(
        isMobile,
        `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        429
      )
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.RIDER },
      include: { rider: true },
    })

    if (!user || !user.isEmailVerified) {
      await recordOtpFailure(rateLimitKey)
      return formatError(isMobile, "Invalid email or OTP.", 400)
    }

    const riderProfile = await ensureRiderProfile(user.id, user.rider)
    if (!riderProfile) {
      return formatError(isMobile, "Rider profile not found. Please contact support.", 403)
    }

    if (isRiderSuspended(riderProfile)) {
      return formatError(
        isMobile,
        "Your rider account has been suspended. Please contact support.",
        403,
        isMobile ? { isSuspended: true, authStatus: "SUSPENDED" } : undefined
      )
    }

    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return formatError(isMobile, "Invalid OTP.", 400)
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      await recordOtpFailure(rateLimitKey)
      return formatError(
        isMobile,
        "OTP has expired. Please request a new one.",
        400,
        isMobile ? { expired: true } : undefined
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: null,
        emailVerificationExpires: null,
        emailOtpSentAt: null,
      },
    })

    await resetOtpRateLimit(rateLimitKey)

    if (!isMobile) {
      const otpLoginToken = createOtpLoginToken(user.email || user.phone || user.id, UserRole.RIDER, {
        userId: user.id,
        email: user.email,
        phone: user.phone,
      })
      return NextResponse.json(
        {
          message: "OTP verified successfully.",
          otpLoginToken,
          email: user.email,
          phone: user.phone,
          loginUrl: "/riderapp",
        },
        { status: 200 }
      )
    }

    const { deviceId, platform, deviceToken, userAgent } = body
    await upsertRiderDeviceToken(riderProfile.id, riderProfile.deviceTokens, {
      deviceId,
      platform,
      deviceToken,
      userAgent,
    })

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      passwordHash: user.password || "",
      deviceId,
      platform,
    })

    const { password: _, rider: _rider, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          rider: {
            id: riderProfile.id,
            isApproved: riderProfile.isApproved,
            isSuspended: riderProfile.isSuspended,
            status: riderProfile.status,
            onboardingCompleted: riderProfile.onboardingCompleted,
            isFirstLogin: riderProfile.isFirstLogin,
            vehicleTypes: riderProfile.vehicleTypes,
            vehicleNumber: riderProfile.vehicleNumber,
            drivingLicenseNo: riderProfile.drivingLicenseNo,
            profileImage: riderProfile.profileImage,
            selectedZones: riderProfile.selectedZones,
            selectedLocations: riderProfile.selectedLocations,
          },
          tokens,
          sessionInfo: {
            expiresIn: tokens.expiresIn,
            tokenType: "Bearer",
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Rider email-otp verify error:", error)
    return formatError(isMobile, "Internal server error", 500)
  }
}
