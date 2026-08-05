import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "./resolve"
import type { CartAddPayload, CartItemApi, CartPatchPayload } from "./types"
import { isProductCartPayload } from "./types"
import { UserRole } from "@prisma/client"

const cartItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      variants: { select: { id: true, stock: true }, take: 1, orderBy: { createdAt: "asc" as const } },
    },
  },
  productVariant: { select: { id: true, name: true, price: true, discount: true, hasGst: true, images: true, stock: true } },
  service: { select: { id: true, name: true, basePrice: true, discount: true, hasGst: true, images: true } },
  servicePackage: { select: { id: true, name: true, price: true } },
} as const

async function getEffectiveProductVariantId(productId: string, preferredVariantId?: string | null) {
  if (preferredVariantId) return preferredVariantId
  const variant = await prisma.productVariant.findFirst({
    where: { productId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  return variant?.id ?? null
}

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
  const toFirstImage = (raw: unknown): string | null => {
    if (!raw) return null
    // Common case: prisma returns string[]
    if (Array.isArray(raw)) {
      const first = raw.find((x) => typeof x === "string" && x.trim())
      return first ?? null
    }
    // Sometimes images is stored as a JSON string (e.g. '["https://..."]')
    if (typeof raw === "string") {
      const trimmed = raw.trim()
      // Fast path: already a URL/path
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{") && trimmed.length > 0) {
        if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed
      }
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (typeof parsed === "string") {
          const s = parsed.trim()
          if (s && (s.startsWith("http") || s.startsWith("/") || s.startsWith("data:"))) return s
        }
        if (Array.isArray(parsed)) {
          const first = parsed.find((x) => typeof x === "string" && x.trim()) as string | undefined
          return first ?? null
        }
      } catch {
        // ignore parse failures; fall through
      }
      if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed
      return null
    }
    return null
  }

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
  const variantFirstImage = toFirstImage(row.productVariant?.images as unknown)
  const productFirstImage = toFirstImage(row.product?.images as unknown)
  const serviceFirstImage = toFirstImage(row.service?.images as unknown)

  const image = variantFirstImage ?? productFirstImage ?? serviceFirstImage
  const stock = row.productVariant?.stock ?? row.product?.variants?.[0]?.stock ?? 999
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
    stock,
  }
}

async function consolidateUserDbCart(userId: string) {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    })

    const productGroups = new Map<string, typeof items>()
    for (const item of items) {
      if (!item.productId) continue
      const key = item.productId
      const list = productGroups.get(key) || []
      list.push(item)
      productGroups.set(key, list)
    }

    for (const [productId, group] of productGroups.entries()) {
      if (group.length <= 1) continue
      const variantSubgroups = new Map<string, typeof items>()
      for (const item of group) {
        const vKey = item.productVariantId ?? "DEFAULT"
        const list = variantSubgroups.get(vKey) || []
        list.push(item)
        variantSubgroups.set(vKey, list)
      }

      for (const [, subgroup] of variantSubgroups.entries()) {
        if (subgroup.length <= 1) continue
        const primary = subgroup[0]
        const duplicates = subgroup.slice(1)
        const totalQty = subgroup.reduce((acc, i) => acc + i.quantity, 0)
        const variantToUse = primary.productVariantId || undefined

        const resolved = await resolveCartLine({
          productId,
          productVariantId: variantToUse,
          quantity: totalQty
        }, totalQty)

        if (resolved) {
          await prisma.cartItem.update({
            where: { id: primary.id },
            data: {
              quantity: totalQty,
              unitPrice: resolved.unitPrice,
              totalPrice: resolved.totalPrice,
              hasGst: resolved.hasGst,
              totalGst: resolved.totalGst,
              totalPriceInclGst: resolved.totalPriceInclGst,
            } as Parameters<typeof prisma.cartItem.update>[0]["data"],
          })

          await prisma.cartItem.deleteMany({
            where: { id: { in: duplicates.map((d) => d.id) } }
          })
        }
      }

      const defaultList = variantSubgroups.get("DEFAULT")
      const otherSubgroups = Array.from(variantSubgroups.entries()).filter(([k]) => k !== "DEFAULT")
      if (defaultList && defaultList.length > 0 && otherSubgroups.length > 0) {
        const primary = otherSubgroups[0][1][0]
        const totalQty = primary.quantity + defaultList.reduce((acc, i) => acc + i.quantity, 0)
        const resolved = await resolveCartLine({
          productId,
          productVariantId: primary.productVariantId || undefined,
          quantity: totalQty
        }, totalQty)
        if (resolved) {
          await prisma.cartItem.update({
            where: { id: primary.id },
            data: {
              quantity: totalQty,
              unitPrice: resolved.unitPrice,
              totalPrice: resolved.totalPrice,
              hasGst: resolved.hasGst,
              totalGst: resolved.totalGst,
              totalPriceInclGst: resolved.totalPriceInclGst,
            } as Parameters<typeof prisma.cartItem.update>[0]["data"],
          })
          await prisma.cartItem.deleteMany({
            where: { id: { in: defaultList.map((d) => d.id) } }
          })
        }
      }
    }
  } catch {
    // Ignore consolidation failures
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
  await consolidateUserDbCart(session.user.id)
  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: cartItemInclude,
    orderBy: { updatedAt: "desc" },
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
  if (!isProductCartPayload(payload)) {
    return NextResponse.json(
      { error: "Services are booked directly. Use Book now on the service page." },
      { status: 400 }
    )
  }
  const quantity = typeof payload.quantity === "number" && payload.quantity >= 1 ? payload.quantity : 1
  const userId = session.user.id
  const productId = payload.productId
  const productVariantId = await getEffectiveProductVariantId(productId, payload.productVariantId ?? null)
  if (!productVariantId) {
    return NextResponse.json({ error: "No variant found for this product" }, { status: 400 })
  }
  const payloadWithVariant: CartAddPayload = {
    ...payload,
    productVariantId,
  }
  let existing = await prisma.cartItem.findFirst({
    where: {
      userId,
      productId,
      productVariantId,
      serviceId: null,
    },
  })
  if (!existing) {
    existing = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        serviceId: null,
      },
    })
  }
  if (existing) {
    const nextQuantity = existing.quantity + quantity
    const resolved = await resolveCartLine(payloadWithVariant, nextQuantity)
    if (!resolved) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        productVariantId,
        quantity: nextQuantity,
        unitPrice: resolved.unitPrice,
        totalPrice: resolved.totalPrice,
        hasGst: resolved.hasGst,
        totalGst: resolved.totalGst,
        totalPriceInclGst: resolved.totalPriceInclGst,
      } as Parameters<typeof prisma.cartItem.update>[0]["data"],
    })
  } else {
    const resolved = await resolveCartLine(payloadWithVariant, quantity)
    if (!resolved) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
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
    await prisma.cartItem.create({ data })
  }
  await consolidateUserDbCart(userId)
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { updatedAt: "desc" },
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
    let maxStock = 999
    if (existing.productVariantId) {
      const v = await prisma.productVariant.findUnique({ where: { id: existing.productVariantId }, select: { stock: true } })
      if (v) maxStock = v.stock
    } else if (existing.productId) {
      const p = await prisma.product.findUnique({
        where: { id: existing.productId },
        select: { variants: { select: { stock: true }, take: 1, orderBy: { createdAt: "asc" } } },
      })
      if (p?.variants?.[0]) maxStock = p.variants[0].stock
    }
    // Services are one booking per line; cap quantity at 1, for products cap at maxStock
    const requestedQty = existing.serviceId != null ? 1 : quantity
    const effectiveQty = Math.min(requestedQty, Math.max(1, maxStock))
    const totalPrice = item.unitPrice * effectiveQty
    const totalGst = item.hasGst ? totalPrice * 0.15 : 0
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: effectiveQty,
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
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(items.map((row) => toCartItemApi(row as CartItemRow)))
}
