import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

/** POST /api/product-seller/auth/registration — Product seller panel registration. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = body
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, name: name ?? null, password: hashedPassword, role: UserRole.SELLER_PRODUCT },
    })
    await prisma.seller.create({ data: { userId: user.id, type: "PRODUCT" } })
    return NextResponse.json({ message: "User created successfully", userId: user.id }, { status: 201 })
  } catch (error) {
    console.error("Product seller registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
