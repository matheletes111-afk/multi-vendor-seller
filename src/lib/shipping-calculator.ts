export interface ShippingItemInput {
  weight?: number | null
  height?: number | null
  width?: number | null
  depth?: number | null
  quantity: number
  isPhysical?: boolean
}

export interface ShippingBreakup {
  weightShippingFee: number
  dimensionShippingFee: number
  regionShippingFee: number
  totalShippingFee: number
}

export const ALLOWED_ADMINISTRATIVE_REGIONS = [
  "Eastern Province",
  "Northern Province",
  "North West Province",
  "Southern Province",
  "Western Area",
  "Other",
] as const

/**
 * Resolves any raw map location, city, or state string into a valid Administrative Region or "Other".
 * Safe for use with reverse-geocoded strings, dropdown selections, and manual text input.
 * Check ordering: North West BEFORE Northern to avoid partial-match issues.
 */
export function resolveAdministrativeRegion(stateInput?: string | null): string {
  if (!stateInput || typeof stateInput !== "string") return "Other"
  const clean = stateInput.trim().toLowerCase()
  if (!clean) return "Other"

  // Exact match on known region names first
  for (const reg of ALLOWED_ADMINISTRATIVE_REGIONS) {
    if (reg === "Other") continue
    if (clean === reg.toLowerCase()) return reg
  }

  // Western Area keywords
  if (clean.includes("western") || clean.includes("freetown") || clean.includes("western area")) return "Western Area"

  // North West Province — must check BEFORE "northern" to avoid partial match
  if (
    clean.includes("north west") ||
    clean.includes("northwest") ||
    clean.includes("port loko") ||
    clean.includes("kambia")
  ) return "North West Province"

  // Northern Province
  if (
    clean.includes("northern") ||
    clean.includes("makeni") ||
    clean.includes("bombali") ||
    clean.includes("tonkolili") ||
    clean.includes("koinadugu")
  ) return "Northern Province"

  // Eastern Province
  if (
    clean.includes("eastern") ||
    clean.includes("kenema") ||
    clean.includes("kailahun") ||
    clean.includes("kono district") ||
    clean === "kono"
  ) return "Eastern Province"

  // Southern Province — use word-boundary safe checks (avoid 'bo' substring trap)
  if (
    clean.includes("southern") ||
    clean === "bo" ||
    clean.startsWith("bo ") ||
    clean.endsWith(" bo") ||
    clean.includes("moyamba") ||
    clean.includes("pujehun") ||
    clean.includes("bonthe")
  ) return "Southern Province"

  return "Other"
}

export interface WeightRange {
  minWeight?: number | null
  maxWeight?: number | null
  charge?: number | null
}

export interface DimensionRange {
  minDimension?: number | null
  maxDimension?: number | null
  charge?: number | null
}

export interface RegionCharge {
  region?: string | null
  charge?: number | null
}

export function getShippingChargeForWeight(weight: number, ranges: WeightRange[] | null | undefined): number {
  if (!ranges || !Array.isArray(ranges) || ranges.length === 0) return 0
  const w = typeof weight === "number" && !isNaN(weight) ? Math.max(0, weight) : 0

  for (const r of ranges) {
    const minW = typeof r?.minWeight === "number" && !isNaN(r.minWeight) ? Number(r.minWeight) : 0
    const maxW = typeof r?.maxWeight === "number" && !isNaN(r.maxWeight) ? Number(r.maxWeight) : 0
    const charge = typeof r?.charge === "number" && !isNaN(r.charge) ? Math.max(0, Number(r.charge)) : 0
    if (w >= minW && w < maxW) {
      return charge
    }
  }
  const firstMin = typeof ranges[0]?.minWeight === "number" && !isNaN(ranges[0].minWeight) ? Number(ranges[0].minWeight) : 0
  if (w <= firstMin) {
    return typeof ranges[0]?.charge === "number" && !isNaN(ranges[0].charge) ? Math.max(0, Number(ranges[0].charge)) : 0
  }
  const lastCharge = ranges[ranges.length - 1]?.charge
  return typeof lastCharge === "number" && !isNaN(lastCharge) ? Math.max(0, Number(lastCharge)) : 0
}

export function getShippingChargeForDimension(volume: number, ranges: DimensionRange[] | null | undefined): number {
  if (!ranges || !Array.isArray(ranges) || ranges.length === 0) return 0
  const v = typeof volume === "number" && !isNaN(volume) ? Math.max(0, volume) : 0

  for (const r of ranges) {
    const minD = typeof r?.minDimension === "number" && !isNaN(r.minDimension) ? Number(r.minDimension) : 0
    const maxD = typeof r?.maxDimension === "number" && !isNaN(r.maxDimension) ? Number(r.maxDimension) : 0
    const charge = typeof r?.charge === "number" && !isNaN(r.charge) ? Math.max(0, Number(r.charge)) : 0
    if (v >= minD && v < maxD) {
      return charge
    }
  }
  const firstMin = typeof ranges[0]?.minDimension === "number" && !isNaN(ranges[0].minDimension) ? Number(ranges[0].minDimension) : 0
  if (v <= firstMin) {
    return typeof ranges[0]?.charge === "number" && !isNaN(ranges[0].charge) ? Math.max(0, Number(ranges[0].charge)) : 0
  }
  const lastCharge = ranges[ranges.length - 1]?.charge
  return typeof lastCharge === "number" && !isNaN(lastCharge) ? Math.max(0, Number(lastCharge)) : 0
}

export function getRegionDeliveryCharge(destinationState: string | null | undefined, regionCharges: RegionCharge[] | null | undefined): number {
  if (!regionCharges || !Array.isArray(regionCharges) || regionCharges.length === 0) {
    return 0
  }

  const resolvedRegion = resolveAdministrativeRegion(destinationState)
  const cleanResolved = resolvedRegion.trim().toLowerCase()

  for (const rc of regionCharges) {
    const regName = typeof rc?.region === "string" ? rc.region.trim().toLowerCase() : ""
    if (!regName) continue

    if (cleanResolved === regName || cleanResolved.includes(regName) || regName.includes(cleanResolved)) {
      const charge = typeof rc?.charge === "number" && !isNaN(rc.charge) ? Math.max(0, Number(rc.charge)) : 0
      return charge
    }
  }

  // Fallback to "Other" region charge if destination does not match standard 5 regions
  const otherRc = regionCharges.find((rc) => {
    const regName = typeof rc?.region === "string" ? rc.region.trim().toLowerCase() : ""
    return regName === "other" || regName === "other region" || regName.includes("other")
  })

  if (otherRc) {
    return typeof otherRc?.charge === "number" && !isNaN(otherRc.charge) ? Math.max(0, Number(otherRc.charge)) : 0
  }

  const firstCharge = regionCharges[0]?.charge
  return typeof firstCharge === "number" && !isNaN(firstCharge) ? Math.max(0, Number(firstCharge)) : 0
}

export function calculateShippingBreakup(params: {
  items: ShippingItemInput[]
  destinationState?: string | null
  weightRanges?: WeightRange[] | null
  dimensionRanges?: DimensionRange[] | null
  regionCharges?: RegionCharge[] | null
}): ShippingBreakup {
  const { items, destinationState, weightRanges, dimensionRanges, regionCharges } = params

  let totalWeight = 0
  let totalVolume = 0
  let hasPhysicalProducts = false

  for (const item of items) {
    const qty = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1
    const isPhysical = item.isPhysical !== false

    if (isPhysical) {
      hasPhysicalProducts = true
      const w = typeof item.weight === "number" && !isNaN(item.weight) ? Math.max(0, item.weight) : 0
      const h = typeof item.height === "number" && !isNaN(item.height) ? Math.max(0, item.height) : 0
      const width = typeof item.width === "number" && !isNaN(item.width) ? Math.max(0, item.width) : 0
      const d = typeof item.depth === "number" && !isNaN(item.depth) ? Math.max(0, item.depth) : 0

      totalWeight += w * qty
      totalVolume += (h * width * d) * qty
    }
  }

  if (!hasPhysicalProducts) {
    return {
      weightShippingFee: 0,
      dimensionShippingFee: 0,
      regionShippingFee: 0,
      totalShippingFee: 0,
    }
  }

  const weightShippingFee = getShippingChargeForWeight(totalWeight, weightRanges)
  const dimensionShippingFee = getShippingChargeForDimension(totalVolume, dimensionRanges)
  const regionShippingFee = getRegionDeliveryCharge(destinationState, regionCharges)

  // Additive shipping formula: Weight + Dimension + Region
  const totalShippingFee = weightShippingFee + dimensionShippingFee + regionShippingFee

  return {
    weightShippingFee,
    dimensionShippingFee,
    regionShippingFee,
    totalShippingFee,
  }
}
