import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SELLER_PRODUCT: "Product Seller",
  SELLER_SERVICE: "Service Seller",
  SELLER_HOTEL: "Hotel Seller",
  SELLER_RESTAURANT: "Restaurant Seller",
  ADMIN: "Admin",
  RIDER: "Delivery Rider",
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, callbackUrl, csrfToken } = body as {
      email?: string
      password?: string
      callbackUrl?: string
      csrfToken?: string
    }

    const rawIdentifier = (email || (body as any).phone || (body as any).identifier || "").trim()
    const rawCountryCode = ((body as any).phoneCountryCode || "").trim()

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: "Email or mobile number and password are required" },
        { status: 400 }
      )
    }

    const isEmailFormat = rawIdentifier.includes("@")
    let user: any = null

    if (isEmailFormat) {
      user = await prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
        select: { id: true, email: true, phone: true, phoneCountryCode: true, name: true, password: true, role: true, isEmailVerified: true },
      })
    } else {
      const { getEquivalentPhoneVariants } = await import("@/lib/phone-validation")
      const phoneVariants = getEquivalentPhoneVariants(rawIdentifier, rawCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true, email: true, phone: true, phoneCountryCode: true, name: true, password: true, role: true, isEmailVerified: true },
      })
    }

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Role check
    if (user.role !== UserRole.RIDER) {
      const label = ROLE_LABELS[user.role] || user.role
      return NextResponse.json(
        { error: `This account is registered as a ${label}. Please sign in using the ${label} login portal.` },
        { status: 401 }
      )
    }

    // Verification check
    if (user.isEmailVerified === false) {
      return NextResponse.json(
        {
          error: "Please verify your account before logging in.",
          needsVerification: true,
          email: user.email,
          phone: user.phone,
        },
        { status: 403 }
      )
    }

    // Rider suspension check
    const rider = await prisma.rider.findUnique({
      where: { userId: user.id },
      select: { isSuspended: true, status: true, onboardingCompleted: true, isFirstLogin: true },
    })

    if (rider && (rider.isSuspended || rider.status === "SUSPENDED")) {
      return NextResponse.json(
        { error: "Your rider account has been suspended. Please contact support." },
        { status: 403 }
      )
    }

    // Require 2FA OTP verification for email/phone + password logins
    const { generateAndSendLogin2faOtp } = await import("@/lib/login-2fa")
    const otpResult = await generateAndSendLogin2faOtp(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
      },
      UserRole.RIDER
    )

    if (!otpResult.success) {
      return NextResponse.json(
        { error: otpResult.error || "Failed to send verification code. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(otpResult, { status: 200 })
  } catch (error) {
    console.error("Rider login API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    )
  }
}
