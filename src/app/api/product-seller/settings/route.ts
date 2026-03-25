import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import path from "path"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

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
  const getRequiredPhoneFieldsError = (phone: string | null | undefined, countryCode: string | null | undefined) => {
    const normalizedPhone = (phone ?? "").trim()
    const normalizedCountryCode = (countryCode ?? "").trim()
    if (!normalizedPhone || !normalizedCountryCode) {
      return "Phone and country code are required."
    }
    return null
  }

  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData()
    const profileImageFile = fd.get("profileImage") as File | null
    const imageUrl = (fd.get("image") as string)?.trim()
    const name = (fd.get("name") as string)?.trim()
    const phone = (fd.get("phone") as string) ?? ""
    const phoneCountryCode = (fd.get("phoneCountryCode") as string) ?? ""
    const nationIdentityNumberRaw = fd.get("nationIdentityNumber") as string | null
    const nationIdentityNumber = (nationIdentityNumberRaw ?? "").trim()
    const password = ((fd.get("password") as string | null) ?? "").trim()

    const userData: { name?: string; image?: string | null; phone?: string | null; phoneCountryCode?: string | null; password?: string } = {}
    if (name !== undefined) userData.name = name
    if (phone !== undefined) userData.phone = phone || null
    if (phoneCountryCode !== undefined) userData.phoneCountryCode = phoneCountryCode || null
    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
      }
      userData.password = await bcrypt.hash(password, 10)
    }
    const sellerData: { nationIdentityNumber?: string | null } = {}
    // If the form includes the field, treat empty value as null.
    if (nationIdentityNumberRaw !== null) sellerData.nationIdentityNumber = nationIdentityNumber || null

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const type = profileImageFile.type?.toLowerCase() ?? ""
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Profile picture must be an image file" }, { status: 400 })
        }
        const bytes = await profileImageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const contentType = profileImageFile.type || "image/jpeg"
        const ext =
          path.extname((profileImageFile as { name?: string }).name || "") || getImageExtFromContentType(contentType)
        userData.image = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType,
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

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }

    if (Object.keys(sellerData).length > 0) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      })
    }

    return NextResponse.json({ success: true })
  }

  const body = await request.json().catch(() => ({})) as {
    store?: Record<string, unknown>
    user?: { name?: string; image?: string; phone?: string; phoneCountryCode?: string; password?: string }
    seller?: { nationIdentityNumber?: string | null }
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
    const userData: { name?: string; image?: string; phone?: string | null; phoneCountryCode?: string | null; password?: string } = {}
    if (body.user.name !== undefined) userData.name = body.user.name
    if (body.user.image !== undefined) userData.image = body.user.image
    if (body.user.phone !== undefined) userData.phone = body.user.phone || null
    if (body.user.phoneCountryCode !== undefined) userData.phoneCountryCode = body.user.phoneCountryCode || null
    const phoneError = getRequiredPhoneFieldsError(userData.phone, userData.phoneCountryCode)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })
    if (body.user.password !== undefined) {
      const password = body.user.password.trim()
      if (password) {
        if (password.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
        }
        userData.password = await bcrypt.hash(password, 10)
      }
    }
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }
  }

  if (body.seller && Object.keys(body.seller).length > 0) {
    const sellerData: { nationIdentityNumber?: string | null } = {}
    if (body.seller.nationIdentityNumber !== undefined) {
      const raw = body.seller.nationIdentityNumber ?? ""
      sellerData.nationIdentityNumber = typeof raw === "string" ? raw.trim() || null : null
    }
    if (Object.keys(sellerData).length > 0) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      })
    }
  }

  return NextResponse.json({ success: true })
}
