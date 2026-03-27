import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
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
          image: string | null
          role: UserRole
          phone: string | null
          phoneCountryCode: string | null
          isEmailVerified: boolean
          createdAt: Date
          updatedAt: Date
        }
        tokens: { accessToken: string; refreshToken: string; expiresIn: number }
        sessionInfo: { expiresIn: number; tokenType: "Bearer" }
      }
    }
  | { success: false; error: string; expired?: boolean }

/** POST /mobileapi/customer/auth/phone-otp/verify-otp — Body: { phone, otp }. Same lookup rules as web /api/customer/auth/phone-otp/verify-otp */
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
        role: UserRole.CUSTOMER,
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
        role: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
      },
    })

    if (!user) return NextResponse.json({ success: false, error: "Invalid phone number or OTP." }, { status: 400 })
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ success: false, error: "Invalid OTP." }, { status: 400 })
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ success: false, error: "OTP has expired. Please request a new one.", expired: true }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    const tokens = generateMobileTokens({ userId: user.id, email: user.email, role: user.role })

    const UserDetails = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        phoneCountryCode: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "OTP login successful",
      data: {
        user: UserDetails,
        tokens,
        sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
      },
    })
  } catch (error) {
    console.error("Mobile customer phone-otp verify error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
