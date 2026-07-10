import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { sanitizeInput } from "@/lib/html-sanitization"

// GET a specific coupon
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 })
    }

    return NextResponse.json({ coupon })
  } catch (error: any) {
    console.error("Error fetching coupon details:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch coupon details" },
      { status: 500 }
    )
  }
}

// PUT update a coupon
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const discountType = sanitizeInput(body.discountType || "PERCENTAGE")
    const discountValue = parseFloat(body.discountValue)
    const type = sanitizeInput(body.type || "PRODUCT")
    const categoryId = body.categoryId ? sanitizeInput(body.categoryId).trim() : null
    const customerCount = body.customerCount ? parseInt(body.customerCount) : null
    const maxUsesPerCustomer = body.maxUsesPerCustomer ? parseInt(body.maxUsesPerCustomer) : 1
    const minOrderValue = body.minOrderValue ? parseFloat(body.minOrderValue) : 0
    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true

    if (isNaN(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: "Discount value must be a positive number" }, { status: 400 })
    }
    if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
      return NextResponse.json({ error: "Invalid discount type" }, { status: 400 })
    }
    if (!["PRODUCT", "SERVICE", "HOTEL", "FOOD"].includes(type)) {
      return NextResponse.json({ error: "Invalid coupon type" }, { status: 400 })
    }
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date" }, { status: 400 })
    }
    if (startDate >= endDate) {
      return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })
    }

    // Check if coupon exists
    const existing = await prisma.coupon.findUnique({
      where: { id }
    })
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 })
    }

    // Code editing is typically disabled, or we can allow updating other fields. We do not update 'code' here.
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        discountType,
        discountValue,
        type,
        categoryId,
        customerCount,
        maxUsesPerCustomer,
        minOrderValue,
        startDate,
        endDate,
        isActive
      }
    })

    return NextResponse.json({ message: "Coupon updated successfully", coupon })
  } catch (error: any) {
    console.error("Error updating coupon:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update coupon" },
      { status: 500 }
    )
  }
}

// DELETE a coupon
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await prisma.coupon.findUnique({
      where: { id }
    })
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 })
    }

    await prisma.coupon.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Coupon deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting coupon:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete coupon" },
      { status: 500 }
    )
  }
}
