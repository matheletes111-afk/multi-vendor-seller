import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

/** Prisma delegate after `npx prisma generate` (UserCategoryInterest). */
const p = prisma as any

// Types
interface PriceRange {
  min: number | null
  max: number | null
}

interface CategoryInfo {
  id: string
  name: string
  slug: string
}

interface SellerInfo {
  id: string
  storeName: string | null
  storeLogo: string | null
}

interface ProductResponse {
  id: string
  name: string
  slug: string
  description: string | null
  images: unknown
  priceRange: PriceRange
  lowestPrice: number | null
  category: CategoryInfo
  subcategory: CategoryInfo | null
  seller: SellerInfo
  rating: number | null
  reviewCount: number
  isActive: boolean
  isFeatured: boolean
  /** ISO string in JSON responses */
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface InterestProductsResponse {
  success: boolean
  data?: ProductResponse[]
  pagination?: PaginationInfo
  meta?: {
    hasInterests: boolean
    interestedCategories?: CategoryInfo[]
    productCount: number
  }
  error?: string
}

// Helper function to format product response with proper typing
function formatProductResponse(product: any): ProductResponse {
  // Safely extract variant prices
  const variants = product.variants || []
  const prices = variants
    .map((v: any) => v.price)
    .filter((p: number) => typeof p === 'number' && !isNaN(p))
  
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null
  const highestPrice = prices.length > 0 ? Math.max(...prices) : null

  // Calculate average rating
  const reviews = product.reviews || []
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
    : null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || null,
    images: product.images || [],
    priceRange: {
      min: lowestPrice,
      max: highestPrice !== lowestPrice ? highestPrice : null
    },
    lowestPrice: lowestPrice,
    category: {
      id: product.category?.id || '',
      name: product.category?.name || '',
      slug: product.category?.slug || ''
    },
    subcategory: product.subcategory ? {
      id: product.subcategory.id,
      name: product.subcategory.name,
      slug: product.subcategory.slug
    } : null,
    seller: {
      id: product.seller?.id || '',
      storeName: product.seller?.store?.name || null,
      storeLogo: product.seller?.store?.logo || null
    },
    rating: avgRating,
    reviewCount: reviews.length,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    createdAt:
      product.createdAt instanceof Date ? product.createdAt.toISOString() : String(product.createdAt ?? ""),
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<InterestProductsResponse>> {
  try {
    // Authenticate user
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      )
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")))
    const skip = (page - 1) * limit

    // Get user's category interests
    const userInterests = await p.userCategoryInterest.findMany({
      where: { userId: auth.userId },
      select: { categoryId: true },
    })

    const interestCategoryIds = userInterests.map((i: { categoryId: string }) => i.categoryId)

    // If no interests, return empty response
    if (interestCategoryIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        meta: {
          hasInterests: false,
          productCount: 0
        }
      })
    }

    // Fetch products from user's interested categories with proper type includes
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        categoryId: { in: interestCategoryIds }
      },
      include: {
        seller: {
          select: {
            id: true,
            store: { select: { name: true, logo: true } },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        variants: {
          select: {
            price: true
          },
          orderBy: {
            price: 'asc'
          }
        },
        reviews: {
          select: {
            rating: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    })

    // Get total count for pagination
    const total = await prisma.product.count({
      where: {
        isActive: true,
        isDeleted: false,
        categoryId: { in: interestCategoryIds }
      }
    })

    // Format products with proper typing
    const formattedProducts: ProductResponse[] = products.map(product => formatProductResponse(product))

    // Get category details for meta info
    const categories = await prisma.category.findMany({
      where: {
        id: { in: interestCategoryIds }
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      meta: {
        hasInterests: true,
        interestedCategories: categories,
        productCount: total
      }
    })

  } catch (error) {
    console.error("Error fetching interest-based products:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}