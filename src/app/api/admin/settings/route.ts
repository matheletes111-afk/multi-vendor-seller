import { NextRequest, NextResponse } from "next/server"
import path from "path"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { sanitizeInput } from "@/lib/html-sanitization"

interface DeliveryRangeInput {
  minWeight: number
  maxWeight: number
  charge: number
}

function validateAndSortRanges(ranges: any): { sorted: DeliveryRangeInput[] | null, error: string | null } {
  if (!Array.isArray(ranges)) {
    return { sorted: null, error: "Weight ranges must be an array" }
  }

  if (ranges.length === 0) {
    return { sorted: [], error: null }
  }

  const parsed: DeliveryRangeInput[] = []

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]
    const minWeight = parseFloat(r.minWeight)
    const maxWeight = parseFloat(r.maxWeight)
    const charge = parseFloat(r.charge)

    if (isNaN(minWeight) || minWeight < 0) {
      return { sorted: null, error: `Range ${i + 1}: Minimum weight must be a non-negative number` }
    }
    if (isNaN(maxWeight) || maxWeight <= minWeight) {
      return { sorted: null, error: `Range ${i + 1}: Maximum weight must be greater than minimum weight` }
    }
    if (isNaN(charge) || charge < 0) {
      return { sorted: null, error: `Range ${i + 1}: Delivery charge must be a non-negative number` }
    }

    parsed.push({ minWeight, maxWeight, charge })
  }

  // Sort by minWeight ascending
  parsed.sort((a, b) => a.minWeight - b.minWeight)

  // Validate contiguity and overlaps
  for (let i = 0; i < parsed.length; i++) {
    const current = parsed[i]
    if (i > 0) {
      const prev = parsed[i - 1]
      // Allow minor floating point tolerance
      if (Math.abs(current.minWeight - prev.maxWeight) > 0.001) {
        return {
          sorted: null,
          error: `Range gap or overlap detected between ranges (${prev.minWeight}-${prev.maxWeight} kg) and (${current.minWeight}-${current.maxWeight} kg). The minimum weight of a range must match the maximum weight of the previous range.`
        }
      }
    }
  }

  // First range must start at 0
  if (parsed[0].minWeight > 0.001) {
    return { sorted: null, error: "The first range must start at 0 kg to cover all possible weights" }
  }

  return { sorted: parsed, error: null }
}

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
  let deliveryChargeRanges: any = undefined

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const name = formData.get("name") !== null ? sanitizeInput(formData.get("name") as string) : undefined
    const imageUrl = (formData.get("image") as string | null)?.trim() || undefined
    const phone = (formData.get("phone") as string | null) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string | null) ?? ""
    const password = ((formData.get("password") as string | null) ?? "").trim()
    const currentPassword = ((formData.get("currentPassword") as string | null) ?? "").trim()
    
    const baseCommissionStr = formData.get("baseCommission") as string | null
    if (baseCommissionStr !== null) baseCommission = parseFloat(baseCommissionStr)

    const deliveryChargeRangesStr = formData.get("deliveryChargeRanges") as string | null
    if (deliveryChargeRangesStr !== null) {
      try {
        deliveryChargeRanges = JSON.parse(deliveryChargeRangesStr)
      } catch {
        return NextResponse.json({ error: "Invalid delivery charge ranges format" }, { status: 400 })
      }
    }

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
      deliveryChargeRanges?: any
    }
    if (body.name !== undefined) {
      userData.name = typeof body.name === "string" ? sanitizeInput(body.name) : undefined
    }
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
    if (body.baseCommission !== undefined) baseCommission = body.baseCommission
    if (body.deliveryChargeRanges !== undefined) deliveryChargeRanges = body.deliveryChargeRanges

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

  let validatedRanges: any = undefined
  if (deliveryChargeRanges !== undefined) {
    const { sorted, error } = validateAndSortRanges(deliveryChargeRanges)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }
    validatedRanges = sorted
  }

  if (baseCommission !== undefined || validatedRanges !== undefined) {
    const globalSettings = await (prisma as any).globalSetting.findFirst()
    const updateData: any = {}
    if (baseCommission !== undefined) updateData.baseCommission = baseCommission
    if (validatedRanges !== undefined) updateData.deliveryChargeRanges = validatedRanges

    if (globalSettings) {
      await (prisma as any).globalSetting.update({
        where: { id: globalSettings.id },
        data: updateData
      })
    } else {
      await (prisma as any).globalSetting.create({
        data: {
          baseCommission: baseCommission !== undefined ? baseCommission : 10.0,
          deliveryChargeRanges: validatedRanges !== undefined ? validatedRanges : []
        }
      })
    }
  }

  return NextResponse.json({ success: true })
}
