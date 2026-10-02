import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/rbac"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { generateSecurePassword } from "@/lib/password-utils"
import { sendBackofficeStaffCredentialsEmail } from "@/lib/email"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

export const dynamic = "force-dynamic"

// GET /api/admin/backoffice-users - List all staff users
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      where: {
        isBackofficeUser: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneCountryCode: true,
        role: true,
        isBackofficeUser: true,
        backofficeRoleId: true,
        backofficeRole: {
          select: {
            id: true,
            name: true,
            permissions: true,
            isActive: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      users,
    })
  } catch (error: any) {
    console.error("Error fetching backoffice users:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch staff users." },
      { status: 500 }
    )
  }
}

// POST /api/admin/backoffice-users - Create new backoffice user with auto-generated credentials
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, phone, phoneCountryCode, roleId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Staff member's full name is required." }, { status: 400 })
    }
    if (!email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 })
    }
    if (!roleId) {
      return NextResponse.json({ error: "An assigned role is required." }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    let cleanPhone: string | null = null
    let cleanCountryCode: string | null = null

    if (phone && typeof phone === "string" && phone.trim()) {
      const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim() ? phoneCountryCode.trim() : "+232"
      const val = validatePhoneAndCountryCode(phone.trim(), code)
      if (!val.isValid) {
        return NextResponse.json({ error: val.error || "Invalid phone number or country code" }, { status: 400 })
      }
      cleanPhone = val.cleanedPhone || phone.trim()
      cleanCountryCode = val.cleanedCountryCode || code
    }

    // Check if role exists and is active
    const role = await prisma.backofficeRole.findUnique({
      where: { id: roleId },
    })
    if (!role) {
      return NextResponse.json({ error: "Selected role does not exist." }, { status: 404 })
    }

    // Check if user already exists with this email
    const existing = await prisma.user.findFirst({
      where: { email: cleanEmail },
    })
    if (existing) {
      return NextResponse.json(
        { error: `A user with email "${cleanEmail}" already exists in the system.` },
        { status: 409 }
      )
    }

    // Generate secure 12-char random password
    const generatedPassword = generateSecurePassword(12)
    const hashedPassword = await bcrypt.hash(generatedPassword, 12)

    // Create user in database
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        phoneCountryCode: cleanCountryCode,
        password: hashedPassword,
        role: UserRole.ADMIN, // Grants admin API compatibility
        isBackofficeUser: true,
        backofficeRoleId: roleId,
        forcePasswordChange: true,
        isEmailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneCountryCode: true,
        isBackofficeUser: true,
        backofficeRoleId: true,
        backofficeRole: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
        createdAt: true,
      },
    })

    // Construct portal login URL
    const origin = request.headers.get("origin") || request.headers.get("host") || "https://meeemsl.com"
    const loginUrl = origin.startsWith("http")
      ? `${origin}/backoffice/login`
      : `https://${origin}/backoffice/login`

    // Dispatch credentials email via SendGrid
    let emailDispatched = false
    let emailError: string | null = null
    try {
      const emailResult = await sendBackofficeStaffCredentialsEmail({
        to: cleanEmail,
        name: cleanName,
        email: cleanEmail,
        password: generatedPassword,
        loginUrl,
        roleName: role.name,
      })
      emailDispatched = !!emailResult?.success
      if (!emailResult?.success && emailResult?.error) {
        emailError = (emailResult.error as any).message || String(emailResult.error)
      }
    } catch (e: any) {
      console.error("Failed to send staff credentials email:", e)
      emailError = e.message || "Failed to dispatch email."
    }

    return NextResponse.json({
      success: true,
      user: newUser,
      generatedPassword, // Returned for the Admin One-Time Copy dialog
      emailDispatched,
      emailError,
      message: emailDispatched
        ? `Staff user created successfully. Login credentials sent to ${cleanEmail}.`
        : `Staff user created, but automated email failed (${emailError || "check SendGrid"}). Please copy and provide credentials manually.`,
    })
  } catch (error: any) {
    console.error("Error creating backoffice user:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create backoffice user." },
      { status: 500 }
    )
  }
}
