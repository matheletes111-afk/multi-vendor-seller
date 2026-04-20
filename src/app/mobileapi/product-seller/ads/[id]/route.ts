import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/ads/[id]
 * Get full details of a specific ad.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
 * Toggle ad status (PAUSE/RESUME).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
    const body = await request.json().catch(() => ({}))
    const { status } = body as { status?: string }

    if (!status) return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 })

    if (status === "PAUSED" && ad.status === "ACTIVE") {
      const updated = await prisma.sellerAd.update({
        where: { id },
        data: { status: "PAUSED" },
      })
      return NextResponse.json({ success: true, status: "PAUSED", data: updated })
    }

    if (status === "ACTIVE" && ad.status === "PAUSED") {
      const updated = await prisma.sellerAd.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      return NextResponse.json({ success: true, status: "ACTIVE", data: updated })
    }

    return NextResponse.json({ 
      success: false, 
      error: "Invalid status change. Only ACTIVE ads can be PAUSED, and PAUSED ads can be set to ACTIVE." 
    }, { status: 400 })
  } catch (error) {
    console.error("Mobile ad status update error:", error)
    return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/product-seller/ads/[id]
 * Permanently delete an ad.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
