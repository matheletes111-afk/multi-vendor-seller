import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateRestaurantFreePlan } from "@/lib/subscriptions"

const OTP_EXPIRY_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, phone, phoneCountryCode } = body
    const normalizedPhone = typeof phone === "string" ? phone.trim() : ""
    const normalizedPhoneCountryCode = typeof phoneCountryCode === "string" ? phoneCountryCode.trim() : ""
    
    if (!email || !password || !normalizedPhone || !normalizedPhoneCountryCode) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 })
    }
    
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return NextResponse.json({ error: "Email already exists" }, { status: 400 })
    
    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        password: hashedPassword,
        role: UserRole.SELLER_RESTAURANT,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
    })
    
    const restaurantSeller = await prisma.restaurantSeller.create({ 
      data: { userId: user.id } 
    })
    
    await activateRestaurantFreePlan(restaurantSeller.id)

    await sendVerificationOtpEmail({ to: email, otp: verifyEmailOtp, name: name ?? null })

    return NextResponse.json({ 
      message: "Verify your email.", 
      userId: user.id, 
      verifyUrl: "/restaurant-seller/verify-otp" 
    }, { status: 201 })
  } catch (error) {
    console.error("Restaurant registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
