import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type WishlistItemApi = {
  wishlistItemId: string
  productId: string
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    image: string | null
    price: number | null
  }
}

function toFirstImage(raw: unknown): string | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const first = raw.find((value) => typeof value === "string" && value.trim())
    return typeof first === "string" ? first : null
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const first = parsed.find((value) => typeof value === "string" && value.trim())
        return typeof first === "string" ? first : null
      }
      return raw.trim() || null
    } catch {
      return raw.trim() || null
    }
  }
  return null
}

function toItemApi(item: {
  id: string
  productId: string
  createdAt: Date
  product: { id: string; name: string; slug: string; images: unknown; variants: Array<{ price: number; discount: number }> }
}): WishlistItemApi {
  const firstVariant = item.product.variants[0]
  const price = firstVariant ? Math.max(0, firstVariant.price - (firstVariant.discount ?? 0)) : null
  return {
    wishlistItemId: item.id,
    productId: item.productId,
    createdAt: item.createdAt.toISOString(),
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      image: toFirstImage(item.product.images),
      price,
    },
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden: only customers can use wishlist" }, { status: 403 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  if (session.user.role !== UserRole.CUSTOMER) return forbidden()

  const rows = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          variants: {
            select: { price: true, discount: true },
            orderBy: { price: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = rows.map(toItemApi)
  return NextResponse.json({ items, count: items.length })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  if (session.user.role !== UserRole.CUSTOMER) return forbidden()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const productId = typeof (body as { productId?: unknown })?.productId === "string"
    ? (body as { productId: string }).productId.trim()
    : ""
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_productId: {
        userId: session.user.id,
        productId,
      },
    },
  })

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } })
    const count = await prisma.wishlistItem.count({ where: { userId: session.user.id } })
    return NextResponse.json({ ok: true, action: "removed", item: null, count })
  }

  const created = await prisma.wishlistItem.create({
    data: { userId: session.user.id, productId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          variants: {
            select: { price: true, discount: true },
            orderBy: { price: "asc" },
            take: 1,
          },
        },
      },
    },
  })
  const count = await prisma.wishlistItem.count({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true, action: "added", item: toItemApi(created), count })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  if (session.user.role !== UserRole.CUSTOMER) return forbidden()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const productId = typeof (body as { productId?: unknown })?.productId === "string"
    ? (body as { productId: string }).productId.trim()
    : ""
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_productId: {
        userId: session.user.id,
        productId,
      },
    },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 })
  }

  await prisma.wishlistItem.delete({ where: { id: existing.id } })
  const count = await prisma.wishlistItem.count({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true, action: "removed", item: null, count })
}

