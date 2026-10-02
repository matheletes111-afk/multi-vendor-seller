import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/rbac"
import bcrypt from "bcryptjs"
import { generateSecurePassword } from "@/lib/password-utils"
import { sendBackofficeStaffCredentialsEmail } from "@/lib/email"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

export const dynamic = "force-dynamic"

// PATCH /api/admin/backoffice-users/[id] - Update staff details or reset password
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, phone, phoneCountryCode, roleId, resetPassword } = body

    const user = await prisma.user.findUnique({
      where: { id },
      include: { backofficeRole: true },
    })

    if (!user || !user.isBackofficeUser) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 })
    }

    // Safety check: Cannot modify own super admin account through staff API
    if (user.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot modify your own Super Admin account through this endpoint." },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name && name.trim()) updateData.name = name.trim()
    if (phone !== undefined) {
      if (phone && typeof phone === "string" && phone.trim()) {
        const effectiveCode = typeof phoneCountryCode === "string" && phoneCountryCode.trim()
          ? phoneCountryCode.trim()
          : user.phoneCountryCode || "+232"
        const val = validatePhoneAndCountryCode(phone.trim(), effectiveCode)
        if (!val.isValid) {
          return NextResponse.json({ error: val.error || "Invalid mobile number or country code" }, { status: 400 })
        }
        updateData.phone = val.cleanedPhone || phone.trim()
        updateData.phoneCountryCode = val.cleanedCountryCode || effectiveCode
      } else {
        updateData.phone = null
        updateData.phoneCountryCode = null
      }
    } else if (phoneCountryCode !== undefined) {
      updateData.phoneCountryCode = phoneCountryCode ? phoneCountryCode.trim() : null
    }

    if (roleId) {
      const role = await prisma.backofficeRole.findUnique({ where: { id: roleId } })
      if (!role) {
        return NextResponse.json({ error: "Selected role does not exist." }, { status: 404 })
      }
      updateData.backofficeRoleId = roleId
    }

    let generatedPassword: string | null = null
    let emailDispatched = false

    if (resetPassword) {
      generatedPassword = generateSecurePassword(12)
      updateData.password = await bcrypt.hash(generatedPassword, 12)
      updateData.forcePasswordChange = true

      const origin = request.headers.get("origin") || request.headers.get("host") || "https://meeemsl.com"
      const loginUrl = origin.startsWith("http")
        ? `${origin}/backoffice/login`
        : `https://${origin}/backoffice/login`

      const roleName = user.backofficeRole?.name || "Staff"
      if (user.email) {
        try {
          const res = await sendBackofficeStaffCredentialsEmail({
            to: user.email,
            name: user.name || "Staff Member",
            email: user.email,
            password: generatedPassword,
            loginUrl,
            roleName,
          })
          emailDispatched = !!res?.success
        } catch (e) {
          console.error("Failed to email reset password to staff:", e)
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: updated,
      generatedPassword,
      emailDispatched,
      message: resetPassword
        ? "Staff password reset successfully."
        : "Staff member updated successfully.",
    })
  } catch (error: any) {
    console.error("Error updating staff user:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update staff user." },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/backoffice-users/[id] - Remove staff member
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own Super Admin account." },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user || !user.isBackofficeUser) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 })
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Staff account for ${user.email || user.name} has been removed.`,
    })
  } catch (error: any) {
    console.error("Error deleting staff user:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete staff user." },
      { status: 500 }
    )
  }
}
