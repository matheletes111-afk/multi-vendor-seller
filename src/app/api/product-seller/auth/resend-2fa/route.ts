import { NextResponse } from "next/server"
import { resendLogin2faOtp } from "@/lib/login-2fa"

/** POST /api/product-seller/auth/resend-2fa — Resend 2FA OTP for Product Seller web login */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { preAuthToken } = body as { preAuthToken?: string }

    if (!preAuthToken) {
      return NextResponse.json(
        { error: "Verification session token is required." },
        { status: 400 }
      )
    }

    const resendResult = await resendLogin2faOtp({ preAuthToken })
    if (!resendResult.success) {
      return NextResponse.json(
        {
          error: resendResult.error || "Failed to resend verification code.",
          sessionExpired: resendResult.sessionExpired,
          cooldownRemaining: resendResult.cooldownRemaining,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: resendResult.message,
        preAuthToken: resendResult.preAuthToken,
        resendCooldown: resendResult.resendCooldown,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Product seller 2FA resend error:", error)
    return NextResponse.json(
      { error: "Internal server error during resend." },
      { status: 500 }
    )
  }
}
