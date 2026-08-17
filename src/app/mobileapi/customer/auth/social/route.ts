import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { verifySocialToken } from "@/lib/social-auth"

interface SocialLoginRequest {
  provider: "google" | "facebook" | "apple"
  idToken?: string
  accessToken?: string
  name?: string
  email?: string
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
    }
    tokens: { accessToken: string; refreshToken: string; expiresIn: number }
    sessionInfo: { expiresIn: number; tokenType: "Bearer" }
  }
}

interface ErrorResponse {
  success: false
  error: string
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

    const { idToken, accessToken, name: bodyName, email: bodyEmail } = body
    let rawProvider = (body.provider as string | undefined)?.toLowerCase()?.trim()
    if (rawProvider === "apple.com") rawProvider = "apple"
    if (rawProvider === "google.com") rawProvider = "google"
    if (rawProvider === "facebook.com") rawProvider = "facebook"

    if (!rawProvider || (rawProvider !== "google" && rawProvider !== "facebook" && rawProvider !== "apple")) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "provider must be 'google', 'facebook', or 'apple'" },
        { status: 400 }
      )
    }

    const provider = rawProvider as "google" | "facebook" | "apple"

    const profile = await verifySocialToken(provider, idToken, accessToken)
    if (!profile) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      )
    }

    const email = (profile.email || bodyEmail)?.toLowerCase().trim()
    const userName = profile.name || bodyName || null
    if (!email) {
      // Check if existing account exists by provider and providerAccountId
      const existingAccount = await prisma.account.findFirst({
        where: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
        include: {
          user: {
            select: {
              password: true,
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
          },
        },
      })

      if (existingAccount) {
        if (existingAccount.user.role !== UserRole.CUSTOMER) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "This account is not a customer account" },
            { status: 403 }
          )
        }
        const tokens = generateMobileTokens({
          userId: existingAccount.user.id,
          email: existingAccount.user.email,
          role: existingAccount.user.role,
          passwordHash: existingAccount.user.password,
        })
        return NextResponse.json<SuccessResponse>(
          {
            success: true,
            message: "Login successful",
            data: {
              user: {
                id: existingAccount.user.id,
                email: existingAccount.user.email,
                name: existingAccount.user.name,
                role: existingAccount.user.role,
                phone: existingAccount.user.phone,
                phoneCountryCode: existingAccount.user.phoneCountryCode,
                isEmailVerified: existingAccount.user.isEmailVerified ?? false,
                createdAt: existingAccount.user.createdAt,
                updatedAt: existingAccount.user.updatedAt,
              },
              tokens,
              sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
            },
          },
          { status: 200 }
        )
      }

      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Email not provided by provider" },
        { status: 401 }
      )
    }

    let user: {
      id: string
      email: string
      name: string | null
      role: UserRole
      phone: string | null
      phoneCountryCode: string | null
      isEmailVerified: boolean
      createdAt: Date
      updatedAt: Date
    } | null = null
    let passwordHash: string | null = null

    const existingAccount = await prisma.account.findFirst({
      where: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
      include: {
        user: {
          select: {
            password: true,
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
        },
      },
    })

    if (existingAccount) {
      if (existingAccount.user.role !== UserRole.CUSTOMER) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "This account is not a customer account" },
          { status: 403 }
        )
      }
      passwordHash = existingAccount.user.password
      user = {
        id: existingAccount.user.id,
        email: existingAccount.user.email,
        name: existingAccount.user.name,
        role: existingAccount.user.role,
        phone: existingAccount.user.phone,
        phoneCountryCode: existingAccount.user.phoneCountryCode,
        isEmailVerified: existingAccount.user.isEmailVerified ?? false,
        createdAt: existingAccount.user.createdAt,
        updatedAt: existingAccount.user.updatedAt,
      }
    } else {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      if (existingUser) {
        if (existingUser.role !== UserRole.CUSTOMER) {
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
        passwordHash = existingUser.password
        user = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          phone: existingUser.phone,
          phoneCountryCode: existingUser.phoneCountryCode,
          isEmailVerified: existingUser.isEmailVerified ?? false,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
        }
      } else {
        const newUser = await prisma.user.create({
          data: {
            email,
            name: userName,
            image: profile.image,
            password: null,
            role: UserRole.CUSTOMER,
            isEmailVerified: true,
          },
          select: {
            password: true,
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
        await prisma.account.create({
          data: {
            userId: newUser.id,
            type: "oauth",
            provider,
            providerAccountId: profile.providerAccountId,
            access_token: accessToken ?? null,
          },
        })
        passwordHash = newUser.password
        const { password: _, ...newUserWithoutPassword } = newUser
        user = newUserWithoutPassword
      }
    }

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      passwordHash,
    })

    return NextResponse.json<SuccessResponse>(
      {
        success: true,
        message: "Login successful",
        data: {
          user,
          tokens,
          sessionInfo: { expiresIn: tokens.expiresIn, tokenType: "Bearer" },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile customer social login error:", error)
    return NextResponse.json<ErrorResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
