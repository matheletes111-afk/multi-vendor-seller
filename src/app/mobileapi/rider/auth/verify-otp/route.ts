import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/**
 * POST /mobileapi/rider/auth/verify-otp
 * Body: { email, phone, phoneCountryCode, otp }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

    if (!otp || (!email && !phone)) {
      return NextResponse.json(
        { success: false, error: "Mobile number or email and OTP code are required" },
        { status: 400 }
      )
    }

    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { email, role: UserRole.RIDER },
        select: {
          id: true,
          email: true,
          phone: true,
          isEmailVerified: true,
          verifyEmailOtp: true,
          emailVerificationExpires: true,
          rider: true,
        },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.RIDER },
        select: {
          id: true,
          email: true,
          phone: true,
          isEmailVerified: true,
          verifyEmailOtp: true,
          emailVerificationExpires: true,
          rider: true,
        },
      })
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Rider account not found." },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Account is already verified. You can now log in to the Rider app.",
        data: {
          email: user.email,
          phone: user.phone,
          isEmailVerified: true,
          loginAvailable: true,
        },
      })
    }

    const now = new Date()
    if (
      user.verifyEmailOtp !== otp ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < now
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP code." },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerified: new Date(),
        verifyEmailOtp: null,
        emailVerificationExpires: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Account verified successfully! You can now log in to complete your rider onboarding.",
      data: {
        email: user.email,
        phone: user.phone,
        isEmailVerified: true,
        loginAvailable: true,
        onboardingCompleted: user.rider?.onboardingCompleted ?? false,
      },
    })
  } catch (error) {
    console.error("Mobile rider verify-otp error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during verification." },
      { status: 500 }
    )
  }
}
