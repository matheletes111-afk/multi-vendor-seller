import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Stale Prisma client types: run `npx prisma generate` after WishlistItem gained `serviceId` / `service`. */
const wishlistItem = prisma.wishlistItem as any

export const dynamic = "force-dynamic"

type WishlistItemApi = {
  wishlistItemId: string
  productId: string | null
  serviceId: string | null
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    image: string | null
    price: number | null
  } | null
  service: {
    id: string
    name: string
    slug: string
    image: string | null
    price: number | null
  } | null
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
  productId: string | null
  serviceId: string | null
  createdAt: Date
  product: {
    id: string
    name: string
    slug: string
    images: unknown
    variants: Array<{ price: number; discount: number }>
  } | null
  service: {
    id: string
    name: string
    slug: string
    images: unknown
    basePrice: number | null
    discount: number
  } | null
}): WishlistItemApi {
  const productPrice = item.product?.variants[0]
    ? Math.max(0, item.product.variants[0].price - (item.product.variants[0].discount ?? 0))
    : null
  const servicePrice = item.service?.basePrice != null
    ? Math.max(0, item.service.basePrice - (item.service.discount ?? 0))
    : null

  return {
    wishlistItemId: item.id,
    productId: item.productId,
    serviceId: item.serviceId,
    createdAt: item.createdAt.toISOString(),
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          image: toFirstImage(item.product.images),
          price: productPrice,
        }
      : null,
    service: item.service
      ? {
          id: item.service.id,
          name: item.service.name,
          slug: item.service.slug,
          image: toFirstImage(item.service.images),
          price: servicePrice,
        }
      : null,
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

  const rows = await wishlistItem.findMany({
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
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          basePrice: true,
          discount: true,
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
    : null
  const serviceId = typeof (body as { serviceId?: unknown })?.serviceId === "string"
    ? (body as { serviceId: string }).serviceId.trim()
    : null

  if (!productId && !serviceId) {
    return NextResponse.json({ error: "productId or serviceId is required" }, { status: 400 })
  }
  if (productId && serviceId) {
    return NextResponse.json({ error: "Cannot add both productId and serviceId" }, { status: 400 })
  }

  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
  } else if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }
  }

  const existing = await wishlistItem.findFirst({
    where: {
      userId: session.user.id,
      ...(productId ? { productId, serviceId: null } : { serviceId: serviceId!, productId: null }),
    },
  })

  if (existing) {
    await wishlistItem.delete({ where: { id: existing.id } })
    const count = await wishlistItem.count({ where: { userId: session.user.id } })
    return NextResponse.json({ ok: true, action: "removed" as const, item: null, count })
  }

  const created = await wishlistItem.create({
    data: {
      userId: session.user.id,
      productId: productId ?? null,
      serviceId: serviceId ?? null,
    },
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
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          basePrice: true,
          discount: true,
        },
      },
    },
  })
  const count = await wishlistItem.count({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true, action: "added" as const, item: toItemApi(created), count })
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
    : null
  const serviceId = typeof (body as { serviceId?: unknown })?.serviceId === "string"
    ? (body as { serviceId: string }).serviceId.trim()
    : null

  if (!productId && !serviceId) {
    return NextResponse.json({ error: "productId or serviceId is required" }, { status: 400 })
  }
  if (productId && serviceId) {
    return NextResponse.json({ error: "Cannot send both productId and serviceId" }, { status: 400 })
  }

  const existing = await wishlistItem.findFirst({
    where: {
      userId: session.user.id,
      ...(productId ? { productId, serviceId: null } : { serviceId: serviceId!, productId: null }),
    },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 })
  }

  await wishlistItem.delete({ where: { id: existing.id } })
  const count = await wishlistItem.count({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true, action: "removed" as const, item: null, count })
}
