import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = "force-dynamic"

// PUT: Update an existing food item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

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
          const url = await uploadPublicFile({
            folder: "foods",
            ext: path.extname(file.name) || ".jpg",
            contentType: file.type || "image/jpeg",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "food-img"
          })
          imageUrls.push(url)
        }
      }
    } else if (imageFile && imageFile.size > 0) {
      const url = await uploadPublicFile({
        folder: "foods",
        ext: path.extname(imageFile.name) || ".jpg",
        contentType: imageFile.type || "image/jpeg",
        buffer: Buffer.from(await imageFile.arrayBuffer()),
        prefix: "food-img"
      })
      imageUrls.push(url)
    }

    updateData.images = imageUrls as any

    const updated = await prisma.foodItem.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      message: "Food item updated successfully",
      data: updated
    })
  } catch (error: any) {
    console.error("Mobile update food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a food item (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

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

    return NextResponse.json({
      success: true,
      message: "Food item deleted successfully"
    })
  } catch (error: any) {
    console.error("Mobile delete food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
