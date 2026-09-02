/**
 * AI-Driven Vehicle Matching Engine for Meeem Delivery Dispatch
 * Uses Gemini AI + Intelligent Dimensional Heuristics to classify delivery packages
 * into appropriate vehicle categories: 2_WHEELER, 3_WHEELER, 4_WHEELER.
 */

export type VehicleType = "2_WHEELER" | "3_WHEELER" | "4_WHEELER"

export interface VehicleMatchResult {
  requiredVehicle: VehicleType
  compatibleVehicles: VehicleType[]
  reason: string
  estimatedWeightKg: number
  confidence: "AI_MODEL" | "HEURISTIC"
}

export interface MatchableItem {
  name?: string | null
  productNameSnapshot?: string | null
  serviceNameSnapshot?: string | null
  product?: { name?: string | null } | null
  quantity?: number | null
  weight?: number | null
  height?: number | null
  width?: number | null
  depth?: number | null
  productVariant?: {
    weight?: number | null
    height?: number | null
    width?: number | null
    depth?: number | null
  } | null
}

/**
 * Fast dimensional and keyword heuristic for package vehicle classification
 */
export function getHeuristicVehicleMatch(items: MatchableItem[]): VehicleMatchResult {
  let totalWeight = 0
  let maxDimension = 0
  let requiresHeavy4Wheeler = false
  let requiresMedium3Wheeler = false
  const detectedKeywords: string[] = []

  if (!items || items.length === 0) {
    return {
      requiredVehicle: "2_WHEELER",
      compatibleVehicles: ["2_WHEELER"],
      reason: "Standard parcel: Dispatches to 2-Wheeler (Motorbike/Scooter).",
      estimatedWeightKg: 0.5,
      confidence: "HEURISTIC",
    }
  }

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1)
    const title = (
      item.productNameSnapshot ||
      item.product?.name ||
      item.serviceNameSnapshot ||
      item.name ||
      ""
    ).toLowerCase().trim()

    const weight =
      item.weight ??
      item.productVariant?.weight ??
      0

    const h = item.height ?? item.productVariant?.height ?? 0
    const w = item.width ?? item.productVariant?.width ?? 0
    const d = item.depth ?? item.productVariant?.depth ?? 0
    const maxSide = Math.max(h, w, d)

    const isHairDryerOrPersonalCare =
      title.includes("hair dryer") ||
      title.includes("hairdryer") ||
      title.includes("blow dryer") ||
      title.includes("hair styler") ||
      title.includes("hair straightener") ||
      title.includes("curler") ||
      title.includes("trimmer") ||
      title.includes("shaver") ||
      title.includes("clipper")

    const isSmallHandheldOrAccessory =
      isHairDryerOrPersonalCare ||
      title.includes("watch") ||
      title.includes("smartwatch") ||
      title.includes("phone") ||
      title.includes("mobile") ||
      title.includes("tablet") ||
      title.includes("ipad") ||
      title.includes("earbud") ||
      title.includes("earphone") ||
      title.includes("headphone") ||
      title.includes("airpod") ||
      title.includes("headset") ||
      title.includes("case") ||
      title.includes("cover") ||
      title.includes("toy") ||
      title.includes("cable") ||
      title.includes("stand") ||
      title.includes("sticker") ||
      title.includes("lube") ||
      title.includes("accessory") ||
      title.includes("mini") ||
      title.includes("charger") ||
      title.includes("perfume") ||
      title.includes("cosmetic")

    // Anomaly sanitizer: If a small consumer product has an absurd recorded weight
    // (e.g. 60 entered meaning 60 grams or decagrams, or 85 entered meaning 85mm),
    // clamp it to realistic consumer package limits so it doesn't trigger 4-Wheeler freight.
    let effectiveWeight = weight
    let effectiveMaxSide = maxSide

    if (isSmallHandheldOrAccessory) {
      if (effectiveWeight > 5) {
        effectiveWeight = Math.min(1.0, effectiveWeight / 100)
        if (effectiveWeight <= 0) effectiveWeight = 0.5
      }
      if (effectiveMaxSide > 45) {
        effectiveMaxSide = Math.min(25, effectiveMaxSide / 10)
      }
    }

    if (effectiveWeight > 0) {
      totalWeight += effectiveWeight * qty
    }
    if (effectiveMaxSide > 0) {
      maxDimension = Math.max(maxDimension, effectiveMaxSide)
    }

    // Heavy & Large Cargo (Refrigerators, Washing machines, Beds, Sofas, Heavy Generators)
    // Exclude hair dryers from "dryer", exclude tablets from "table", exclude bedsheets from "bed"
    const isHeavyFreight =
      !isSmallHandheldOrAccessory &&
      (title.includes("fridge") ||
        title.includes("refrigerator") ||
        title.includes("freezer") ||
        title.includes("washing machine") ||
        (/\bwasher\b/.test(title) && !title.includes("car")) ||
        title.includes("tumble dryer") ||
        title.includes("clothes dryer") ||
        (/\bdryer\b/.test(title) && !isHairDryerOrPersonalCare) ||
        title.includes("sofa") ||
        title.includes("couch") ||
        (/\b(bed frame|mattress|double bed|single bed|bunk bed)\b/.test(title) &&
          !title.includes("sheet") &&
          !title.includes("cover")) ||
        title.includes("wardrobe") ||
        title.includes("dining table") ||
        title.includes("generator") ||
        title.includes("treadmill") ||
        title.includes("cupboard"))

    if (isHeavyFreight) {
      requiresHeavy4Wheeler = true
      detectedKeywords.push(title)
      if (effectiveWeight === 0) totalWeight += 50 * qty
      if (effectiveMaxSide === 0) maxDimension = Math.max(maxDimension, 160)
    }
    // Medium Cargo (TVs, Microwaves, ACs, Desks, Chairs, Monitors, Dishwashers, Ovens, Bicycles)
    else if (
      !isSmallHandheldOrAccessory &&
      (title.includes("tv") ||
        title.includes("television") ||
        title.includes("microwave") ||
        title.includes("air conditioner") ||
        /\bac\b/.test(title) ||
        title.includes("aircon") ||
        title.includes("oven") ||
        title.includes("dishwasher") ||
        title.includes("office desk") ||
        title.includes("study desk") ||
        title.includes("office chair") ||
        title.includes("dining chair") ||
        title.includes("bicycle") ||
        title.includes("exercise bike") ||
        title.includes("stationary bike") ||
        title.includes("monitor") ||
        title.includes("printer"))
    ) {
      requiresMedium3Wheeler = true
      detectedKeywords.push(title)
      if (effectiveWeight === 0) totalWeight += 15 * qty
      if (effectiveMaxSide === 0) maxDimension = Math.max(maxDimension, 80)
    }
    // Small lightweight items
    else {
      if (effectiveWeight === 0) totalWeight += 0.5 * qty
      if (effectiveMaxSide === 0) maxDimension = Math.max(maxDimension, 20)
    }
  }

  // Large or Heavy rule
  if (requiresHeavy4Wheeler || totalWeight > 60 || maxDimension >= 140) {
    return {
      requiredVehicle: "4_WHEELER",
      compatibleVehicles: ["3_WHEELER", "4_WHEELER"],
      reason: `Heavy/Bulky cargo detected (~${totalWeight.toFixed(1)}kg, ${maxDimension}cm): Requires 3-Wheeler or 4-Wheeler vehicle.`,
      estimatedWeightKg: totalWeight,
      confidence: "HEURISTIC",
    }
  }

  // Medium rule
  if (requiresMedium3Wheeler || totalWeight > 15 || maxDimension >= 65) {
    return {
      requiredVehicle: "3_WHEELER",
      compatibleVehicles: ["3_WHEELER", "4_WHEELER"],
      reason: `Medium-sized parcel (~${totalWeight.toFixed(1)}kg, ${maxDimension}cm): Requires 3-Wheeler or 4-Wheeler vehicle.`,
      estimatedWeightKg: totalWeight,
      confidence: "HEURISTIC",
    }
  }

  // Small rule (Default for watches, phones, hair dryers, clothes, cosmetics, small electronics)
  return {
    requiredVehicle: "2_WHEELER",
    compatibleVehicles: ["2_WHEELER"],
    reason: `Small & lightweight parcel (~${totalWeight.toFixed(1)}kg): Dispatches to 2-Wheeler (Motorbike/Scooter).`,
    estimatedWeightKg: totalWeight,
    confidence: "HEURISTIC",
  }
}

/**
 * Intelligent AI + Heuristic vehicle matching for delivery dispatch and rider assignment
 */
export async function determineRequiredVehicleForItems(
  items: MatchableItem[]
): Promise<VehicleMatchResult> {
  if (!items || items.length === 0) {
    return {
      requiredVehicle: "2_WHEELER",
      compatibleVehicles: ["2_WHEELER"],
      reason: "Standard parcel: Dispatches to 2-Wheeler (Motorbike/Scooter).",
      estimatedWeightKg: 0.5,
      confidence: "HEURISTIC",
    }
  }

  const heuristic = getHeuristicVehicleMatch(items)

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    ""

  if (!apiKey) {
    return heuristic
  }

  try {
    const itemSummaries = items.map((i) => ({
      name: i.productNameSnapshot || i.product?.name || i.serviceNameSnapshot || i.name || "Item",
      quantity: i.quantity || 1,
      weightKg: i.weight || i.productVariant?.weight || null,
      dimensionsCm: {
        h: i.height || i.productVariant?.height || null,
        w: i.width || i.productVariant?.width || null,
        d: i.depth || i.productVariant?.depth || null,
      },
    }))

    const promptText = `You are an expert delivery logistics vehicle matching AI.
Analyze the following items for a delivery order package and classify the REQUIRED vehicle type.

Vehicle Types:
- "2_WHEELER": Small/lightweight items (smartwatches, watches, hair dryers, styling tools, phones, earbuds, clothes, books, cosmetics, small electronics <= 15kg).
- "3_WHEELER": Medium cargo/appliances (TVs, microwaves, desktop PCs, office chairs, air conditioners 15kg to 60kg).
- "4_WHEELER": Large/heavy freight (refrigerators, washing machines, beds, sofas, heavy commercial generators > 60kg or height > 140cm).

IMPORTANT ANOMALY CHECK:
Watch out for data-entry unit errors (e.g., grams entered as kg, such as entering 60 for a 60g or 600g hair dryer, watch, or phone; or millimeters entered as centimeters).
A watch, smartphone, hair dryer, or handheld personal item NEVER weighs 60 kg! If an item is obviously a handheld consumer product, treat its weight as realistic (~0.1kg - 0.8kg) and classify it as "2_WHEELER".

Items:
${JSON.stringify(itemSummaries, null, 2)}

Return ONLY a raw, valid JSON object with NO markdown syntax, formatted as:
{
  "requiredVehicle": "2_WHEELER" | "3_WHEELER" | "4_WHEELER",
  "compatibleVehicles": ["2_WHEELER"] | ["3_WHEELER", "4_WHEELER"] | ["4_WHEELER"],
  "reason": "Brief explanation of why this vehicle category is needed"
}`

    const geminiModels = [
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-3-flash-preview",
    ]

    for (const model of geminiModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const aiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
        })

        if (aiRes.ok) {
          const aiData = await aiRes.json()
          const candidateText =
            aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
          const cleanedText = candidateText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()

          const parsed = JSON.parse(cleanedText)
          if (
            parsed.requiredVehicle &&
            ["2_WHEELER", "3_WHEELER", "4_WHEELER"].includes(parsed.requiredVehicle)
          ) {
            const compatible: VehicleType[] = Array.isArray(parsed.compatibleVehicles)
              ? parsed.compatibleVehicles
              : parsed.requiredVehicle === "2_WHEELER"
              ? ["2_WHEELER"]
              : ["3_WHEELER", "4_WHEELER"]

            return {
              requiredVehicle: parsed.requiredVehicle,
              compatibleVehicles: compatible,
              reason: parsed.reason || heuristic.reason,
              estimatedWeightKg: heuristic.estimatedWeightKg,
              confidence: "AI_MODEL",
            }
          }
        }
      } catch {
        // Try next model
      }
    }
  } catch (err) {
    console.warn("[AIVehicleMatcher] AI classification failed, using heuristic:", err)
  }

  return heuristic
}
