import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAppBaseUrl } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { UserRole } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = (searchParams.get("token") || searchParams.get("otp") || "").trim()
    const email = (searchParams.get("email") || "").trim().toLowerCase()
    const phone = (searchParams.get("phone") || "").trim()
    const phoneCountryCode = (searchParams.get("phoneCountryCode") || "").trim()
    const baseUrl = getAppBaseUrl(request)

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/riderapp/login?error=missing_token`)
    }

    let whereClause: any = { verifyEmailOtp: token, role: UserRole.RIDER }
    if (email) {
      whereClause.email = email
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      whereClause.phone = { in: phoneVariants }
    }

    const user = await prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
      },
    })

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/riderapp/login?error=invalid_or_expired_token`)
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return NextResponse.redirect(`${baseUrl}/riderapp/login?error=verification_expired`)
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

    const identifier = user.email || user.phone || ""
    return NextResponse.redirect(`${baseUrl}/riderapp/login?verified=1&identifier=${encodeURIComponent(identifier)}`)
  } catch (error) {
    console.error("Rider GET verify-email error:", error)
    return NextResponse.redirect(`${getAppBaseUrl(request)}/riderapp/login?error=verification_error`)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, otp, email, phone, phoneCountryCode } = body
    const code = (token || otp || "").trim()
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    const cleanPhone = typeof phone === "string" ? phone.trim() : ""
    const cleanCountryCode = typeof phoneCountryCode === "string" ? phoneCountryCode.trim() : ""

    if (!code || (!cleanEmail && !cleanPhone)) {
      return NextResponse.json(
        { error: "Verification code and email or mobile number are required" },
        { status: 400 }
      )
    }

    let user: any = null
    if (cleanEmail) {
      user = await prisma.user.findFirst({
        where: { email: cleanEmail, role: UserRole.RIDER },
        select: {
          id: true,
          isEmailVerified: true,
          verifyEmailOtp: true,
          emailVerificationExpires: true,
        },
      })
    } else if (cleanPhone) {
      const phoneVariants = getEquivalentPhoneVariants(cleanPhone, cleanCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.RIDER },
        select: {
          id: true,
          isEmailVerified: true,
          verifyEmailOtp: true,
          emailVerificationExpires: true,
        },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: "Rider account not found" },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Account is already verified. You can now log in.",
      })
    }

    if (user.verifyEmailOtp !== code) {
      return NextResponse.json(
        { error: "Invalid verification code or link" },
        { status: 400 }
      )
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return NextResponse.json(
        { error: "Verification link has expired. Please request a new one." },
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
      message: "Account successfully verified! You can now log in to the Rider Portal.",
    })
  } catch (error) {
    console.error("Rider verify-email error:", error)
    return NextResponse.json(
      { error: "An error occurred during verification." },
      { status: 500 }
    )
  }
}
