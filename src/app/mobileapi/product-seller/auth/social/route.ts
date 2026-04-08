import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { verifySocialToken } from "@/lib/social-auth"
import { activateFreePlan } from "@/lib/subscriptions"

interface SocialLoginRequest {
  provider: "google" | "facebook"
  idToken?: string
  accessToken?: string
}

interface SellerInfo {
  isApproved: boolean
  isSuspended: boolean
  onboardingCompleted: boolean
  onboardingStep: number
  mobileStep: number
  type: string | null
}

interface SuccessResponse {
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
      sellerInfo: SellerInfo | null
    }
    tokens: { accessToken: string; refreshToken: string; expiresIn: number }
    sessionInfo: { expiresIn: number; tokenType: "Bearer" }
  }
}

interface ErrorResponse {
  success: false
  error: string
  needsApproval?: boolean
  isSuspended?: boolean
  approvalStatus?: string
}

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    let body: SocialLoginRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const { provider, idToken, accessToken } = body
    if (!provider || (provider !== "google" && provider !== "facebook")) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "provider must be 'google' or 'facebook'" },
        { status: 400 }
      )
    }

    const profile = await verifySocialToken(provider, idToken, accessToken)
    if (!profile) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      )
    }

    const email = profile.email?.toLowerCase().trim()
    if (!email) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Email not provided by provider" },
        { status: 401 }
      )
    }

    const existingAccount = await prisma.account.findFirst({
      where: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            phoneCountryCode: true,
            isEmailVerified: true,
            createdAt: true,
            updatedAt: true,
            seller: { select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true, type: true } },
          },
        },
      },
    })

    if (existingAccount) {
      const u = existingAccount.user
      if (u.role !== UserRole.SELLER_PRODUCT) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "This account is not a product seller account" },
          { status: 403 }
        )
      }
      if (!u.seller) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "Seller account not properly configured. Please contact support." },
          { status: 403 }
        )
      }
      if (!u.seller.isApproved) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Your account is pending admin approval. You cannot log in until approved.",
            needsApproval: true,
            approvalStatus: "PENDING",
          },
          { status: 403 }
        )
      }
      if (u.seller.isSuspended) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Your account has been suspended. Please contact support.",
            isSuspended: true,
          },
          { status: 403 }
        )
      }
      const tokens = generateMobileTokens({
        userId: u.id,
        email: u.email,
        role: u.role,
      })
      return NextResponse.json<SuccessResponse>(
        {
          success: true,
          message: "Login successful",
          data: {
            user: {
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role,
              phone: u.phone,
              phoneCountryCode: u.phoneCountryCode,
              isEmailVerified: u.isEmailVerified ?? false,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
              sellerInfo: {
                ...u.seller,
                mobileStep: Math.max(1, (u.seller?.onboardingStep || 1) - 1)
              } as any,
            },
            tokens,
            sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
          },
        },
        { status: 200 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { seller: true },
    })
    if (existingUser) {
      if (existingUser.role !== UserRole.SELLER_PRODUCT) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "This email is registered as a different account type" },
          { status: 403 }
        )
      }
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          type: "oauth",
          provider,
          providerAccountId: profile.providerAccountId,
          access_token: accessToken ?? null,
        },
      })
      const seller = existingUser.seller
      if (!seller) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "Seller account not properly configured. Please contact support." },
          { status: 403 }
        )
      }
      if (!seller.isApproved) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Your account is pending admin approval. You cannot log in until approved.",
            needsApproval: true,
            approvalStatus: "PENDING",
          },
          { status: 403 }
        )
      }
      if (seller.isSuspended) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Your account has been suspended. Please contact support.",
            isSuspended: true,
          },
          { status: 403 }
        )
      }
      const tokens = generateMobileTokens({
        userId: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      })
      return NextResponse.json<SuccessResponse>(
        {
          success: true,
          message: "Login successful",
          data: {
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              role: existingUser.role,
              phone: existingUser.phone,
              phoneCountryCode: existingUser.phoneCountryCode,
              isEmailVerified: existingUser.isEmailVerified ?? false,
              createdAt: existingUser.createdAt,
              updatedAt: existingUser.updatedAt,
              sellerInfo: {
                ...seller,
                mobileStep: Math.max(1, (seller?.onboardingStep || 1) - 1)
              } as any,
            },
            tokens,
            sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
          },
        },
        { status: 200 }
      )
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name: profile.name ?? null,
        image: profile.image,
        password: null,
        role: UserRole.SELLER_PRODUCT,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    const seller = await prisma.seller.create({
      data: { userId: newUser.id, type: "PRODUCT" },
    })
    await activateFreePlan(seller.id)
    await prisma.account.create({
      data: {
        userId: newUser.id,
        type: "oauth",
        provider,
        providerAccountId: profile.providerAccountId,
        access_token: accessToken ?? null,
      },
    })

    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: "Your account is pending admin approval. You cannot log in until approved.",
        needsApproval: true,
        approvalStatus: "PENDING",
      },
      { status: 403 }
    )
  } catch (error) {
    console.error("Mobile product seller social login error:", error)
    return NextResponse.json<ErrorResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
