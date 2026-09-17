import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { formatTimeAgo } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (!authResult.ok || !authResult.userId) {
      // Guest User Policy: Returns empty array [] without error
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50 // Default 50 to return all recent searches

    const recentViews = await prisma.recentView.findMany({
      where: { userId: authResult.userId },
      orderBy: { viewedAt: "desc" },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            variants: {
              select: {
                price: true,
                discount: true,
              },
              take: 1,
            },
          },
        },
      },
    })

    const items = recentViews.map((rv) => {
      const p = rv.product
      const variant = p.variants[0]
      const originalPrice = variant ? variant.price : 0
      const discountAmount = variant ? (variant.discount || 0) : 0
      const finalPrice = Math.max(0, originalPrice - discountAmount)

      const discountTag =
        discountAmount > 0 && originalPrice > 0
          ? `${Math.round((discountAmount / originalPrice) * 100)}% OFF`
          : null

      let imageUrl: string | null = null
      if (Array.isArray(p.images) && p.images.length > 0) {
        imageUrl = String(p.images[0])
      }

      const timeAgo = formatTimeAgo(rv.viewedAt)

      return {
        search_id: rv.id,
        product_id: p.id,
        query_text: p.name,
        searched_time_ago: timeAgo, // Dynamic relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday", "3d ago")
        viewed_at: rv.viewedAt.toISOString(), // ISO 8601 timestamp
        viewed_time_ago: timeAgo,
        image_url: imageUrl,
        price: finalPrice,
        original_price: discountAmount > 0 ? originalPrice : null,
        discount_tag: discountTag,
      }
    })

    return NextResponse.json(
      {
        success: true,
        data: items,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Recent searches GET API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (!authResult.ok || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    let body: { productId?: string; product_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const productId = (body.product_id || body.productId || "").trim()
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "productId is required" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({
        success: true,
        message: "Product not found or inactive",
      })
    }

    await prisma.recentView.upsert({
      where: { userId_productId: { userId: authResult.userId, productId } },
      create: { userId: authResult.userId, productId, viewedAt: new Date() },
      update: { viewedAt: new Date() },
    })

    const over = await prisma.recentView.findMany({
      where: { userId: authResult.userId },
      orderBy: { viewedAt: "desc" },
      select: { id: true },
    })

    if (over.length > 50) {
      const toRemove = over.slice(50).map((r) => r.id)
      await prisma.recentView.deleteMany({
        where: { id: { in: toRemove } },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Recent view recorded",
    })
  } catch (error) {
    console.error("Recent searches POST API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (!authResult.ok || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await prisma.recentView.deleteMany({
      where: { userId: authResult.userId },
    })

    return NextResponse.json({
      success: true,
      message: "Recent searches cleared successfully",
    })
  } catch (error) {
    console.error("Recent searches DELETE API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

