import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json([])
  }

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id },
    include: {
      category: true,
      variants: true,
      _count: {
        select: {
          orderItems: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  if (!seller.isApproved) return NextResponse.json({ error: "Your seller account is pending approval." }, { status: 403 })
  if (seller.isSuspended) return NextResponse.json({ error: "Your seller account has been suspended." }, { status: 403 })
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: `Product limit reached. Plan allows ${limitCheck.limit}. Upgrade to add more.`,
    }, { status: 403 })
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
  if (!name || !categoryId) return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
  const basePrice = Number(body.basePrice ?? 0)
  const stock = Number(body.stock ?? 0)
  if (isNaN(basePrice) || basePrice <= 0) return NextResponse.json({ error: "Valid base price required" }, { status: 400 })
  if (isNaN(stock) || stock < 0) return NextResponse.json({ error: "Valid stock required" }, { status: 400 })
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const discount = Math.round(Number(body.discount ?? 0) * 100) / 100
  const imagesData = Array.isArray(body.images) ? body.images : []
  try {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        name,
        slug,
        description: (body.description as string) ?? null,
        basePrice,
        discount,
        hasGst: body.hasGst !== false,
        stock,
        sku: (body.sku as string) ?? null,
        images: imagesData as object,
      },
    })
    return NextResponse.json(product)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code === "P2002") return NextResponse.json({ error: "Product with this name already exists" }, { status: 400 })
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
