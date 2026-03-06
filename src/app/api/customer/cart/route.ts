import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "./resolve"
import type { CartAddPayload, CartItemApi, CartPatchPayload } from "./types"
import { isProductCartPayload } from "./types"
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

/** GET /api/customer/cart — return current user's cart items. Only CUSTOMER. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden: only customers can use cart" }, { status: 403 })
  }
  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  const result: CartItemApi[] = items.map((row) => toCartItemApi(row as CartItemRow))
  return NextResponse.json(result)
}

/** POST /api/customer/cart — add or update item (product or service). Only CUSTOMER. */
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
  const payload = body as CartAddPayload
  const quantity = typeof payload.quantity === "number" && payload.quantity >= 1 ? payload.quantity : 1
  const resolved = await resolveCartLine(payload, quantity)
  if (!resolved) {
    return NextResponse.json({ error: "Product or service not found" }, { status: 404 })
  }
  const userId = session.user.id
  if (isProductCartPayload(payload)) {
    const productId = payload.productId
    const productVariantId = payload.productVariantId ?? null
    const existing = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        productVariantId,
        serviceId: null,
      },
    })
    const data = {
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
    }
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity,
          totalPrice: resolved.totalPrice,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        } as Parameters<typeof prisma.cartItem.update>[0]["data"],
      })
    } else {
      await prisma.cartItem.create({ data })
    }
  } else {
    const serviceId = payload.serviceId
    const servicePackageId = payload.servicePackageId ?? null
    const serviceSlotId = payload.serviceSlotId ?? null
    const existing = await prisma.cartItem.findFirst({
      where: {
        userId,
        serviceId,
        productId: null,
        productVariantId: null,
        servicePackageId,
        serviceSlotId,
      },
    })
    const data = {
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
    }
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity,
          totalPrice: resolved.totalPrice,
          totalGst: resolved.totalGst,
          totalPriceInclGst: resolved.totalPriceInclGst,
        } as Parameters<typeof prisma.cartItem.update>[0]["data"],
      })
    } else {
      await prisma.cartItem.create({ data })
    }
  }
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(items.map((row) => toCartItemApi(row as CartItemRow)))
}

/** PATCH /api/customer/cart — update quantity or remove item. Only CUSTOMER. */
export async function PATCH(request: NextRequest) {
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
  const payload = body as CartPatchPayload
  const { cartItemId, quantity, remove } = payload
  if (!cartItemId || typeof cartItemId !== "string") {
    return NextResponse.json({ error: "cartItemId required" }, { status: 400 })
  }
  const existing = await prisma.cartItem.findFirst({
    where: { id: cartItemId, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 })
  }
  if (remove === true) {
    await prisma.cartItem.delete({ where: { id: cartItemId } })
  } else if (typeof quantity === "number" && quantity >= 1) {
    const item = existing as typeof existing & CartItemPricing
    const totalPrice = item.unitPrice * quantity
    const totalGst = item.hasGst ? totalPrice * 0.15 : 0
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        totalPrice,
        totalGst,
        totalPriceInclGst: totalPrice + totalGst,
      } as Parameters<typeof prisma.cartItem.update>[0]["data"],
    })
  } else {
    return NextResponse.json({ error: "quantity must be >= 1 or remove: true" }, { status: 400 })
  }
  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(items.map((row) => toCartItemApi(row as CartItemRow)))
}
