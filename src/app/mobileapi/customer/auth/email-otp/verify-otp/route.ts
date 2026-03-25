import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"

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
        }
        tokens: { accessToken: string; refreshToken: string; expiresIn: number }
        sessionInfo: { expiresIn: number; tokenType: "Bearer" }
      }
    }
  | { success: false; error: string; expired?: boolean }

/** POST /mobileapi/customer/auth/email-otp/verify-otp — Body: { email, otp } */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    if (!email || !otp) return NextResponse.json({ success: false, error: "Email and OTP are required" }, { status: 400 })
    if (!/^\d{6}$/.test(otp)) return NextResponse.json({ success: false, error: "OTP must be 6 digits" }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.CUSTOMER },
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
      },
    })
    if (!user) return NextResponse.json({ success: false, error: "No account found for this email in customer panel." }, { status: 404 })
    if (!user.isEmailVerified) return NextResponse.json({ success: false, error: "Please verify your email first before OTP login." }, { status: 400 })
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ success: false, error: "Invalid OTP." }, { status: 400 })
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ success: false, error: "OTP has expired. Please request a new one.", expired: true }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    const tokens = generateMobileTokens({ userId: user.id, email: user.email, role: user.role })
    
    const UserDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        phoneCountryCode: true,
      },
    })
    
    if (!UserDetails) {
      return NextResponse.json({
        success: false,
        error: "User not found",
      }, { status: 404 })
    }
    
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
    console.error("Mobile customer email-otp verify error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
