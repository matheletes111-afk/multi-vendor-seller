import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAppBaseUrl } from "@/lib/twilio-sms"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = (searchParams.get("token") || searchParams.get("otp") || "").trim()
    const email = (searchParams.get("email") || "").trim().toLowerCase()
    const baseUrl = getAppBaseUrl(request)

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/riderapp/login?error=missing_token`)
    }

    const user = await prisma.user.findFirst({
      where: email ? { email, verifyEmailOtp: token } : { verifyEmailOtp: token },
      select: {
        id: true,
        email: true,
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

    return NextResponse.redirect(`${baseUrl}/riderapp/login?verified=1&email=${encodeURIComponent(user.email)}`)
  } catch (error) {
    console.error("Rider GET verify-email error:", error)
    return NextResponse.redirect(`${getAppBaseUrl(request)}/riderapp/login?error=verification_error`)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, otp, email } = body
    const code = (token || otp || "").trim()

    if (!code || !email) {
      return NextResponse.json(
        { error: "Verification code and email are required" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified. You can now log in.",
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
      message: "Email successfully verified! You can now log in to the Rider Portal.",
    })
  } catch (error) {
    console.error("Rider verify-email error:", error)
    return NextResponse.json(
      { error: "An error occurred during email verification." },
      { status: 500 }
    )
  }
}
