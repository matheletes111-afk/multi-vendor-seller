import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export type VariantInput = {
  name?: string
  sku?: string
  price?: number
  discount?: number
  hasGst?: boolean
  stock?: number
  weight?: number
  images?: string[] | unknown
  attributes?: Record<string, string> | unknown
  specification?: string
  details?: string
  returnType?: "NON_RETURNABLE" | "RETURNABLE"
  returnDays?: number
  replacementAllowed?: boolean
}

export type NormalizedVariant = {
  name: string
  sku: string | null
  price: number
  discount: number
  hasGst: boolean
  stock: number
  weight: number | null
  images: object
  attributes: object
  specification: string | null
  details: string | null
  returnType: "NON_RETURNABLE" | "RETURNABLE"
  returnDays: number | null
  replacementAllowed: boolean
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
  const vDiscount = Math.round(Number(v?.discount ?? 0) * 100) / 100
  const vWeight = v?.weight !== undefined && v?.weight !== null ? Number(v.weight) : null
  if (isNaN(vPrice) || vPrice <= 0) {
    return { ok: false, error: `Variant ${index + 1}: valid price required` }
  }
  if (isNaN(vStock) || vStock < 0) {
    return { ok: false, error: `Variant ${index + 1}: valid stock required` }
  }
  const vReturnType = v?.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
  const vReturnDaysRaw = typeof v?.returnDays === "number" ? v.returnDays : undefined
  const vReturnDays =
    vReturnType === "RETURNABLE" && typeof vReturnDaysRaw === "number" && vReturnDaysRaw > 0
      ? Math.floor(vReturnDaysRaw)
      : null

  const replacementAllowed = v?.replacementAllowed === true

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
