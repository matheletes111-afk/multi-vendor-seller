import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"

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

async function validateAndUploadFoodImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File "${file.name}" is too large. Maximum allowed size is 10 MB.`)
  }

  const type = (file.type || "").toLowerCase().trim()
  const extFromName = path.extname(file.name || "").toLowerCase().trim()
  const isAllowedExt = ALLOWED_IMAGE_EXTS.includes(extFromName)
  const isAllowedMime = type && (ALLOWED_IMAGE_TYPES.includes(type) || (type.startsWith("image/") && type !== "image/svg+xml"))

  if (!isAllowedMime && !isAllowedExt) {
    throw new Error(`"${file.name}": Invalid file type. Please upload an image file (JPEG, PNG, WebP, HEIC, GIF, AVIF, BMP).`)
  }

  const ext = extFromName || (type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg")
  return await uploadPublicFile({
    folder: "foods",
    ext,
    contentType: file.type || "image/jpeg",
    buffer: Buffer.from(await file.arrayBuffer()),
    prefix: "food-img",
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { id } = await params
    const foodItem = await prisma.foodItem.findFirst({
      where: { id, restaurantSellerId: seller.id, isDeleted: false }
    })
    if (!foodItem) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: foodItem })
  } catch (error) {
    console.error("Web get single food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { id } = await params
    const foodItem = await prisma.foodItem.findFirst({
      where: { id, restaurantSellerId: seller.id, isDeleted: false }
    })
    if (!foodItem) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const name = sanitizeInput(formData.get("name") as string)
    const description = sanitizeInput(formData.get("description") as string || "")
    const priceRaw = formData.get("price")
    const category = sanitizeInput(formData.get("category") as string)
    const isVegRaw = formData.get("isVeg")
    const newImageFiles = formData.getAll("newImages") as File[]
    const existingImagesRaw = formData.get("existingImages") as string // JSON array of URLs to keep
    const imageFile = formData.get("image") as File | null // fallback

    const updateData: any = {}
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (category) updateData.category = category

    if (priceRaw) {
      const price = parseFloat(String(priceRaw))
      if (isNaN(price) || price < 0) {
        return NextResponse.json({ success: false, error: "Price must be a positive number" }, { status: 400 })
      }
      updateData.price = price
    }

    if (isVegRaw !== null && isVegRaw !== undefined) {
      updateData.isVeg = isVegRaw === "true" || isVegRaw === "1"
    }

    let existingImages: string[] = []
    if (existingImagesRaw) {
      try {
        existingImages = JSON.parse(existingImagesRaw)
      } catch (e) {
        existingImages = Array.isArray(foodItem.images) ? (foodItem.images as string[]) : []
      }
    } else {
      existingImages = Array.isArray(foodItem.images) ? (foodItem.images as string[]) : []
    }

    const imageUrls: string[] = [...existingImages]
    if (newImageFiles && newImageFiles.length > 0) {
      for (const file of newImageFiles) {
        if (file && file.size > 0) {
          const url = await validateAndUploadFoodImage(file)
          imageUrls.push(url)
        }
      }
    } else if (imageFile && imageFile.size > 0) {
      const url = await validateAndUploadFoodImage(imageFile)
      imageUrls.push(url)
    }

    updateData.images = imageUrls as any

    const updated = await prisma.foodItem.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error("Web update food item error:", error)
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { id } = await params
    const foodItem = await prisma.foodItem.findFirst({
      where: { id, restaurantSellerId: seller.id, isDeleted: false }
    })
    if (!foodItem) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    await prisma.foodItem.update({
      where: { id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true, message: "Food item deleted successfully" })
  } catch (error) {
    console.error("Web delete food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
