import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { saveAdCreativeFile, validateAdCreativeFile } from "@/lib/ad-upload"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/admanagement
 * List ads for the authenticated hotel seller.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const where = { hotelSellerId: seller.id }

    const [ads, totalCount] = await Promise.all([
      prisma.sellerAd.findMany({
        where,
        skip,
        take,
        include: {
          hotel: { select: { id: true, name: true } },
          _count: { select: { adClicks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerAd.count({ where }),
    ])

    const serialized = ads.map((ad) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
      targetCountries: ad.targetCountries as string[] | null,
    }))

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        ads: serialized,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage
        }
      }
    })
  } catch (error) {
    console.error("Mobile list ads error:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/hotel-seller/admanagement
 * Create a new ad for the seller (supports multipart/form-data creative uploads).
 */
export async function POST(request: NextRequest) {
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

    let body: Record<string, string | number | boolean | undefined>
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const placements = formData.getAll("placements") as string[]
      const hasWeb = placements.includes("WEB")
      const hasMobile = placements.includes("MOBILE")

      const creativeFile = formData.get("creativeFile") as File | null
      let creativeUrl = (formData.get("creativeUrl") as string) || ""
      if (hasWeb && creativeFile && creativeFile.size > 0) {
        const check = validateAdCreativeFile(creativeFile)
        if (!check.ok) {
          return NextResponse.json({ success: false, error: "Web Creative: " + check.error }, { status: 400 })
        }
        try {
          creativeUrl = await saveAdCreativeFile(creativeFile)
        } catch (e) {
          return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 })
        }
      }

      const mobileCreativeFile = formData.get("mobilecreativeFile") as File | null
      let mobileCreativeUrl = (formData.get("mobilecreativeUrl") as string) || ""
      if (hasMobile && mobileCreativeFile && mobileCreativeFile.size > 0) {
        const check = validateAdCreativeFile(mobileCreativeFile)
        if (!check.ok) {
          return NextResponse.json({ success: false, error: "Mobile Creative: " + check.error }, { status: 400 })
        }
        try {
          mobileCreativeUrl = await saveAdCreativeFile(mobileCreativeFile)
        } catch (e) {
          return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 })
        }
      }

      const totalBudgetStr = (formData.get("totalBudget") as string) || ""
      const maxCpcStr = (formData.get("maxCpc") as string) || ""
      const targetAudienceStr = (formData.get("targetAudience") as string) || ""
      const totalBudget = parseFloat(totalBudgetStr)
      let maxCpc = parseFloat(maxCpcStr)
      if (!maxCpcStr && targetAudienceStr) {
        const aud = parseInt(targetAudienceStr, 10)
        if (aud >= 1) maxCpc = totalBudget / aud
      }

      body = {
        adType: (formData.get("adType") as string) || "promote_product",
        hotelId: formData.get("hotelId") as string,
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || undefined,
        placements: placements as any,
        creativeType: ((formData.get("creativeType") as string) || "IMAGE") as any,
        creativeUrl,
        mobileCreativeType: ((formData.get("mobilecreativeType") as string) || "IMAGE") as any,
        mobileCreativeUrl,
        totalBudget,
        maxCpc,
        startAt: formData.get("startAt") as string,
        endAt: formData.get("endAt") as string,
        targetCountries: (formData.get("targetCountries") as string) || undefined,
        targetAudience: targetAudienceStr ? parseInt(targetAudienceStr, 10) : undefined,
        targetAgeMin: (formData.get("targetAgeMin") as string) ? parseInt((formData.get("targetAgeMin") as string), 10) : undefined,
        targetAgeMax: (formData.get("targetAgeMax") as string) ? parseInt((formData.get("targetAgeMax") as string), 10) : undefined,
        expandAudience: (formData.get("expandAudience") as string) === "on" || (formData.get("expandAudience") as string) === "true",
      }
    } else {
      body = await request.json().catch(() => ({}))
    }

    const adTypeRaw = String(body.adType ?? "promote_product").trim().toLowerCase().replace(/-/g, "_")
    const isOwnAd = adTypeRaw === "own_ad" || adTypeRaw === "ownad"
    const hotelIdRaw = String(body.hotelId ?? "").trim()
    const resolvedHotelId = isOwnAd ? null : hotelIdRaw
    const title = String(body.title ?? "").trim()
    const placements = (body.placements as unknown as string[]) || ["WEB"]
    const creativeUrl = String(body.creativeUrl ?? "").trim()
    const creativeType = body.creativeType === "VIDEO" ? "VIDEO" : "IMAGE"
    const mobileCreativeUrl = String(body.mobileCreativeUrl ?? "").trim()
    const mobileCreativeType = body.mobileCreativeType === "VIDEO" ? "VIDEO" : "IMAGE"
    const totalBudget = Number(body.totalBudget ?? 0)
    const maxCpc = Number(body.maxCpc ?? 0)
    const startAt = new Date(String(body.startAt ?? ""))
    const endAt = new Date(String(body.endAt ?? ""))

    if (placements.length === 0) {
      return NextResponse.json({ success: false, error: "At least one placement is required" }, { status: 400 })
    }
    if (!isOwnAd && !hotelIdRaw) {
      return NextResponse.json({ success: false, error: "hotelId is required when promoting a hotel" }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 })
    }
    if (placements.includes("WEB") && !creativeUrl) {
      return NextResponse.json({ success: false, error: "Web creative URL or file is required for Web placement" }, { status: 400 })
    }
    if (placements.includes("MOBILE") && !mobileCreativeUrl) {
      return NextResponse.json({ success: false, error: "Mobile creative URL or file is required for Mobile placement" }, { status: 400 })
    }
    if (isNaN(totalBudget) || totalBudget <= 0 || isNaN(maxCpc) || maxCpc <= 0) {
      return NextResponse.json({ success: false, error: "Valid totalBudget and maxCpc required" }, { status: 400 })
    }
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ success: false, error: "Valid startAt and endAt required" }, { status: 400 })
    }
    if (endAt <= startAt) {
      return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 })
    }

    if (!isOwnAd && resolvedHotelId) {
      const hotel = await prisma.hotel.findFirst({
        where: { id: resolvedHotelId, hotelSellerId: seller.id, isDeleted: false },
      })
      if (!hotel) {
        return NextResponse.json({ success: false, error: "Hotel not found or unauthorized" }, { status: 404 })
      }
    }

    let targetCountries: string[] | null = null
    const tc = body.targetCountries
    if (tc) {
      try {
        const parsed = typeof tc === "string" ? JSON.parse(tc) : tc
        targetCountries = Array.isArray(parsed) ? parsed.map((c: unknown) => String(c).trim()).filter(Boolean) : null
      } catch {
        targetCountries = String(tc).split(",").map((c) => c.trim()).filter(Boolean)
      }
    }

    const targetAgeMin = body.targetAgeMin != null && !isNaN(Number(body.targetAgeMin)) ? Number(body.targetAgeMin) : null
    const targetAgeMax = body.targetAgeMax != null && !isNaN(Number(body.targetAgeMax)) ? Number(body.targetAgeMax) : null
    const targetAudience = body.targetAudience != null && Number(body.targetAudience) >= 1 ? Number(body.targetAudience) : null

    const createdAd = await prisma.sellerAd.create({
      data: {
        hotelSellerId: seller.id,
        customerUserId: null,
        hotelId: resolvedHotelId,
        title,
        description: (body.description as string) || null,
        placements: placements as any,
        creativeType: creativeType,
        creativeUrl: creativeUrl || mobileCreativeUrl || "",
        mobileCreativeType: mobileCreativeType,
        mobileCreativeUrl: mobileCreativeUrl || null,
        status: "PENDING_APPROVAL",
        totalBudget,
        spentAmount: 0,
        maxCpc,
        targetAudience,
        startAt,
        endAt,
        targetCountries: targetCountries?.length ? (targetCountries as unknown as object) : undefined,
        targetAgeMin,
        targetAgeMax,
        expandAudience: body.expandAudience === true,
      },
    })

    return NextResponse.json({ success: true, data: createdAd })
  } catch (error: any) {
    console.error("Mobile create ad error:", error)
    return NextResponse.json(
      { success: false, error: `Failed to create ad: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    )
  }
}
