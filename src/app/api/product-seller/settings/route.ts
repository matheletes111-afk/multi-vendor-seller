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
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      selectedCategories: true,
      user: {
        select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
      },
    } as any,
  }) as any

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
    include: { store: true, businessInfo: true, kyc: true, bankDetails: true } as any,
  }) as any

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

    if (Object.keys(sellerData).length > 0) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      })
    }

    // Handle new onboarding files if provided in FormData
    const busRegCert = fd.get("busRegCert") as File | null
    if (busRegCert && busRegCert.size > 0) {
        const url = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(busRegCert.name) || ".pdf",
            contentType: busRegCert.type || "application/pdf",
            buffer: Buffer.from(await busRegCert.arrayBuffer()),
            prefix: "bus-reg",
        })
        await (prisma as any).sellerBusinessInfo.upsert({
            where: { sellerId: seller.id },
            update: { busRegCertUrl: url },
            create: { sellerId: seller.id, busRegCertUrl: url }
        })
    }

    const bankPassbook = fd.get("bankPassbook") as File | null
    if (bankPassbook && bankPassbook.size > 0) {
        const url = await uploadPublicFile({
            folder: "onboarding/bank",
            ext: path.extname(bankPassbook.name) || ".jpg",
            contentType: bankPassbook.type || "image/jpeg",
            buffer: Buffer.from(await bankPassbook.arrayBuffer()),
            prefix: "bank-passbook",
        })
        await (prisma as any).sellerBankDetails.upsert({
            where: { sellerId: seller.id },
            update: { passbookUrl: url },
            create: { sellerId: seller.id, passbookUrl: url }
        })
    }

    // Handle Store Visuals
    const storeLogo = fd.get("storeLogo") as File | null
    const storeBanner = fd.get("storeBanner") as File | null
    const storeUpdates: any = {}

    if (storeLogo && storeLogo.size > 0) {
        storeUpdates.logo = await uploadPublicFile({
            folder: "onboarding/store",
            ext: path.extname(storeLogo.name) || ".jpg",
            contentType: storeLogo.type || "image/jpeg",
            buffer: Buffer.from(await storeLogo.arrayBuffer()),
            prefix: "store-logo",
        })
    }
    if (storeBanner && storeBanner.size > 0) {
        storeUpdates.banner = await uploadPublicFile({
            folder: "onboarding/store",
            ext: path.extname(storeBanner.name) || ".jpg",
            contentType: storeBanner.type || "image/jpeg",
            buffer: Buffer.from(await storeBanner.arrayBuffer()),
            prefix: "store-banner",
        })
    }

    const latRaw = fd.get("storeLat") as string | null
    const lngRaw = fd.get("storeLng") as string | null
    const addressRaw = fd.get("storeAddress") as string | null

    if (addressRaw) storeUpdates.address = addressRaw

    if (latRaw && lngRaw) {
        const lat = parseFloat(latRaw)
        const lng = parseFloat(lngRaw)
        if (!isNaN(lat) && !isNaN(lng)) {
            storeUpdates.lat = lat
            storeUpdates.lng = lng
        }
    }

    if (Object.keys(storeUpdates).length > 0) {
        if (seller.store) {
            await prisma.store.update({
                where: { id: seller.store.id },
                data: storeUpdates
            })
        } else {
            await prisma.store.create({
                data: { ...storeUpdates, sellerId: seller.id, name: "My Store" }
            })
        }
    }

    return NextResponse.json({ success: true })
  }

  const body = await request.json().catch(() => ({})) as {
    store?: Record<string, unknown>
    user?: { name?: string; image?: string; phone?: string; phoneCountryCode?: string; password?: string }
    seller?: Record<string, any>
  }

  if (body.store && Object.keys(body.store).length > 0) {
    const storeData = body.store as Record<string, unknown>
    const allowed = [
      "name", "description", "phone", "website", "address", "city", "state",
      "zipCode", "country", "logo", "banner", "lat", "lng"
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
  }

  if (body.seller && Object.keys(body.seller).length > 0) {
    const s = body.seller as any
    if (s.businessInfo) {
        if (s.businessInfo.haveGst !== undefined) {
            const h = s.businessInfo.haveGst === "true" || s.businessInfo.haveGst === true;
            s.businessInfo.haveGst = h;
            if (!h) {
                s.businessInfo.taxIdNumber = null;
                s.businessInfo.gstInvNo = null;
                s.businessInfo.gstCustomerName = null;
            }
        }
        await (prisma as any).sellerBusinessInfo.upsert({
            where: { sellerId: seller.id },
            update: s.businessInfo,
            create: { ...s.businessInfo, sellerId: seller.id }
        })
    }
    if (s.bankDetails) {
        await (prisma as any).sellerBankDetails.upsert({
            where: { sellerId: seller.id },
            update: s.bankDetails,
            create: { ...s.bankDetails, sellerId: seller.id }
        })
    }
    if (s.kyc) {
        await (prisma as any).sellerKYC.upsert({
            where: { sellerId: seller.id },
            update: s.kyc,
            create: { ...s.kyc, sellerId: seller.id }
        })
    }

    const sellerData: any = {}
    if (body.seller.nationIdentityNumber !== undefined) {
      const raw = body.seller.nationIdentityNumber ?? ""
      sellerData.nationIdentityNumber = typeof raw === "string" ? raw.trim() || null : null
    }

    if (body.seller.categoryIds && Array.isArray(body.seller.categoryIds)) {
        sellerData.selectedCategories = {
            set: body.seller.categoryIds.map((id: string) => ({ id }))
        }
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
