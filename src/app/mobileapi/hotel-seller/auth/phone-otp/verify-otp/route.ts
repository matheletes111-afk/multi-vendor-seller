import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber } from "@/lib/twilio-sms"

type ApiResponse =
  | {
      success: true
      message: string
      data: {
        user: {
          id: string
          email: string
          name: string | null
          role: UserRole
          phone: string | null
          phoneCountryCode: string | null
          isEmailVerified: boolean
          createdAt: Date
          updatedAt: Date
          sellerInfo: { isApproved: boolean; isSuspended: boolean; onboardingCompleted: boolean; onboardingStep: number; mobileStep: number } | null
        }
        tokens: { accessToken: string; refreshToken: string; expiresIn: number }
        sessionInfo: { expiresIn: number; tokenType: "Bearer" }
      }
    }
  | { success: false; error: string; expired?: boolean; needsApproval?: boolean; isSuspended?: boolean; approvalStatus?: string }

/** POST /mobileapi/hotel-seller/auth/phone-otp/verify-otp — Body: { phone, otp } */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone) || !otp) {
      return NextResponse.json({ success: false, error: "Phone number and OTP are required." }, { status: 400 })
    }
    if (!/^\d{6}$/.test(otp)) return NextResponse.json({ success: false, error: "OTP must be 6 digits" }, { status: 400 })

    const phoneDigits = normalizedPhone.replace(/^\+/, "")
    const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.SELLER_HOTEL,
        OR: [
          { phone: normalizedPhone },
          { phone: phoneDigits },
          ...splitPairs.map((pair) => ({
            phoneCountryCode: pair.countryCode,
            phone: pair.phone,
          })),
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
        createdAt: true,
        updatedAt: true,
        hotelSeller: { select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } },
      },
    })

    if (!user || !user.isEmailVerified) {
      return NextResponse.json({ success: false, error: "Invalid phone number or OTP." }, { status: 400 })
    }
    if (!user.hotelSeller) {
      return NextResponse.json({ success: false, error: "Hotel seller account not properly configured. Please contact support." }, { status: 403 })
    }
    if (!user.hotelSeller.isApproved && user.hotelSeller.onboardingCompleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account is pending admin approval.",
          needsApproval: true,
          approvalStatus: "PENDING",
        },
        { status: 403 }
      )
    }
    if (user.hotelSeller.isSuspended) {
      return NextResponse.json({ success: false, error: "Your account has been suspended. Please contact support.", isSuspended: true }, { status: 403 })
    }
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ success: false, error: "Invalid OTP." }, { status: 400 })
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ success: false, error: "OTP has expired. Please request a new one.", expired: true }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    const tokens = generateMobileTokens({ userId: user.id, email: user.email, role: user.role })
    return NextResponse.json({
      success: true,
      message: "OTP login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          phoneCountryCode: user.phoneCountryCode,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          sellerInfo: {
            ...user.hotelSeller,
            mobileStep: Math.max(1, (user.hotelSeller?.onboardingStep || 1) - 1)
          },
        },
        tokens,
        sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
      },
    })
  } catch (error) {
    console.error("Mobile hotel seller phone-otp verify error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
