import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit
    
    // Filter parameters
    const status = searchParams.get("status") // "ACTIVE", "PAUSED", "PENDING_APPROVAL", "ENDED"
    const creativeType = searchParams.get("creativeType") // "IMAGE", "VIDEO"
    const sellerId = searchParams.get("sellerId")
    const customerUserId = searchParams.get("customerUserId")
    
    // Build where clause
    const where: any = {}
    
    if (status) {
      where.status = status
    } else {
      // Default to show active ads
      where.status = "ACTIVE"
    }
    
    if (creativeType) {
      where.creativeType = creativeType
    }
    
    if (sellerId) {
      where.sellerId = sellerId
    }
    
    if (customerUserId) {
      where.customerUserId = customerUserId
    }
    
    // Get current date for filtering active ads
    const now = new Date()
    
    // If filtering by active status, also check date range
    if (status === "ACTIVE") {
      where.startAt = { lte: now }
      where.endAt = { gte: now }
    }
    
    // Get total count for pagination
    const total = await prisma.sellerAd.count({ where })
    
    // Fetch ads with relations
    const ads = await prisma.sellerAd.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        seller: {
          include: {
            store: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true
          }
        },
        adClicks: {
          select: {
            id: true
          }
        }
      }
    })
    
    // Transform data for response with proper null handling
    const formattedAds = ads.map(ad => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      creativeType: ad.creativeType,
      creativeUrl: ad.creativeUrl,
      status: ad.status,
      totalBudget: ad.totalBudget,
      spentAmount: ad.spentAmount,
      maxCpc: ad.maxCpc,
      clicks: ad.adClicks?.length || 0,
      startAt: ad.startAt,
      endAt: ad.endAt,
      createdAt: ad.createdAt,
      advertiser: ad.seller 
        ? {
            type: "SELLER" as const,
            id: ad.seller.id,
            storeName: ad.seller.store?.name || null,
            name: ad.seller.user?.name || null
          }
        : ad.customer
        ? {
            type: "CUSTOMER" as const,
            id: ad.customer.id,
            name: ad.customer.name || null,
            email: ad.customer.email || null
          }
        : null,
      productId: ad.productId || null,
      serviceId: ad.serviceId || null,
      target: ad.product ? {
        id: ad.product.id,
        name: ad.product.name,
        type: "PRODUCT" as const,
        image: Array.isArray(ad.product.images) && ad.product.images.length > 0 ? ad.product.images[0] : null
      } : ad.service ? {
        id: ad.service.id,
        name: ad.service.name,
        type: "SERVICE" as const,
        image: Array.isArray(ad.service.images) && ad.service.images.length > 0 ? ad.service.images[0] : null
      } : null,
      targeting: {
        targetCountries: ad.targetCountries,
        targetAgeMin: ad.targetAgeMin,
        targetAgeMax: ad.targetAgeMax,
        expandAudience: ad.expandAudience
      }
    }))
    
    return NextResponse.json({
      success: true,
      data: formattedAds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1
      }
    })
    
  } catch (error) {
    console.error("Error fetching ads:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch ads" },
      { status: 500 }
    )
  }
}