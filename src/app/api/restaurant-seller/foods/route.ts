import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"
import { computeFoodDiscount, readSellingPriceField, readImageUrlsField } from "@/lib/food-pricing"

export async function GET(request: NextRequest) {
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

    const foods = await prisma.foodItem.findMany({
      where: {
        restaurantSellerId: seller.id,
        isDeleted: false
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({ success: true, data: foods })
  } catch (error) {
    console.error("Web get food items error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

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

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const name = sanitizeInput(formData.get("name") as string)
    const description = sanitizeInput(formData.get("description") as string || "")
    const priceRaw = formData.get("price")
    const sellingPriceRaw = readSellingPriceField(formData)
    const category = sanitizeInput(formData.get("category") as string)
    const isVegRaw = formData.get("isVeg")
    const imageFiles = formData.getAll("images") as File[]
    const singleImageFile = formData.get("image") as File | null

    if (!name || !priceRaw || !category) {
      return NextResponse.json({ success: false, error: "Name, price, and category are required" }, { status: 400 })
    }

    const price = parseFloat(String(priceRaw))
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ success: false, error: "Price must be greater than 0" }, { status: 400 })
    }

    const discountResult = computeFoodDiscount(price, sellingPriceRaw)
    if (!discountResult.ok) {
      return NextResponse.json({ success: false, error: discountResult.error }, { status: 400 })
    }
    const discount = discountResult.discount ?? 0

    const isVeg = isVegRaw === "true" || isVegRaw === "1"

    const imageUrls: string[] = [...readImageUrlsField(formData)]
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        if (file && file.size > 0) {
          const url = await validateAndUploadFoodImage(file)
          imageUrls.push(url)
        }
      }
    } else if (singleImageFile && singleImageFile.size > 0) {
      const url = await validateAndUploadFoodImage(singleImageFile)
      imageUrls.push(url)
    }

    const foodItem = await prisma.foodItem.create({
      data: {
        restaurantSellerId: seller.id,
        name,
        description,
        price,
        discount,
        category,
        isVeg,
        images: imageUrls as any
      }
    })

    if (imageUrls.length > 0) {
      try {
        await prisma.restaurantMediaImage.updateMany({
          where: { restaurantSellerId: seller.id, url: { in: imageUrls } },
          data: { isUsed: true },
        })
      } catch (mediaErr) {
        console.warn("Could not mark media images as used:", mediaErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...foodItem,
        sellingPrice: Math.max(0, foodItem.price - (foodItem.discount || 0)),
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("Web create food item error:", error)
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 })
  }
}
