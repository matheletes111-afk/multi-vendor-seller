import { NextResponse } from "next/server"
import { resendLogin2faOtp } from "@/lib/login-2fa"

/** POST /mobileapi/restaurant-seller/auth/resend-2fa — Resend 2FA OTP for Restaurant Seller mobile login */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { preAuthToken } = body as { preAuthToken?: string }

    if (!preAuthToken) {
      return NextResponse.json(
        { success: false, error: "Verification session token is required." },
        { status: 400 }
      )
    }

    const resendResult = await resendLogin2faOtp({ preAuthToken })
    if (!resendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: resendResult.error || "Failed to resend verification code.",
          cooldownRemaining: (resendResult as any).cooldownRemaining,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: resendResult.message,
        data: {
          preAuthToken: resendResult.preAuthToken,
          resendCooldown: resendResult.resendCooldown,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile restaurant-seller 2FA resend error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during resend." },
      { status: 500 }
    )
  }
}
