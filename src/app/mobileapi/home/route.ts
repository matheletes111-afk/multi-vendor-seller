import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { JsonValue } from "@prisma/client/runtime/library"
import { getServiceDisplayImageUrls } from "@/lib/service-images"

// Define types for the response data
interface Banner {
  id: string
  bannerHeading: string | null
  bannerDescription: string | null
  bannerImage: string | null
  categoryId: string | null
  subcategoryId: string | null
}

interface Subcategory {
  id: string
  name: string
  slug: string
  image: string | null
}

interface Category {
  id: string
  name: string
  slug: string
  mobileIcon: string | null
  image: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  subcategories: Subcategory[]
}

interface Ad {
  id: string
  title: string
  creativeType: string
  creativeUrl: string | null
  productId: string | null
  serviceId: string | null
}

interface ServiceCategoryItem {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  mobileIcon: string | null
  commissionRate: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  servicesCount: number
}

interface Service {
  id: string
  name: string
  slug: string
  description: string | null
  serviceType: string
  basePrice: number | null
  discount: number
  hasGst: boolean
  images: JsonValue
  isActive: boolean
  isFeatured: boolean
  duration: number | null
  createdAt: Date
  updatedAt: Date
  // Temporarily remove category until database is updated
  _count: {
    orderItems: number
    reviews: number
  }
}

interface HomepageData {
  banners: Banner[]
  categories: Category[]
  featuredCategories: Category[]
  serviceCategories: ServiceCategoryItem[]
  ads: Ad[]
  services: Service[]
}

interface SuccessResponse {
  success: true
  message: string
  data: HomepageData
}

interface ErrorResponse {
  success: false
  error: string
}

export async function GET(): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Fetch banners in parallel
    const bannersPromise = prisma.banner.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bannerHeading: true,
        bannerDescription: true,
        bannerImage: true,
        categoryId: true,
        subcategoryId: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Fetch categories with subcategories (only 10)
    const categoriesPromise = prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
          take: 5,
        }
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    })

    // Fetch featured categories (isFeatured=true, max 4) with full fields and subcategories
    const featuredCategoriesPromise = prisma.category.findMany({
      where: {
        isActive: true,
        ...({ isFeatured: true } as unknown as Record<string, unknown>),
      },
      include: {
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    } as unknown as Parameters<typeof prisma.category.findMany>[0])

    // Fetch service categories with full data (active only)
    const serviceCategoriesPromise = prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        commissionRate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { services: true } },
      },
      orderBy: { name: "asc" },
    })

    const now = new Date()
    
    // Fetch active ads
    const adsPromise = prisma.sellerAd.findMany({
      where: { 
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gte: now },
        // @ts-ignore
        placements: { has: "MOBILE" }
      },
      select: {
        id: true,
        title: true,
        creativeType: true,
        creativeUrl: true,
        productId: true,
        serviceId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    // Fetch services with related data (only 10) - WITHOUT category relation
    const servicesPromise = prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        serviceType: true,
        basePrice: true,
        discount: true,
        hasGst: true,
        images: true,
        galleryImages: true,
        isActive: true,
        isFeatured: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    // Execute all promises in parallel
    const [banners, categories, featuredCategoriesRaw, serviceCategoriesRaw, ads, services] = await Promise.all([
      bannersPromise,
      categoriesPromise,
      featuredCategoriesPromise,
      serviceCategoriesPromise,
      adsPromise,
      servicesPromise,
    ])

    // Transform featured categories to full Category shape (same as categories)
    const featuredCategories: Category[] = (featuredCategoriesRaw as any[]).map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      mobileIcon: cat.mobileIcon ?? null,
      image: cat.image,
      description: cat.description,
      isActive: cat.isActive ?? true,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      subcategories: (cat.subcategories ?? []).map((sub: { id: string; name: string; slug: string; image: string | null }) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        image: sub.image,
      })),
    }))

    // Transform categories to match the Category interface
    const transformedCategories: Category[] = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image: cat.image,
      mobileIcon: cat.mobileIcon,
      description: cat.description,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      subcategories: cat.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        image: sub.image,
      }))
    }))

    const transformedServices: Service[] = services.map((service) => ({
      ...service,
      images: getServiceDisplayImageUrls({
        images: service.images,
        galleryImages: service.galleryImages,
      }) as unknown as JsonValue,
    }))

    // Transform service categories to full ServiceCategoryItem shape
    const serviceCategories: ServiceCategoryItem[] = serviceCategoriesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      mobileIcon: c.mobileIcon,
      commissionRate: c.commissionRate,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      servicesCount: c._count.services,
    }))

    // Compile homepage data
    const homepageData: HomepageData = {
      banners,
      categories: transformedCategories,
      featuredCategories,
      serviceCategories,
      ads,
      services: transformedServices,
    }

    return NextResponse.json<SuccessResponse>(
      {
        success: true,
        message: "Homepage data fetched successfully",
        data: homepageData,
      },
      { status: 200 }
    )

  } catch (error) {
    // Log error for debugging
    console.error("Mobile homepage API error:", error)

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("prisma")) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Database error occurred while fetching homepage data",
          },
          { status: 500 }
        )
      }
    }

    // Generic error response
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}

// Optional: Add revalidation for ISR or caching
export const revalidate = 60 // Revalidate every 60 seconds