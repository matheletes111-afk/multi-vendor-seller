import { validateRequestSecurity } from "@/lib/security-guard"
import { NextResponse } from "next/server"
import { resendLogin2faOtp } from "@/lib/login-2fa"

/** POST /mobileapi/product-seller/auth/resend-2fa — Resend 2FA OTP for Product Seller mobile login */
export async function POST(request: Request) {
  try {
    // 🛡️ Security Guard: IP rate limit (3/min)
    const sec = await validateRequestSecurity(request, {
      action: "resend_otp",
      isMobile: true,
    })
    if (!sec.allowed) {
      return (sec.response || NextResponse.json({ success: false, error: "Too many requests. Please wait." }, { status: 429 })) as any
    }

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
    console.error("Mobile product-seller 2FA resend error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during resend." },
      { status: 500 }
    )
  }
}
