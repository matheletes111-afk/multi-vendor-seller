import { prisma } from "@/lib/prisma"
import type { CartAddPayload, GuestCartItemForMerge } from "./types"
import { isProductCartPayload } from "./types"

const GST_RATE = 0.15

export type ResolvedCartLine = {
  unitPrice: number
  hasGst: boolean
  totalPrice: number
  totalGst: number
  totalPriceInclGst: number
  name: string
  image: string | null
}

export async function resolveProductCartLine(
  productId: string,
  productVariantId: string | null | undefined,
  quantity: number
): Promise<ResolvedCartLine | null> {
  const variantId = productVariantId ?? null
  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
    select: {
      name: true,
      images: true,
      variants: {
        where: variantId ? { id: variantId } : undefined,
        take: 1,
        orderBy: { createdAt: "asc" as const },
      },
    },
  })
  if (!product) return null
  const variant = product.variants?.[0]
  if (!variant) return null
  const v = variant as { price: number; discount?: number; hasGst?: boolean; name?: string; images?: string[] }
  const unitPrice = Math.max(0, v.price - (v.discount ?? 0))
  const hasGst = v.hasGst ?? true
  const totalPrice = unitPrice * quantity
  const totalGst = hasGst ? totalPrice * GST_RATE : 0
  const totalPriceInclGst = totalPrice + totalGst
  const name = v.name ? `${product.name} (${v.name})` : product.name
  const images = (product.images as string[] | null) ?? []
  const image = images[0] ?? (Array.isArray(v.images) && v.images[0]) ?? null
  return { unitPrice, hasGst, totalPrice, totalGst, totalPriceInclGst, name, image }
}

export async function resolveServiceCartLine(
  serviceId: string,
  servicePackageId: string | null | undefined,
  _serviceSlotId: string | null | undefined,
  quantity: number
): Promise<ResolvedCartLine | null> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    include: {
      packages: servicePackageId ? { where: { id: servicePackageId }, take: 1 } : { take: 0 },
    },
  })
  if (!service) return null
  let unitPrice: number
  let name: string = service.name
  const packages = service.packages ?? []
  if (servicePackageId && packages.length > 0) {
    const pkg = packages[0] as { price: number; name?: string }
    unitPrice = pkg.price
    if (pkg.name) name = `${service.name} - ${pkg.name}`
  } else {
    const base = service.basePrice ?? 0
    unitPrice = Math.max(0, base - (service.discount ?? 0))
  }
  const hasGst = service.hasGst ?? true
  const totalPrice = unitPrice * quantity
  const totalGst = hasGst ? totalPrice * GST_RATE : 0
  const totalPriceInclGst = totalPrice + totalGst
  const images = (service.images as string[] | null) ?? []
  const image = images[0] ?? null
  return { unitPrice, hasGst, totalPrice, totalGst, totalPriceInclGst, name, image }
}

export async function resolveCartLine(
  payload: CartAddPayload | GuestCartItemForMerge,
  fallbackQuantity: number = 1
): Promise<ResolvedCartLine | null> {
  const qty = "quantity" in payload && typeof (payload as { quantity?: number }).quantity === "number"
    ? (payload as { quantity: number }).quantity
    : fallbackQuantity
  if (qty < 1) return null
  if (isProductCartPayload(payload as CartAddPayload)) {
    const p = payload as CartAddPayload & { productId: string; productVariantId?: string | null }
    return resolveProductCartLine(p.productId, p.productVariantId ?? null, qty)
  }
  if ("serviceId" in payload && typeof (payload as { serviceId?: string }).serviceId === "string") {
    const s = payload as { serviceId: string; servicePackageId?: string; serviceSlotId?: string }
    return resolveServiceCartLine(s.serviceId, s.servicePackageId ?? null, s.serviceSlotId ?? null, qty)
  }
  return null
}
