import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import path from "path"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/** GET current customer user for profile/settings page. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json(user)
}

/** PUT update customer profile. Accepts JSON or FormData (for profile image upload). */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  const getRequiredPhoneFieldsError = (phone: string | null | undefined, countryCode: string | null | undefined) => {
    const normalizedPhone = (phone ?? "").trim()
    const normalizedCountryCode = (countryCode ?? "").trim()
    if (!normalizedPhone || !normalizedCountryCode) {
      return "Phone and country code are required."
    }
    return null
  }
  let userData: {
    name?: string
    image?: string | null
    phone?: string | null
    phoneCountryCode?: string | null
    password?: string
  } = {}

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const name = formData.get("name") !== null ? sanitizeInput(formData.get("name") as string) : undefined
    const imageUrl = (formData.get("image") as string)?.trim() || undefined
    const phone = (formData.get("phone") as string) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string) ?? ""
    const password = (formData.get("password") as string) ?? ""
    const currentPassword = (formData.get("currentPassword") as string) ?? ""
    const profileImageFile = formData.get("profileImage") as File | null
 
    if (name !== undefined) userData.name = name
    if (phone !== undefined) userData.phone = phone || null
    if (phoneCountryCode !== undefined) userData.phoneCountryCode = phoneCountryCode || null
    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })
    if (password.trim()) {
      const passwordValidation = validatePassword(password.trim())
      if (!passwordValidation.isValid) {
        return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true }
      })
      if (dbUser?.password) {
        if (!currentPassword.trim()) {
          return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 })
        }
        const isPasswordCorrect = await bcrypt.compare(currentPassword.trim(), dbUser.password)
        if (!isPasswordCorrect) {
          return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
        }
      }
      userData.password = await bcrypt.hash(password.trim(), 10)
    }
 
    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const type = profileImageFile.type?.toLowerCase() ?? ""
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Profile picture must be an image file" }, { status: 400 })
        }
        const bytes = await profileImageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const ct = profileImageFile.type || "image/jpeg"
        const ext =
          path.extname((profileImageFile as { name?: string }).name || "") || getImageExtFromContentType(ct)
        userData.image = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType: ct,
          buffer,
          prefix: "profile",
        })
      } catch (e) {
        console.error("Profile image upload error:", e)
        const message = e instanceof Error ? e.message : "Failed to upload profile image"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    } else if (imageUrl !== undefined) {
      userData.image = imageUrl || null
    }
  } else {
    const body = await request.json().catch(() => ({})) as {
      name?: string
      image?: string
      phone?: string
      phoneCountryCode?: string
      password?: string
      currentPassword?: string
    }
    if (body.name !== undefined) {
      userData.name = typeof body.name === "string" ? sanitizeInput(body.name) : undefined
    }
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })
    if (body.password !== undefined) {
      if (typeof body.password !== "string") {
        return NextResponse.json({ error: "Password must be a string" }, { status: 400 })
      }
      const password = body.password.trim()
      const currentPassword = (body.currentPassword ?? "").trim()
      if (password) {
        const passwordValidation = validatePassword(password)
        if (!passwordValidation.isValid) {
          return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { password: true }
        })
        if (dbUser?.password) {
          if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 })
          }
          const isPasswordCorrect = await bcrypt.compare(currentPassword, dbUser.password)
          if (!isPasswordCorrect) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
          }
        }
        userData.password = await bcrypt.hash(password, 10)
      }
    }
  }

  if (Object.keys(userData).length === 0) {
    return NextResponse.json({ success: true })
  }
  if (userData.phone) {
    const existing = await prisma.user.findFirst({
      where: {
        phone: userData.phone,
        NOT: { id: session.user.id }
      }
    })
    if (existing) {
      return NextResponse.json({ error: "Phone number already in use by another account" }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: userData,
  })
  return NextResponse.json({ success: true })
}
