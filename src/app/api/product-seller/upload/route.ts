import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB limit for incoming images (auto-compressed down to 1-2MB WebP)
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
]
const ALLOWED_IMAGE_EXTS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".tiff",
  ".tif",
]

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("heic")) return ".heic"
  if (ct.includes("heif")) return ".heif"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("png")) return ".png"
  if (ct.includes("gif")) return ".gif"
  if (ct.includes("avif")) return ".avif"
  if (ct.includes("bmp")) return ".bmp"
  if (ct.includes("tiff")) return ".tiff"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  return ".jpg"
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const purposeRaw = formData.get("purpose")
  const purpose = typeof purposeRaw === "string" ? purposeRaw.trim().toLowerCase() : ""

  /** Default: product catalog images. `delivery-proof` → order delivery proof (same S3 bucket, separate folder). */
  let folder = "products"
  let prefix = "product"
  if (purpose === "delivery-proof") {
    folder = "review-images/orders/delivery-proof"
    prefix = "delivery-proof"
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum allowed size is 10 MB." },
      { status: 400 }
    )
  }

  const type = (file.type || "").toLowerCase().trim()
  const extFromName = path.extname((file as { name?: string }).name || "").toLowerCase().trim()
  const isAllowedExt = ALLOWED_IMAGE_EXTS.includes(extFromName)
  const isAllowedMime = type && (ALLOWED_IMAGE_TYPES.includes(type) || (type.startsWith("image/") && type !== "image/svg+xml"))

  if (!isAllowedMime && !isAllowedExt) {
    return NextResponse.json(
      { error: "Invalid file type. Please upload an image file (JPEG, PNG, WebP, HEIC, GIF, AVIF, BMP)." },
      { status: 400 }
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const contentType = file.type || "image/jpeg"
    const extFromName = path.extname((file as { name?: string }).name || "")
    const ext = extFromName || getImageExtFromContentType(contentType)

    const url = await uploadPublicFile({
      folder,
      ext,
      contentType,
      buffer,
      prefix,
    })

    return NextResponse.json({ url })
  } catch (err) {
    console.error("Product image upload error:", err)
    const message = err instanceof Error ? err.message : "Failed to upload file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
