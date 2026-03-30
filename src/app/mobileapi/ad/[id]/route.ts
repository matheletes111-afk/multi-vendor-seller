import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Fetch ad with all relations
    const ad = await prisma.sellerAd.findUnique({
      where: { id },
      include: {
        seller: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            store: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        product: {
          include: {
            category: true,
            subcategory: true,
            variants: {
              take: 5,
              orderBy: { price: "asc" }
            }
          }
        },
        service: {
          include: {
            serviceCategory: true,
            packages: {
              take: 5
            }
          }
        },
        adClicks: {
          orderBy: { createdAt: "desc" },
          take: 10
        }
      }
    })
    
    if (!ad) {
      return NextResponse.json(
        { success: false, error: "Ad not found" },
        { status: 404 }
      )
    }
    
    // Calculate statistics
    const totalClicks = ad.adClicks?.length || 0
    
    // Format response with proper null handling
    const formattedAd = {
      id: ad.id,
      title: ad.title,
      description: ad.description,
      creativeType: ad.creativeType,
      creativeUrl: ad.creativeUrl,
      status: ad.status,
      totalBudget: ad.totalBudget,
      spentAmount: ad.spentAmount,
      remainingBudget: Number(ad.totalBudget) - Number(ad.spentAmount),
      maxCpc: ad.maxCpc,
      clicks: totalClicks,
      startAt: ad.startAt,
      endAt: ad.endAt,
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
      // Always include productId and serviceId, even if null
      productId: ad.productId || null,
      serviceId: ad.serviceId || null,
      // Advertiser info
      advertiser: ad.seller 
        ? {
            type: "SELLER" as const,
            id: ad.seller.id,
            userId: ad.seller.userId,
            name: ad.seller.user?.name || null,
            email: ad.seller.user?.email || null,
            phone: ad.seller.user?.phone || null,
            storeName: ad.seller.store?.name || null,
            storeLogo: ad.seller.store?.logo || null
          }
        : ad.customer
        ? {
            type: "CUSTOMER" as const,
            id: ad.customer.id,
            name: ad.customer.name || null,
            email: ad.customer.email || null,
            phone: ad.customer.phone || null
          }
        : null,
      // Target details - only include if product or service exists
      target: ad.product ? {
        type: "PRODUCT" as const,
        id: ad.product.id,
        name: ad.product.name,
        slug: ad.product.slug,
        description: ad.product.description,
        images: ad.product.images,
        category: ad.product.category?.name || null,
        subcategory: ad.product.subcategory?.name || null,
        priceRange: ad.product.variants && ad.product.variants.length > 0 
          ? {
              min: Math.min(...ad.product.variants.map(v => v.price)),
              max: Math.max(...ad.product.variants.map(v => v.price))
            }
          : null,
        variantCount: ad.product.variants?.length || 0
      } : ad.service ? {
        type: "SERVICE" as const,
        id: ad.service.id,
        name: ad.service.name,
        slug: ad.service.slug,
        description: ad.service.description,
        images: ad.service.images,
        serviceType: ad.service.serviceType,
        basePrice: ad.service.basePrice,
        category: ad.service.serviceCategory?.name || null,
        packageCount: ad.service.packages?.length || 0
      } : null,
      // Targeting info
      targeting: {
        targetCountries: ad.targetCountries,
        targetAgeMin: ad.targetAgeMin,
        targetAgeMax: ad.targetAgeMax,
        expandAudience: ad.expandAudience
      },
      // Recent clicks
      recentClicks: ad.adClicks?.map(click => ({
        id: click.id,
        createdAt: click.createdAt,
        sessionId: click.sessionId
      })) || [],
      // Statistics
      statistics: {
        totalClicks,
        avgCpc: totalClicks > 0 ? Number(ad.spentAmount) / totalClicks : 0,
        budgetUtilization: Number(ad.totalBudget) > 0 ? (Number(ad.spentAmount) / Number(ad.totalBudget)) * 100 : 0,
        daysRemaining: Math.max(0, Math.ceil(
          (new Date(ad.endAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ))
      }
    }
    
    return NextResponse.json({
      success: true,
      data: formattedAd
    })
    
  } catch (error) {
    console.error("Error fetching ad details:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch ad details" },
      { status: 500 }
    )
  }
}