import { NextRequest } from "next/server"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/pjpeg"]

export type HybridProductPayload = {
  name?: string
  categoryId?: string
  subcategoryId?: string | null
  description?: string
  condition?: "NEW" | "USED"
  deliveryChargePerKm?: number
  isActive?: boolean
  images?: string[] // Combined result (URLs)
  variants?: Array<{
    name?: string
    sku?: string
    price?: number
    discount?: number
    hasGst?: boolean
    stock?: number
    weight?: number
    images?: string[] // Combined result (URLs)
    attributes?: Record<string, any>
    specification?: string
    details?: string
    returnType?: "NON_RETURNABLE" | "RETURNABLE"
    returnDays?: number
    replacementAllowed?: boolean
  }>
}

/**
 * Extracts product data and handles file uploads from either JSON or FormData.
 */
export async function processHybridProductRequest(
  request: NextRequest
): Promise<{ ok: true; data: HybridProductPayload } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    try {
      const data = await request.json()
      return { ok: true, data }
    } catch (e) {
      return { ok: false, error: "Invalid JSON body" }
    }
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData()
      const dataStr = formData.get("data") as string
      let rawData: any = {}
      
      if (dataStr) {
        try {
          rawData = JSON.parse(dataStr)
        } catch (e) {
          return { ok: false, error: "Invalid JSON in 'data' field" }
        }
      } else {
        // Support flat fields if data JSON is missing
        rawData = {
          name: formData.get("name") as string,
          categoryId: formData.get("categoryId") as string,
          subcategoryId: formData.get("subcategoryId") as string,
          description: formData.get("description") as string,
          condition: formData.get("condition") as string,
          deliveryChargePerKm: Number(formData.get("deliveryChargePerKm") || 0),
          isActive: formData.get("isActive") === "true",
          images: [],
          variants: []
        }
      }

      // Handle main product images (URLs already in rawData.images)
      const mainImages: string[] = Array.isArray(rawData.images) ? [...rawData.images] : []
      const mainFiles = formData.getAll("file").concat(formData.getAll("images")) as File[]
      
      for (const file of mainFiles) {
        if (file && file.size > 0) {
          const url = await uploadAndGetUrl(file, "products", "mobile-product")
          mainImages.push(url)
        }
      }
      rawData.images = mainImages

      // Handle Variants
      if (Array.isArray(rawData.variants)) {
        for (let i = 0; i < rawData.variants.length; i++) {
          const variant = rawData.variants[i]
          const variantImages: string[] = Array.isArray(variant.images) ? [...variant.images] : []
          
          // Files named variant_file_0, variant_file_1, etc.
          const variantFiles = formData.getAll(`variant_file_${i}`).concat(formData.getAll(`variant_images_${i}`)) as File[]
          
          for (const file of variantFiles) {
            if (file && file.size > 0) {
              const url = await uploadAndGetUrl(file, "products/variants", "mobile-variant")
              variantImages.push(url)
            }
          }
          variant.images = variantImages
        }
      }

      return { ok: true, data: rawData }
    } catch (error: any) {
      return { ok: false, error: error.message || "Failed to process form data" }
    }
  }

  return { ok: false, error: "Unsupported Content-Type. Use application/json or multipart/form-data" }
}

async function uploadAndGetUrl(file: File, folder: string, prefix: string): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("File too large (max 10MB)")
  
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  }

  const type = file.type?.toLowerCase()
  const ext = path.extname(file.name).toLowerCase() || ".jpg"
  
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"]
    const baseExt = ext.replace(/^\./, "")
    if (!baseExt || !allowedExts.includes(baseExt)) {
      throw new Error("Invalid image type. Use JPEG, PNG, GIF, or WebP.")
    }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const resolvedType = mimeMap[ext] || type || "image/jpeg"

  return await uploadPublicFile({
    folder,
    ext,
    contentType: resolvedType,
    buffer,
    prefix,
  })
}
