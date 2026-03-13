import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// API uses request.url for searchParams — must be dynamic
export const dynamic = "force-dynamic"

// Define types for the response data
interface Subcategory {
  id: string
  name: string
  slug: string
  image: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  productsCount?: number
}

interface Category {
  id: string
  name: string
  slug: string
  mobileIcon: string | null  // Add this line
  image: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  subcategories: Subcategory[]
  productsCount?: number
  subcategoriesCount?: number
}

interface CategoriesData {
  categories: Category[]
  totalCategories: number
  totalSubcategories: number
}

interface SuccessResponse {
  success: true
  message: string
  data: CategoriesData
}

interface ErrorResponse {
  success: false
  error: string
}

export async function GET(request: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Get URL parameters
    const { searchParams } = new URL(request.url)
    const includeCounts = searchParams.get('includeCounts') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true

    // Build where clause
    const whereClause = activeOnly ? { isActive: true } : {}

    // Fetch all categories with their subcategories
    const categories = await prisma.category.findMany({
      where: whereClause,
      include: {
        subcategories: {
          where: activeOnly ? { isActive: true } : {},
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            ...(includeCounts && {
              _count: {
                select: {
                  products: true, // Only products exist for subcategories
                }
              }
            })
          },
        },
        ...(includeCounts && {
          _count: {
            select: {
              products: true,
              subcategories: true,
            }
          }
        })
      },
      orderBy: { name: "asc" },
      ...(limit && { take: limit }),
    })

    // Transform the data to include counts if requested
    const transformedCategories: Category[] = categories.map(cat => {
      const category: Category = {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        mobileIcon: cat.mobileIcon,
        image: cat.image,
        description: cat.description,
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        subcategories: cat.subcategories.map(sub => {
          const subcategory: Subcategory = {
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            image: sub.image,
            description: sub.description,
            isActive: sub.isActive,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
          }
          
          // Add products count if requested
          if (includeCounts && '_count' in sub) {
            subcategory.productsCount = (sub as any)._count?.products || 0
          }
          
          return subcategory
        }),
      }

      // Add category counts if requested
      if (includeCounts && '_count' in cat) {
        category.productsCount = (cat as any)._count?.products || 0
        category.subcategoriesCount = (cat as any)._count?.subcategories || 0
      }

      return category
    })

    // Calculate totals
    const totalCategories = await prisma.category.count({
      where: whereClause
    })

    const totalSubcategories = await prisma.subcategory.count({
      where: activeOnly ? { isActive: true } : {}
    })

    const responseData: CategoriesData = {
      categories: transformedCategories,
      totalCategories,
      totalSubcategories,
    }

    return NextResponse.json<SuccessResponse>(
      {
        success: true,
        message: "Categories fetched successfully",
        data: responseData,
      },
      { status: 200 }
    )

  } catch (error) {
    // Log error for debugging
    console.error("Mobile categories API error:", error)

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("prisma")) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: "Database error occurred while fetching categories",
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
export const revalidate = 300 // Revalidate every 5 minutes