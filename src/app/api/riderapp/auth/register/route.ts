import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { sendRiderVerificationEmail } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, phoneCountryCode, password } = body

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Validate phone & country code if provided
    let cleanedPhone: string | null = null
    let cleanedCountryCode: string | null = null

    if (phone && phoneCountryCode) {
      const phoneValidation = validatePhoneAndCountryCode(phone, phoneCountryCode)
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || "Invalid phone number or country code" },
          { status: 400 }
        )
      }
      cleanedPhone = phoneValidation.cleanedPhone || null
      cleanedCountryCode = phoneValidation.cleanedCountryCode || null
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        phone: cleanedPhone,
        phoneCountryCode: cleanedCountryCode,
        role: UserRole.RIDER,
        isEmailVerified: false,
        verifyEmailOtp: verifyToken,
        emailVerificationExpires: expiresAt,
        emailOtpSentAt: new Date(),
        rider: {
          create: {
            isApproved: true,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        },
      },
    })

    const origin = new URL(request.url).origin
    const verificationLink = `${origin}/riderapp/verify-email?token=${verifyToken}&email=${encodeURIComponent(cleanEmail)}`

    // Send verification email
    await sendRiderVerificationEmail({
      to: cleanEmail,
      name: name.trim(),
      verificationLink,
    })

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      email: cleanEmail,
    })
  } catch (error) {
    console.error("Rider registration error:", error)
    return NextResponse.json(
      { error: "An error occurred during registration. Please try again." },
      { status: 500 }
    )
  }
}
