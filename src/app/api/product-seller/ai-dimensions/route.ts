import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function getSmartFallbackDimensions(productName: string): { weight: number; height: number; width: number; depth: number } {
  const name = productName.toLowerCase()

  if (name.includes("fridge") || name.includes("refrigerator") || name.includes("freezer")) {
    return { weight: 55, height: 165, width: 65, depth: 60 }
  }
  if (name.includes("washing machine") || name.includes("washer") || name.includes("dryer")) {
    return { weight: 60, height: 85, width: 60, depth: 60 }
  }
  if (name.includes("tv") || name.includes("television") || name.includes("monitor")) {
    return { weight: 12, height: 70, width: 120, depth: 15 }
  }
  if (/\bac\b/.test(name) || name.includes("air conditioner")) {
    return { weight: 35, height: 45, width: 85, depth: 30 }
  }
  if (name.includes("sofa") || name.includes("couch") || name.includes("bed")) {
    return { weight: 45, height: 85, width: 180, depth: 90 }
  }
  if (name.includes("laptop") || name.includes("macbook") || name.includes("notebook")) {
    return { weight: 1.8, height: 2, width: 32, depth: 22 }
  }
  if (name.includes("phone") || name.includes("mobile") || name.includes("iphone") || name.includes("smartphone")) {
    return { weight: 0.2, height: 1.5, width: 7.5, depth: 15 }
  }
  if (name.includes("shoe") || name.includes("sneaker") || name.includes("footwear")) {
    return { weight: 0.9, height: 12, width: 22, depth: 32 }
  }
  if (name.includes("shirt") || name.includes("tshirt") || name.includes("pant") || name.includes("dress") || name.includes("cloth")) {
    return { weight: 0.3, height: 3, width: 25, depth: 30 }
  }

  // General default fallback
  return { weight: 1.5, height: 20, width: 20, depth: 15 }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : ""
    const productName = typeof body.productName === "string" ? body.productName.trim() : ""
    const variantName = typeof body.variantName === "string" ? body.variantName.trim() : ""
    const fullProductTitle = [productName, variantName && variantName !== "Default" ? variantName : ""].filter(Boolean).join(" - ")

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: "Image URL or Base64 is required" }, { status: 400 })
    }

    const fallback = getSmartFallbackDimensions(fullProductTitle || productName)

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_AI_KEY ||
      ""

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        warning: "GEMINI_API_KEY not configured in .env",
        dimensions: fallback,
      })
    }

    const promptText = `You are a product logistics expert. Analyze product image and item title "${fullProductTitle || productName}". Estimate realistic physical package/item shipping dimensions:
- weight in kg (floating number)
- height in cm (floating number)
- width in cm (floating number)
- depth in cm (floating number)

Return ONLY a valid, raw JSON object with no markdown syntax, formatted exactly as:
{"weight": 55, "height": 165, "width": 65, "depth": 60}`

    let imagePart: { inlineData: { mimeType: string; data: string } } | null = null

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")
      imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      }
    } else if (imageUrl && !imageUrl.startsWith("blob:")) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const mimeType = imgRes.headers.get("content-type") || "image/jpeg"
          const buffer = await imgRes.arrayBuffer()
          const base64Data = Buffer.from(buffer).toString("base64")
          imagePart = {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          }
        }
      } catch (e) {
        console.warn("Failed to fetch image URL in route:", e)
      }
    }

    const contents = imagePart
      ? [{ parts: [{ text: promptText }, imagePart] }]
      : [{ parts: [{ text: `${promptText}\nProduct Name: ${productName}` }] }]

    // Try working vision models first: gemini-flash-latest and gemini-3-flash-preview
    const geminiModels = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.0-flash"]
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
      return NextResponse.json({
        success: true,
        warning: "AI models unavailable, using smart heuristics fallback",
        dimensions: fallback,
      })
    }

    const weight = Math.max(0, Number(parsed.weight || fallback.weight))
    const height = Math.max(0, Number(parsed.height || fallback.height))
    const width = Math.max(0, Number(parsed.width || fallback.width))
    const depth = Math.max(0, Number(parsed.depth || fallback.depth))

    return NextResponse.json({
      success: true,
      dimensions: { weight, height, width, depth },
    })
  } catch (error: any) {
    console.error("AI Dimensions route exception:", error)
    return NextResponse.json({
      success: true,
      dimensions: { weight: 1.5, height: 20, width: 20, depth: 15 },
    })
  }
}
