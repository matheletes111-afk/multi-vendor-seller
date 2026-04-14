import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { saveAdCreativeFile, validateAdCreativeFile } from "@/lib/ad-upload"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/service-seller/ads
 * List ads for the authenticated service seller.
 */
export async function GET(request: NextRequest) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  try {
    const [ads, totalCount] = await Promise.all([
      prisma.sellerAd.findMany({
        where: { sellerId: seller.id },
        skip,
        take,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          _count: { select: { adClicks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerAd.count({ where: { sellerId: seller.id } }),
    ])

    const serialized = ads.map((ad) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
      targetCountries: ad.targetCountries as string[] | null,
      clickCount: ad._count.adClicks,
    }))

    return NextResponse.json({
      success: true,
      data: {
        ads: serialized,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / perPage) || 1,
          page,
          perPage,
        }
      }
    })
  } catch (error) {
    console.error("Mobile service list ads error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ads" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/service-seller/ads
 * Create a new ad (promote service or own business).
 * Supports multipart/form-data for file uploads.
 */
export async function POST(request: NextRequest) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  try {
    const contentType = request.headers.get("content-type") || ""
    let body: any = {}

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const placements = formData.getAll("placements") as string[]
      
      let creativeUrl = (formData.get("creativeUrl") as string) || ""
      const creativeFile = formData.get("creativeFile") as File | null
      if (creativeFile && creativeFile.size > 0) {
        creativeUrl = await saveAdCreativeFile(creativeFile)
      }

      let mobileCreativeUrl = (formData.get("mobileCreativeUrl") as string) || ""
      const mobileCreativeFile = formData.get("mobileCreativeFile") as File | null
      if (mobileCreativeFile && mobileCreativeFile.size > 0) {
        mobileCreativeUrl = await saveAdCreativeFile(mobileCreativeFile)
      }

      body = {
        adType: formData.get("adType") as string,
        serviceId: formData.get("serviceId") as string,
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
      }
    } else {
      body = await request.json()
    }

    // Validation & Defaults
    const adType = String(body.adType || "promote_service").trim().toLowerCase()
    const isOwnAd = adType === "own_ad" || adType === "ownad"
    const serviceId = isOwnAd ? null : String(body.serviceId || "").trim()
    const title = String(body.title || "").trim()
    const placements = Array.isArray(body.placements) ? body.placements : ["WEB"]
    const creativeUrl = String(body.creativeUrl || "").trim()
    const mobileCreativeUrl = String(body.mobileCreativeUrl || "").trim()
    const totalBudget = Number(body.totalBudget || 0)
    const maxCpc = Number(body.maxCpc || 0)
    const startAt = new Date(String(body.startAt || ""))
    const endAt = new Date(String(body.endAt || ""))

    if (!title) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 })
    if (!isOwnAd && !serviceId) return NextResponse.json({ success: false, error: "Service ID is required for promoting a service" }, { status: 400 })
    if (placements.includes("WEB") && !creativeUrl) return NextResponse.json({ success: false, error: "Web creative is required for Web placement" }, { status: 400 })
    if (placements.includes("MOBILE") && !mobileCreativeUrl) return NextResponse.json({ success: false, error: "Mobile creative is required for Mobile placement" }, { status: 400 })
    if (totalBudget <= 0 || maxCpc <= 0) return NextResponse.json({ success: false, error: "Valid totalBudget and maxCpc are required" }, { status: 400 })
    if (endAt <= startAt) return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 })

    if (serviceId) {
      const service = await prisma.service.findFirst({ where: { id: serviceId, sellerId: seller.id } })
      if (!service) return NextResponse.json({ success: false, error: "Service not found or does not belong to you" }, { status: 404 })
    }

    // Handle targetCountries (matches web logic)
    let targetCountries: string[] | null = null
    const tc = body.targetCountries
    if (tc) {
      try {
        const parsed = typeof tc === "string" ? JSON.parse(tc) : tc
        targetCountries = Array.isArray(parsed) ? parsed.map((c: any) => String(c).trim()).filter(Boolean) : null
      } catch {
        targetCountries = String(tc).split(",").map((c) => c.trim()).filter(Boolean)
      }
    }

    const ad = await prisma.sellerAd.create({
      data: {
        sellerId: seller.id,
        serviceId,
        title,
        description: body.description || null,
        // @ts-ignore
        placements: placements,
        creativeType: (body.creativeType === "VIDEO" ? "VIDEO" : "IMAGE"),
        creativeUrl: creativeUrl || mobileCreativeUrl || "",
        // @ts-ignore
        mobileCreativeType: (body.mobileCreativeType === "VIDEO" ? "VIDEO" : "IMAGE"),
        mobileCreativeUrl: mobileCreativeUrl || null,
        status: "PENDING_APPROVAL",
        totalBudget,
        spentAmount: 0,
        maxCpc,
        startAt,
        endAt,
        targetCountries: targetCountries?.length ? (targetCountries as any) : undefined,
        targetAgeMin: body.targetAgeMin,
        targetAgeMax: body.targetAgeMax,
      }
    })

    return NextResponse.json({ success: true, data: ad })
  } catch (error: any) {
    console.error("Mobile service ad creation error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to create ad" }, { status: 500 })
  }
}
