import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

/**
 * POST /mobileapi/rider/auth/verify-otp
 * Body: { email, otp }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP code are required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.RIDER },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
        rider: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Rider account not found." },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified. You can now log in to the Rider app.",
        data: {
          email: user.email,
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
      message: "Email verified successfully! You can now log in to complete your rider onboarding.",
      data: {
        email: user.email,
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
