import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateFreePlan } from "@/lib/subscriptions"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 min

/** POST /api/product-seller/auth/registration — Product seller panel registration. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, phone, phoneCountryCode } = body
    const normalizedPhone = typeof phone === "string" ? phone.trim() : ""
    const normalizedPhoneCountryCode = typeof phoneCountryCode === "string" ? phoneCountryCode.trim() : ""
    if (!email || !password || !normalizedPhone || !normalizedPhoneCountryCode) {
      return NextResponse.json({ error: "Email, password, phone, and country code are required" }, { status: 400 })
    }
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }
    const existingPhone = await prisma.user.findFirst({ where: { phone: normalizedPhone } })
    if (existingPhone) {
      return NextResponse.json({ error: "User with this phone number already exists" }, { status: 400 })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        password: hashedPassword,
        role: UserRole.SELLER_PRODUCT,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
    })
    const seller = await prisma.seller.create({ data: { userId: user.id, type: "PRODUCT" } })
    await activateFreePlan(seller.id)

    await sendVerificationOtpEmail({
      to: email,
      otp: verifyEmailOtp,
      name: name ?? null,
    })

    return NextResponse.json({ message: "Please verify your email with the OTP sent.", userId: user.id, verifyUrl: "/product-seller/verify-otp" }, { status: 201 })
  } catch (error) {
    console.error("Product seller registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
