import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  extractImageUrls,
  getServiceDisplayImageUrls,
  parseServiceImagesForSellerForm,
} from "@/lib/service-images"

export const dynamic = "force-dynamic"

type ServiceSellerPayload = {
  store: {
    name: string
    phone: string | null
    logo: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    country: string | null
  } | null
  account: {
    name: string | null
    email: string
    phone: string | null
    phoneCountryCode: string | null
    image: string | null
  }
}

type ServiceDetailData = {
  id: string
  name: string
  slug: string
  description: string | null
  serviceType: string
  basePrice: number | null
  discount: number
  hasGst: boolean
  displayPrice: number | null
  /** Combined display order: master first, then gallery (backward compatible with older clients). */
  images: string[]
  /** Master / cover image only (same as listing hero). */
  masterImage: string | null
  /** Additional gallery URLs only. */
  galleryImages: string[]
  duration: number | null
  isFeatured: boolean
  serviceCategory: { id: string; name: string; slug: string }
  seller: { store: { name: string } | null } | null
  serviceSeller: ServiceSellerPayload | null
  reviewCount: number
  averageRating: number
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    images: string[]
    createdAt: string
    isVerified: boolean
    reviewerName: string
  }>
  sellerAds?: any[]
}

type SuccessResponse = { success: true; message: string; data: { service: ServiceDetailData } }
type ErrorResponse = { success: false; error: string }

function mapServiceSeller(seller: {
  store: {
    name: string
    phone: string | null
    logo: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    country: string | null
  } | null
  user: {
    name: string | null
    email: string
    phone: string | null
    phoneCountryCode: string | null
    image: string | null
  }
}): ServiceSellerPayload {
  return {
    store: seller.store
      ? {
          name: seller.store.name,
          phone: seller.store.phone ?? null,
          logo: seller.store.logo ?? null,
          address: seller.store.address ?? null,
          city: seller.store.city ?? null,
          state: seller.store.state ?? null,
          zipCode: seller.store.zipCode ?? null,
          country: seller.store.country ?? null,
        }
      : null,
    account: {
      name: seller.user.name ?? null,
      email: seller.user.email,
      phone: seller.user.phone ?? null,
      phoneCountryCode: seller.user.phoneCountryCode ?? null,
      image: seller.user.image ?? null,
    },
  }
}

/** GET /mobileapi/services/[id] — full service detail (same data as web /service/[id]). Public. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id } = await params
    const [service, ratingAgg] = await Promise.all([
      prisma.service.findFirst({
        where: { id, isActive: true, isDeleted: false },
        include: {
          serviceCategory: true,
          seller: {
            include: {
              store: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  phoneCountryCode: true,
                  image: true,
                },
              },
            },
          },
          _count: { select: { reviews: true } },
          sellerAds: true,
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              rating: true,
              comment: true,
              images: true,
              createdAt: true,
              isVerified: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.review.aggregate({
        where: { serviceId: id },
        _avg: { rating: true },
      }),
    ])

    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
    }

    const reviews = service.reviews.map((review) => {
      const safeName = (review.user?.name || "").trim()
      const reviewerName = safeName ? safeName.split(/\s+/)[0] : "Verified buyer"
      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        images: extractImageUrls(review.images),
        createdAt: review.createdAt.toISOString(),
        isVerified: review.isVerified,
        reviewerName,
      }
    })

    const base = service.basePrice
    const displayPrice = base != null ? Math.max(0, base - (service.discount ?? 0)) : null

    const { masterUrl, galleryUrls } = parseServiceImagesForSellerForm({
      images: service.images,
      galleryImages: service.galleryImages,
    })
    const combinedImages = getServiceDisplayImageUrls({
      images: service.images,
      galleryImages: service.galleryImages,
    })

    const seller = service.seller
    const detail: ServiceDetailData = {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      serviceType: service.serviceType,
      basePrice: service.basePrice,
      discount: service.discount,
      hasGst: service.hasGst,
      displayPrice,
      images: combinedImages,
      masterImage: masterUrl,
      galleryImages: galleryUrls,
      duration: service.duration,
      isFeatured: service.isFeatured,
      serviceCategory: service.serviceCategory,
      seller: service.seller
        ? { store: service.seller.store ? { name: service.seller.store.name } : null }
        : null,
      serviceSeller: seller ? mapServiceSeller(seller) : null,
      reviewCount: service._count.reviews,
      averageRating: Number(ratingAgg._avg.rating ?? 0),
      reviews,
      sellerAds: (service as any).sellerAds,
    }

    return NextResponse.json({
      success: true,
      message: "Service fetched successfully",
      data: { service: detail },
    })
  } catch (error) {
    console.error("Mobile service detail API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
