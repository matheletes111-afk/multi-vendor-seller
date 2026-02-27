import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET single product by id. Public (no auth) for product detail page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      seller: { include: { store: true } },
      _count: { select: { reviews: true } },
    },
  })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json(product)
}
