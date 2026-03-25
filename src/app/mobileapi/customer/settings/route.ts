import { NextRequest, NextResponse } from "next/server"
import path from "path"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export const dynamic = "force-dynamic"

type CustomerProfileData = {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  phoneCountryCode: string | null
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized. Valid customer token required." },
    { status: 401 }
  )
}

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/** GET /mobileapi/customer/settings — fetch customer profile. */
export async function GET(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
  })
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
  }

  const data: CustomerProfileData = user
  return NextResponse.json({ success: true, message: "Profile fetched", data })
}

/** PUT /mobileapi/customer/settings — update customer profile with JSON or multipart/form-data. */
export async function PUT(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const contentType = request.headers.get("content-type") ?? ""
  const userData: {
    name?: string
    image?: string | null
    phone?: string | null
    phoneCountryCode?: string | null
    password?: string
  } = {}

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const getString = (...keys: string[]) => {
      for (const key of keys) {
        const value = formData.get(key)
        if (typeof value === "string") return value
      }
      return undefined
    }
    const getFile = (...keys: string[]) => {
      for (const key of keys) {
        const value = formData.get(key)
        if (value instanceof File) return value
      }
      return null
    }

    // Support both flat keys and nested client keys from mobile forms.
    const name = getString("name", "user[name]")?.trim()
    const imageUrl = getString("image", "imageUrl", "user[image]")?.trim()
    const phone = getString("phone", "user[phone]")
    const phoneCountryCode = getString("phoneCountryCode", "phone_country_code", "user[phoneCountryCode]")
    const password = getString("password", "user[password]")
    const profileImageFile = getFile("profileImage", "profile_image", "image")

    if (name !== undefined) userData.name = name
    if (phone !== undefined) userData.phone = phone || null
    if (phoneCountryCode !== undefined) userData.phoneCountryCode = phoneCountryCode || null
    if (password !== undefined) {
      const trimmedPassword = password.trim()
      if (trimmedPassword) {
        if (trimmedPassword.length < 6) {
          return NextResponse.json({ success: false, error: "Password must be at least 6 characters long" }, { status: 400 })
        }
        userData.password = await bcrypt.hash(trimmedPassword, 10)
      }
    }

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const type = profileImageFile.type?.toLowerCase() ?? ""
        if (!type.startsWith("image/")) {
          return NextResponse.json({ success: false, error: "Profile picture must be an image file" }, { status: 400 })
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
      } catch (error) {
        console.error("Mobile profile image upload error:", error)
        const message = error instanceof Error ? error.message : "Failed to upload profile image"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
      }
    } else if (imageUrl !== undefined) {
      userData.image = imageUrl || null
    }
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      image?: string
      phone?: string
      phoneCountryCode?: string
      password?: string
    }
    if (body.name !== undefined) userData.name = body.name
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
    if (body.password !== undefined) {
      const trimmedPassword = body.password.trim()
      if (trimmedPassword) {
        if (trimmedPassword.length < 6) {
          return NextResponse.json({ success: false, error: "Password must be at least 6 characters long" }, { status: 400 })
        }
        userData.password = await bcrypt.hash(trimmedPassword, 10)
      }
    }
  }

  if (Object.keys(userData).length === 0) {
    return NextResponse.json({ success: true, message: "No changes provided" })
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: userData,
  })

  const updatedUser = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { 
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      phoneCountryCode: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
     },
  })

  return NextResponse.json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  })
}

