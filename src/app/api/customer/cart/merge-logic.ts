import { prisma } from "@/lib/prisma"
import { resolveCartLine } from "./resolve"
import type { CartAddPayload, GuestCartItemForMerge } from "./types"
import { isProductCartPayload } from "./types"

/**
 * Merge guest cart items into the database for a customer (e.g. after login).
 * Used only by customer login route; does not clear any client state.
 */
export async function mergeGuestCartForUser(
  userId: string,
  items: GuestCartItemForMerge[]
): Promise<void> {
  if (!items?.length) return
  for (const raw of items) {
    const quantity = typeof raw.quantity === "number" && raw.quantity >= 1 ? raw.quantity : 1
    const payload = raw as CartAddPayload
    const resolved = await resolveCartLine(payload, quantity)
    if (!resolved) continue
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
    } else if ("serviceId" in payload && typeof (payload as { serviceId?: string }).serviceId === "string") {
      const serviceId = (payload as { serviceId: string }).serviceId
      const servicePackageId = (payload as { servicePackageId?: string }).servicePackageId ?? null
      const serviceSlotId = (payload as { serviceSlotId?: string }).serviceSlotId ?? null
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
  }
}
