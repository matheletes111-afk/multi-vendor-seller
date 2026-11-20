import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { ensureRiderProfile, isRiderSuspended, upsertRiderDeviceToken } from "@/lib/rider-auth"
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

    const riderProfile = await ensureRiderProfile(user.id, user.rider)
    if (!riderProfile) {
      return NextResponse.json(
        { success: false, error: "Rider profile not found. Please contact support." },
        { status: 403 }
      )
    }

    if (isRiderSuspended(riderProfile)) {
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
          user: {
            ...userWithoutPassword,
            isEmailVerified: true,
          },
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
    console.error("Mobile rider phone-otp verify error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
