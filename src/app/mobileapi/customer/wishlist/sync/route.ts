import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { toMobileItemApi, mobileWishlistInclude } from "../route"

const wishlistItem = prisma.wishlistItem as any

export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized. Valid customer token required." },
    { status: 401 }
  )
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

  const items = Array.isArray((body as any)?.items) ? (body as any).items : []

  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId.trim() : null
    const serviceId = typeof item?.serviceId === "string" ? item.serviceId.trim() : null
    const hotelId = typeof item?.hotelId === "string" ? item.hotelId.trim() : null
    const foodItemId = typeof item?.foodItemId === "string" ? item.foodItemId.trim() : null

    if (!productId && !serviceId && !hotelId && !foodItemId) continue

    // Check if already in DB
    const existing = await wishlistItem.findFirst({
      where: {
        userId: auth.userId,
        ...(productId ? { productId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(hotelId ? { hotelId } : {}),
        ...(foodItemId ? { foodItemId } : {}),
      },
    })

    if (existing) continue

    // Validate active entity exists
    if (productId) {
      const p = await prisma.product.findFirst({ where: { id: productId, isActive: true, isDeleted: false }, select: { id: true } })
      if (!p) continue
    } else if (serviceId) {
      const s = await prisma.service.findFirst({ where: { id: serviceId, isActive: true, isDeleted: false }, select: { id: true } })
      if (!s) continue
    } else if (hotelId) {
      const h = await prisma.hotel.findFirst({ where: { id: hotelId, isActive: true, isDeleted: false }, select: { id: true } })
      if (!h) continue
    } else if (foodItemId) {
      const f = await prisma.foodItem.findFirst({ where: { id: foodItemId, isActive: true, isDeleted: false }, select: { id: true } })
      if (!f) continue
    }

    await wishlistItem.create({
      data: {
        userId: auth.userId,
        productId: productId ?? null,
        serviceId: serviceId ?? null,
        hotelId: hotelId ?? null,
        foodItemId: foodItemId ?? null,
      },
    }).catch(() => {})
  }

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

  const mergedItems = validRows.map(toMobileItemApi)
  return NextResponse.json({
    success: true,
    message: "Wishlist synced successfully",
    data: {
      items: mergedItems,
      count: mergedItems.length,
    },
  })
}
