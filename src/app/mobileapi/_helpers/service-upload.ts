import { NextRequest } from "next/server"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/pjpeg"]

export type HybridServicePayload = {
  name?: string
  serviceCategoryId?: string
  description?: string | null
  serviceType?: "APPOINTMENT" | "FIXED_PRICE"
  basePrice?: number | null
  discount?: number
  hasGst?: boolean
  isActive?: boolean
  duration?: number | null
  weeklyAvailability?: any
  images?: string[] // Master images (Listing cover)
  galleryImages?: string[] // Additional gallery
}

/**
 * Extracts service data and handles file uploads from either JSON or FormData.
 */
export async function processHybridServiceRequest(
  request: NextRequest
): Promise<{ ok: true; data: HybridServicePayload } | { ok: false; error: string }> {
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
        // Flat fields fallback
        rawData = {
          name: formData.get("name") as string,
          serviceCategoryId: formData.get("serviceCategoryId") as string,
          description: formData.get("description") as string,
          serviceType: formData.get("serviceType") as string,
          basePrice: formData.get("basePrice") ? parseFloat(formData.get("basePrice") as string) : null,
          isActive: formData.get("isActive") === "true",
          images: [],
          galleryImages: []
        }
      }

      // 1. Process Master Images (Hero/Cover)
      const masterImages: string[] = Array.isArray(rawData.images) ? [...rawData.images] : []
      const masterFiles = formData.getAll("file").concat(formData.getAll("images")) as File[]
      
      for (const file of masterFiles) {
        if (file && file.size > 0) {
          const url = await uploadAndGetUrl(file, "services", "mobile-service")
          masterImages.push(url)
        }
      }
      rawData.images = masterImages

      // 2. Process Gallery Images
      const galleryImages: string[] = Array.isArray(rawData.galleryImages) ? [...rawData.galleryImages] : []
      const galleryFiles = formData.getAll("gallery_images").concat(formData.getAll("gallery_file")) as File[]
      
      for (const file of galleryFiles) {
        if (file && file.size > 0) {
          const url = await uploadAndGetUrl(file, "services/gallery", "mobile-gallery")
          galleryImages.push(url)
        }
      }
      rawData.galleryImages = galleryImages

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
