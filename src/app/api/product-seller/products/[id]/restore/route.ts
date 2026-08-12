import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  if (!product.isDeleted) {
    return NextResponse.json({ error: "Product is not deleted" }, { status: 400 })
  }

  // Verify product limit before restoring
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Product limit reached. Your plan allows ${limitCheck.limit ?? 0} active products. Upgrade your plan to restore more products.`,
      },
      { status: 403 }
    )
  }

  const restored = await prisma.product.update({
    where: { id },
    data: {
      isDeleted: false,
      isActive: true,
    },
    include: {
      category: true,
      subcategory: true,
      variants: true,
    },
  })

  return NextResponse.json({ success: true, product: restored })
}
