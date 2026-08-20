import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

const wishlistItem = prisma.wishlistItem as any

export const dynamic = "force-dynamic"

export type MobileWishlistItemApi = {
  wishlistItemId: string
  productId: string | null
  serviceId: string | null
  hotelId: string | null
  foodItemId: string | null
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
  hotel: {
    id: string
    name: string
    slug: string
    image: string | null
    price: number | null
    city: string | null
    starRating: number
  } | null
  foodItem: {
    id: string
    name: string
    image: string | null
    price: number | null
    isVeg: boolean
    category?: string
    restaurantName?: string
  } | null
}

export function toFirstImage(raw: unknown): string | null {
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

export function toMobileItemApi(item: {
  id: string
  productId: string | null
  serviceId: string | null
  hotelId: string | null
  foodItemId: string | null
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
  hotel?: {
    id: string
    name: string
    images: unknown
    logo: string | null
    banner: string | null
    city: string | null
    starRating: number
    rooms: Array<{ price: number }>
  } | null
  foodItem?: {
    id: string
    name: string
    images: unknown
    price: number
    isVeg: boolean
    category: string
    restaurantSeller?: {
      businessInfo?: { businessName: string | null } | null
      user?: { name: string | null } | null
    } | null
  } | null
}): MobileWishlistItemApi {
  const productPrice = item.product?.variants?.[0]
    ? Math.max(0, item.product.variants[0].price - (item.product.variants[0].discount ?? 0))
    : null
  const servicePrice = item.service?.basePrice != null
    ? Math.max(0, item.service.basePrice - (item.service.discount ?? 0))
    : null

  let hotelPrice: number | null = null
  if (item.hotel?.rooms && item.hotel.rooms.length > 0) {
    const validPrices = item.hotel.rooms.map((r) => r.price).filter((p) => typeof p === "number" && !isNaN(p))
    if (validPrices.length > 0) {
      hotelPrice = Math.min(...validPrices)
    }
  }

  const hotelImage = item.hotel ? (toFirstImage(item.hotel.images) || item.hotel.logo || item.hotel.banner) : null
  const foodImage = item.foodItem ? toFirstImage(item.foodItem.images) : null
  const restaurantName = item.foodItem?.restaurantSeller?.businessInfo?.businessName || item.foodItem?.restaurantSeller?.user?.name || undefined

  return {
    wishlistItemId: item.id,
    productId: item.productId,
    serviceId: item.serviceId,
    hotelId: item.hotelId,
    foodItemId: item.foodItemId,
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
    hotel: item.hotel
      ? {
          id: item.hotel.id,
          name: item.hotel.name,
          slug: item.hotel.id,
          image: hotelImage,
          price: hotelPrice,
          city: item.hotel.city,
          starRating: item.hotel.starRating || 0,
        }
      : null,
    foodItem: item.foodItem
      ? {
          id: item.foodItem.id,
          name: item.foodItem.name,
          image: foodImage,
          price: item.foodItem.price,
          isVeg: item.foodItem.isVeg,
          category: item.foodItem.category,
          restaurantName,
        }
      : null,
  }
}

export const mobileWishlistInclude = {
  product: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      variants: {
        select: { price: true, discount: true },
        orderBy: { price: "asc" as const },
        take: 1,
      },
    },
  },
  service: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      basePrice: true,
      discount: true,
    },
  },
  hotel: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      images: true,
      logo: true,
      banner: true,
      city: true,
      starRating: true,
      rooms: {
        where: { isDeleted: false, isActive: true },
        select: { price: true },
        orderBy: { price: "asc" as const },
      },
    },
  },
  foodItem: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      images: true,
      price: true,
      isVeg: true,
      category: true,
      restaurantSeller: {
        select: {
          businessInfo: { select: { businessName: true } },
          user: { select: { name: true } },
        },
      },
    },
  },
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized. Valid customer token required." },
    { status: 401 }
  )
}

export async function GET(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const rows = await wishlistItem.findMany({
    where: { userId: auth.userId },
    include: mobileWishlistInclude,
    orderBy: { createdAt: "desc" },
  })
  const validRows = rows.filter(
    (r: any) =>
      (r.productId && r.product) ||
      (r.serviceId && r.service) ||
      (r.hotelId && r.hotel) ||
      (r.foodItemId && r.foodItem)
  )
  const items = validRows.map(toMobileItemApi)

  return NextResponse.json({
    success: true,
    message: "Wishlist fetched",
    data: { items, count: items.length },
  })
}

export async function POST(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const productId = typeof (body as any)?.productId === "string" ? (body as any).productId.trim() : null
  const serviceId = typeof (body as any)?.serviceId === "string" ? (body as any).serviceId.trim() : null
  const hotelId = typeof (body as any)?.hotelId === "string" ? (body as any).hotelId.trim() : null
  const foodItemId = typeof (body as any)?.foodItemId === "string" ? (body as any).foodItemId.trim() : null

  const targetCount = [productId, serviceId, hotelId, foodItemId].filter(Boolean).length
  if (targetCount === 0) {
    return NextResponse.json(
      { success: false, error: "productId, serviceId, hotelId, or foodItemId is required" },
      { status: 400 }
    )
  }
  if (targetCount > 1) {
    return NextResponse.json(
      { success: false, error: "Cannot specify multiple target IDs in one request" },
      { status: 400 }
    )
  }

  // Validate active & non-deleted entity
  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
  } else if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
  } else if (hotelId) {
    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!hotel) return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
  } else if (foodItemId) {
    const food = await prisma.foodItem.findFirst({
      where: { id: foodItemId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!food) return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
  }

  const existing = await wishlistItem.findFirst({
    where: {
      userId: auth.userId,
      ...(productId ? { productId } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(hotelId ? { hotelId } : {}),
      ...(foodItemId ? { foodItemId } : {}),
    },
  })

  if (existing) {
    await wishlistItem.delete({ where: { id: existing.id } })
    const count = await wishlistItem.count({ where: { userId: auth.userId } })
    return NextResponse.json({
      success: true,
      message: "Wishlist updated",
      data: { action: "removed", item: null, count },
    })
  }

  const created = await wishlistItem.create({
    data: {
      userId: auth.userId,
      productId: productId ?? null,
      serviceId: serviceId ?? null,
      hotelId: hotelId ?? null,
      foodItemId: foodItemId ?? null,
    },
    include: mobileWishlistInclude,
  })
  const count = await wishlistItem.count({ where: { userId: auth.userId } })
  return NextResponse.json({
    success: true,
    message: "Wishlist updated",
    data: { action: "added", item: toMobileItemApi(created), count },
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const productId = typeof (body as any)?.productId === "string" ? (body as any).productId.trim() : null
  const serviceId = typeof (body as any)?.serviceId === "string" ? (body as any).serviceId.trim() : null
  const hotelId = typeof (body as any)?.hotelId === "string" ? (body as any).hotelId.trim() : null
  const foodItemId = typeof (body as any)?.foodItemId === "string" ? (body as any).foodItemId.trim() : null

  const targetCount = [productId, serviceId, hotelId, foodItemId].filter(Boolean).length
  if (targetCount === 0) {
    return NextResponse.json(
      { success: false, error: "productId, serviceId, hotelId, or foodItemId is required" },
      { status: 400 }
    )
  }

  const existing = await wishlistItem.findFirst({
    where: {
      userId: auth.userId,
      ...(productId ? { productId } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(hotelId ? { hotelId } : {}),
      ...(foodItemId ? { foodItemId } : {}),
    },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ success: false, error: "Wishlist item not found" }, { status: 404 })
  }

  await wishlistItem.delete({ where: { id: existing.id } })
  const count = await wishlistItem.count({ where: { userId: auth.userId } })
  return NextResponse.json({
    success: true,
    message: "Wishlist updated",
    data: { action: "removed", item: null, count },
  })
}
