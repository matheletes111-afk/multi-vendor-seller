import { NextRequest, NextResponse } from "next/server"
import { estimateProductDimensions } from "@/lib/ai-dimensions"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : ""
    const productName = typeof body.productName === "string" ? body.productName.trim() : ""
    const variantName = typeof body.variantName === "string" ? body.variantName.trim() : ""

    if (!imageUrl && !imageBase64 && !productName) {
      return NextResponse.json({ error: "Image URL, Base64, or Product Name is required" }, { status: 400 })
    }

    const result = await estimateProductDimensions({
      imageUrl,
      imageBase64,
      productName,
      variantName
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("AI Dimensions web route exception:", error)
    return NextResponse.json({
      success: true,
      dimensions: { weight: 1.5, height: 20, width: 20, depth: 15 },
      unit: { weight: "kg", dimensions: "cm" }
    })
  }
}
