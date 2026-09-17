import { NextResponse } from "next/server"
import { verifyLogin2faOtp } from "@/lib/login-2fa"
import { generateMobileTokens } from "@/lib/mobile-jwt"

/** POST /mobileapi/restaurant-seller/auth/verify-2fa — Verify 2FA OTP for Restaurant Seller mobile login */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { preAuthToken, otp } = body as { preAuthToken?: string; otp?: string }

    if (!preAuthToken || !otp) {
      return NextResponse.json(
        { success: false, error: "Verification session token and 6-digit code are required." },
        { status: 400 }
      )
    }

    const verification = await verifyLogin2faOtp({ preAuthToken, otp })
    if (!verification.success || !verification.user) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "Invalid verification code.",
          sessionExpired: verification.sessionExpired,
          codeExpired: verification.codeExpired,
        },
        { status: 400 }
      )
    }

    const user = verification.user

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      passwordHash: user.password,
    })

    const { password: _, restaurantSeller, ...userWithoutPassword } = user as any

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          user: {
            ...userWithoutPassword,
            sellerType: "restaurant",
            sellerInfo: restaurantSeller
              ? {
                  ...restaurantSeller,
                  mobileStep: Math.max(1, (restaurantSeller.onboardingStep || 2) - 1),
                }
              : null,
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
    console.error("Mobile restaurant-seller 2FA verification error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during verification." },
      { status: 500 }
    )
  }
}
