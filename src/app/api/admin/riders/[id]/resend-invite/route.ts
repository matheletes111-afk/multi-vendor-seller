import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendRiderWelcomeEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const user = await prisma.user.findUnique({
      where: { id },
      include: { rider: true },
    })

    if (!user || !user.rider) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 })
    }

    // Generate new temporary password
    const temporaryPassword = crypto.randomBytes(5).toString("hex") + "!9A"
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        rider: {
          update: {
            isFirstLogin: true,
          },
        },
      },
    })

    const origin = new URL(request.url).origin
    const loginUrl = `${origin}/riderapp/login`

    await sendRiderWelcomeEmail({
      to: user.email,
      name: user.name,
      temporaryPassword,
      loginUrl,
    })

    return NextResponse.json({
      success: true,
      message: `Login credentials re-sent successfully to ${user.email}!`,
    })
  } catch (error) {
    console.error("Resend invite error:", error)
    return NextResponse.json({ error: "Failed to resend credentials." }, { status: 500 })
  }
}
