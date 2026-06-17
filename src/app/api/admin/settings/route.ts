import { NextRequest, NextResponse } from "next/server"
import path from "path"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { sanitizeInput } from "@/lib/html-sanitization"

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
  })

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  let globalSettings = await (prisma as any).globalSetting.findFirst()
  if (!globalSettings) {
    globalSettings = await (prisma as any).globalSetting.create({ data: { baseCommission: 10.0 } })
  }

  return NextResponse.json({ ...user, globalSettings })
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  const getRequiredPhoneFieldsError = (phone: string | null | undefined, countryCode: string | null | undefined) => {
    const normalizedPhone = (phone ?? "").trim()
    const normalizedCountryCode = (countryCode ?? "").trim()
    if (!normalizedPhone || !normalizedCountryCode) {
      return "Phone and country code are required."
    }
    if (!/^\+?[0-9]+$/.test(normalizedCountryCode)) {
      return "Country code must contain only numbers (optionally starting with +)."
    }
    if (!/^[0-9]+$/.test(normalizedPhone)) {
      return "Phone number must contain only numbers."
    }
    return null
  }

  const userData: {
    name?: string
    image?: string | null
    phone?: string | null
    phoneCountryCode?: string | null
    password?: string
  } = {}
  let baseCommission: number | undefined = undefined

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const name = formData.get("name") !== null ? sanitizeInput(formData.get("name") as string) : undefined
    const imageUrl = (formData.get("image") as string | null)?.trim() || undefined
    const phone = (formData.get("phone") as string | null) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string | null) ?? ""
    const password = ((formData.get("password") as string | null) ?? "").trim()
    const currentPassword = ((formData.get("currentPassword") as string | null) ?? "").trim()
    const baseCommissionStr = (formData.get("baseCommission") as string | null)
    if (baseCommissionStr !== null) baseCommission = parseFloat(baseCommissionStr)
    const profileImageFile = formData.get("profileImage") as File | null

    if (name !== undefined) userData.name = name
    userData.phone = phone || null
    userData.phoneCountryCode = phoneCountryCode || null
    
    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
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

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const type = profileImageFile.type?.toLowerCase() ?? ""
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Profile picture must be an image file" }, { status: 400 })
        }
        const bytes = await profileImageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const ct = profileImageFile.type || "image/jpeg"
        const ext = path.extname((profileImageFile as { name?: string }).name || "") || getImageExtFromContentType(ct)
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
      baseCommission?: number
    }
    if (body.name !== undefined) {
      userData.name = typeof body.name === "string" ? sanitizeInput(body.name) : undefined
    }
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
    if (body.baseCommission !== undefined) baseCommission = body.baseCommission

    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })

    if (body.password !== undefined) {
      const password = body.password.trim()
      const currentPassword = (body.currentPassword ?? "").trim()
      if (password) {
        if (password.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
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

  if (Object.keys(userData).length > 0) {
    if (userData.phone) {
      const existing = await prisma.user.findFirst({
        where: { phone: userData.phone, NOT: { id: session.user.id } }
      })
      if (existing) return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: userData,
    })
  }

  if (baseCommission !== undefined) {
    const globalSettings = await (prisma as any).globalSetting.findFirst()
    if (globalSettings) {
      await (prisma as any).globalSetting.update({
        where: { id: globalSettings.id },
        data: { baseCommission }
      })
    } else {
      await (prisma as any).globalSetting.create({
        data: { baseCommission }
      })
    }
  }

  return NextResponse.json({ success: true })
}
