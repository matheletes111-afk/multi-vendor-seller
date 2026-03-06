import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "../resolve"
import type { CartItemApi, CartMergePayload, GuestCartItemForMerge } from "../types"
import { UserRole } from "@prisma/client"

const cartItemInclude = {
  product: { select: { id: true, name: true, images: true } },
  productVariant: { select: { id: true, name: true, price: true, discount: true, hasGst: true, images: true } },
  service: { select: { id: true, name: true, basePrice: true, discount: true, hasGst: true, images: true } },
  servicePackage: { select: { id: true, name: true, price: true } },
} as const

type CartItemWithRelations = Awaited<
  ReturnType<typeof prisma.cartItem.findMany<{ include: typeof cartItemInclude }>>
>[number]

function toCartItemApi(row: CartItemWithRelations): CartItemApi {
  const name =
    row.product != null && row.productVariant != null
      ? `${row.product.name} (${row.productVariant.name})`
      : row.product != null
        ? row.product.name
        : row.service != null && row.servicePackage != null
          ? `${row.service.name} - ${row.servicePackage.name}`
          : row.service != null
            ? row.service.name
            : "Item"
  const images = (row.product?.images as string[] | null) ?? (row.service?.images as string[] | null) ?? []
  const variantImages = row.productVariant?.images as string[] | null | undefined
  const rawImage = (Array.isArray(variantImages) && variantImages[0]) ?? images[0]
  const image = typeof rawImage === "string" ? rawImage : null
  return {
    id: row.id,
    productId: row.productId,
    productVariantId: row.productVariantId,
    serviceId: row.serviceId,
    servicePackageId: row.servicePackageId,
    serviceSlotId: row.serviceSlotId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    totalPrice: row.totalPrice,
    hasGst: row.hasGst,
    totalGst: row.totalGst,
    totalPriceInclGst: row.totalPriceInclGst ?? row.totalPrice + row.totalGst,
    name,
    image,
  }
}

/** POST /api/customer/cart/merge — merge guest cart (localStorage) into DB for current user. Only CUSTOMER. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden: only customers can use cart" }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as CartMergePayload
  const items = Array.isArray(payload.items) ? payload.items : []
  const userId = session.user.id
  for (const item of items as GuestCartItemForMerge[]) {
    if (!item || typeof item.quantity !== "number" || item.quantity < 1) continue
    const hasProduct = typeof item.productId === "string"
    const hasService = typeof item.serviceId === "string"
    if (!hasProduct && !hasService) continue
    const resolved = await resolveCartLine(item, item.quantity)
    if (!resolved) continue
    if (hasProduct) {
      const productId = item.productId as string
      const productVariantId = item.productVariantId ?? null
      const existing = await prisma.cartItem.findFirst({
        where: { userId, productId, productVariantId, serviceId: null },
      })
      const data = {
        userId,
        productId,
        productVariantId,
        serviceId: null,
        servicePackageId: null,
        serviceSlotId: null,
        quantity: item.quantity,
        unitPrice: resolved.unitPrice,
        totalPrice: resolved.totalPrice,
        hasGst: resolved.hasGst,
        totalGst: resolved.totalGst,
        totalPriceInclGst: resolved.totalPriceInclGst,
      }
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: item.quantity, totalPrice: resolved.totalPrice, totalGst: resolved.totalGst, totalPriceInclGst: resolved.totalPriceInclGst },
        })
      } else {
        await prisma.cartItem.create({ data })
      }
    } else {
      const serviceId = item.serviceId as string
      const servicePackageId = item.servicePackageId ?? null
      const serviceSlotId = item.serviceSlotId ?? null
      const existing = await prisma.cartItem.findFirst({
        where: { userId, serviceId, productId: null, productVariantId: null, servicePackageId, serviceSlotId },
      })
      const data = {
        userId,
        productId: null,
        productVariantId: null,
        serviceId,
        servicePackageId,
        serviceSlotId,
        quantity: item.quantity,
        unitPrice: resolved.unitPrice,
        totalPrice: resolved.totalPrice,
        hasGst: resolved.hasGst,
        totalGst: resolved.totalGst,
        totalPriceInclGst: resolved.totalPriceInclGst,
      }
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: item.quantity, totalPrice: resolved.totalPrice, totalGst: resolved.totalGst, totalPriceInclGst: resolved.totalPriceInclGst },
        })
      } else {
        await prisma.cartItem.create({ data })
      }
    }
  }
  const updated = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(updated.map(toCartItemApi))
}
