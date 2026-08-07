export interface DimensionResult {
  weight: number // in kg
  height: number // in cm
  width: number  // in cm
  depth: number  // in cm
}

export interface AIDimensionResponse {
  success: boolean
  dimensions: DimensionResult
  unit?: {
    weight: string
    dimensions: string
  }
  warning?: string
}

export function getSmartFallbackDimensions(productName: string): DimensionResult {
  const name = (productName || "").toLowerCase()

  if (name.includes("fridge") || name.includes("refrigerator") || name.includes("freezer")) {
    return { weight: 55, height: 165, width: 65, depth: 60 }
  }
  if (name.includes("washing machine") || name.includes("washer") || name.includes("dryer")) {
    return { weight: 60, height: 85, width: 60, depth: 60 }
  }
  if (name.includes("tv") || name.includes("television") || name.includes("monitor")) {
    return { weight: 12, height: 70, width: 120, depth: 15 }
  }
  if (/\bac\b/.test(name) || name.includes("air conditioner") || name.includes("aircon")) {
    return { weight: 35, height: 45, width: 85, depth: 30 }
  }
  if (name.includes("sofa") || name.includes("couch") || name.includes("bed") || name.includes("mattress")) {
    return { weight: 45, height: 85, width: 180, depth: 90 }
  }
  if (name.includes("laptop") || name.includes("macbook") || name.includes("notebook")) {
    return { weight: 1.8, height: 2, width: 32, depth: 22 }
  }
  if (name.includes("phone") || name.includes("mobile") || name.includes("iphone") || name.includes("smartphone")) {
    return { weight: 0.2, height: 1.5, width: 7.5, depth: 15 }
  }
  if (name.includes("tablet") || name.includes("ipad")) {
    return { weight: 0.5, height: 1.0, width: 18, depth: 25 }
  }
  if (name.includes("shoe") || name.includes("sneaker") || name.includes("footwear") || name.includes("boot")) {
    return { weight: 0.9, height: 12, width: 22, depth: 32 }
  }
  if (name.includes("shirt") || name.includes("tshirt") || name.includes("pant") || name.includes("dress") || name.includes("cloth") || name.includes("jacket")) {
    return { weight: 0.3, height: 3, width: 25, depth: 30 }
  }
  if (name.includes("watch") || name.includes("smartwatch") || name.includes("jewelry")) {
    return { weight: 0.1, height: 5, width: 8, depth: 8 }
  }
  if (name.includes("headphone") || name.includes("earphone") || name.includes("airpods") || name.includes("audio")) {
    return { weight: 0.25, height: 6, width: 15, depth: 18 }
  }
  if (name.includes("bag") || name.includes("backpack") || name.includes("luggage") || name.includes("suitcase")) {
    return { weight: 1.2, height: 45, width: 30, depth: 20 }
  }
  if (name.includes("microwave") || name.includes("oven")) {
    return { weight: 14, height: 30, width: 48, depth: 38 }
  }
  if (name.includes("blender") || name.includes("juicer") || name.includes("mixer")) {
    return { weight: 3.5, height: 40, width: 20, depth: 20 }
  }

  // General default fallback
  return { weight: 1.5, height: 20, width: 20, depth: 15 }
}

export async function estimateProductDimensions(options: {
  imageUrl?: string
  imageBase64?: string
  imageBuffer?: Buffer
  mimeType?: string
  productName?: string
  variantName?: string
}): Promise<AIDimensionResponse> {
  const { imageUrl, imageBase64, imageBuffer, mimeType = "image/jpeg", productName = "", variantName = "" } = options
  const fullProductTitle = [productName, variantName && variantName !== "Default" ? variantName : ""].filter(Boolean).join(" - ")
  const fallback = getSmartFallbackDimensions(fullProductTitle || productName)

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    ""

  if (!apiKey) {
    return {
      success: true,
      warning: "GEMINI_API_KEY not configured in environment, using category heuristics",
      dimensions: fallback,
      unit: { weight: "kg", dimensions: "cm" }
    }
  }

  const promptText = `You are a product logistics expert. Analyze product image and item title "${fullProductTitle || productName}". Estimate realistic physical package/item shipping dimensions:
- weight in kg (floating number)
- height in cm (floating number)
- width in cm (floating number)
- depth in cm (floating number)

Return ONLY a valid, raw JSON object with no markdown syntax, formatted exactly as:
{"weight": 55, "height": 165, "width": 65, "depth": 60}`

  let imagePart: { inlineData: { mimeType: string; data: string } } | null = null

  if (imageBuffer) {
    imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: imageBuffer.toString("base64"),
      },
    }
  } else if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: cleanBase64,
      },
    }
  } else if (imageUrl && !imageUrl.startsWith("blob:")) {
    try {
      const imgRes = await fetch(imageUrl)
      if (imgRes.ok) {
        const detectedMime = imgRes.headers.get("content-type") || "image/jpeg"
        const buffer = await imgRes.arrayBuffer()
        const base64Data = Buffer.from(buffer).toString("base64")
        imagePart = {
          inlineData: {
            mimeType: detectedMime,
            data: base64Data,
          },
        }
      }
    } catch (e) {
      console.warn("Failed to fetch image URL in AI dimension helper:", e)
    }
  }

  const contents = imagePart
    ? [{ parts: [{ text: promptText }, imagePart] }]
    : [{ parts: [{ text: `${promptText}\nProduct Name: ${fullProductTitle || productName}` }] }]

  const geminiModels = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.0-flash", "gemini-1.5-flash"]
  let parsed: any = null

  for (const model of geminiModels) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const aiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const textOutput = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
          break
        }
      }
    } catch {
      // Continue to next model
    }
  }

  if (!parsed) {
    return {
      success: true,
      warning: "AI models unavailable, using smart heuristics fallback",
      dimensions: fallback,
      unit: { weight: "kg", dimensions: "cm" }
    }
  }

  const weight = Math.max(0, Number(parsed.weight || fallback.weight))
  const height = Math.max(0, Number(parsed.height || fallback.height))
  const width = Math.max(0, Number(parsed.width || fallback.width))
  const depth = Math.max(0, Number(parsed.depth || fallback.depth))

  return {
    success: true,
    dimensions: { weight, height, width, depth },
    unit: { weight: "kg", dimensions: "cm" }
  }
}
