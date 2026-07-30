import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"
import { saveAdCreativeFile } from "@/lib/ad-upload"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/admanagement/[id]
 * Get single ad details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, hotelSellerId: seller.id },
      include: {
        hotel: true,
        _count: { select: { adClicks: true } },
      },
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    const serialized = {
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
      targetCountries: ad.targetCountries as string[] | null,
    }

    return NextResponse.json({ success: true, data: serialized })
  } catch (error) {
    console.error("Mobile get ad error:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * PATCH /mobileapi/hotel-seller/admanagement/[id]
 * Update ad fields or toggle ad status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, hotelSellerId: seller.id },
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const jsonBody = await request.json().catch(() => ({}))
      if (Object.keys(jsonBody).length === 1 && jsonBody.status) {
        const { status } = jsonBody
        if (status === "PAUSED" && ad.status === "ACTIVE") {
          const updated = await prisma.sellerAd.update({ where: { id }, data: { status: "PAUSED" } })
          return NextResponse.json({ success: true, data: { status: "PAUSED", ad: updated } })
        }
        if (status === "ACTIVE" && ad.status === "PAUSED") {
          const updated = await prisma.sellerAd.update({ where: { id }, data: { status: "ACTIVE" } })
          return NextResponse.json({ success: true, data: { status: "ACTIVE", ad: updated } })
        }
        return NextResponse.json({ success: false, error: "Invalid status change" }, { status: 400 })
      }
    }

    let body: any = {}
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const placements = formData.getAll("placements") as string[]
      
      let creativeUrl = (formData.get("creativeUrl") as string) || ad.creativeUrl || ""
      const creativeFile = formData.get("creativeFile") as File | null
      if (creativeFile && creativeFile.size > 0) {
        creativeUrl = await saveAdCreativeFile(creativeFile)
      }

      let mobileCreativeUrl = (formData.get("mobileCreativeUrl") as string) || ad.mobileCreativeUrl || ""
      const mobileCreativeFile = formData.get("mobileCreativeFile") as File | null
      if (mobileCreativeFile && mobileCreativeFile.size > 0) {
        mobileCreativeUrl = await saveAdCreativeFile(mobileCreativeFile)
      }

      body = {
        adType: formData.get("adType") as string,
        hotelId: formData.get("hotelId") as string,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        placements: placements.length > 0 ? placements : undefined,
        creativeType: formData.get("creativeType") as string,
        creativeUrl,
        mobileCreativeType: formData.get("mobileCreativeType") as string,
        mobileCreativeUrl,
        totalBudget: formData.get("totalBudget") ? parseFloat(formData.get("totalBudget") as string) : undefined,
        maxCpc: formData.get("maxCpc") ? parseFloat(formData.get("maxCpc") as string) : undefined,
        startAt: formData.get("startAt") as string,
        endAt: formData.get("endAt") as string,
        targetCountries: formData.get("targetCountries") as string,
        targetAgeMin: formData.get("targetAgeMin") ? parseInt(formData.get("targetAgeMin") as string) : undefined,
        targetAgeMax: formData.get("targetAgeMax") ? parseInt(formData.get("targetAgeMax") as string) : undefined,
        targetAudience: formData.get("targetAudience") ? parseInt(formData.get("targetAudience") as string) : undefined,
        expandAudience: formData.get("expandAudience") === "on" || formData.get("expandAudience") === "true",
      }
    } else {
      body = await request.json().catch(() => ({}))
    }

    const adType = String(body.adType || "promote_product").trim().toLowerCase()
    const isOwnAd = adType === "own_ad" || adType === "ownad"
    const hotelId = isOwnAd ? null : (body.hotelId ? String(body.hotelId).trim() : ad.hotelId)
    const title = body.title ? String(body.title).trim() : ad.title

    let placements: string[] = ad.placements && ad.placements.length > 0 ? (ad.placements as string[]) : ["WEB"]
    const rawPlacements = body.placements
    if (Array.isArray(rawPlacements)) {
      placements = rawPlacements.flatMap((p: any) => String(p).split(",")).map((p: string) => p.trim().toUpperCase())
    } else if (typeof rawPlacements === "string" && rawPlacements.trim()) {
      placements = rawPlacements.split(",").map((p: string) => p.trim().toUpperCase())
    }
    placements = placements.filter((p) => p === "WEB" || p === "MOBILE")
    if (placements.length === 0) placements = ["WEB"]

    const creativeUrl = body.creativeUrl !== undefined ? String(body.creativeUrl).trim() : ad.creativeUrl
    const mobileCreativeUrl = body.mobileCreativeUrl !== undefined ? String(body.mobileCreativeUrl).trim() : ad.mobileCreativeUrl
    const totalBudget = body.totalBudget ? Number(body.totalBudget) : Number(ad.totalBudget)
    const maxCpc = body.maxCpc ? Number(body.maxCpc) : Number(ad.maxCpc)
    const startAt = body.startAt ? new Date(String(body.startAt)) : ad.startAt
    const endAt = body.endAt ? new Date(String(body.endAt)) : ad.endAt

    if (!title) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 })

    if (hotelId) {
      const hotel = await prisma.hotel.findFirst({ where: { id: hotelId, hotelSellerId: seller.id } })
      if (!hotel) return NextResponse.json({ success: false, error: "Hotel property not found or does not belong to you" }, { status: 404 })
    }

    let targetCountries: string[] | null = (ad.targetCountries as string[]) || null
    if (body.targetCountries !== undefined) {
      const tc = body.targetCountries
      if (!tc) {
        targetCountries = null
      } else {
        try {
          const parsed = typeof tc === "string" ? JSON.parse(tc) : tc
          targetCountries = Array.isArray(parsed) ? parsed.map((c: any) => String(c).trim()).filter(Boolean) : null
        } catch {
          targetCountries = String(tc).split(",").map((c) => c.trim()).filter(Boolean)
        }
      }
    }

    const updatedAd = await prisma.sellerAd.update({
      where: { id },
      data: {
        hotelId,
        title,
        description: body.description !== undefined ? body.description : ad.description,
        // @ts-ignore
        placements,
        creativeType: body.creativeType ? (body.creativeType === "VIDEO" ? "VIDEO" : "IMAGE") : ad.creativeType,
        creativeUrl: creativeUrl || mobileCreativeUrl || ad.creativeUrl,
        // @ts-ignore
        mobileCreativeType: body.mobileCreativeType ? (body.mobileCreativeType === "VIDEO" ? "VIDEO" : "IMAGE") : ad.mobileCreativeType,
        mobileCreativeUrl: mobileCreativeUrl || null,
        status: "PENDING_APPROVAL",
        totalBudget,
        maxCpc,
        startAt,
        endAt,
        targetCountries: targetCountries ? (targetCountries as any) : null,
        targetAgeMin: body.targetAgeMin !== undefined ? (body.targetAgeMin ? Number(body.targetAgeMin) : null) : ad.targetAgeMin,
        targetAgeMax: body.targetAgeMax !== undefined ? (body.targetAgeMax ? Number(body.targetAgeMax) : null) : ad.targetAgeMax,
        targetAudience: body.targetAudience !== undefined ? (body.targetAudience ? Number(body.targetAudience) : null) : ad.targetAudience,
        expandAudience: body.expandAudience !== undefined ? Boolean(body.expandAudience) : ad.expandAudience,
      },
    })

    return NextResponse.json({ success: true, data: updatedAd })
  } catch (error: any) {
    console.error("Mobile patch ad error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

/**
 * DELETE /mobileapi/hotel-seller/admanagement/[id]
 * End/stop a running ad.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, hotelSellerId: seller.id },
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    await prisma.sellerAd.update({
      where: { id },
      data: { status: "ENDED" },
    })

    return NextResponse.json({ success: true, message: "Ad ended successfully" })
  } catch (error) {
    console.error("Mobile delete ad error:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
