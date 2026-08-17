import {
  ALL_LOCATION_REGIONS,
  LOCATION_ZONES,
  SPECIFIC_LOCATION_REGIONS,
  PROVINCE_REGIONS,
  getZoneForRegion,
} from "./location-zones"
import { resolveAdministrativeRegion } from "./shipping-calculator"

export interface AIRegionMatchResult {
  matchedRegion: string
  zone: string
  confidence: number
  reasoning: string
  isAiMatched: boolean
}

export interface AddressInput {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Priority 1: Fast deterministic matching for specific delivery areas (ZONE 1 to ZONE 15).
 * Evaluates street/line1, sublocality/line2, and city against specific zone regions.
 */
export function fastMatchSpecificZoneRegion(address: AddressInput): string | null {
  const streetAndArea = [address.addressLine1, address.addressLine2, address.city]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase()

  if (!streetAndArea) return null

  // 1. Search against specific zone regions (sorted by longest name first)
  for (const reg of SPECIFIC_LOCATION_REGIONS) {
    if (!reg || reg === "Other") continue
    const regLower = reg.toLowerCase()

    // For short names (<= 4 chars like PZ), require word boundary match
    if (regLower.length <= 4) {
      const regex = new RegExp(`\\b${escapeRegExp(regLower)}\\b`, "i")
      if (regex.test(streetAndArea)) {
        return reg
      }
    } else {
      if (streetAndArea.includes(regLower)) {
        return reg
      }
    }
  }

  return null
}

/**
 * Fast deterministic match for administrative provinces if no specific zone matched.
 */
export function fastMatchProvinceRegion(address: AddressInput): string | null {
  const fullText = [address.addressLine1, address.addressLine2, address.city, address.state]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase()

  if (!fullText) return null

  for (const prov of PROVINCE_REGIONS) {
    if (fullText.includes(prov.toLowerCase())) {
      return prov
    }
  }

  return null
}

/**
 * Resolves a clean formatted delivery zone string for any address:
 * e.g. "Wallace Johnson Street (ZONE 5)", "Western Area", or "Other".
 */
export function getFormattedDeliveryZone(address?: AddressInput | null): string {
  if (!address) return "Other"
  const specificMatch = fastMatchSpecificZoneRegion(address)
  if (specificMatch) {
    const zone = getZoneForRegion(specificMatch)
    return `${specificMatch} (${zone})`
  }
  const provMatch =
    fastMatchProvinceRegion(address) ||
    (address.state ? resolveAdministrativeRegion(address.state) : null)
  if (provMatch && provMatch !== "Other") {
    return provMatch
  }
  return "Other"
}

/**
 * Multi-tier AI spatial region matcher:
 * Priority 1: Specific Zones (ZONE 1 to ZONE 15)
 * Priority 2: Gemini AI spatial intelligence prioritizing specific zones
 * Priority 3: Administrative Provinces
 * Priority 4: Other
 */
export async function matchRegionWithAI(address: AddressInput): Promise<AIRegionMatchResult> {
  const addressString = [
    address.addressLine1 ? `Address Line 1: ${address.addressLine1}` : "",
    address.addressLine2 ? `Address Line 2: ${address.addressLine2}` : "",
    address.city ? `City: ${address.city}` : "",
    address.state ? `State/Province: ${address.state}` : "",
    address.postalCode ? `Postal Code: ${address.postalCode}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  // Priority 1: Check deterministic match against specific zone regions (ZONE 1 - 15)
  const specificMatch = fastMatchSpecificZoneRegion(address)
  if (specificMatch) {
    const zone = getZoneForRegion(specificMatch)
    return {
      matchedRegion: specificMatch,
      zone,
      confidence: 1.0,
      reasoning: `Direct match with ${zone} location area.`,
      isAiMatched: false,
    }
  }

  // Priority 2: Leverage Gemini AI spatial/semantic reasoning prioritizing specific zones
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (apiKey && addressString.trim()) {
    // Separate Specific Zones from Administrative Provinces in prompt for AI clarity
    const specificZonesList = LOCATION_ZONES.filter((z) => z.zone.startsWith("ZONE"))
      .map((z) => `${z.zone}: ${z.regions.join(", ")}`)
      .join("\n")

    const provinceZonesList = LOCATION_ZONES.filter(
      (z) => z.zone === "Administrative Provinces"
    )
      .map((z) => `${z.zone}: ${z.regions.join(", ")}`)
      .join("\n")

    const promptText = `
You are a spatial location reasoning AI for Sierra Leone delivery logistics.
Your task is to match the customer delivery address to the BEST matching region name from the system regions list.

Customer Address Details:
${addressString}

SYSTEM REGIONS HIERARCHY:

--- PRIORITY 1: Specific Delivery Zones (ZONE 1 to ZONE 15) ---
${specificZonesList}

--- PRIORITY 2: Administrative Provinces (Use ONLY if no specific zone above matches) ---
${provinceZonesList}

--- PRIORITY 3: Other ---
Other

CRITICAL MATCHING RULES (STRICT PRIORITY ORDER):
1. [HIGHEST PRIORITY] First check if the address (street, neighborhood, junction, road, landmark, building, town) is in or corresponds to one of the SPECIFIC REGIONS in ZONE 1 through ZONE 15.
   - For example: Central Freetown, PZ, Rawdon St, Wallace Johnson St, Circular Rd -> ZONE 5 (e.g. "PZ", "RAWDON STREET", "CIRCULAR ROAD")
   - Tower Hill / Central Freetown -> ZONE 5 ("PZ", "WATERLOO STREET", "CIRCULAR ROAD")
   - Lumley, Goderich, Juba -> ZONE 2 or ZONE 8
   - Aberdeen, Murray Town, Congo Cross, Wilkinson Rd -> ZONE 4
   - Cline Town, Kissy, Wellington -> ZONE 6
   Always prefer the most specific zone region from ZONE 1 - 15 whenever the address is located in that area.
2. [SECONDARY PRIORITY] If and ONLY if the location is outside all specific delivery zones in ZONE 1 - 15, match to an Administrative Province ("Western Area", "Northern Province", "Southern Province", "Eastern Province", "North West Province"). Do NOT default to "Western Area" if a specific zone applies!
3. [LOWEST PRIORITY] If the address is completely unidentifiable or outside Sierra Leone, return "Other".

Output ONLY valid raw JSON with this exact structure (no markdown fences):
{
  "matchedRegion": "<Exact region string from System Regions List or 'Other'>",
  "confidence": 0.95,
  "reasoning": "<Short 1-sentence spatial match reason>"
}
`

    const geminiModels = [
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-3-flash-preview",
    ]

    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const cleanJson = text.replace(/```json/gi, "").replace(/```/g, "").trim()
            const parsed = JSON.parse(cleanJson)
            const candidateRegion = parsed.matchedRegion?.trim() || "Other"

            // Verify matchedRegion is a valid region in system list
            const matchedRegion = ALL_LOCATION_REGIONS.includes(candidateRegion)
              ? candidateRegion
              : "Other"

            const zone = getZoneForRegion(matchedRegion)

            return {
              matchedRegion,
              zone,
              confidence: parsed.confidence || 0.9,
              reasoning: parsed.reasoning || `Matched to ${matchedRegion} (${zone}).`,
              isAiMatched: true,
            }
          }
        }
      } catch (e) {
        console.warn(`[AI Region Matcher] Model ${model} fallback error:`, e)
      }
    }
  }

  // Priority 3: Fallback check for Administrative Provinces if AI was offline/unavailable
  const provinceMatch = fastMatchProvinceRegion(address)
  if (provinceMatch) {
    return {
      matchedRegion: provinceMatch,
      zone: "Administrative Provinces",
      confidence: 0.8,
      reasoning: `Identified by province (${provinceMatch}).`,
      isAiMatched: false,
    }
  }

  // Priority 4: Final fallback
  return {
    matchedRegion: "Other",
    zone: "Other",
    confidence: 0.5,
    reasoning: "Standard fallback region.",
    isAiMatched: false,
  }
}
