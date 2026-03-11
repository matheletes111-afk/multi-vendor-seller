import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Product ID is required"
      }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { 
        id, 
        isActive: true 
      },
      include: {
        category: true,
        seller: { 
          include: { 
            store: true 
          } 
        },
        variants: true,
        _count: { 
          select: { 
            reviews: true 
          } 
        },
      },
    })

    if (!product) {
      return NextResponse.json({
        success: false,
        error: "Product not found"
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: product
    })

  } catch (error) {
    console.error("Product API error:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 })
  }
}