import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Define types
interface ProductVariant {
  price: number
  discount: number | null
}

interface Product {
  id: string
  name: string
  slug: string
  images: any
  isFeatured: boolean
  createdAt: Date
  category: {
    id: string
    name: string
    slug: string
  } | null
  seller: {
    store: {
      name: string
    } | null
  } | null
  variants: ProductVariant[]
  minPrice?: number
  maxPrice?: number
  discount?: number | null
}

interface SuccessResponse {
  success: true
  message: string
  data: any
}

interface ErrorResponse {
  success: false
  error: string
}

export async function GET(request: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    const includeSubcategoryProducts = searchParams.get('includeSubcategoryProducts') === 'true'

    console.log("Received request with ID:", id) // Debug log

    // If no ID is provided, return all categories (list view)
    if (!id) {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          description: true,
          _count: {
            select: {
              products: true,
              subcategories: true
            }
          }
        },
        orderBy: { name: "asc" }
      })

      return NextResponse.json({
        success: true,
        message: "Categories fetched successfully",
        data: {
          categories: categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            image: cat.image,
            description: cat.description,
            productsCount: cat._count.products,
            subcategoriesCount: cat._count.subcategories
          })),
          total: categories.length
        }
      })
    }

    // Get single category with ID
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!category) {
      return NextResponse.json({
        success: false,
        error: `Category not found with ID: ${id}`
      }, { status: 404 })
    }

    // Get subcategories
    const subcategories = await prisma.subcategory.findMany({
      where: { 
        categoryId: id,
        isActive: true 
      },
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
        _count: {
          select: {
            products: true,
          }
        }
      }
    })

    // Get products
    const products = await prisma.product.findMany({
      where: { 
        categoryId: id,
        isActive: true 
      },
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        isFeatured: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        seller: {
          select: {
            store: {
              select: {
                name: true,
              }
            }
          }
        },
        variants: {
          orderBy: { price: "asc" },
          select: {
            price: true,
            discount: true,
          }
        },
      },
    })

    // Get total products count
    const productsCount = await prisma.product.count({
      where: { 
        categoryId: id,
        isActive: true 
      }
    })

    // Transform products to include min/max price
    const transformedProducts: Product[] = products.map(product => {
      const prices = product.variants.map(v => v.price)
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
      
      const discounts = product.variants
        .filter(v => v.discount)
        .map(v => v.discount)
      const bestDiscount = discounts.length > 0 ? Math.max(...discounts as number[]) : null

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        images: product.images,
        isFeatured: product.isFeatured,
        createdAt: product.createdAt,
        category: product.category,
        seller: product.seller,
        variants: product.variants.slice(0, 1),
        minPrice,
        maxPrice,
        discount: bestDiscount,
      }
    })

    // Transform subcategories
    const transformedSubcategories = subcategories.map(sub => ({
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      image: sub.image,
      description: sub.description,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      productsCount: sub._count.products,
    }))

    // Return category details
    return NextResponse.json({
      success: true,
      message: "Category details fetched successfully",
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        image: category.image,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        subcategories: transformedSubcategories,
        products: transformedProducts,
        productsCount,
        subcategoriesCount: subcategories.length,
      }
    })

  } catch (error) {
    console.error("Categories API error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}