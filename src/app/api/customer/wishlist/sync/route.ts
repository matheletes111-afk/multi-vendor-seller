import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toItemApi, wishlistInclude } from "../route"

const wishlistItem = prisma.wishlistItem as any

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden: only customers can use wishlist" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
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
        userId: session.user.id,
        ...(productId ? { productId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(hotelId ? { hotelId } : {}),
        ...(foodItemId ? { foodItemId } : {}),
      },
    })

    if (existing) continue

    // Validate entity exists
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
        userId: session.user.id,
        productId: productId ?? null,
        serviceId: serviceId ?? null,
        hotelId: hotelId ?? null,
        foodItemId: foodItemId ?? null,
      },
    }).catch(() => {})
  }

  const rows = await wishlistItem.findMany({
    where: { userId: session.user.id },
    include: wishlistInclude,
    orderBy: { createdAt: "desc" },
  })

  const validRows = rows.filter(
    (r: any) =>
      (r.productId && r.product) ||
      (r.serviceId && r.service) ||
      (r.hotelId && r.hotel) ||
      (r.foodItemId && r.foodItem)
  )

  const mergedItems = validRows.map(toItemApi)
  return NextResponse.json({
    ok: true,
    message: "Wishlist synced successfully",
    items: mergedItems,
    count: mergedItems.length,
  })
}
