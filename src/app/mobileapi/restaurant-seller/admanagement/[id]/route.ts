import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/restaurant-seller/admanagement/[id]
 * Get single ad details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, restaurantSellerId: seller.id },
      include: {
        foodItem: true,
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
 * PATCH /mobileapi/restaurant-seller/admanagement/[id]
 * Update ad status (pause or resume).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, restaurantSellerId: seller.id },
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { status } = body as { status?: string }

    if (status === "PAUSED" && ad.status === "ACTIVE") {
      const updated = await prisma.sellerAd.update({
        where: { id },
        data: { status: "PAUSED" },
      })
      return NextResponse.json({ success: true, data: { status: "PAUSED", ad: updated } })
    }

    if (status === "ACTIVE" && ad.status === "PAUSED") {
      const updated = await prisma.sellerAd.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      return NextResponse.json({ success: true, data: { status: "ACTIVE", ad: updated } })
    }

    return NextResponse.json({ success: false, error: "Invalid status change" }, { status: 400 })
  } catch (error) {
    console.error("Mobile patch ad error:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/restaurant-seller/admanagement/[id]
 * End/stop a running ad.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const ad = await prisma.sellerAd.findFirst({
      where: { id, restaurantSellerId: seller.id },
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
