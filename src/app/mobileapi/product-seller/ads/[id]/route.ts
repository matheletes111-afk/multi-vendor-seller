import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"
import { saveAdCreativeFile } from "@/lib/ad-upload"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/ads/[id]
 * Get full details of a specific ad.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  try {
    const ad = await prisma.sellerAd.findFirst({
      where: { id, sellerId: seller.id },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        _count: { select: { adClicks: true } },
      },
    })

    if (!ad) return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        ...ad,
        totalBudget: Number(ad.totalBudget),
        spentAmount: Number(ad.spentAmount),
        maxCpc: Number(ad.maxCpc),
        targetCountries: ad.targetCountries as string[] | null,
        clickCount: ad._count.adClicks,
      }
    })
  } catch (error) {
    console.error("Mobile get ad detail error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ad details" }, { status: 500 })
  }
}

/**
 * PATCH /mobileapi/product-seller/ads/[id]
 * Update ad fields or toggle ad status (PAUSE/RESUME).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  const ad = await prisma.sellerAd.findFirst({
    where: { id, sellerId: seller.id },
  })

  if (!ad) return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })

  try {
    const contentType = request.headers.get("content-type") || ""

    // Handle status-only toggle if JSON with just status
    if (contentType.includes("application/json")) {
      const jsonBody = await request.json().catch(() => ({}))
      if (Object.keys(jsonBody).length === 1 && jsonBody.status) {
        const { status } = jsonBody
        if (status === "PAUSED" && ad.status === "ACTIVE") {
          const updated = await prisma.sellerAd.update({ where: { id }, data: { status: "PAUSED" } })
          return NextResponse.json({ success: true, status: "PAUSED", data: updated })
        }
        if (status === "ACTIVE" && ad.status === "PAUSED") {
          const updated = await prisma.sellerAd.update({ where: { id }, data: { status: "ACTIVE" } })
          return NextResponse.json({ success: true, status: "ACTIVE", data: updated })
        }
        return NextResponse.json({ success: false, error: "Invalid status change" }, { status: 400 })
      }
    }

    // Full ad update (multipart or JSON)
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
        productId: formData.get("productId") as string,
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
    const productId = isOwnAd ? null : (body.productId ? String(body.productId).trim() : ad.productId)
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

    if (productId) {
      const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } })
      if (!product) return NextResponse.json({ success: false, error: "Product not found or does not belong to you" }, { status: 404 })
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
        productId,
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
    console.error("Mobile ad edit error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to update ad" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

/**
 * DELETE /mobileapi/product-seller/ads/[id]
 * Permanently delete an ad.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  const ad = await prisma.sellerAd.findFirst({ where: { id, sellerId: seller.id } })
  if (!ad) return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })

  try {
    await prisma.sellerAd.update({ where: { id }, data: { status: "ENDED" } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mobile delete ad error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete ad" }, { status: 500 })
  }
}
