import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

/** GET current seller + store + user for settings page. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      store: true,
      user: {
        select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
      },
    },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  return NextResponse.json(seller)
}

/** PUT update store and/or user profile. Accepts JSON or FormData (for profile image). */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { store: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData()
    const profileImageFile = fd.get("profileImage") as File | null
    const imageUrl = (fd.get("image") as string)?.trim()
    const name = (fd.get("name") as string)?.trim()
    const phone = (fd.get("phone") as string) ?? ""
    const phoneCountryCode = (fd.get("phoneCountryCode") as string) ?? ""

    const userData: { name?: string; image?: string | null; phone?: string | null; phoneCountryCode?: string | null } = {}
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

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }

    return NextResponse.json({ success: true })
  }

  const body = await request.json().catch(() => ({})) as {
    store?: Record<string, unknown>
    user?: { name?: string; image?: string; phone?: string; phoneCountryCode?: string }
  }

  if (body.store && Object.keys(body.store).length > 0) {
    const storeData = body.store as Record<string, unknown>
    const allowed = [
      "name", "description", "phone", "website", "address", "city", "state",
      "zipCode", "country", "logo", "banner",
    ]
    const data = Object.fromEntries(
      Object.entries(storeData).filter(([k]) => allowed.includes(k))
    ) as Record<string, string>
    if (Object.keys(data).length > 0) {
      if (seller.store) {
        await prisma.store.update({
          where: { id: seller.store.id },
          data,
        })
      } else {
        await prisma.store.create({
          data: {
            sellerId: seller.id,
            name: (data.name as string) || "My Store",
            ...data,
          },
        })
      }
    }
  }

  if (body.user && Object.keys(body.user).length > 0) {
    const userData: { name?: string; image?: string; phone?: string | null; phoneCountryCode?: string | null } = {}
    if (body.user.name !== undefined) userData.name = body.user.name
    if (body.user.image !== undefined) userData.image = body.user.image
    if (body.user.phone !== undefined) userData.phone = body.user.phone || null
    if (body.user.phoneCountryCode !== undefined) userData.phoneCountryCode = body.user.phoneCountryCode || null
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }
  }

  return NextResponse.json({ success: true })
}
