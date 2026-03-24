import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "./resolve"
import type { CartAddPayload, GuestCartItemForMerge } from "./types"
import { isProductCartPayload } from "./types"

async function getEffectiveProductVariantId(productId: string, preferredVariantId?: string | null) {
  if (preferredVariantId) return preferredVariantId
  const variant = await prisma.productVariant.findFirst({
    where: { productId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  return variant?.id ?? null
}

/**
 * Merge guest cart items (products only) into the database for a customer (e.g. after login).
 * Services are not added to cart; they are booked directly via service-book flow.
 */
export async function mergeGuestCartForUser(
  userId: string,
  items: GuestCartItemForMerge[]
): Promise<void> {
  if (!items?.length) return
  for (const raw of items) {
    const payload = raw as CartAddPayload
    if (!isProductCartPayload(payload)) continue
    const quantity = typeof raw.quantity === "number" && raw.quantity >= 1 ? raw.quantity : 1
    const productId = payload.productId
    const productVariantId = await getEffectiveProductVariantId(productId, payload.productVariantId ?? null)
    if (!productVariantId) continue
    const payloadWithVariant: CartAddPayload = {
      ...payload,
      productVariantId,
    }
    const existing = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        productVariantId,
        serviceId: null,
      },
    })
    if (existing) {
      const nextQuantity = existing.quantity + quantity
      const resolved = await resolveCartLine(payloadWithVariant, nextQuantity)
      if (!resolved) continue
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
      const resolved = await resolveCartLine(payloadWithVariant, quantity)
      if (!resolved) continue
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
  }
}
