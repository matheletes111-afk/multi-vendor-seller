import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, normalizeHotelMedia, toPublicMediaUrl, toPublicMediaUrlList } from "@/lib/media-url"

export async function GET(request: Request) {
  try {
    const origin = getRequestPublicOrigin(request)
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

    // Only return ads specifically targeted for mobile devices with an image present
    // @ts-ignore - Prisma client needs regeneration
    where.placements = { has: "MOBILE" }
    where.mobileCreativeUrl = { not: null, notIn: [""] }

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
    if (!status || status === "ACTIVE") {
      where.startAt = { lte: now }
      where.endAt = { gte: now }
    }

    // Get total count for pagination (representing total ads matching criteria)
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
                email: true,
                image: true
              }
            }
          }
        },
        hotelSeller: {
          include: {
            businessInfo: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        restaurantSeller: {
          include: {
            businessInfo: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        product: {
          include: {
            variants: {
              take: 1,
              orderBy: { price: "asc" }
            }
          }
        },
        service: true,
        hotel: true,
        foodItem: true,
        adClicks: {
          select: {
            id: true
          }
        }
      }
    })

    // Group ads by advertiser (WhatsApp status/stories style)
    const groupedAdvertisers = new Map<string, any>()

    for (const ad of ads) {
      const advertiserId = ad.sellerId || ad.hotelSellerId || ad.restaurantSellerId || ad.customerUserId || "anonymous"
      
      if (!groupedAdvertisers.has(advertiserId)) {
        groupedAdvertisers.set(advertiserId, {
          advertiser: ad.seller
            ? {
              type: "SELLER",
              id: ad.seller.id,
              storeName: ad.seller.store?.name || null,
              name: ad.seller.user?.name || null,
              avatar: toPublicMediaUrl(ad.seller.store?.logo || ad.seller.user?.image || null, origin),
              sellerType: ad.seller.type // PRODUCT or SERVICE
            }
            : ad.hotelSeller
              ? {
                type: "HOTEL_SELLER",
                id: ad.hotelSeller.id,
                storeName: ad.hotelSeller.businessInfo?.businessName || null,
                name: ad.hotelSeller.user?.name || null,
                avatar: toPublicMediaUrl(ad.hotelSeller.logo || ad.hotelSeller.user?.image || null, origin),
                sellerType: "HOTEL"
              }
              : ad.restaurantSeller
                ? {
                  type: "RESTAURANT_SELLER",
                  id: ad.restaurantSeller.id,
                  storeName: ad.restaurantSeller.businessInfo?.businessName || null,
                  name: ad.restaurantSeller.user?.name || null,
                  avatar: toPublicMediaUrl(ad.restaurantSeller.logo || ad.restaurantSeller.user?.image || null, origin),
                  sellerType: "RESTAURANT"
                }
                : ad.customer
                  ? {
                    type: "CUSTOMER",
                    id: ad.customer.id,
                    name: ad.customer.name || null,
                    avatar: toPublicMediaUrl(ad.customer.image || null, origin),
                    email: ad.customer.email || null
                  }
                  : null,
          ads: []
        })
      }

      // @ts-ignore - Prisma needs regeneration
      const mobileType = ad.mobileCreativeType
      // @ts-ignore
      const mobileUrl = toPublicMediaUrl(ad.mobileCreativeUrl, origin)
      const webUrl = toPublicMediaUrl(ad.creativeUrl, origin)
      // @ts-ignore
      const placementsArray = ad.placements || ["WEB"]
      const hotelMedia = ad.hotel ? normalizeHotelMedia(ad.hotel, origin) : null

      groupedAdvertisers.get(advertiserId).ads.push({
        id: ad.id,
        title: ad.title,
        description: ad.description,
        creativeType: mobileType || ad.creativeType,
        creativeUrl: mobileUrl || webUrl,
        placements: placementsArray,
        webCreativeType: ad.creativeType,
        webCreativeUrl: webUrl,
        mobileCreativeType: mobileType,
        mobileCreativeUrl: mobileUrl,
        status: ad.status,
        totalBudget: ad.totalBudget,
        spentAmount: ad.spentAmount,
        maxCpc: ad.maxCpc,
        clicks: ad.adClicks?.length || 0,
        startAt: ad.startAt,
        endAt: ad.endAt,
        createdAt: ad.createdAt,
        productId: ad.productId || null,
        serviceId: ad.serviceId || null,
        hotelId: ad.hotelId || null,
        foodItemId: ad.foodItemId || null,
        restaurantSellerId: ad.restaurantSellerId || null,
        target: {
          product: ad.product
            ? {
                ...ad.product,
                images: toPublicMediaUrlList(ad.product.images, origin),
                type: "PRODUCT" as const,
              }
            : null,
          service: ad.service
            ? {
                ...ad.service,
                images: toPublicMediaUrlList(ad.service.images, origin),
                galleryImages: toPublicMediaUrlList(ad.service.galleryImages, origin),
                type: "SERVICE" as const,
              }
            : null,
          hotel: ad.hotel && hotelMedia
            ? {
                ...ad.hotel,
                images: hotelMedia.images,
                banner: hotelMedia.banner,
                logo: hotelMedia.logo,
                coverImage: hotelMedia.coverImage,
                type: "HOTEL" as const,
              }
            : null,
          foodItem: ad.foodItem
            ? {
                ...ad.foodItem,
                images: toPublicMediaUrlList(ad.foodItem.images, origin),
                type: "FOOD" as const,
              }
            : null
        },
        targeting: {
          targetCountries: ad.targetCountries,
          targetAgeMin: ad.targetAgeMin,
          targetAgeMax: ad.targetAgeMax,
          expandAudience: ad.expandAudience
        }
      })
    }

    const data = Array.from(groupedAdvertisers.values())

    return NextResponse.json({
      success: true,
      data: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
        totalAds: total,
        totalGroups: data.length
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