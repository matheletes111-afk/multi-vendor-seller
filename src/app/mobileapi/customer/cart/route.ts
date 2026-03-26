import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "@/app/api/customer/cart/resolve"
import type { CartAddPayload, CartItemApi, CartPatchPayload } from "@/app/api/customer/cart/types"
import { isProductCartPayload } from "@/app/api/customer/cart/types"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { getServiceFirstDisplayImageUrl } from "@/lib/service-images"

export const dynamic = "force-dynamic"

const cartItemInclude = {
  product: { select: { id: true, name: true, images: true } },
  productVariant: { select: { id: true, name: true, price: true, discount: true, hasGst: true, images: true } },
  service: { select: { id: true, name: true, basePrice: true, discount: true, hasGst: true, images: true, galleryImages: true } },
  servicePackage: { select: { id: true, name: true, price: true } },
} as const

type CartItemWithRelations = Awaited<
  ReturnType<typeof prisma.cartItem.findMany<{ include: typeof cartItemInclude }>>
>[number]

/** Schema fields; generated Prisma client may be out of date until `prisma generate` is run. */
type CartItemPricing = {
  unitPrice: number
  totalPrice: number
  hasGst: boolean
  totalGst: number
  totalPriceInclGst: number | null
}

type CartItemRow = CartItemWithRelations & CartItemPricing

function toCartItemApi(row: CartItemRow): CartItemApi {
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

  const variantImages = row.productVariant?.images as string[] | null | undefined
  const rawImage = row.product
    ? (Array.isArray(variantImages) && variantImages[0]) ??
      ((row.product.images as string[] | null) ?? [])[0]
    : row.service
      ? getServiceFirstDisplayImageUrl({
          images: row.service.images,
          galleryImages: row.service.galleryImages,
        })
      : null
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

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
}

/** GET /mobileapi/customer/cart — return current user's cart items. Auth: Bearer token (customer). */
export async function GET(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const items = await prisma.cartItem.findMany({
    where: { userId: auth.userId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  const result: CartItemApi[] = (items as CartItemRow[]).map(toCartItemApi)
  return NextResponse.json(result)
}

/** POST /mobileapi/customer/cart — add or update item (product or service). Auth: Bearer token (customer). */
export async function POST(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as CartAddPayload
  const quantity =
    typeof (payload as { quantity?: unknown }).quantity === "number" && (payload as { quantity: number }).quantity >= 1
      ? (payload as { quantity: number }).quantity
      : 1

  const userId = auth.userId

  if (isProductCartPayload(payload)) {
    const productId = payload.productId
    const productVariantId = payload.productVariantId ?? null

    const existing = await prisma.cartItem.findFirst({
      where: { userId, productId, productVariantId, serviceId: null },
    })

    if (existing) {
      const nextQuantity = existing.quantity + quantity
      const resolved = await resolveCartLine(payload, nextQuantity)
      if (!resolved) {
        return NextResponse.json({ success: false, error: "Invalid cart item" }, { status: 400 })
      }
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQuantity,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.totalPrice,
          hasGst: resolved.hasGst,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        } as Parameters<typeof prisma.cartItem.update>[0]["data"],
      })
    } else {
      const resolved = await resolveCartLine(payload, quantity)
      if (!resolved) {
        return NextResponse.json({ success: false, error: "Invalid cart item" }, { status: 400 })
      }
      await prisma.cartItem.create({
        data: {
          userId,
          productId,
          productVariantId,
          serviceId: null,
          servicePackageId: null,
          serviceSlotId: null,
          quantity,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.totalPrice,
          hasGst: resolved.hasGst,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        },
      })
    }
  } else if ("serviceId" in payload && typeof (payload as { serviceId?: string }).serviceId === "string") {
    const serviceId = (payload as { serviceId: string }).serviceId
    const servicePackageId = (payload as { servicePackageId?: string | null }).servicePackageId ?? null
    const serviceSlotId = (payload as { serviceSlotId?: string | null }).serviceSlotId ?? null

    const existing = await prisma.cartItem.findFirst({
      where: { userId, serviceId, productId: null, productVariantId: null, servicePackageId, serviceSlotId },
    })

    if (existing) {
      const nextQuantity = existing.quantity + quantity
      const resolved = await resolveCartLine(payload, nextQuantity)
      if (!resolved) {
        return NextResponse.json({ success: false, error: "Invalid cart item" }, { status: 400 })
      }
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQuantity,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.totalPrice,
          hasGst: resolved.hasGst,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        } as Parameters<typeof prisma.cartItem.update>[0]["data"],
      })
    } else {
      const resolved = await resolveCartLine(payload, quantity)
      if (!resolved) {
        return NextResponse.json({ success: false, error: "Invalid cart item" }, { status: 400 })
      }
      await prisma.cartItem.create({
        data: {
          userId,
          productId: null,
          productVariantId: null,
          serviceId,
          servicePackageId,
          serviceSlotId,
          quantity,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.totalPrice,
          hasGst: resolved.hasGst,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        },
      })
    }
  } else {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 })
  }

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  const result: CartItemApi[] = (items as CartItemRow[]).map(toCartItemApi)
  return NextResponse.json(result)
}

/** PATCH /mobileapi/customer/cart — update quantity or remove item. Auth: Bearer token (customer). */
export async function PATCH(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as CartPatchPayload
  const cartItemId = typeof payload.cartItemId === "string" ? payload.cartItemId.trim() : ""
  if (!cartItemId) {
    return NextResponse.json({ success: false, error: "cartItemId required" }, { status: 400 })
  }

  const existing = await prisma.cartItem.findFirst({
    where: { id: cartItemId, userId: auth.userId },
    include: cartItemInclude,
  })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Cart item not found" }, { status: 404 })
  }

  if (payload.remove === true) {
    await prisma.cartItem.delete({ where: { id: cartItemId } })
  } else if (typeof payload.quantity === "number" && payload.quantity >= 1) {
    const quantity = payload.quantity
    const item = existing as typeof existing & CartItemPricing
    const totalPrice = item.unitPrice * quantity
    const totalGst = item.hasGst ? totalPrice * 0.15 : 0
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity, totalPrice, totalGst, totalPriceInclGst: totalPrice + totalGst },
    })
  } else {
    return NextResponse.json({ success: false, error: "Invalid patch payload" }, { status: 400 })
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: auth.userId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  const result: CartItemApi[] = (items as CartItemRow[]).map(toCartItemApi)
  return NextResponse.json(result)
}

