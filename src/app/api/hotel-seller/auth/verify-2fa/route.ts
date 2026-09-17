import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { verifyLogin2faOtp, completeWebNextAuthLogin } from "@/lib/login-2fa"

/** POST /api/hotel-seller/auth/verify-2fa — Verify 2FA OTP for Hotel Seller web login */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { preAuthToken, otp, callbackUrl, csrfToken } = body as {
      preAuthToken?: string
      otp?: string
      callbackUrl?: string
      csrfToken?: string
    }

    if (!preAuthToken || !otp) {
      return NextResponse.json(
        { error: "Verification session token and 6-digit code are required." },
        { status: 400 }
      )
    }

    const verification = await verifyLogin2faOtp({ preAuthToken, otp })
    if (!verification.success || !verification.user) {
      return NextResponse.json(
        {
          error: verification.error || "Invalid verification code.",
          sessionExpired: verification.sessionExpired,
          codeExpired: verification.codeExpired,
        },
        { status: 400 }
      )
    }

    return completeWebNextAuthLogin({
      request,
      user: verification.user,
      role: UserRole.SELLER_HOTEL,
      callbackUrl,
      defaultPath: "/hotel-seller",
      csrfToken,
    })
  } catch (error) {
    console.error("Hotel seller 2FA verification error:", error)
    return NextResponse.json(
      { error: "Internal server error during verification." },
      { status: 500 }
    )
  }
}
