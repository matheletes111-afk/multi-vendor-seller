import { NextRequest, NextResponse } from "next/server"
import path from "path"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"

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
  return NextResponse.json(user)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
    const name = (formData.get("name") as string | null)?.trim() || undefined
    const imageUrl = (formData.get("image") as string | null)?.trim() || undefined
    const phone = (formData.get("phone") as string | null) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string | null) ?? ""
    const password = ((formData.get("password") as string | null) ?? "").trim()
    const profileImageFile = formData.get("profileImage") as File | null

    if (name !== undefined) userData.name = name
    userData.phone = phone || null
    userData.phoneCountryCode = phoneCountryCode || null
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
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
    }
    if (body.name !== undefined) userData.name = body.name
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
    if (body.password !== undefined) {
      const password = body.password.trim()
      if (password) {
        if (password.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
        }
        userData.password = await bcrypt.hash(password, 10)
      }
    }
  }

  if (Object.keys(userData).length === 0) return NextResponse.json({ success: true })

  await prisma.user.update({
    where: { id: session.user.id },
    data: userData,
  })
  return NextResponse.json({ success: true })
}
