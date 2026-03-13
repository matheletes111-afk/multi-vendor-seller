import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

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
  let userData: { name?: string; image?: string | null; phone?: string | null; phoneCountryCode?: string | null } = {}

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const name = (formData.get("name") as string)?.trim() || undefined
    const imageUrl = (formData.get("image") as string)?.trim() || undefined
    const phone = (formData.get("phone") as string) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string) ?? ""
    const profileImageFile = formData.get("profileImage") as File | null

    if (name !== undefined) userData.name = name
    if (phone !== undefined) userData.phone = phone || null
    if (phoneCountryCode !== undefined) userData.phoneCountryCode = phoneCountryCode || null

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const bytes = await profileImageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const ext = path.extname(profileImageFile.name) || ".jpg"
        const fileName = `profile-${session.user.id}-${Date.now()}${ext}`
        const uploadDir = path.join(process.cwd(), "public/uploads/profile")
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, fileName), buffer)
        userData.image = `/uploads/profile/${fileName}`
      } catch (e) {
        console.error("Profile image upload error:", e)
        return NextResponse.json({ error: "Failed to upload profile image" }, { status: 500 })
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
    }
    if (body.name !== undefined) userData.name = body.name
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
  }

  if (Object.keys(userData).length === 0) {
    return NextResponse.json({ success: true })
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: userData,
  })
  return NextResponse.json({ success: true })
}
