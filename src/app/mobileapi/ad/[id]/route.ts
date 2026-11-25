import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, normalizeHotelMedia, toPublicMediaUrl, toPublicMediaUrlList } from "@/lib/media-url"

// Fix: Use NextRequest and await params
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params (required in Next.js 15+)
    const { id } = await params

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
                phone: true,
                image: true,
              }
            },
            store: true
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
                phone: true,
                image: true,
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
                phone: true,
                image: true,
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
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
        hotel: {
          include: {
            hotelSeller: { select: { logo: true, banner: true, mainPhoto: true } }
          }
        },
        foodItem: true,
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
    // @ts-ignore
    const mobileType = ad.mobileCreativeType
    // @ts-ignore
    const origin = getRequestPublicOrigin(request)
    const mobileUrl = toPublicMediaUrl(ad.mobileCreativeUrl, origin)
    const webUrl = toPublicMediaUrl(ad.creativeUrl, origin)
    // @ts-ignore
    const placements = ad.placements || ["WEB"]
    const hotelMedia = ad.hotel ? normalizeHotelMedia(ad.hotel, origin) : null

    const formattedAd = {
      id: ad.id,
      title: ad.title,
      description: ad.description,
      creativeType: mobileType || ad.creativeType,
      creativeUrl: mobileUrl || webUrl,
      placements: placements,
      webCreativeType: ad.creativeType,
      webCreativeUrl: webUrl,
      mobileCreativeType: mobileType,
      mobileCreativeUrl: mobileUrl,
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
      // Always include target IDs, even if null
      productId: ad.productId || null,
      serviceId: ad.serviceId || null,
      hotelId: ad.hotelId || null,
      foodItemId: ad.foodItemId || null,
      restaurantSellerId: ad.restaurantSellerId || null,
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
          storeLogo: toPublicMediaUrl(ad.seller.store?.logo || ad.seller.user?.image || null, origin),
          avatar: toPublicMediaUrl(ad.seller.store?.logo || ad.seller.user?.image || null, origin),
        }
        : ad.hotelSeller
          ? {
            type: "HOTEL_SELLER" as const,
            id: ad.hotelSeller.id,
            userId: ad.hotelSeller.userId,
            name: ad.hotelSeller.user?.name || null,
            email: ad.hotelSeller.user?.email || null,
            phone: ad.hotelSeller.user?.phone || null,
            storeName: ad.hotelSeller.businessInfo?.businessName || null,
            storeLogo: toPublicMediaUrl(ad.hotelSeller.logo || ad.hotelSeller.user?.image || null, origin),
            avatar: toPublicMediaUrl(ad.hotelSeller.logo || ad.hotelSeller.user?.image || null, origin),
          }
          : ad.restaurantSeller
            ? {
              type: "RESTAURANT_SELLER" as const,
              id: ad.restaurantSeller.id,
              userId: ad.restaurantSeller.userId,
              name: ad.restaurantSeller.user?.name || null,
              email: ad.restaurantSeller.user?.email || null,
              phone: ad.restaurantSeller.user?.phone || null,
              storeName: ad.restaurantSeller.businessInfo?.businessName || null,
              storeLogo: toPublicMediaUrl(ad.restaurantSeller.logo || ad.restaurantSeller.user?.image || null, origin),
              avatar: toPublicMediaUrl(ad.restaurantSeller.logo || ad.restaurantSeller.user?.image || null, origin),
            }
            : ad.customer
              ? {
                type: "CUSTOMER" as const,
                id: ad.customer.id,
                name: ad.customer.name || null,
                email: ad.customer.email || null,
                phone: ad.customer.phone || null,
                avatar: toPublicMediaUrl(ad.customer.image || null, origin),
              }
              : null,
      // Target details - only include if linked entity exists
      target: ad.product ? {
        type: "PRODUCT" as const,
        id: ad.product.id,
        name: ad.product.name,
        slug: ad.product.slug,
        description: ad.product.description,
        images: toPublicMediaUrlList(ad.product.images, origin),
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
        images: toPublicMediaUrlList(ad.service.images, origin),
        galleryImages: toPublicMediaUrlList(ad.service.galleryImages, origin),
        serviceType: ad.service.serviceType,
        basePrice: ad.service.basePrice,
        category: ad.service.serviceCategory?.name || null,
        packageCount: ad.service.packages?.length || 0
      } : ad.hotel && hotelMedia ? {
        type: "HOTEL" as const,
        id: ad.hotel.id,
        name: ad.hotel.name,
        description: ad.hotel.description,
        city: ad.hotel.city,
        address: ad.hotel.address,
        images: hotelMedia.images,
        banner: hotelMedia.banner,
        logo: hotelMedia.logo,
        coverImage: hotelMedia.coverImage,
      } : ad.foodItem ? {
        type: "FOOD" as const,
        id: ad.foodItem.id,
        name: ad.foodItem.name,
        description: ad.foodItem.description,
        price: ad.foodItem.price,
        discount: ad.foodItem.discount,
        category: ad.foodItem.category,
        isVeg: ad.foodItem.isVeg,
        images: toPublicMediaUrlList(ad.foodItem.images, origin),
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