import { NextRequest, NextResponse } from "next/server"
import path from "path"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { sanitizeInput } from "@/lib/html-sanitization"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"

interface DeliveryRangeInput {
  minWeight: number
  maxWeight: number
  charge: number
}

interface DimensionRangeInput {
  minDimension: number
  maxDimension: number
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

function validateAndSortDimensionRanges(ranges: any): { sorted: DimensionRangeInput[] | null, error: string | null } {
  if (!Array.isArray(ranges)) {
    return { sorted: null, error: "Dimension ranges must be an array" }
  }

  if (ranges.length === 0) {
    return { sorted: [], error: null }
  }

  const parsed: DimensionRangeInput[] = []

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]
    const minDimension = parseFloat(r.minDimension)
    const maxDimension = parseFloat(r.maxDimension)
    const charge = parseFloat(r.charge)

    if (isNaN(minDimension) || minDimension < 0) {
      return { sorted: null, error: `Dimension Range ${i + 1}: Minimum dimension/volume must be a non-negative number` }
    }
    if (isNaN(maxDimension) || maxDimension <= minDimension) {
      return { sorted: null, error: `Dimension Range ${i + 1}: Maximum dimension/volume must be greater than minimum dimension/volume` }
    }
    if (isNaN(charge) || charge < 0) {
      return { sorted: null, error: `Dimension Range ${i + 1}: Delivery charge must be a non-negative number` }
    }

    parsed.push({ minDimension, maxDimension, charge })
  }

  // Sort by minDimension ascending
  parsed.sort((a, b) => a.minDimension - b.minDimension)

  // Validate contiguity and overlaps
  for (let i = 0; i < parsed.length; i++) {
    const current = parsed[i]
    if (i > 0) {
      const prev = parsed[i - 1]
      // Allow minor floating point tolerance
      if (Math.abs(current.minDimension - prev.maxDimension) > 0.001) {
        return {
          sorted: null,
          error: `Range gap or overlap detected between dimension ranges (${prev.minDimension}-${prev.maxDimension} cm³) and (${current.minDimension}-${current.maxDimension} cm³). The minimum dimension of a range must match the maximum dimension of the previous range.`
        }
      }
    }
  }

  // First range must start at 0
  if (parsed[0].minDimension > 0.001) {
    return { sorted: null, error: "The first dimension range must start at 0 cm³ to cover all possible volumes" }
  }

  return { sorted: parsed, error: null }
}

import { ALL_LOCATION_REGIONS } from "@/lib/location-zones"

const ALLOWED_ADMINISTRATIVE_REGIONS = ALL_LOCATION_REGIONS

interface RegionDeliveryChargeInput {
  region: string
  charge: number
}

function validateRegionDeliveryCharges(items: any): { sorted: RegionDeliveryChargeInput[] | null, error: string | null } {
  if (!Array.isArray(items)) {
    return { sorted: null, error: "Region delivery charges must be an array" }
  }

  if (items.length === 0) {
    return { sorted: [], error: null }
  }

  const parsed: RegionDeliveryChargeInput[] = []
  const seenRegions = new Set<string>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const region = typeof item?.region === "string" ? item.region.trim() : ""
    const charge = parseFloat(item?.charge)

    if (!ALLOWED_ADMINISTRATIVE_REGIONS.includes(region as any)) {
      return { sorted: null, error: `Row ${i + 1}: Invalid administrative region "${region}"` }
    }
    if (seenRegions.has(region)) {
      return { sorted: null, error: `Region "${region}" is configured multiple times.` }
    }
    seenRegions.add(region)

    if (isNaN(charge) || charge < 0) {
      return { sorted: null, error: `Row ${i + 1}: Delivery charge for "${region}" must be a non-negative number` }
    }

    parsed.push({ region, charge })
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
    globalSettings = await (prisma as any).globalSetting.create({
      data: {
        baseCommission: 10.0,
        productBaseCommission: 10.0,
        restaurantBaseCommission: 10.0,
        hotelBaseCommission: 10.0,
        serviceBaseCommission: 10.0,
      }
    })
  } else {
    globalSettings.productBaseCommission = globalSettings.productBaseCommission ?? globalSettings.baseCommission ?? 10.0
    globalSettings.restaurantBaseCommission = globalSettings.restaurantBaseCommission ?? globalSettings.baseCommission ?? 10.0
    globalSettings.hotelBaseCommission = globalSettings.hotelBaseCommission ?? globalSettings.baseCommission ?? 10.0
    globalSettings.serviceBaseCommission = globalSettings.serviceBaseCommission ?? globalSettings.baseCommission ?? 10.0
  }

  return NextResponse.json({ ...user, globalSettings })
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  const validatePhoneFields = (phone: string | null | undefined, countryCode: string | null | undefined) => {
    if (!phone?.trim() || !countryCode?.trim()) {
      return { error: "Phone and country code are required." }
    }
    const validation = validatePhoneAndCountryCode(phone, countryCode)
    if (!validation.isValid) {
      return { error: validation.error || "Invalid phone number or country code." }
    }
    return { cleanedPhone: validation.cleanedPhone, cleanedCountryCode: validation.cleanedCountryCode }
  }

  const userData: {
    name?: string
    image?: string | null
    phone?: string | null
    phoneCountryCode?: string | null
    password?: string
  } = {}
  let baseCommission: number | undefined = undefined
  let productBaseCommission: number | undefined = undefined
  let restaurantBaseCommission: number | undefined = undefined
  let hotelBaseCommission: number | undefined = undefined
  let serviceBaseCommission: number | undefined = undefined
  let deliveryChargeRanges: any = undefined
  let dimensionDeliveryChargeRanges: any = undefined
  let regionDeliveryCharges: any = undefined
  let disallowedNames: string[] | undefined = undefined

  function parseCommission(val: unknown, label: string): { parsed?: number; error?: string } {
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
      return {}
    }
    const num = typeof val === "number" ? val : parseFloat(String(val))
    if (isNaN(num) || num < 0 || num > 100) {
      return { error: `${label} must be a valid percentage between 0% and 100%` }
    }
    return { parsed: num }
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const name = formData.get("name") !== null ? sanitizeInput(formData.get("name") as string) : undefined
    const imageUrl = (formData.get("image") as string | null)?.trim() || undefined
    const phone = (formData.get("phone") as string | null) ?? ""
    const phoneCountryCode = (formData.get("phoneCountryCode") as string | null) ?? ""
    const password = ((formData.get("password") as string | null) ?? "").trim()
    const currentPassword = ((formData.get("currentPassword") as string | null) ?? "").trim()
    
    const baseCommRes = parseCommission(formData.get("baseCommission"), "Platform base commission")
    if (baseCommRes.error) return NextResponse.json({ error: baseCommRes.error }, { status: 400 })
    if (baseCommRes.parsed !== undefined) baseCommission = baseCommRes.parsed

    const prodCommRes = parseCommission(formData.get("productBaseCommission"), "Product seller base commission")
    if (prodCommRes.error) return NextResponse.json({ error: prodCommRes.error }, { status: 400 })
    if (prodCommRes.parsed !== undefined) productBaseCommission = prodCommRes.parsed

    const restCommRes = parseCommission(formData.get("restaurantBaseCommission"), "Restaurant seller base commission")
    if (restCommRes.error) return NextResponse.json({ error: restCommRes.error }, { status: 400 })
    if (restCommRes.parsed !== undefined) restaurantBaseCommission = restCommRes.parsed

    const hotelCommRes = parseCommission(formData.get("hotelBaseCommission"), "Hotel seller base commission")
    if (hotelCommRes.error) return NextResponse.json({ error: hotelCommRes.error }, { status: 400 })
    if (hotelCommRes.parsed !== undefined) hotelBaseCommission = hotelCommRes.parsed

    const svcCommRes = parseCommission(formData.get("serviceBaseCommission"), "Service seller base commission")
    if (svcCommRes.error) return NextResponse.json({ error: svcCommRes.error }, { status: 400 })
    if (svcCommRes.parsed !== undefined) serviceBaseCommission = svcCommRes.parsed

    const deliveryChargeRangesStr = formData.get("deliveryChargeRanges") as string | null
    if (deliveryChargeRangesStr !== null) {
      try {
        deliveryChargeRanges = JSON.parse(deliveryChargeRangesStr)
      } catch {
        return NextResponse.json({ error: "Invalid delivery charge ranges format" }, { status: 400 })
      }
    }

    const dimensionDeliveryChargeRangesStr = formData.get("dimensionDeliveryChargeRanges") as string | null
    if (dimensionDeliveryChargeRangesStr !== null) {
      try {
        dimensionDeliveryChargeRanges = JSON.parse(dimensionDeliveryChargeRangesStr)
      } catch {
        return NextResponse.json({ error: "Invalid dimension delivery charge ranges format" }, { status: 400 })
      }
    }

    const regionDeliveryChargesStr = formData.get("regionDeliveryCharges") as string | null
    if (regionDeliveryChargesStr !== null) {
      try {
        regionDeliveryCharges = JSON.parse(regionDeliveryChargesStr)
      } catch {
        return NextResponse.json({ error: "Invalid region delivery charges format" }, { status: 400 })
      }
    }

    const disallowedNamesStr = formData.get("disallowedNames") as string | null
    if (disallowedNamesStr !== null) {
      try {
        const parsed = JSON.parse(disallowedNamesStr)
        if (Array.isArray(parsed)) {
          disallowedNames = parsed.map((s: any) => String(s).trim()).filter(Boolean)
        }
      } catch {
        return NextResponse.json({ error: "Invalid disallowed names format" }, { status: 400 })
      }
    }

    const profileImageFile = formData.get("profileImage") as File | null

    if (name !== undefined) userData.name = name
    if (phone || phoneCountryCode) {
      const phoneRes = validatePhoneFields(phone, phoneCountryCode)
      if (phoneRes.error) return NextResponse.json({ error: phoneRes.error }, { status: 400 })
      userData.phone = phoneRes.cleanedPhone
      userData.phoneCountryCode = phoneRes.cleanedCountryCode
    }

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
      productBaseCommission?: number
      restaurantBaseCommission?: number
      hotelBaseCommission?: number
      serviceBaseCommission?: number
      deliveryChargeRanges?: any
      dimensionDeliveryChargeRanges?: any
      regionDeliveryCharges?: any
      disallowedNames?: string[]
    }
    if (body.name !== undefined) {
      userData.name = typeof body.name === "string" ? sanitizeInput(body.name) : undefined
    }
    if (body.image !== undefined) userData.image = body.image
    if (body.phone !== undefined) userData.phone = body.phone || null
    if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null

    const baseCommRes = parseCommission(body.baseCommission, "Platform base commission")
    if (baseCommRes.error) return NextResponse.json({ error: baseCommRes.error }, { status: 400 })
    if (baseCommRes.parsed !== undefined) baseCommission = baseCommRes.parsed

    const prodCommRes = parseCommission(body.productBaseCommission, "Product seller base commission")
    if (prodCommRes.error) return NextResponse.json({ error: prodCommRes.error }, { status: 400 })
    if (prodCommRes.parsed !== undefined) productBaseCommission = prodCommRes.parsed

    const restCommRes = parseCommission(body.restaurantBaseCommission, "Restaurant seller base commission")
    if (restCommRes.error) return NextResponse.json({ error: restCommRes.error }, { status: 400 })
    if (restCommRes.parsed !== undefined) restaurantBaseCommission = restCommRes.parsed

    const hotelCommRes = parseCommission(body.hotelBaseCommission, "Hotel seller base commission")
    if (hotelCommRes.error) return NextResponse.json({ error: hotelCommRes.error }, { status: 400 })
    if (hotelCommRes.parsed !== undefined) hotelBaseCommission = hotelCommRes.parsed

    const svcCommRes = parseCommission(body.serviceBaseCommission, "Service seller base commission")
    if (svcCommRes.error) return NextResponse.json({ error: svcCommRes.error }, { status: 400 })
    if (svcCommRes.parsed !== undefined) serviceBaseCommission = svcCommRes.parsed

    if (body.deliveryChargeRanges !== undefined) deliveryChargeRanges = body.deliveryChargeRanges
    if (body.dimensionDeliveryChargeRanges !== undefined) dimensionDeliveryChargeRanges = body.dimensionDeliveryChargeRanges
    if (body.regionDeliveryCharges !== undefined) regionDeliveryCharges = body.regionDeliveryCharges
    if (body.disallowedNames !== undefined && Array.isArray(body.disallowedNames)) {
      disallowedNames = body.disallowedNames.map(s => String(s).trim()).filter(Boolean)
    }

    if (body.phone !== undefined || body.phoneCountryCode !== undefined) {
      const phoneRes = validatePhoneFields(body.phone, body.phoneCountryCode)
      if (phoneRes.error) return NextResponse.json({ error: phoneRes.error }, { status: 400 })
      userData.phone = phoneRes.cleanedPhone
      userData.phoneCountryCode = phoneRes.cleanedCountryCode
    }

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

  let validatedDimensionRanges: any = undefined
  if (dimensionDeliveryChargeRanges !== undefined) {
    const { sorted, error } = validateAndSortDimensionRanges(dimensionDeliveryChargeRanges)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }
    validatedDimensionRanges = sorted
  }

  let validatedRegionCharges: any = undefined
  if (regionDeliveryCharges !== undefined) {
    const { sorted, error } = validateRegionDeliveryCharges(regionDeliveryCharges)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }
    validatedRegionCharges = sorted
  }

  if (
    baseCommission !== undefined ||
    productBaseCommission !== undefined ||
    restaurantBaseCommission !== undefined ||
    hotelBaseCommission !== undefined ||
    serviceBaseCommission !== undefined ||
    validatedRanges !== undefined ||
    validatedDimensionRanges !== undefined ||
    validatedRegionCharges !== undefined ||
    disallowedNames !== undefined
  ) {
    const globalSettings = await (prisma as any).globalSetting.findFirst()
    const updateData: any = {}
    if (baseCommission !== undefined) updateData.baseCommission = baseCommission
    if (productBaseCommission !== undefined) updateData.productBaseCommission = productBaseCommission
    if (restaurantBaseCommission !== undefined) updateData.restaurantBaseCommission = restaurantBaseCommission
    if (hotelBaseCommission !== undefined) updateData.hotelBaseCommission = hotelBaseCommission
    if (serviceBaseCommission !== undefined) updateData.serviceBaseCommission = serviceBaseCommission
    if (validatedRanges !== undefined) updateData.deliveryChargeRanges = validatedRanges
    if (validatedDimensionRanges !== undefined) updateData.dimensionDeliveryChargeRanges = validatedDimensionRanges
    if (validatedRegionCharges !== undefined) updateData.regionDeliveryCharges = validatedRegionCharges
    if (disallowedNames !== undefined) updateData.disallowedNames = disallowedNames

    if (globalSettings) {
      await (prisma as any).globalSetting.update({
        where: { id: globalSettings.id },
        data: updateData
      })
    } else {
      await (prisma as any).globalSetting.create({
        data: {
          baseCommission: baseCommission !== undefined ? baseCommission : 10.0,
          productBaseCommission: productBaseCommission !== undefined ? productBaseCommission : 10.0,
          restaurantBaseCommission: restaurantBaseCommission !== undefined ? restaurantBaseCommission : 10.0,
          hotelBaseCommission: hotelBaseCommission !== undefined ? hotelBaseCommission : 10.0,
          serviceBaseCommission: serviceBaseCommission !== undefined ? serviceBaseCommission : 10.0,
          deliveryChargeRanges: validatedRanges !== undefined ? validatedRanges : [],
          dimensionDeliveryChargeRanges: validatedDimensionRanges !== undefined ? validatedDimensionRanges : [],
          regionDeliveryCharges: validatedRegionCharges !== undefined ? validatedRegionCharges : [],
          disallowedNames: disallowedNames !== undefined ? disallowedNames : []
        }
      })
    }
  }

  return NextResponse.json({ success: true })
}
