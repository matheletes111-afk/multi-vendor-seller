import { NextRequest, NextResponse } from "next/server"
import { estimateProductDimensions } from "@/lib/ai-dimensions"

export const dynamic = "force-dynamic"

async function extractParams(request: NextRequest) {
  let imageUrl = ""
  let imageBase64 = ""
  let imageBuffer: Buffer | undefined = undefined
  let mimeType = "image/jpeg"
  let productName = ""
  let variantName = ""

  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData()
      const file = (formData.get("image") || formData.get("file") || formData.get("photo")) as File | null
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer()
        imageBuffer = Buffer.from(arrayBuffer)
        mimeType = file.type || "image/jpeg"
      }

      imageUrl = (formData.get("imageUrl") || formData.get("image_url") || formData.get("url") || "") as string
      imageBase64 = (formData.get("imageBase64") || formData.get("image_base64") || formData.get("base64") || "") as string
      productName = (formData.get("productName") || formData.get("product_name") || formData.get("title") || formData.get("name") || "") as string
      variantName = (formData.get("variantName") || formData.get("variant_name") || formData.get("variant") || "") as string
    } catch (e) {
      console.warn("Error parsing multipart form data in mobileapi ai-dimensions:", e)
    }
  } else if (contentType.includes("application/json")) {
    try {
      const body = await request.json().catch(() => ({}))
      imageUrl = String(body.imageUrl || body.image_url || body.url || "").trim()
      imageBase64 = String(body.imageBase64 || body.image_base64 || body.base64 || "").trim()
      productName = String(body.productName || body.product_name || body.title || body.name || "").trim()
      variantName = String(body.variantName || body.variant_name || body.variant || "").trim()
    } catch (e) {
      console.warn("Error parsing JSON body in mobileapi ai-dimensions:", e)
    }
  }

  // Fallback to query params if parameters are missing
  const { searchParams } = new URL(request.url)
  if (!imageUrl) imageUrl = String(searchParams.get("imageUrl") || searchParams.get("image_url") || searchParams.get("url") || "").trim()
  if (!imageBase64) imageBase64 = String(searchParams.get("imageBase64") || searchParams.get("image_base64") || searchParams.get("base64") || "").trim()
  if (!productName) productName = String(searchParams.get("productName") || searchParams.get("product_name") || searchParams.get("title") || searchParams.get("name") || "").trim()
  if (!variantName) variantName = String(searchParams.get("variantName") || searchParams.get("variant_name") || searchParams.get("variant") || "").trim()

  return {
    imageUrl,
    imageBase64,
    imageBuffer,
    mimeType,
    productName,
    variantName
  }
}

export async function POST(request: NextRequest) {
  try {
    const params = await extractParams(request)
    const { imageUrl, imageBase64, imageBuffer, productName } = params

    if (!imageUrl && !imageBase64 && !imageBuffer && !productName) {
      return NextResponse.json(
        { error: "At least one input is required: image (File/URL/Base64) or product name/title" },
        { status: 400 }
      )
    }

    const result = await estimateProductDimensions(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /mobileapi/product-seller/ai-dimensions] Exception:", error)
    return NextResponse.json({
      success: true,
      dimensions: { weight: 1.5, height: 20, width: 20, depth: 15 },
      unit: { weight: "kg", dimensions: "cm" }
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = await extractParams(request)
    const { imageUrl, imageBase64, productName } = params

    if (!imageUrl && !imageBase64 && !productName) {
      return NextResponse.json(
        { error: "At least one query parameter is required: imageUrl or productName/title" },
        { status: 400 }
      )
    }

    const result = await estimateProductDimensions(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[GET /mobileapi/product-seller/ai-dimensions] Exception:", error)
    return NextResponse.json({
      success: true,
      dimensions: { weight: 1.5, height: 20, width: 20, depth: 15 },
      unit: { weight: "kg", dimensions: "cm" }
    })
  }
}
