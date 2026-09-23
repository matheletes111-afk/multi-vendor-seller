import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export type VariantInput = {
  name?: string
  sku?: string
  price?: number
  discount?: number
  sellingPrice?: number
  selling_price?: number
  hasGst?: boolean
  stock?: number
  weight?: number
  height?: number
  width?: number
  depth?: number
  images?: string[] | unknown
  attributes?: Record<string, string> | unknown
  specification?: string
  details?: string
  returnType?: "NON_RETURNABLE" | "RETURNABLE"
  returnDays?: number
  replacementAllowed?: boolean
  deliveryDays?: number
  delivery_days?: number
  deliveryDaysExpected?: number
}

export type NormalizedVariant = {
  name: string
  sku: string | null
  price: number
  discount: number
  hasGst: boolean
  stock: number
  weight: number | null
  height: number
  width: number
  depth: number
  images: object
  attributes: object
  specification: string | null
  details: string | null
  returnType: "NON_RETURNABLE" | "RETURNABLE"
  returnDays: number | null
  replacementAllowed: boolean
  deliveryDays: number
}

export function slugFromName(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  return s || "product"
}

export function uniqueSlugSuffix(): string {
  return randomBytes(3).toString("hex")
}

export function parseVariantInput(
  v: VariantInput,
  index: number
): { ok: true; variant: NormalizedVariant } | { ok: false; error: string } {
  const vName = typeof v?.name === "string" ? v.name.trim() : `Variant ${index + 1}`
  const vPrice = Number(v?.price ?? 0)
  const vStock = Number(v?.stock ?? 0)
  const vWeight = v?.weight !== undefined && v?.weight !== null ? Number(v.weight) : null
  const vHeight = v?.height !== undefined && v?.height !== null ? Number(v.height) : 0
  const vWidth = v?.width !== undefined && v?.width !== null ? Number(v.width) : 0
  const vDepth = v?.depth !== undefined && v?.depth !== null ? Number(v.depth) : 0

  // Client enters the target selling price (e.g. 60 for a 100 rs item).
  // In DB, discount is stored as (price - sellingPrice) = 100 - 60 = 40.
  const rawSellingPrice =
    v?.sellingPrice !== undefined && v?.sellingPrice !== null && String(v.sellingPrice).trim() !== ""
      ? Number(v.sellingPrice)
      : v?.selling_price !== undefined && v?.selling_price !== null && String(v.selling_price).trim() !== ""
      ? Number(v.selling_price)
      : v?.discount !== undefined && v?.discount !== null && String(v.discount).trim() !== ""
      ? Number(v.discount)
      : undefined

  if (isNaN(vPrice) || vPrice <= 0) {
    return { ok: false, error: `Variant ${index + 1}: valid price required` }
  }
  if (isNaN(vStock) || vStock < 0) {
    return { ok: false, error: `Variant ${index + 1}: valid stock required` }
  }

  let vDiscount = 0
  if (rawSellingPrice !== undefined && !isNaN(rawSellingPrice) && rawSellingPrice > 0) {
    if (rawSellingPrice > vPrice) {
      return { ok: false, error: `Variant ${index + 1}: selling price (${rawSellingPrice}) cannot exceed regular price (${vPrice})` }
    }
    vDiscount = Math.round((vPrice - rawSellingPrice) * 100) / 100
  }
  const vReturnType = v?.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
  const vReturnDaysRaw = typeof v?.returnDays === "number" ? v.returnDays : undefined
  const vReturnDays =
    vReturnType === "RETURNABLE" && typeof vReturnDaysRaw === "number" && vReturnDaysRaw > 0
      ? Math.floor(vReturnDaysRaw)
      : null

  const replacementAllowed = v?.replacementAllowed === true

  const vDeliveryDaysRaw = v?.deliveryDays ?? v?.delivery_days ?? v?.deliveryDaysExpected
  const vDeliveryDaysNum = Number(vDeliveryDaysRaw)
  const deliveryDays =
    typeof vDeliveryDaysRaw !== "undefined" && !isNaN(vDeliveryDaysNum) && vDeliveryDaysNum > 0
      ? Math.floor(vDeliveryDaysNum)
      : 7

  return {
    ok: true,
    variant: {
      name: vName,
      sku: typeof v?.sku === "string" ? v.sku || null : null,
      price: vPrice,
      discount: vDiscount,
      hasGst: v?.hasGst !== false,
      stock: Math.floor(vStock),
      weight: vWeight !== null && !isNaN(vWeight) ? vWeight : null,
      height: !isNaN(vHeight) && vHeight >= 0 ? vHeight : 0,
      width: !isNaN(vWidth) && vWidth >= 0 ? vWidth : 0,
      depth: !isNaN(vDepth) && vDepth >= 0 ? vDepth : 0,
      images: Array.isArray(v?.images) ? (v.images as object) : [],
      attributes:
        v?.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)
          ? (v.attributes as object)
          : {},
      specification: typeof v?.specification === "string" ? v.specification : null,
      details: typeof v?.details === "string" ? v.details : null,
      returnType: vReturnType,
      returnDays: vReturnDays,
      replacementAllowed,
      deliveryDays,
    },
  }
}

export async function sellerHasSelectedCategory(sellerId: string, categoryId: string): Promise<boolean> {
  const n = await prisma.seller.count({
    where: {
      id: sellerId,
      selectedCategories: { some: { id: categoryId, isActive: true } },
    },
  })
  return n > 0
}
