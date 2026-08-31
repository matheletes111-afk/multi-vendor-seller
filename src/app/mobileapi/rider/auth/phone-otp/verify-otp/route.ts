import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber } from "@/lib/twilio-sms"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"

/** POST /mobileapi/rider/auth/phone-otp/verify-otp — Body: { phone, otp, deviceId?, platform?, deviceToken?, userAgent? } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const { deviceId, platform, deviceToken, userAgent } = body
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone) || !otp) {
      return NextResponse.json(
        { success: false, error: "Phone number and OTP are required." },
        { status: 400 }
      )
    }

    const rateLimitKey = `${normalizedPhone}:mobile-rider-verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json(
        { success: false, error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      )
    }

    const phoneDigits = normalizedPhone.replace(/^\+/, "")
    const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.RIDER,
        OR: [
          { phone: normalizedPhone },
          { phone: phoneDigits },
          ...splitPairs.map((pair) => ({
            phoneCountryCode: pair.countryCode,
            phone: pair.phone,
          })),
        ],
      },
      include: {
        rider: true,
      },
    })

    if (!user) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ success: false, error: "Invalid phone number or OTP." }, { status: 400 })
    }

    if (!user.rider) {
      return NextResponse.json(
        { success: false, error: "Rider profile not found. Please contact support." },
        { status: 403 }
      )
    }

    if (user.rider.isSuspended || user.rider.status === "SUSPENDED") {
      return NextResponse.json(
        {
          success: false,
          error: "Your rider account has been suspended. Please contact support.",
          isSuspended: true,
          authStatus: "SUSPENDED",
        },
        { status: 403 }
      )
    }

    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ success: false, error: "Invalid OTP." }, { status: 400 })
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Auto-verify user email/phone and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verifyEmailOtp: null,
        emailVerificationExpires: null,
        emailOtpSentAt: null,
      },
    })

    await resetOtpRateLimit(rateLimitKey)

    // Auto-register device token if provided
    if (deviceToken || deviceId) {
      try {
        const tokenToStore = deviceToken || deviceId!
        const existingTokens: any[] = Array.isArray(user.rider.deviceTokens)
          ? (user.rider.deviceTokens as any[])
          : []

        const now = new Date().toISOString()
        const otherTokens = existingTokens.filter((t) => t && t.token !== tokenToStore && t.deviceId !== deviceId)

        const newEntry = {
          token: tokenToStore,
          deviceId: deviceId || null,
          platform: platform || "android",
          userAgent: userAgent || null,
          lastActiveAt: now,
          createdAt: now,
        }

        await prisma.rider.update({
          where: { id: user.rider.id },
          data: {
            deviceTokens: [...otherTokens, newEntry],
          },
        })
      } catch (tokenErr) {
        console.error("Failed to register device token in phone OTP verify:", tokenErr)
      }
    }

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      passwordHash: user.password || "",
      deviceId,
      platform,
    })

    const { password: _, rider, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          user: {
            ...userWithoutPassword,
            isEmailVerified: true,
          },
          rider: {
            id: rider.id,
            isApproved: rider.isApproved,
            isSuspended: rider.isSuspended,
            status: rider.status,
            onboardingCompleted: rider.onboardingCompleted,
            isFirstLogin: rider.isFirstLogin,
            vehicleTypes: rider.vehicleTypes,
            vehicleNumber: rider.vehicleNumber,
            drivingLicenseNo: rider.drivingLicenseNo,
            profileImage: rider.profileImage,
            selectedZones: rider.selectedZones,
            selectedLocations: rider.selectedLocations,
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
    console.error("Mobile rider phone-otp verify error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
