import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

export async function GET(
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
    include: { category: true, variants: true },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function PUT(
  request: NextRequest,
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

  const existing = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({})) as {
    name?: string
    description?: string
    categoryId?: string
    basePrice?: number
    discount?: number
    hasGst?: boolean
    stock?: number
    sku?: string
    images?: string[]
    isActive?: boolean
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.description !== undefined) updateData.description = body.description
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId
  if (typeof body.basePrice === "number") updateData.basePrice = body.basePrice
  if (typeof body.discount === "number") updateData.discount = Math.round(body.discount * 100) / 100
  if (typeof body.hasGst === "boolean") updateData.hasGst = body.hasGst
  if (typeof body.stock === "number") updateData.stock = body.stock
  if (body.sku !== undefined) updateData.sku = body.sku
  if (body.images !== undefined) updateData.images = Array.isArray(body.images) ? body.images : existing.images
  if (typeof body.isActive === "boolean") updateData.isActive = body.isActive

  if (body.name) {
    (updateData as { slug?: string }).slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: updateData as never,
    })
    return NextResponse.json(product)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Failed to update: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
